import { NextResponse } from "next/server";
import { resolveAuth } from "@/lib/resolveAuth";
import { generatePrompt } from "@/lib/prompt";
import { Team } from "@/lib/types";
import { prisma } from "@/lib/prisma";

// Allow up to 300s (5 min) — 16+ full-res screenshots can take a while
export const maxDuration = 300;

/**
 * POST /api/ocr
 * Accepts FormData with:
 *   - images: File[] (screenshot files)
 *   - teams: string (JSON-stringified Team[])
 *
 * Sends images + prompt to Gemini Flash for OCR, returns the parsed JSON.
 */
export async function POST(req: Request) {
  const caller = await resolveAuth(req);
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get email for usage tracking
  const { auth: getAuth } = await import("@root/auth");
  const session = await getAuth();
  const userEmail = session?.user?.email ?? "unknown";

  // Support multiple API keys (comma-separated) for rotation on rate limits
  const apiKeys = (process.env.GEMINI_API_KEYS || process.env.GOOGLE_GEMINI_API_KEY || "")
    .split(",")
    .map(k => k.trim())
    .filter(Boolean);

  if (apiKeys.length === 0) {
    return NextResponse.json(
      { error: "Gemini API key not configured" },
      { status: 500 },
    );
  }

  console.log(`OCR: ${apiKeys.length} API key(s) available for rotation`);

  try {
    const formData = await req.formData();
    const teamsRaw = formData.get("teams") as string | null;
    const teams: Team[] = teamsRaw ? JSON.parse(teamsRaw) : [];

    // Collect image files
    const imageFiles: File[] = [];
    for (const [key, value] of formData.entries()) {
      if (key === "images" && value instanceof File) {
        imageFiles.push(value);
      }
    }

    if (imageFiles.length === 0) {
      return NextResponse.json(
        { error: "No images uploaded" },
        { status: 400 },
      );
    }

    const prompt = generateDirectPrompt(teams);
    const models = [
      "gemini-3.8-flash",
      "gemini-3.7-flash",
      "gemini-3.6-flash",
      "gemini-3.5-flash",
    ];

    const startTime = Date.now();

    // Convert all images to base64 once
    const imageParts = await Promise.all(
      imageFiles.map(async (file) => {
        const buffer = Buffer.from(await file.arrayBuffer());
        const base64 = buffer.toString("base64");
        return { inline_data: { mime_type: file.type || "image/jpeg", data: base64 } };
      }),
    );

    const requestBody = JSON.stringify({
      contents: [{ parts: [{ text: prompt }, ...imageParts] }],
      generationConfig: { temperature: 0, maxOutputTokens: 65536 },
    });

    console.log(`Processing ${imageFiles.length} images in single API call`);

    /** Delay helper */
    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

    // Try all combinations: key × model × retries
    let geminiResponse: Response | null = null;
    let usedModel = models[0];
    let usedKeyIdx = 0;

    outer:
    for (let keyIdx = 0; keyIdx < apiKeys.length; keyIdx++) {
      const currentKey = apiKeys[keyIdx];

      for (const model of models) {
        for (let attempt = 0; attempt < 3; attempt++) {
          if (attempt > 0) {
            const waitMs = 2000 * attempt; // 2s, 4s backoff
            console.log(`Key ${keyIdx + 1}: Retrying ${model} in ${waitMs}ms (attempt ${attempt + 1})...`);
            await delay(waitMs);
          }

          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${currentKey}`;
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: requestBody,
          });

          if (res.ok) {
            geminiResponse = res;
            usedModel = model;
            usedKeyIdx = keyIdx;
            break outer;
          }

          if (res.status === 503 || res.status === 429) {
            console.warn(`Key ${keyIdx + 1}: ${model} rate-limited (${res.status}), attempt ${attempt + 1}/3`);
            continue; // Retry same model
          }

          if (res.status === 404) {
            break; // Model deprecated, try next model
          }

          // If this key is invalid (400/401/403), skip to next key
          if (res.status === 400 || res.status === 401 || res.status === 403) {
            console.warn(`Key ${keyIdx + 1}: Invalid or forbidden (${res.status}), trying next key...`);
            continue outer; // skip remaining models+retries for this key
          }

          const errBody = await res.text();
          throw new Error(`API error ${res.status} — ${errBody.slice(0, 200)}`);
        }

        if (geminiResponse) break;
      }
    }

    if (!geminiResponse) {
      throw new Error(`All ${apiKeys.length} API key(s) × ${models.length} models exhausted after retries`);
    }

    console.log(`Success with key ${usedKeyIdx + 1}, model ${usedModel}`);

    const geminiResult = await geminiResponse.json();
    const textContent = geminiResult?.candidates?.[0]?.content?.parts?.[0]?.text;
    const usageMetadata = geminiResult?.usageMetadata;
    const inputTokens = usageMetadata?.promptTokenCount ?? 0;
    const outputTokens = usageMetadata?.candidatesTokenCount ?? 0;

    if (!textContent) {
      throw new Error("No response text from Gemini");
    }

    const jsonStr = extractJson(textContent);
    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      const repaired = repairJson(jsonStr);
      parsed = JSON.parse(repaired);
      console.log("JSON was truncated, auto-repaired");
    }

    const durationMs = Date.now() - startTime;
    console.log(`OCR completed: ${imageFiles.length} images, ${durationMs}ms, key ${usedKeyIdx + 1}, model ${usedModel}`);

    // Log successful API call
    await logApiUsage(caller.userId, userEmail, usedModel, imageFiles.length, inputTokens, outputTokens, durationMs, "success");

    return NextResponse.json({ data: parsed });
  } catch (err: unknown) {
    console.error("OCR route error:", err);
    const message =
      err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Log API usage to the database (fire-and-forget, never blocks response) */
async function logApiUsage(
  userId: string,
  userEmail: string,
  model: string,
  imageCount: number,
  inputTokens: number,
  outputTokens: number,
  durationMs: number,
  status: string,
  errorMessage?: string,
) {
  try {
    await prisma.apiUsage.create({
      data: { userId, userEmail, model, imageCount, inputTokens, outputTokens, durationMs, status, errorMessage },
    });
  } catch (e) {
    console.error("Failed to log API usage:", e);
  }
}

/** Extract JSON from Gemini response text */
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const braceStart = text.indexOf("{");
  const braceEnd = text.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd > braceStart)
    return text.slice(braceStart, braceEnd + 1);
  return text.trim();
}

/** Repair truncated/malformed JSON — close unclosed brackets, fix trailing commas */
function repairJson(jsonStr: string): string {
  let s = jsonStr.trim();

  // Walk backwards to find the last "complete" token
  while (s.length > 0) {
    const last = s[s.length - 1];
    if (last === '}' || last === ']' || last === '"' || last === 'e' || last === 'l' || /\d/.test(last)) break;
    s = s.slice(0, -1);
  }

  // Remove trailing commas before closing brackets
  s = s.replace(/,\s*([\]}])/g, '$1');

  try { JSON.parse(s); return s; } catch { /* needs more repair */ }

  // Track open brackets
  const stack: string[] = [];
  let inString = false;
  let escape = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') stack.push('}');
    else if (ch === '[') stack.push(']');
    else if (ch === '}' || ch === ']') stack.pop();
  }

  if (inString) s += '"';
  s = s.replace(/,\s*$/, '');
  s = s.replace(/:\s*$/, ': null');
  s = s.replace(/,\s*([\]}])/g, '$1');

  while (stack.length > 0) {
    const closer = stack.pop()!;
    s = s.replace(/,\s*$/, '');
    s += closer;
  }

  return s;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Merge results from multiple batches into a single GeminiOutput.
 *  Each batch returns its own match numbering (1,2,3...).
 *  We renumber them sequentially across batches:
 *    Batch 0 matches: 1,2,3,4
 *    Batch 1 matches: 5,6,7,8
 *    etc.
 *  Groups with the same name across batches are merged.
 */
function mergeBatchResults(batchDatas: Record<string, any>[]): Record<string, any> {
  const groupMap = new Map<string, any>();
  let totalMatches = 0;

  for (const batchData of batchDatas) {
    const batchMatchCount = batchData.matches_detected || 0;
    const matchOffset = totalMatches; // Offset for renumbering

    for (const group of (batchData.groups || [])) {
      const key = (group.group || "").toUpperCase().trim();
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          group: group.group,
          players: [...(group.players || [])],
          matches: [],
        });
      }

      const existing = groupMap.get(key)!;

      // Merge players (deduplicate)
      for (const p of (group.players || [])) {
        if (!existing.players.includes(p)) {
          existing.players.push(p);
        }
      }

      // Add matches with renumbered match numbers
      for (const match of (group.matches || [])) {
        existing.matches.push({
          ...match,
          match: match.match + matchOffset,
        });
      }
    }

    totalMatches += batchMatchCount;
  }

  return {
    matches_detected: totalMatches,
    groups: Array.from(groupMap.values()),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Direct prompt for API-based OCR (no multi-turn upload flow needed).
 * Gemini sees all images at once.
 */
function generateDirectPrompt(teams: Team[]): string {
  const hasTeams = teams.length > 0;

  const rosterSection = hasTeams
    ? `\nREGISTERED TEAMS (${teams.length}):
${teams
  .map((t, i) => {
    const playerList =
      t.players && t.players.length > 0
        ? ` — Players: ${t.players.join(", ")}`
        : "";
    return `${i + 1}. ${t.name}${playerList}`;
  })
  .join("\n")}
`
    : "";

  return `Extract BGMI scoreboard stats from the screenshots provided.
${rosterSection}
BGMI SCOREBOARD LAYOUT:
- LEFT PANEL: #1 (crown icon) and #2 (silver icon) teams — each shows player rows: "[Name] ... [N finishes]"
- RIGHT PANEL: Positions #3–#14 in separate blocks, each block has a position header + player rows
- Each player row: "[PlayerName]    [N finishes]" — the digit BEFORE the word "finishes" is their KILL COUNT
- Players in the same position block = teammates (max 4 per squad)
- Multiple screenshots per match (scrollable view). Same #1 and #2 teams = same match.
- Read ALL position blocks visible, including partially visible ones at screen edges.

DIGIT READING — CRITICAL:
- Zoom into each "N finishes" text mentally. The digit is small but distinct:
  • "1 finishes" has a single vertical stroke with a small top serif — do NOT confuse with "0" (round/oval shape)
  • "3 finishes" has two curved bumps on the right — do NOT confuse with "2" (flat bottom horizontal stroke)
  • "0 finishes" is a closed oval/circle — only output 0 if you clearly see the oval
- If a digit is ambiguous between 0 and 1, lean toward 1 (1-kill is far more common than 0-kill for a visible player)
- NEVER default any kill count to 0. Read each one individually.

PLAYER NAME MATCHING:
- If a registered team roster is provided above, match each in-game name to the closest registered player
- In-game names often differ slightly from registered names (extra symbols, case changes, Unicode variants)
- Use the EXACT in-game name as shown on screen in the output (do not substitute the registered name)

TASK:
1. Group images by match (same #1/#2 = same match). Label M1, M2, M3…
2. For each match, read EVERY position block: position number, exact player names (preserve Unicode/symbols), and kill counts
3. Match players to registered teams. Unmatched players → use group letters A, B, C…
4. NEVER merge two position blocks into one group. Each position block = exactly one group.
5. Do NOT calculate points. Only output positions and kills.
6. VERIFICATION: After extracting all data, re-read each kill count digit one more time.

OUTPUT FORMAT — CRITICAL RULES:
- Wrap the JSON in a \`\`\`json code block
- Output COMPACT/MINIFIED JSON on a single line (no indentation, no newlines inside the JSON)
- The ENTIRE JSON must be complete and valid — never stop mid-way
- Do NOT write anything after the closing \`\`\` of the code block — no summary, no explanation, nothing

Example output format:
\`\`\`json
{"matches_detected":4,"groups":[{"group":"TeamName","players":["Player1","Player2"],"matches":[{"match":1,"position":1,"playerKills":{"Player1":5,"Player2":3}}]}]}
\`\`\`

RULES:
- One position block = one group entry. Never combine blocks.
- Player names EXACTLY as on screen — preserve all Unicode, CJK, special chars, superscripts, subscripts
- "players" = union of all unique players seen across ALL matches for that group
- Skip matches where a team doesn't appear at all`;
}
