"use client";
import { useState, useRef, useEffect } from "react";
import { Trash2, X, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ClipboardPaste, Trophy, Upload, Camera, Loader2, ImageIcon, X as XIcon, Eye, Plus } from "lucide-react";
import { toast } from "sonner";
import { Tournament, AssignedGroup, StandingRow, DEFAULT_BGMI_POINTS } from "@/lib/types";
import GroupFilterDropdown from "./GroupFilterDropdown";

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
  isAdmin?: boolean;
}

export default function CalculateScreen({
  tournament, groups, assignments, matchesDetected, groupFilter, setGroupFilter,
  onAssignTeam, onUnassignTeam, onCopyPrompt, onPasteJson, onClearData, onClose,
  onOcrResult, isAdmin = false,
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
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [showAddMatches, setShowAddMatches] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setOcrError(null);

    try {
      const formData = new FormData();
      const activeTeams = tournament.teams.filter((t) => !t.out);
      formData.append("teams", JSON.stringify(activeTeams));

      // Compress images based on batch size to avoid payload limits
      for (let i = 0; i < uploadFiles.length; i++) {
        const prepared = await prepareImage(uploadFiles[i]);
        formData.append("images", prepared, `screenshot_${i + 1}.jpg`);
      }

      // 5 min timeout to match server maxDuration — prevents browser from killing the connection
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5 * 60 * 1000);

      const res = await fetch("/api/ocr", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const detail = body.details ? `\n${body.details}` : "";
        throw new Error((body.error || `Server error ${res.status}`) + detail);
      }

      const result = await res.json();
      if (result.data) {
        // Auto-apply the OCR result immediately
        const jsonStr = JSON.stringify(result.data, null, 2);
        if (onOcrResult) onOcrResult(jsonStr);
        // Clean up upload state
        uploadPreviews.forEach((p) => URL.revokeObjectURL(p));
        setUploadFiles([]);
        setUploadPreviews([]);
        setShowAddMatches(false);
      } else {
        throw new Error("No data in response");
      }
    } catch (err: unknown) {
      const isTimeout = err instanceof DOMException && err.name === "AbortError";
      const msg = isTimeout
        ? "Request timed out — try uploading fewer screenshots"
        : err instanceof Error ? err.message : "OCR failed";
      setOcrError(msg);
      toast.error(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[55] overflow-y-auto" style={{ background: "#0c0914" }}>
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white">Calculate</h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs" style={{ color: "rgba(167,139,250,0.5)" }}>{groups.length > 0 ? `${groups.length} groups · ${matchesDetected} matches` : tournament.name}</p>
              {tournament.splitEnabled && <GroupFilterDropdown value={groupFilter} onChange={setGroupFilter} groupCount={tournament.groupCount ?? 2} showFinal={tournament.teams.some(t => t.group === "final")} />}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0 pt-1">
            {groups.length > 0 && (
              <button onClick={onClearData} className="p-1.5 rounded-lg transition-colors" style={{ color: "rgba(239,68,68,0.6)" }} title="Reset match data">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: "rgba(167,139,250,0.5)" }}><X className="h-5 w-5" /></button>
          </div>
        </div>

        {groups.length === 0 ? (
          /* ── Empty state: Tabbed UI ── */
          <div className="mt-2 px-1">
            {/* Tab bar (only shown if admin) */}
            {isAdmin && (
              <div className="flex rounded-xl p-1 mb-4" style={{ background: "rgba(24,24,27,0.6)", border: "1px solid rgba(63,63,70,0.3)" }}>
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
                  <span
                    className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wider leading-none"
                    style={calcTab === "auto"
                      ? { background: "rgba(0,0,0,0.25)", color: "#d1fae5" }
                      : { background: "rgba(16,185,129,0.15)", color: "rgba(52,211,153,0.7)" }
                    }
                  >
                    Beta
                  </span>
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
            )}

            {!isAdmin || calcTab === "manual" ? (
              /* ── Manual tab ── */
              <div className="w-full rounded-2xl p-4" style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.25)" }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(124,58,237,0.2)" }}>
                    <ClipboardPaste className="h-5 w-5" style={{ color: "#a78bfa" }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-white">Use Gemini manually</p>
                    <p className="text-xs mt-0.5" style={{ color: "rgba(167,139,250,0.55)" }}>Copy prompt → paste in Gemini → copy JSON back</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    { step: "1", title: "Copy the prompt below", desc: "Tap Copy Prompt, then open Gemini and paste it" },
                    { step: "2", title: "Send & upload screenshots", desc: "Reply with your match result screenshots in the next message" },
                    { step: "3", title: "Copy the JSON reply", desc: "Gemini responds with a JSON block — select and copy it" },
                    { step: "4", title: "Paste it here", desc: "Come back and tap the purple 'Paste' button below" },
                  ].map((s) => (
                    <div key={s.step} className="flex items-start gap-3">
                      <div className="h-7 w-7 rounded-lg shrink-0 flex items-center justify-center text-xs font-black" style={{ background: "rgba(124,58,237,0.3)", color: "#c4b5fd" }}>{s.step}</div>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-white">{s.title}</p>
                        <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: "rgba(167,139,250,0.6)" }}>{s.desc}</p>
                      </div>
                    </div>
                  ))}
                  <div className="pt-2 space-y-2">
                    <button onClick={onCopyPrompt} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white press-scale" style={{ background: "linear-gradient(135deg,#7c3aed,#9333ea)", boxShadow: "0 4px 20px rgba(124,58,237,0.4)" }}>Copy Prompt</button>
                    <button onClick={onPasteJson} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold press-scale" style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)", color: "#c4b5fd" }}><ClipboardPaste className="h-4 w-4" /> Paste JSON from Gemini</button>
                    <p className="text-[10px] text-center pt-0.5" style={{ color: "rgba(167,139,250,0.35)" }}>Prompt copied to clipboard · paste in Gemini</p>
                  </div>
                </div>
              </div>
            ) : (
              /* ── Auto Scan tab ── */
              <div className="w-full rounded-2xl p-4 space-y-4" style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.06), rgba(5,150,105,0.03))", border: "1px solid rgba(16,185,129,0.2)" }}>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(16,185,129,0.15)" }}>
                    <Camera className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-white">Upload Screenshots</p>
                      <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wider leading-none bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">Beta</span>
                    </div>
                    <p className="text-[10px]" style={{ color: "rgba(52,211,153,0.6)" }}>AI reads your scoreboards instantly</p>
                  </div>
                </div>

                {uploadPreviews.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                    {uploadPreviews.map((src, idx) => (
                      <div
                        key={idx}
                        onClick={() => setPreviewModalIndex(idx)}
                        className="relative shrink-0 h-20 w-20 rounded-lg overflow-hidden border cursor-pointer group active:scale-95 transition-all"
                        style={{ borderColor: "rgba(16,185,129,0.3)" }}
                        title="Click to preview screenshot"
                      >
                        <img src={src} alt={`Screenshot ${idx + 1}`} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/35 transition-colors flex items-center justify-center pointer-events-none">
                          <Eye className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile(idx);
                          }}
                          className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full flex items-center justify-center bg-black/80 hover:bg-red-600 text-white transition-all active:scale-90 z-10"
                          title="Remove screenshot"
                        >
                          <XIcon className="h-3 w-3" />
                        </button>
                        <span className="absolute bottom-0.5 left-0.5 text-[9px] font-bold px-1 rounded bg-black/60 text-white z-10 pointer-events-none">
                          {idx + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileSelect} className="hidden" id="ocr-file-input" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                  className="w-full flex flex-col items-center justify-center gap-2 py-5 rounded-xl border-2 border-dashed transition-all active:scale-[0.98]"
                  style={{ borderColor: uploadFiles.length > 0 ? "rgba(16,185,129,0.3)" : "rgba(63,63,70,0.5)", background: uploadFiles.length > 0 ? "rgba(16,185,129,0.03)" : "rgba(24,24,27,0.3)" }}
                >
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(16,185,129,0.1)" }}>
                    <Upload className="h-5 w-5 text-emerald-400/70" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-semibold" style={{ color: uploadFiles.length > 0 ? "#34d399" : "rgba(161,161,170,0.8)" }}>
                      {uploadFiles.length > 0 ? `${uploadFiles.length} screenshot${uploadFiles.length > 1 ? "s" : ""} added` : "Tap to add screenshots"}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: "rgba(161,161,170,0.4)" }}>
                      {uploadFiles.length > 0 ? "Tap to add more" : "Select match result screenshots"}
                    </p>
                  </div>
                </button>

                {ocrError && (
                  <div className="px-3 py-2 rounded-lg text-xs" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}>{ocrError}</div>
                )}

                <button
                  onClick={handleOcrSubmit}
                  disabled={uploadFiles.length === 0 || isProcessing}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: isProcessing ? "rgba(16,185,129,0.3)" : "linear-gradient(135deg, #059669, #10b981)", boxShadow: isProcessing ? "none" : "0 4px 20px rgba(16,185,129,0.3)" }}
                >
                  {isProcessing ? (<><Loader2 className="h-4 w-4 animate-spin" /> Processing with AI…</>) : (<><ImageIcon className="h-4 w-4" /> Scan {uploadFiles.length} Screenshot{uploadFiles.length !== 1 ? "s" : ""}</>)}
                </button>



                <p className="text-[10px] text-center" style={{ color: "rgba(52,211,153,0.3)" }}>Screenshots are processed by Gemini AI · no data stored</p>
              </div>
            )}
          </div>
        ) : (
          /* ── Groups list ── */
          <>
          {/* Add More Matches upload panel (expanded) */}
          {showAddMatches && (
            <div className="mb-3 rounded-2xl p-4 space-y-3" style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.06), rgba(5,150,105,0.03))", border: "1px solid rgba(16,185,129,0.2)" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(16,185,129,0.15)" }}>
                    <Camera className="h-3.5 w-3.5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">Add More Matches</p>
                    <p className="text-[10px]" style={{ color: "rgba(52,211,153,0.5)" }}>Upload new match screenshots</p>
                  </div>
                </div>
                <button onClick={() => { setShowAddMatches(false); uploadPreviews.forEach((p) => URL.revokeObjectURL(p)); setUploadFiles([]); setUploadPreviews([]); setOcrError(null); }} className="p-1.5 rounded-lg" style={{ color: "rgba(52,211,153,0.4)" }}><X className="h-4 w-4" /></button>
              </div>

              {uploadPreviews.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                  {uploadPreviews.map((src, idx) => (
                    <div key={idx} onClick={() => setPreviewModalIndex(idx)} className="relative shrink-0 h-16 w-16 rounded-lg overflow-hidden border cursor-pointer group active:scale-95 transition-all" style={{ borderColor: "rgba(16,185,129,0.3)" }} title="Click to preview">
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
                className="w-full flex flex-col items-center justify-center gap-1.5 py-3.5 rounded-xl border-2 border-dashed transition-all active:scale-[0.98]"
                style={{ borderColor: uploadFiles.length > 0 ? "rgba(16,185,129,0.3)" : "rgba(63,63,70,0.5)", background: uploadFiles.length > 0 ? "rgba(16,185,129,0.03)" : "rgba(24,24,27,0.3)" }}
              >
                <Upload className="h-4 w-4 text-emerald-400/70" />
                <p className="text-[11px] font-semibold" style={{ color: uploadFiles.length > 0 ? "#34d399" : "rgba(161,161,170,0.8)" }}>
                  {uploadFiles.length > 0 ? `${uploadFiles.length} screenshot${uploadFiles.length > 1 ? "s" : ""} added · tap to add more` : "Tap to add screenshots"}
                </p>
              </button>

              {ocrError && (
                <div className="px-3 py-2 rounded-lg text-xs" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}>{ocrError}</div>
              )}

              <button
                onClick={handleOcrSubmit}
                disabled={uploadFiles.length === 0 || isProcessing}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: isProcessing ? "rgba(16,185,129,0.3)" : "linear-gradient(135deg, #059669, #10b981)", boxShadow: isProcessing ? "none" : "0 4px 20px rgba(16,185,129,0.3)" }}
              >
                {isProcessing ? (<><Loader2 className="h-4 w-4 animate-spin" /> Processing…</>) : (<><ImageIcon className="h-4 w-4" /> Scan {uploadFiles.length} Screenshot{uploadFiles.length !== 1 ? "s" : ""}</>)}
              </button>
            </div>
          )}
          <div className="space-y-3">
            {/* Match selector pills + Add more pill */}
            {matchesDetected > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
                {matchesDetected > 1 && (
                  <button onClick={() => setSelectedMatch(null)} className="shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all" style={selectedMatch === null ? { background: "linear-gradient(135deg,#7c3aed,#9333ea)", color: "#fff" } : { background: "rgba(124,58,237,0.12)", color: "rgba(167,139,250,0.7)", border: "1px solid rgba(124,58,237,0.2)" }}>All</button>
                )}
                {Array.from({ length: matchesDetected }, (_, i) => i + 1).map((mn) => (
                  <button key={mn} onClick={() => setSelectedMatch(mn)} className="shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all" style={selectedMatch === mn ? { background: "linear-gradient(135deg,#7c3aed,#9333ea)", color: "#fff" } : { background: "rgba(124,58,237,0.12)", color: "rgba(167,139,250,0.7)", border: "1px solid rgba(124,58,237,0.2)" }}>M{mn}</button>
                ))}
                {/* + Add matches pill (only shown if admin) */}
                {isAdmin && (
                  <button
                    onClick={() => setShowAddMatches(!showAddMatches)}
                    className="shrink-0 h-[30px] w-[30px] rounded-full flex items-center justify-center text-xs font-bold transition-all active:scale-90"
                    style={showAddMatches
                      ? { background: "linear-gradient(135deg, #059669, #10b981)", color: "#fff" }
                      : { background: "rgba(16,185,129,0.12)", color: "#34d399", border: "1px solid rgba(16,185,129,0.25)" }
                    }
                    title="Add more matches"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}

            {filteredGroups.map((group) => {
              const topKiller = getTopKiller(group);
              const isAssigned = !!group.teamId;
              const isExpanded = expandedGroups.has(group.group);
              const isDropdownOpen = openDropdown === group.group;
              return (
                <div key={group.group} className={`rounded-xl border transition-all ${isAssigned ? "bg-violet-500/[0.03] border-violet-500/20" : "bg-zinc-900/50 border-zinc-800/60"}`}>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className={`flex items-center justify-center h-8 w-8 rounded-lg text-sm font-black shrink-0 ${group.rank === 1 ? "bg-gradient-to-br from-yellow-500 to-amber-600 text-black" : group.rank === 2 ? "bg-gradient-to-br from-gray-300 to-gray-500 text-black" : group.rank === 3 ? "bg-gradient-to-br from-orange-500 to-orange-700 text-white" : "bg-zinc-800 text-zinc-400 border border-zinc-700"}`}>{group.rank}</div>
                    <div className="flex-1 relative">
                      <button onClick={() => setOpenDropdown(isDropdownOpen ? null : group.group)} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${isAssigned ? "bg-violet-500/10 border border-violet-500/30 text-white" : "bg-zinc-800 border border-zinc-700/60 text-zinc-400"}`}>
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
                    <button onClick={() => toggleExpand(group.group)} className="shrink-0 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors">
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-zinc-500" /> : <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />}
                    </button>
                  </div>
                  <div className="px-4 pb-3 flex items-center gap-3 flex-wrap">
                    {(() => {
                      const ps = tournament.pointSystem ?? DEFAULT_BGMI_POINTS;
                      if (selectedMatch !== null) {
                        const m = group.matches.find((m) => m.match === selectedMatch);
                        if (!m) return <span className="text-[10px] text-zinc-500">Did not play M{selectedMatch}</span>;
                        const kills = m.teamKills ?? Object.values(m.playerKills ?? {}).reduce((a, b) => a + b, 0);
                        const pp = m.placementPoints ?? (ps.positionPoints[m.position - 1] ?? 0);
                        const pts = pp + kills * ps.killPoints;
                        return (<>
                          <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px]"><span className="text-white/40">PTS</span><span className="font-bold text-violet-400">{pts}</span></span>
                          <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px]"><span className="text-white/40">K</span><span className="font-medium text-white">{kills}</span></span>
                          {m.position === 1 && <span className="text-[10px] text-yellow-400 font-semibold">🍗 Chicken!</span>}
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ml-auto ${m.position === 1 ? "bg-violet-500/15 text-violet-400" : m.position <= 3 ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-800 text-zinc-500"}`}>#{m.position}</span>
                        </>);
                      }
                      return (<>
                        <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px]"><span className="text-white/40">PTS</span><span className="font-bold text-violet-400">{group.totals.totalPoints}</span></span>
                        <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px]"><span className="text-white/40">K</span><span className="font-medium text-white">{group.totals.totalKills}</span></span>
                        {group.totals.chickenDinners > 0 && <span className="text-[10px] text-yellow-400 font-semibold">🍗 {group.totals.chickenDinners}</span>}
                        <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500"><Trophy className="h-2.5 w-2.5 text-violet-400" />{topKiller.name} ({topKiller.kills}k)</span>
                        <div className="flex items-center gap-1 ml-auto">
                          {group.matches.map((m) => <span key={m.match} className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${m.position === 1 ? "bg-violet-500/15 text-violet-400" : m.position <= 3 ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-800 text-zinc-500"}`}>#{m.position}</span>)}
                        </div>
                      </>);
                    })()}
                  </div>
                  {isExpanded && (
                    <div className="px-4 pb-3 pt-2 border-t border-zinc-800/40 space-y-2">
                      {group.matches.map((m) => (
                        <div key={m.match} className="pl-3 border-l-2" style={{ borderColor: m.position === 1 ? "#7c3aed" : "rgba(63,63,70,0.6)" }}>
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

          {/* Persistent action bar for adding more matches */}
          <div className="sticky bottom-0 pt-3 pb-6 mt-4" style={{ background: "linear-gradient(to top, #0c0914 70%, transparent)" }}>
            <div className="flex gap-2">
              <button
                onClick={onCopyPrompt}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all active:scale-95"
                style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)", color: "#c4b5fd" }}
              >
                Copy Prompt
              </button>
              <button
                onClick={onPasteJson}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold text-white transition-all active:scale-95"
                style={{ background: "linear-gradient(135deg,#7c3aed,#9333ea)", boxShadow: "0 4px 20px rgba(124,58,237,0.4)" }}
              >
                <ClipboardPaste className="h-3.5 w-3.5" /> Paste JSON
              </button>
            </div>
            <p className="text-[10px] text-center mt-1.5" style={{ color: "rgba(167,139,250,0.3)" }}>
              Add more matches · data will accumulate
            </p>
          </div>
          </>
        )}
      </div>

      {/* ── Fullscreen Image Preview Lightbox ── */}
      {previewModalIndex !== null && uploadPreviews[previewModalIndex] && (
        <div
          className="fixed inset-0 z-[120] flex flex-col items-center justify-between p-3 sm:p-5 bg-black/95 backdrop-blur-md select-none animate-in fade-in duration-200"
          onClick={() => setPreviewModalIndex(null)}
        >
          {/* Top Bar */}
          <div
            className="w-full max-w-4xl flex items-center justify-between py-2 px-1 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-white/10 text-white/90 border border-white/10">
                Screenshot {previewModalIndex + 1} of {uploadPreviews.length}
              </span>
              {uploadFiles[previewModalIndex]?.name && (
                <span className="text-xs text-white/50 truncate max-w-[180px] sm:max-w-xs">
                  {uploadFiles[previewModalIndex].name}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const idx = previewModalIndex;
                  removeFile(idx);
                }}
                className="p-2 rounded-xl bg-red-500/15 hover:bg-red-500/30 text-red-400 hover:text-red-300 transition-colors"
                title="Delete screenshot"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPreviewModalIndex(null)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                title="Close preview (Esc)"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Center Image with Prev / Next */}
          <div
            className="relative flex-1 w-full max-w-4xl flex items-center justify-center min-h-0 py-2"
            onClick={(e) => e.stopPropagation()}
          >
            {uploadPreviews.length > 1 && (
              <button
                onClick={() => setPreviewModalIndex((prev) => (prev! > 0 ? prev! - 1 : uploadPreviews.length - 1))}
                className="absolute left-1 sm:left-3 top-1/2 -translate-y-1/2 p-2.5 sm:p-3 rounded-full bg-black/70 hover:bg-black/95 text-white border border-white/15 shadow-2xl transition-all active:scale-90 z-10"
                title="Previous image (←)"
              >
                <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
              </button>
            )}

            <img
              src={uploadPreviews[previewModalIndex]}
              alt={`Screenshot ${previewModalIndex + 1}`}
              className="max-h-[75vh] max-w-[90vw] md:max-w-[80vw] object-contain rounded-xl shadow-2xl border border-white/10"
            />

            {uploadPreviews.length > 1 && (
              <button
                onClick={() => setPreviewModalIndex((prev) => (prev! < uploadPreviews.length - 1 ? prev! + 1 : 0))}
                className="absolute right-1 sm:right-3 top-1/2 -translate-y-1/2 p-2.5 sm:p-3 rounded-full bg-black/70 hover:bg-black/95 text-white border border-white/15 shadow-2xl transition-all active:scale-90 z-10"
                title="Next image (→)"
              >
                <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
              </button>
            )}
          </div>

          {/* Bottom Strip: thumbnail preview gallery & keyboard hint */}
          <div
            className="w-full max-w-4xl flex flex-col items-center gap-2 py-2 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            {uploadPreviews.length > 1 && (
              <div className="flex items-center gap-2 max-w-full overflow-x-auto px-2 py-1" style={{ scrollbarWidth: "none" }}>
                {uploadPreviews.map((thumb, tIdx) => (
                  <button
                    key={tIdx}
                    onClick={() => setPreviewModalIndex(tIdx)}
                    className={`relative shrink-0 h-12 w-12 rounded-lg overflow-hidden border-2 transition-all ${
                      tIdx === previewModalIndex
                        ? "border-emerald-400 scale-105 shadow-lg shadow-emerald-500/25 ring-2 ring-emerald-400/30"
                        : "border-white/10 opacity-50 hover:opacity-90"
                    }`}
                  >
                    <img src={thumb} alt={`Thumbnail ${tIdx + 1}`} className="h-full w-full object-cover" />
                    <span className="absolute bottom-0.5 right-0.5 text-[8px] font-bold px-1 rounded bg-black/70 text-white">
                      {tIdx + 1}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <p className="text-[10px] text-white/40 hidden sm:block">
              Tip: Press <kbd className="px-1 py-0.5 rounded bg-white/10 font-mono text-[9px]">Esc</kbd> to close · Use <kbd className="px-1 py-0.5 rounded bg-white/10 font-mono text-[9px]">←</kbd> <kbd className="px-1 py-0.5 rounded bg-white/10 font-mono text-[9px]">→</kbd> to switch screenshots
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
