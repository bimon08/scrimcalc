"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { Trash2, X, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ClipboardPaste, Trophy, Upload, Camera, Loader2, ImageIcon, X as XIcon, Eye, Plus } from "lucide-react";
import { toast } from "sonner";
import { Tournament, AssignedGroup, StandingRow, DEFAULT_BGMI_POINTS, Team } from "@/lib/types";
import GroupFilterDropdown from "./GroupFilterDropdown";

// ── Client-side OCR helpers (replicate server logic for direct browser → Gemini calls) ──

/** Build the Gemini prompt for direct OCR (all images in one call) */
function buildDirectPrompt(teams: Team[]): string {
  const hasTeams = teams.length > 0;

  const rosterSection = hasTeams
    ? `\nREGISTERED TEAMS (${teams.length}):\n${teams
    .map((t, i) => {
      const playerList =
        t.players && t.players.length > 0
          ? ` — Players: ${t.players.join(", ")}`
          : "";
      return `${i + 1}. ${t.name}${playerList}`;
    })
    .join("\n")}\n`
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
- Wrap the JSON in a \\\`\\\`\\\`json code block
- Output COMPACT/MINIFIED JSON on a single line (no indentation, no newlines inside the JSON)
- The ENTIRE JSON must be complete and valid — never stop mid-way
- Do NOT write anything after the closing \\\`\\\`\\\` of the code block — no summary, no explanation, nothing

Example output format:
\\\`\\\`\\\`json
{"matches_detected":4,"groups":[{"group":"TeamName","players":["Player1","Player2"],"matches":[{"match":1,"position":1,"playerKills":{"Player1":5,"Player2":3}}]}]}
\\\`\\\`\\\`

RULES:
- One position block = one group entry. Never combine blocks.
- Player names EXACTLY as on screen — preserve all Unicode, CJK, special chars, superscripts, subscripts
- "players" = union of all unique players seen across ALL matches for that group
- Skip matches where a team doesn't appear at all`;
}

/** Extract JSON from Gemini response text */
function extractJsonFromText(text: string): string {
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const braceStart = text.indexOf("{");
  const braceEnd = text.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd > braceStart)
    return text.slice(braceStart, braceEnd + 1);
  return text.trim();
}

/** Repair truncated/malformed JSON — close unclosed brackets, fix trailing commas */
function repairTruncatedJson(jsonStr: string): string {
  let s = jsonStr.trim();

  while (s.length > 0) {
    const last = s[s.length - 1];
    if (last === '}' || last === ']' || last === '"' || last === 'e' || last === 'l' || /\d/.test(last)) break;
    s = s.slice(0, -1);
  }

  s = s.replace(/,\s*([\]}])/g, '$1');

  try { JSON.parse(s); return s; } catch { /* needs more repair */ }

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

interface Props {
  tournament: Tournament;
  groups: AssignedGroup[];
  assignments: Record<string, string>;
  matchesDetected: number;
  standings: StandingRow[];
  groupFilter: string;
  setGroupFilter: (v: string) => void;
  onAssignTeam: (groupLabel: string, teamId: string) => void;
  onUnassignTeam: (groupLabel: string) => void;
  onCopyPrompt: () => void;
  onPasteJson: () => void;
  onClearData: () => void;
  onClose: () => void;
  onOcrResult?: (json: string) => void;

}

export default function CalculateScreen({
  tournament, groups, assignments, matchesDetected, groupFilter, setGroupFilter,
  onAssignTeam, onUnassignTeam, onCopyPrompt, onPasteJson, onClearData, onClose,
  onOcrResult,
}: Props) {
  const [selectedMatch, setSelectedMatch] = useState<number | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // OCR upload state
  const [calcTab, setCalcTab] = useState<"manual" | "auto">("manual");
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadPreviews, setUploadPreviews] = useState<string[]>([]);
  const [previewModalIndex, setPreviewModalIndex] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStage, setProcessStage] = useState("");
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [showAddMatches, setShowAddMatches] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // ── Screen Wake Lock + beforeunload guard while processing ──
  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try { await wakeLockRef.current.release(); } catch { /* ignore */ }
      wakeLockRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isProcessing) {
      releaseWakeLock();
      return;
    }

    // Request Wake Lock to keep screen on during scan
    let cancelled = false;
    (async () => {
      try {
        if ("wakeLock" in navigator) {
          const lock = await navigator.wakeLock.request("screen");
          if (cancelled) { lock.release(); return; }
          wakeLockRef.current = lock;
        }
      } catch { /* Wake Lock not supported or denied — non-critical */ }
    })();

    // Warn user if they try to leave/close while processing
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      cancelled = true;
      releaseWakeLock();
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isProcessing, releaseWakeLock]);


  const toggleExpand = (g: string) => setExpandedGroups(p => { const n = new Set(p); n.has(g) ? n.delete(g) : n.add(g); return n; });
  const assignedTeamIds = new Set(Object.values(assignments));

  const getTopKiller = (group: AssignedGroup) => {
    const m = new Map<string, number>();
    group.matches.forEach((match) => Object.entries(match.playerKills).forEach(([n, k]) => m.set(n, (m.get(n) || 0) + k)));
    let tn = "", tk = 0; m.forEach((k, n) => { if (k > tk) { tn = n; tk = k; } }); return { name: tn, kills: tk };
  };

  const filteredGroups = groups.filter(g => {
    if (!tournament.splitEnabled || groupFilter === "all") return true;
    const teamId = g.teamId || assignments[g.group];
    if (!teamId) return true;
    const team = tournament.teams.find(t => t.id === teamId);
    return team?.group === groupFilter;
  });

  // ── OCR upload handlers ──
  const MAX_SCREENSHOTS = 40;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    let newFiles = [...uploadFiles, ...files];
    if (newFiles.length > MAX_SCREENSHOTS) {
      toast.error(`Max ${MAX_SCREENSHOTS} screenshots allowed`);
      newFiles = newFiles.slice(0, MAX_SCREENSHOTS);
    }
    setUploadFiles(newFiles);
    const newPreviews = [...uploadPreviews];
    files.slice(0, MAX_SCREENSHOTS - uploadFiles.length).forEach((f) => {
      newPreviews.push(URL.createObjectURL(f));
    });
    setUploadPreviews(newPreviews.slice(0, MAX_SCREENSHOTS));
    setOcrError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (idx: number) => {
    URL.revokeObjectURL(uploadPreviews[idx]);
    setUploadFiles((prev) => prev.filter((_, i) => i !== idx));
    setUploadPreviews((prev) => {
      const updated = prev.filter((_, i) => i !== idx);
      setPreviewModalIndex((curr) => {
        if (curr === null) return null;
        if (updated.length === 0) return null;
        if (curr === idx) return Math.min(curr, updated.length - 1);
        if (curr > idx) return curr - 1;
        return curr;
      });
      return updated;
    });
  };

  // Keyboard navigation for image preview lightbox
  useEffect(() => {
    if (previewModalIndex === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewModalIndex(null);
      else if (e.key === "ArrowLeft") {
        setPreviewModalIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : uploadPreviews.length - 1));
      } else if (e.key === "ArrowRight") {
        setPreviewModalIndex((prev) => (prev !== null && prev < uploadPreviews.length - 1 ? prev + 1 : 0));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewModalIndex, uploadPreviews.length]);

  // Prepare image: resize to 1920px max width for fast upload + accurate OCR
  const prepareImage = async (file: File): Promise<Blob> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, 1920 / img.width);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d")!;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => resolve(blob!), "image/jpeg", 0.9);
      };
      img.src = URL.createObjectURL(file);
    });
  };

  const handleOcrSubmit = async () => {
    if (uploadFiles.length === 0) {
      toast.error("Add at least one screenshot");
      return;
    }
    setIsProcessing(true);
    setProcessStage("Connecting…");
    setOcrError(null);

    const startTime = Date.now();

    try {
      // 1. Get API key from server (only returned to authenticated users)
      const configRes = await fetch("/api/ocr/config");
      if (!configRes.ok) {
        const body = await configRes.json().catch(() => ({}));
        throw new Error(body.error || "Failed to get OCR config");
      }
      const { key, models } = await configRes.json() as { key: string; models: string[] };

      // 2. Build the prompt
      const activeTeams = tournament.teams.filter((t) => !t.out);
      const prompt = buildDirectPrompt(activeTeams);

      // 3. Convert images to base64
      setProcessStage(`Preparing ${uploadFiles.length} image${uploadFiles.length > 1 ? "s" : ""}…`);
      const imageParts = await Promise.all(
        uploadFiles.map(async (file) => {
          const prepared = await prepareImage(file);
          const arrayBuffer = await prepared.arrayBuffer();
          const base64 = btoa(
            new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
          );
          return { inline_data: { mime_type: "image/jpeg", data: base64 } };
        })
      );

      const requestBody = JSON.stringify({
        contents: [{ parts: [{ text: prompt }, ...imageParts] }],
        generationConfig: { temperature: 0, maxOutputTokens: 65536 },
      });

      // 4. Call Gemini directly from browser (uses user's residential IP, not Vercel's)
      setProcessStage("Uploading to AI…");
      let geminiResult: Record<string, unknown> | null = null;
      let usedModel = models[0];

      for (const model of models) {
        for (let attempt = 0; attempt < 3; attempt++) {
          if (attempt > 0) await new Promise(r => setTimeout(r, 2000 * attempt));

          try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
            const res = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: requestBody,
            });

            if (res.ok) {
              setProcessStage("Reading scoreboards…");
              geminiResult = await res.json();
              usedModel = model;
              break;
            }

            if (res.status === 503 || res.status === 429) continue; // retry
            if (res.status === 404) break; // model deprecated, try next
            if (res.status === 400 || res.status === 401 || res.status === 403) break; // bad key, try next model

            const errBody = await res.text();
            throw new Error(`API error ${res.status} — ${errBody.slice(0, 200)}`);
          } catch (fetchErr) {
            if (attempt === 2) throw fetchErr;
          }
        }
        if (geminiResult) break;
      }

      if (!geminiResult) {
        throw new Error("All API models exhausted — please try again");
      }

      // 5. Parse response
      setProcessStage("Extracting match data…");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const textContent = (geminiResult as any)?.candidates?.[0]?.content?.parts?.[0]?.text;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const usageMetadata = (geminiResult as any)?.usageMetadata;
      const inputTokens = usageMetadata?.promptTokenCount ?? 0;
      const outputTokens = usageMetadata?.candidatesTokenCount ?? 0;

      if (!textContent) throw new Error("No response text from Gemini");

      const jsonStr = extractJsonFromText(textContent);
      let parsed;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        const repaired = repairTruncatedJson(jsonStr);
        parsed = JSON.parse(repaired);
      }

      const durationMs = Date.now() - startTime;

      // 6. Log usage (fire-and-forget)
      fetch("/api/ocr/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: usedModel, imageCount: uploadFiles.length, inputTokens, outputTokens, durationMs, status: "success" }),
      }).catch(() => {});

      // 7. Apply result
      setProcessStage("Done ✓");
      if (onOcrResult) onOcrResult(JSON.stringify(parsed, null, 2));
      uploadPreviews.forEach((p) => URL.revokeObjectURL(p));
      setUploadFiles([]);
      setUploadPreviews([]);
      setShowAddMatches(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "OCR failed";
      setOcrError(msg);
      toast.error(msg);

      // Log failure
      fetch("/api/ocr/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "unknown", imageCount: uploadFiles.length, inputTokens: 0, outputTokens: 0, durationMs: Date.now() - startTime, status: "error", errorMessage: msg }),
      }).catch(() => {});
    } finally {
      setIsProcessing(false);
      setProcessStage("");
    }
  };

  // Contextual delete label
  const deleteLabel = selectedMatch !== null ? `Delete M${selectedMatch}` : "Clear all data";

  return (
    <div className="fixed inset-0 z-[55] overflow-y-auto" style={{ background: "#0c0914" }}>
      <div className="max-w-3xl mx-auto px-4 pt-4 pb-32">

        {/* ═══ Top Bar ═══ */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={onClose} className="shrink-0 h-9 w-9 rounded-xl flex items-center justify-center transition-all active:scale-90" style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.2)" }}>
              <ChevronLeft className="h-4 w-4" style={{ color: "#a78bfa" }} />
            </button>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-white truncate">{tournament.name}</h1>
              <p className="text-[11px] mt-0.5" style={{ color: "rgba(167,139,250,0.45)" }}>
                {groups.length > 0 ? `${filteredGroups.length} teams · ${matchesDetected} match${matchesDetected !== 1 ? "es" : ""}` : "Calculate results"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {groups.length > 0 && (
              <>
                <button onClick={onCopyPrompt} className="h-8 px-3 rounded-lg flex items-center gap-1.5 text-[11px] font-semibold transition-all active:scale-95" style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.15)", color: "#a78bfa" }} title="Copy Prompt">
                  <ClipboardPaste className="h-3 w-3" /> Copy
                </button>
                <button onClick={onPasteJson} className="h-8 px-3 rounded-lg flex items-center gap-1.5 text-[11px] font-semibold transition-all active:scale-95" style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.25)", color: "#c4b5fd" }} title="Paste JSON">
                  <ClipboardPaste className="h-3 w-3" /> Paste
                </button>
              </>
            )}
            {tournament.splitEnabled && <GroupFilterDropdown value={groupFilter} onChange={setGroupFilter} groupCount={tournament.groupCount ?? 2} showFinal={tournament.teams.some(t => t.group === "final")} />}
          </div>
        </div>

        {groups.length === 0 ? (
          /* ═══ Empty State — Input Methods ═══ */
          <div className="mt-4 space-y-3">
            {/* Tab bar */}
            <div className="flex rounded-xl p-1" style={{ background: "rgba(24,24,27,0.6)", border: "1px solid rgba(63,63,70,0.3)" }}>
              <button
                onClick={() => setCalcTab("auto")}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-all"
                style={calcTab === "auto"
                  ? { background: "linear-gradient(135deg, #059669, #10b981)", color: "#fff", boxShadow: "0 2px 12px rgba(16,185,129,0.3)" }
                  : { color: "rgba(52,211,153,0.5)" }
                }
              >
                <Camera className="h-3.5 w-3.5" />
                <span>Auto Scan</span>
                <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wider leading-none" style={calcTab === "auto" ? { background: "rgba(0,0,0,0.25)", color: "#d1fae5" } : { background: "rgba(16,185,129,0.15)", color: "rgba(52,211,153,0.7)" }}>Beta</span>
              </button>
              <button
                onClick={() => setCalcTab("manual")}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-all"
                style={calcTab === "manual"
                  ? { background: "linear-gradient(135deg,#7c3aed,#9333ea)", color: "#fff", boxShadow: "0 2px 12px rgba(124,58,237,0.3)" }
                  : { color: "rgba(167,139,250,0.5)" }
                }
              >
                <ClipboardPaste className="h-3.5 w-3.5" /> Manual
              </button>
            </div>

            {calcTab === "manual" ? (
              /* ── Manual tab ── */
              <div className="rounded-2xl p-4" style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)" }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(124,58,237,0.2)" }}>
                    <ClipboardPaste className="h-5 w-5" style={{ color: "#a78bfa" }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-white">Manual Mode</p>
                    <p className="text-[11px] mt-0.5" style={{ color: "rgba(167,139,250,0.5)" }}>Copy prompt → Gemini → paste JSON back</p>
                  </div>
                </div>
                <div className="space-y-2.5">
                  {[
                    { step: "1", title: "Copy the prompt", desc: "Tap below, then paste it in Gemini" },
                    { step: "2", title: "Upload screenshots", desc: "Send match result screenshots in the next message" },
                    { step: "3", title: "Copy the JSON", desc: "Gemini responds with JSON — copy it" },
                    { step: "4", title: "Paste it here", desc: "Come back and tap Paste" },
                  ].map((s) => (
                    <div key={s.step} className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-lg shrink-0 flex items-center justify-center text-[10px] font-black" style={{ background: "rgba(124,58,237,0.25)", color: "#c4b5fd" }}>{s.step}</div>
                      <div className="flex-1">
                        <p className="text-[11px] font-bold text-white leading-tight">{s.title}</p>
                        <p className="text-[10px] leading-snug" style={{ color: "rgba(167,139,250,0.5)" }}>{s.desc}</p>
                      </div>
                    </div>
                  ))}
                  <div className="pt-2 flex gap-2">
                    <button onClick={onCopyPrompt} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-all active:scale-[0.97]" style={{ background: "linear-gradient(135deg,#7c3aed,#9333ea)", boxShadow: "0 4px 20px rgba(124,58,237,0.35)" }}>Copy Prompt</button>
                    <button onClick={onPasteJson} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all active:scale-[0.97]" style={{ background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.3)", color: "#c4b5fd" }}>
                      <ClipboardPaste className="h-4 w-4" /> Paste
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* ── Auto Scan tab ── */
              <div className="rounded-2xl p-4 space-y-3" style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.06), rgba(5,150,105,0.03))", border: "1px solid rgba(16,185,129,0.2)" }}>
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(16,185,129,0.15)" }}>
                    <Camera className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">Upload Screenshots</p>
                    <p className="text-[10px]" style={{ color: "rgba(52,211,153,0.5)" }}>AI reads scoreboards instantly · max {MAX_SCREENSHOTS}</p>
                  </div>
                </div>

                {uploadPreviews.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                    {uploadPreviews.map((src, idx) => (
                      <div key={idx} onClick={() => setPreviewModalIndex(idx)} className="relative shrink-0 h-[72px] w-[72px] rounded-lg overflow-hidden border cursor-pointer group active:scale-95 transition-all" style={{ borderColor: "rgba(16,185,129,0.3)" }}>
                        <img src={src} alt={`Screenshot ${idx + 1}`} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/35 transition-colors flex items-center justify-center pointer-events-none">
                          <Eye className="h-3.5 w-3.5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); removeFile(idx); }} className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full flex items-center justify-center bg-black/80 hover:bg-red-600 text-white transition-all active:scale-90 z-10"><XIcon className="h-2.5 w-2.5" /></button>
                        <span className="absolute bottom-0.5 left-0.5 text-[8px] font-bold px-1 rounded bg-black/60 text-white z-10 pointer-events-none">{idx + 1}</span>
                      </div>
                    ))}
                  </div>
                )}

                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileSelect} className="hidden" id="ocr-file-input" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                  className="w-full flex items-center justify-center gap-3 py-4 rounded-xl border-2 border-dashed transition-all active:scale-[0.98]"
                  style={{ borderColor: uploadFiles.length > 0 ? "rgba(16,185,129,0.3)" : "rgba(63,63,70,0.5)", background: uploadFiles.length > 0 ? "rgba(16,185,129,0.03)" : "rgba(24,24,27,0.3)" }}
                >
                  <Upload className="h-5 w-5 text-emerald-400/60" />
                  <p className="text-xs font-semibold" style={{ color: uploadFiles.length > 0 ? "#34d399" : "rgba(161,161,170,0.7)" }}>
                    {uploadFiles.length > 0 ? `${uploadFiles.length} screenshot${uploadFiles.length > 1 ? "s" : ""} added · tap for more` : "Tap to add screenshots"}
                  </p>
                </button>

                {ocrError && (
                  <div className="px-3 py-2 rounded-lg text-xs" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}>{ocrError}</div>
                )}

                <button
                  onClick={handleOcrSubmit}
                  disabled={uploadFiles.length === 0 || isProcessing}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold text-white transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: isProcessing ? "rgba(16,185,129,0.25)" : "linear-gradient(135deg, #059669, #10b981)", boxShadow: isProcessing ? "none" : "0 4px 20px rgba(16,185,129,0.3)" }}
                >
                  {isProcessing ? (<><Loader2 className="h-4 w-4 animate-spin" /> {processStage || "Processing…"}</>) : (<><ImageIcon className="h-4 w-4" /> Scan {uploadFiles.length} Screenshot{uploadFiles.length !== 1 ? "s" : ""}</>)}
                </button>

                {isProcessing && (
                  <p className="text-[10px] text-center animate-pulse" style={{ color: "rgba(52,211,153,0.5)" }}>
                    📱 Please keep screen on while processing…
                  </p>
                )}

                <p className="text-[10px] text-center" style={{ color: "rgba(52,211,153,0.25)" }}>Processed by Gemini AI · no data stored</p>
              </div>
            )}
          </div>
        ) : (
          /* ═══ Results View — Groups + Matches ═══ */
          <>
            {/* Add More Matches panel */}
            {showAddMatches && (
              <div className="mb-4 rounded-2xl p-4 space-y-3" style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.06), rgba(5,150,105,0.03))", border: "1px solid rgba(16,185,129,0.2)" }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(16,185,129,0.15)" }}>
                      <Camera className="h-3.5 w-3.5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">Add More Matches</p>
                      <p className="text-[10px]" style={{ color: "rgba(52,211,153,0.45)" }}>New matches merge with existing data</p>
                    </div>
                  </div>
                  <button onClick={() => { setShowAddMatches(false); uploadPreviews.forEach((p) => URL.revokeObjectURL(p)); setUploadFiles([]); setUploadPreviews([]); setOcrError(null); }} className="p-1.5 rounded-lg transition-colors" style={{ color: "rgba(52,211,153,0.4)" }}><X className="h-4 w-4" /></button>
                </div>

                {uploadPreviews.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                    {uploadPreviews.map((src, idx) => (
                      <div key={idx} onClick={() => setPreviewModalIndex(idx)} className="relative shrink-0 h-16 w-16 rounded-lg overflow-hidden border cursor-pointer group active:scale-95 transition-all" style={{ borderColor: "rgba(16,185,129,0.3)" }}>
                        <img src={src} alt={`Screenshot ${idx + 1}`} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/35 transition-colors flex items-center justify-center pointer-events-none">
                          <Eye className="h-3 w-3 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); removeFile(idx); }} className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full flex items-center justify-center bg-black/80 hover:bg-red-600 text-white transition-all active:scale-90 z-10"><XIcon className="h-2.5 w-2.5" /></button>
                        <span className="absolute bottom-0.5 left-0.5 text-[8px] font-bold px-0.5 rounded bg-black/60 text-white z-10 pointer-events-none">{idx + 1}</span>
                      </div>
                    ))}
                  </div>
                )}

                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileSelect} className="hidden" id="ocr-file-input-add" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed transition-all active:scale-[0.98]"
                  style={{ borderColor: uploadFiles.length > 0 ? "rgba(16,185,129,0.3)" : "rgba(63,63,70,0.5)", background: uploadFiles.length > 0 ? "rgba(16,185,129,0.03)" : "rgba(24,24,27,0.3)" }}
                >
                  <Upload className="h-4 w-4 text-emerald-400/70" />
                  <p className="text-[11px] font-semibold" style={{ color: uploadFiles.length > 0 ? "#34d399" : "rgba(161,161,170,0.7)" }}>
                    {uploadFiles.length > 0 ? `${uploadFiles.length} screenshot${uploadFiles.length > 1 ? "s" : ""} · tap for more` : "Tap to add screenshots"}
                  </p>
                </button>

                {ocrError && (
                  <div className="px-3 py-2 rounded-lg text-xs" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}>{ocrError}</div>
                )}

                <button
                  onClick={handleOcrSubmit}
                  disabled={uploadFiles.length === 0 || isProcessing}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: isProcessing ? "rgba(16,185,129,0.25)" : "linear-gradient(135deg, #059669, #10b981)", boxShadow: isProcessing ? "none" : "0 4px 20px rgba(16,185,129,0.3)" }}
                >
                  {isProcessing ? (<><Loader2 className="h-4 w-4 animate-spin" /> {processStage || "Processing…"}</>) : (<><ImageIcon className="h-4 w-4" /> Scan {uploadFiles.length} Screenshot{uploadFiles.length !== 1 ? "s" : ""}</>)}
                </button>

                {isProcessing && (
                  <p className="text-[10px] text-center animate-pulse" style={{ color: "rgba(52,211,153,0.5)" }}>
                    📱 Please keep screen on while processing…
                  </p>
                )}
              </div>
            )}

            {/* Match pills */}
            <div className="space-y-3">
              {matchesDetected > 0 && (
                <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
                  {matchesDetected > 1 && (
                    <button onClick={() => setSelectedMatch(null)} className="shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-bold transition-all active:scale-95" style={selectedMatch === null ? { background: "linear-gradient(135deg,#7c3aed,#9333ea)", color: "#fff", boxShadow: "0 2px 8px rgba(124,58,237,0.25)" } : { background: "rgba(124,58,237,0.08)", color: "rgba(167,139,250,0.6)", border: "1px solid rgba(124,58,237,0.15)" }}>All</button>
                  )}
                  {Array.from({ length: matchesDetected }, (_, i) => i + 1).map((mn) => (
                    <button key={mn} onClick={() => setSelectedMatch(mn)} className="shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-bold transition-all active:scale-95" style={selectedMatch === mn ? { background: "linear-gradient(135deg,#7c3aed,#9333ea)", color: "#fff", boxShadow: "0 2px 8px rgba(124,58,237,0.25)" } : { background: "rgba(124,58,237,0.08)", color: "rgba(167,139,250,0.6)", border: "1px solid rgba(124,58,237,0.15)" }}>M{mn}</button>
                  ))}
                  <button
                    onClick={() => setShowAddMatches(!showAddMatches)}
                    className="shrink-0 h-[30px] w-[30px] rounded-full flex items-center justify-center transition-all active:scale-90"
                    style={showAddMatches
                      ? { background: "linear-gradient(135deg, #059669, #10b981)", color: "#fff" }
                      : { background: "rgba(16,185,129,0.1)", color: "#34d399", border: "1px solid rgba(16,185,129,0.2)" }
                    }
                    title="Add more matches"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* ── Group Cards ── */}
              {filteredGroups.map((group) => {
                const topKiller = getTopKiller(group);
                const isAssigned = !!group.teamId;
                const isExpanded = expandedGroups.has(group.group);
                const isDropdownOpen = openDropdown === group.group;
                const ps = tournament.pointSystem ?? DEFAULT_BGMI_POINTS;

                return (
                  <div key={group.group} className="rounded-xl overflow-hidden transition-all" style={{ background: isAssigned ? "rgba(124,58,237,0.04)" : "rgba(24,24,27,0.5)", border: `1px solid ${isAssigned ? "rgba(124,58,237,0.15)" : "rgba(63,63,70,0.4)"}` }}>
                    {/* Card header */}
                    <div className="flex items-center gap-3 px-3.5 py-3">
                      <div className={`flex items-center justify-center h-8 w-8 rounded-lg text-sm font-black shrink-0 ${group.rank === 1 ? "bg-gradient-to-br from-yellow-400 to-amber-600 text-black shadow-lg shadow-yellow-500/20" : group.rank === 2 ? "bg-gradient-to-br from-gray-200 to-gray-400 text-black" : group.rank === 3 ? "bg-gradient-to-br from-orange-400 to-orange-600 text-white" : "text-zinc-500"}`} style={group.rank > 3 ? { background: "rgba(39,39,42,0.8)", border: "1px solid rgba(63,63,70,0.5)" } : undefined}>{group.rank}</div>

                      <div className="flex-1 relative min-w-0">
                        <button onClick={() => setOpenDropdown(isDropdownOpen ? null : group.group)} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${isAssigned ? "bg-violet-500/10 border border-violet-500/25 text-white" : "bg-zinc-800/80 border border-zinc-700/50 text-zinc-400"}`}>
                          <span className="truncate">{isAssigned ? <>{(() => { const tm = tournament.teams.find(t => t.id === group.teamId); const g = tm?.group; return g && g !== "waiting" ? <span className="mr-1 text-[9px] px-1 py-0.5 rounded" style={{ background: "rgba(124,58,237,0.2)", color: "#c4b5fd" }}>{g === "final" ? "F" : g}</span> : null; })()}{group.teamName}</> : "Assign team..."}</span>
                          <ChevronDown className={`h-3 w-3 shrink-0 ml-2 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
                        </button>
                        {isDropdownOpen && (
                          <div className="absolute top-full left-0 right-0 mt-1 z-20 rounded-lg bg-zinc-800 border border-zinc-700 shadow-xl max-h-48 overflow-y-auto">
                            {isAssigned && <button onClick={() => { onUnassignTeam(group.group); setOpenDropdown(null); }} className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors border-b border-zinc-700/50">✕ Unassign</button>}
                            {tournament.teams.filter((t) => !t.out && !assignedTeamIds.has(t.id)).map((t) => (
                              <button key={t.id} onClick={() => { onAssignTeam(group.group, t.id); setOpenDropdown(null); }} className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-zinc-700 ${t.id === group.teamId ? "text-violet-400 font-semibold" : "text-zinc-300"}`}>
                                {tournament.splitEnabled && t.group && t.group !== "waiting" && <span className="mr-1 text-[9px] px-1 py-0.5 rounded" style={{ background: "rgba(124,58,237,0.25)", color: "#c4b5fd" }}>{t.group === "final" ? "F" : t.group}</span>}
                                {t.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <button onClick={() => toggleExpand(group.group)} className="shrink-0 p-1.5 rounded-lg hover:bg-zinc-800/80 transition-colors">
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-zinc-500" /> : <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />}
                      </button>
                    </div>

                    {/* Stats row */}
                    <div className="px-3.5 pb-3 flex items-center gap-2 flex-wrap">
                      {(() => {
                        if (selectedMatch !== null) {
                          const m = group.matches.find((m) => m.match === selectedMatch);
                          if (!m) return <span className="text-[10px] text-zinc-600 italic">Did not play M{selectedMatch}</span>;
                          const kills = m.teamKills ?? Object.values(m.playerKills ?? {}).reduce((a, b) => a + b, 0);
                          const pp = m.placementPoints ?? (ps.positionPoints[m.position - 1] ?? 0);
                          const pts = pp + kills * ps.killPoints;
                          return (<>
                            <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px]" style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.15)" }}><span style={{ color: "rgba(167,139,250,0.5)" }}>PTS</span><span className="font-bold text-violet-400">{pts}</span></span>
                            <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px]" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}><span className="text-white/30">K</span><span className="font-semibold text-white/80">{kills}</span></span>
                            {m.position === 1 && <span className="text-[10px] text-yellow-400 font-semibold">🍗</span>}
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ml-auto ${m.position === 1 ? "bg-violet-500/15 text-violet-400" : m.position <= 3 ? "bg-emerald-500/12 text-emerald-400" : "bg-zinc-800/80 text-zinc-500"}`}>#{m.position}</span>
                          </>);
                        }
                        return (<>
                          <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px]" style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.15)" }}><span style={{ color: "rgba(167,139,250,0.5)" }}>PTS</span><span className="font-bold text-violet-400">{group.totals.totalPoints}</span></span>
                          <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px]" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}><span className="text-white/30">K</span><span className="font-semibold text-white/80">{group.totals.totalKills}</span></span>
                          {group.totals.chickenDinners > 0 && <span className="text-[10px] text-yellow-400 font-semibold">🍗 {group.totals.chickenDinners}</span>}
                          <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500"><Trophy className="h-2.5 w-2.5 text-violet-400/60" />{topKiller.name} ({topKiller.kills}k)</span>
                          <div className="flex items-center gap-1 ml-auto">
                            {group.matches.map((m) => <span key={m.match} className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${m.position === 1 ? "bg-violet-500/15 text-violet-400" : m.position <= 3 ? "bg-emerald-500/12 text-emerald-400" : "bg-zinc-800/80 text-zinc-500"}`}>#{m.position}</span>)}
                          </div>
                        </>);
                      })()}
                    </div>

                    {/* Expanded match details */}
                    {isExpanded && (
                      <div className="px-3.5 pb-3 pt-2 space-y-2" style={{ borderTop: "1px solid rgba(63,63,70,0.3)" }}>
                        {group.matches.map((m) => (
                          <div key={m.match} className="pl-3 border-l-2" style={{ borderColor: m.position === 1 ? "#7c3aed" : "rgba(63,63,70,0.5)" }}>
                            <div className="flex items-center gap-2 mb-1 text-[11px]">
                              <span className="font-bold text-zinc-400">M{m.match}</span>
                              <span className={`font-bold ${m.position === 1 ? "text-violet-400" : m.position <= 3 ? "text-emerald-400" : "text-zinc-500"}`}>#{m.position}</span>
                              <span className="text-zinc-600">{m.matchPoints}pts</span>
                              <span className="text-zinc-700 text-[10px]">({m.placementPoints}pp + {m.teamKills}k)</span>
                            </div>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                              {Object.entries(m.playerKills).map(([pn, k]) => (
                                <span key={pn} className="text-[10px] text-zinc-400">{pn} <span className="text-violet-400 font-semibold">{k}k</span></span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ═══ Floating Bottom Bar ═══ */}
            <div className="fixed bottom-0 left-0 right-0 z-[56]" style={{ background: "linear-gradient(to top, #0c0914 80%, transparent)" }}>
              <div className="max-w-3xl mx-auto px-4 pb-5 pt-3 space-y-2">
                <div className="flex gap-2">
                  <button onClick={onPasteJson} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold text-white transition-all active:scale-95" style={{ background: "linear-gradient(135deg,#7c3aed,#9333ea)", boxShadow: "0 4px 16px rgba(124,58,237,0.3)" }}>
                    <ClipboardPaste className="h-3.5 w-3.5" /> Paste JSON
                  </button>
                  <button onClick={onCopyPrompt} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all active:scale-95" style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.2)", color: "#a78bfa" }}>
                    Copy Prompt
                  </button>
                </div>
                <button
                  onClick={onClearData}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-medium transition-all active:scale-[0.98]"
                  style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.1)", color: "rgba(239,68,68,0.5)" }}
                >
                  <Trash2 className="h-3 w-3" /> {deleteLabel}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Fullscreen Image Preview Lightbox ── */}
      {previewModalIndex !== null && uploadPreviews[previewModalIndex] && (
        <div className="fixed inset-0 z-[120] flex flex-col items-center justify-between p-3 sm:p-5 bg-black/95 backdrop-blur-md select-none animate-in fade-in duration-200" onClick={() => setPreviewModalIndex(null)}>
          <div className="w-full max-w-4xl flex items-center justify-between py-2 px-1 z-10" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-white/10 text-white/90 border border-white/10">{previewModalIndex + 1} / {uploadPreviews.length}</span>
              {uploadFiles[previewModalIndex]?.name && <span className="text-xs text-white/40 truncate max-w-[160px]">{uploadFiles[previewModalIndex].name}</span>}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => removeFile(previewModalIndex)} className="p-2 rounded-xl bg-red-500/15 hover:bg-red-500/30 text-red-400 transition-colors"><Trash2 className="h-4 w-4" /></button>
              <button onClick={() => setPreviewModalIndex(null)} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"><X className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="relative flex-1 w-full max-w-4xl flex items-center justify-center min-h-0 py-2" onClick={(e) => e.stopPropagation()}>
            {uploadPreviews.length > 1 && <button onClick={() => setPreviewModalIndex((p) => (p! > 0 ? p! - 1 : uploadPreviews.length - 1))} className="absolute left-1 sm:left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/70 hover:bg-black/95 text-white border border-white/15 shadow-2xl transition-all active:scale-90 z-10"><ChevronLeft className="h-5 w-5" /></button>}
            <img src={uploadPreviews[previewModalIndex]} alt={`Screenshot ${previewModalIndex + 1}`} className="max-h-[75vh] max-w-[90vw] md:max-w-[80vw] object-contain rounded-xl shadow-2xl border border-white/10" />
            {uploadPreviews.length > 1 && <button onClick={() => setPreviewModalIndex((p) => (p! < uploadPreviews.length - 1 ? p! + 1 : 0))} className="absolute right-1 sm:right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/70 hover:bg-black/95 text-white border border-white/15 shadow-2xl transition-all active:scale-90 z-10"><ChevronRight className="h-5 w-5" /></button>}
          </div>
          <div className="w-full max-w-4xl flex flex-col items-center gap-2 py-2 z-10" onClick={(e) => e.stopPropagation()}>
            {uploadPreviews.length > 1 && (
              <div className="flex items-center gap-2 max-w-full overflow-x-auto px-2 py-1" style={{ scrollbarWidth: "none" }}>
                {uploadPreviews.map((thumb, tIdx) => (
                  <button key={tIdx} onClick={() => setPreviewModalIndex(tIdx)} className={`relative shrink-0 h-12 w-12 rounded-lg overflow-hidden border-2 transition-all ${tIdx === previewModalIndex ? "border-emerald-400 scale-105 shadow-lg shadow-emerald-500/25" : "border-white/10 opacity-50 hover:opacity-90"}`}>
                    <img src={thumb} alt={`Thumb ${tIdx + 1}`} className="h-full w-full object-cover" />
                    <span className="absolute bottom-0.5 right-0.5 text-[8px] font-bold px-1 rounded bg-black/70 text-white">{tIdx + 1}</span>
                  </button>
                ))}
              </div>
            )}
            <p className="text-[10px] text-white/40 hidden sm:block">
              <kbd className="px-1 py-0.5 rounded bg-white/10 font-mono text-[9px]">Esc</kbd> close · <kbd className="px-1 py-0.5 rounded bg-white/10 font-mono text-[9px]">←</kbd> <kbd className="px-1 py-0.5 rounded bg-white/10 font-mono text-[9px]">→</kbd> navigate
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

