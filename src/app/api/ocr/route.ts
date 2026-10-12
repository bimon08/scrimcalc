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

  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Gemini API key not configured" },
      { status: 500 },
    );
  }

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
    const BATCH_SIZE = 4; // 4 images per API call for reliability + accuracy

    // Split images into batches
    const batches: File[][] = [];
    for (let i = 0; i < imageFiles.length; i += BATCH_SIZE) {
      batches.push(imageFiles.slice(i, i + BATCH_SIZE));
    }

    console.log(`Processing ${imageFiles.length} images in ${batches.length} batch(es) of up to ${BATCH_SIZE} — parallel`);

    /** Process a single batch: convert to base64, call Gemini with model fallback */
    const processBatch = async (batch: File[], batchIdx: number) => {
      const imageParts = await Promise.all(
        batch.map(async (file) => {
          const buffer = Buffer.from(await file.arrayBuffer());
          const base64 = buffer.toString("base64");
          return { inline_data: { mime_type: file.type || "image/jpeg", data: base64 } };
        }),
      );

      const requestBody = JSON.stringify({
        contents: [{ parts: [{ text: prompt }, ...imageParts] }],
        generationConfig: { temperature: 0, maxOutputTokens: 16384 },
      });

      let geminiResponse: Response | null = null;
      let usedModel = models[0];

      for (const model of models) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: requestBody,
        });

        if (res.ok) {
          geminiResponse = res;
          usedModel = model;
          break;
        }

        if (res.status === 404 || res.status === 503) {
          console.warn(`Batch ${batchIdx + 1}: Model ${model} unavailable (${res.status}), trying next...`);
          continue;
        }

        const errBody = await res.text();
        throw new Error(`Batch ${batchIdx + 1}: API error ${res.status} — ${errBody.slice(0, 200)}`);
      }

      if (!geminiResponse) {
        throw new Error(`Batch ${batchIdx + 1}: All Gemini models unavailable`);
      }

      const geminiResult = await geminiResponse.json();
      const textContent = geminiResult?.candidates?.[0]?.content?.parts?.[0]?.text;
      const usageMetadata = geminiResult?.usageMetadata;
      const inputTokens = usageMetadata?.promptTokenCount ?? 0;
      const outputTokens = usageMetadata?.candidatesTokenCount ?? 0;

      if (!textContent) {
        throw new Error(`Batch ${batchIdx + 1}: No response text from Gemini`);
      }

      console.log(`Batch ${batchIdx + 1}/${batches.length} done with ${usedModel} (${batch.length} imgs)`);

      const jsonStr = extractJson(textContent);
      const parsed = JSON.parse(jsonStr);
      return { data: parsed, inputTokens, outputTokens, model: usedModel };
    };

    // Run ALL batches in parallel
    const batchResults = await Promise.all(
      batches.map((batch, idx) => processBatch(batch, idx)),
    );

    const durationMs = Date.now() - startTime;

    // Merge batch results
    const mergedData = batchResults.length === 1
      ? batchResults[0].data
      : mergeBatchResults(batchResults.map((r) => r.data));

    // Sum up token usage across all batches
    const totalInputTokens = batchResults.reduce((sum, r) => sum + r.inputTokens, 0);
    const totalOutputTokens = batchResults.reduce((sum, r) => sum + r.outputTokens, 0);
    const usedModel = batchResults[batchResults.length - 1]?.model ?? "unknown";

    console.log(`OCR completed: ${batches.length} batches, ${imageFiles.length} images, ${durationMs}ms`);

    // Log successful API call
    await logApiUsage(caller.userId, userEmail, usedModel, imageFiles.length, totalInputTokens, totalOutputTokens, durationMs, "success");

    return NextResponse.json({ data: mergedData });
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
- Examples: "Alpine yVortex" → same person as "AlpineツVortex", "I4BxNICK" → "148xNick", "777sDawann" → "777sDawan"
- Use the EXACT in-game name as shown on screen in the output (do not substitute the registered name)

TASK:
1. Group images by match (same #1/#2 = same match). Label M1, M2, M3…
2. For each match, read EVERY position block: position number, exact player names (preserve Unicode/symbols), and kill counts
3. Match players to registered teams. Unmatched players → use group letters A, B, C…
4. NEVER merge two position blocks into one group. Each position block = exactly one group.
5. Do NOT calculate points. Only output positions and kills.
6. VERIFICATION: After extracting all data, re-read each kill count digit one more time. Compare the team's total kills against the sum of individual player kills for each match.

OUTPUT — wrap the JSON in a \`\`\`json code block. No explanation before the JSON:

{
  "matches_detected": 4,
  "groups": [
    {
      "group": "TeamName",
      "players": ["Player1", "Player2"],
      "matches": [
        {
          "match": 1,
          "position": 1,
          "playerKills": { "Player1": 5, "Player2": 3 }
        }
      ]
    }
  ]
}

RULES:
- One position block = one group entry. Never combine blocks.
- Player names EXACTLY as on screen — preserve all Unicode, CJK, special chars, superscripts, subscripts
- "players" = union of all unique players seen across ALL matches for that group
- Skip matches where a team doesn't appear at all
- After the JSON code block, on a new line: "Groups: X | Matches: Y" + list any unmatched teams`;
}
