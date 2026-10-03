"use client";
import { useState } from "react";
import { X, ChevronLeft, ChevronRight, Check as CheckIcon, RotateCcw, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Tournament, AssignedGroup, GroupMatch, DEFAULT_BGMI_POINTS } from "@/lib/types";

interface Props {
  tournament: Tournament;
  groups: AssignedGroup[];
  matchesDetected: number;
  onSave: (updatedGroups: { groupLabel: string; matches: GroupMatch[] }[]) => void;
  onClose: () => void;
  onAddMatch?: () => void;
  onDeleteMatch?: (matchNum: number) => void;
}

interface EditableEntry {
  groupLabel: string;
  teamName: string;
  position: number;
  playerKills: Record<string, number>;
}

export default function MatchEditOverlay({ tournament, groups, matchesDetected, onSave, onClose, onAddMatch, onDeleteMatch }: Props) {
  const [activeMatch, setActiveMatch] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  // Build editable state: deep clone all match data from all groups
  const [editData, setEditData] = useState<Map<string, EditableEntry[]>>(() => {
    const map = new Map<string, EditableEntry[]>();
    for (let m = 1; m <= matchesDetected; m++) {
      const entries: EditableEntry[] = [];
      groups.forEach((g) => {
        const match = g.matches.find((mm) => mm.match === m);
        if (match) {
          entries.push({
            groupLabel: g.group,
            teamName: g.teamName || g.group,
            position: match.position,
            playerKills: { ...match.playerKills },
          });
        }
      });
      // Sort by position
      entries.sort((a, b) => a.position - b.position);
      map.set(`M${m}`, entries);
    }
    return map;
  });

  // Store original for reset
  const [originalData] = useState(() => {
    const map = new Map<string, EditableEntry[]>();
    for (let m = 1; m <= matchesDetected; m++) {
      const entries: EditableEntry[] = [];
      groups.forEach((g) => {
        const match = g.matches.find((mm) => mm.match === m);
        if (match) {
          entries.push({
            groupLabel: g.group,
            teamName: g.teamName || g.group,
            position: match.position,
            playerKills: { ...match.playerKills },
          });
        }
      });
      entries.sort((a, b) => a.position - b.position);
      map.set(`M${m}`, entries);
    }
    return map;
  });

  const currentEntries = editData.get(`M${activeMatch}`) ?? [];

  const updateEntry = (entryIdx: number, field: "position", value: number) => {
    setEditData((prev) => {
      const next = new Map(prev);
      const entries = [...(next.get(`M${activeMatch}`) ?? [])];
      entries[entryIdx] = { ...entries[entryIdx], [field]: value };
      next.set(`M${activeMatch}`, entries);
      return next;
    });
  };

  const updatePlayerKill = (entryIdx: number, playerName: string, value: number) => {
    setEditData((prev) => {
      const next = new Map(prev);
      const entries = [...(next.get(`M${activeMatch}`) ?? [])];
      entries[entryIdx] = {
        ...entries[entryIdx],
        playerKills: { ...entries[entryIdx].playerKills, [playerName]: value },
      };
      next.set(`M${activeMatch}`, entries);
      return next;
    });
  };

  const resetCurrentMatch = () => {
    const orig = originalData.get(`M${activeMatch}`);
    if (orig) {
      setEditData((prev) => {
        const next = new Map(prev);
        next.set(`M${activeMatch}`, orig.map((e) => ({ ...e, playerKills: { ...e.playerKills } })));
        return next;
      });
      toast("Match reset to original");
    }
  };

  const handleSave = () => {
    const ps = tournament.pointSystem ?? DEFAULT_BGMI_POINTS;
    // Build updated matches per group
    const groupUpdates = new Map<string, GroupMatch[]>();

    // Start with current matches from groups
    groups.forEach((g) => {
      groupUpdates.set(g.group, g.matches.map((m) => ({ ...m, playerKills: { ...m.playerKills } })));
    });

    // Apply edits from each match
    for (let m = 1; m <= matchesDetected; m++) {
      const entries = editData.get(`M${m}`) ?? [];
      entries.forEach((entry) => {
        const matches = groupUpdates.get(entry.groupLabel);
        if (!matches) return;
        const matchIdx = matches.findIndex((mm) => mm.match === m);
        if (matchIdx === -1) return;

        const teamKills = Object.values(entry.playerKills).reduce((a, b) => a + b, 0);
        const placementPoints = ps.positionPoints[entry.position - 1] ?? 0;
        const matchPoints = placementPoints + teamKills * ps.killPoints;

        matches[matchIdx] = {
          ...matches[matchIdx],
          position: entry.position,
          playerKills: { ...entry.playerKills },
          teamKills,
          placementPoints,
          matchPoints,
        };
      });
    }

    const result = Array.from(groupUpdates.entries()).map(([groupLabel, matches]) => ({
      groupLabel,
      matches,
    }));

    onSave(result);
    toast.success("Points updated!");
  };

  const totalKills = (entry: EditableEntry) =>
    Object.values(entry.playerKills).reduce((a, b) => a + b, 0);

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto" style={{ background: "#0c0914" }}>
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-white">Edit Points</h1>
            <p className="text-[11px] mt-0.5" style={{ color: "rgba(167,139,250,0.5)" }}>
              {matchesDetected} matches · {groups.length} teams
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={resetCurrentMatch}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all active:scale-95"
              style={{ color: "rgba(167,139,250,0.6)", border: "1px solid rgba(124,58,237,0.15)" }}
              title="Reset this match"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: "rgba(167,139,250,0.5)" }}>
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Match navigation pills */}
        <div className="flex gap-2 overflow-x-auto pb-3 -mx-1 px-1 mb-4" style={{ scrollbarWidth: "none" }}>
          {Array.from({ length: matchesDetected }, (_, i) => i + 1).map((mn) => (
            <button
              key={mn}
              onClick={() => setActiveMatch(mn)}
              className="shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all"
              style={
                activeMatch === mn
                  ? { background: "linear-gradient(135deg,#7c3aed,#9333ea)", color: "#fff", boxShadow: "0 2px 12px rgba(124,58,237,0.3)" }
                  : { background: "rgba(124,58,237,0.08)", color: "rgba(167,139,250,0.6)", border: "1px solid rgba(124,58,237,0.15)" }
              }
            >
              Match {mn}
            </button>
          ))}
          {onAddMatch && (
            <button
              onClick={() => { onAddMatch(); }}
              className="shrink-0 h-9 w-9 rounded-xl flex items-center justify-center transition-all active:scale-95"
              style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", color: "#4ade80" }}
              title="Add match"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Match navigation arrows + title */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setActiveMatch((p) => Math.max(1, p - 1))}
            disabled={activeMatch === 1}
            className="p-2 rounded-lg transition-all active:scale-95 disabled:opacity-20"
            style={{ color: "#c4b5fd", background: "rgba(124,58,237,0.1)" }}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-white">
              Match {activeMatch} <span className="text-zinc-500 font-normal text-xs">/ {matchesDetected}</span>
            </p>
            {onDeleteMatch && matchesDetected > 1 && (
              confirmDelete === activeMatch ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      const deleting = activeMatch;
                      if (activeMatch >= matchesDetected) setActiveMatch(Math.max(1, matchesDetected - 1));
                      setConfirmDelete(null);
                      onDeleteMatch(deleting);
                    }}
                    className="px-2 py-1 rounded-md text-[10px] font-bold transition-all active:scale-95"
                    style={{ background: "rgba(239,68,68,0.2)", color: "#f87171" }}
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setConfirmDelete(null)}
                    className="px-2 py-1 rounded-md text-[10px] font-medium text-zinc-500 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(activeMatch)}
                  className="p-1 rounded-md transition-all active:scale-95"
                  style={{ color: "rgba(239,68,68,0.5)" }}
                  title="Delete this match"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )
            )}
          </div>
          <button
            onClick={() => setActiveMatch((p) => Math.min(matchesDetected, p + 1))}
            disabled={activeMatch === matchesDetected}
            className="p-2 rounded-lg transition-all active:scale-95 disabled:opacity-20"
            style={{ color: "#c4b5fd", background: "rgba(124,58,237,0.1)" }}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Teams in this match */}
        <div className="space-y-3 mb-6">
          {currentEntries.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-zinc-500">No teams found for this match</p>
            </div>
          ) : (
            currentEntries.map((entry, idx) => {
              const kills = totalKills(entry);
              const ps = tournament.pointSystem ?? DEFAULT_BGMI_POINTS;
              const pp = ps.positionPoints[entry.position - 1] ?? 0;
              const pts = pp + kills * ps.killPoints;

              return (
                <div
                  key={entry.groupLabel}
                  className="rounded-xl border overflow-hidden transition-all"
                  style={{
                    background: entry.position === 1
                      ? "rgba(124,58,237,0.06)"
                      : "rgba(24,24,27,0.5)",
                    borderColor: entry.position === 1
                      ? "rgba(124,58,237,0.25)"
                      : "rgba(63,63,70,0.4)",
                  }}
                >
                  {/* Team header */}
                  <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid rgba(63,63,70,0.3)" }}>
                    <div
                      className="flex items-center justify-center h-8 w-8 rounded-lg text-sm font-black shrink-0"
                      style={
                        entry.position === 1
                          ? { background: "linear-gradient(135deg,#eab308,#d97706)", color: "#000" }
                          : entry.position === 2
                          ? { background: "linear-gradient(135deg,#d1d5db,#6b7280)", color: "#000" }
                          : entry.position === 3
                          ? { background: "linear-gradient(135deg,#f97316,#c2410c)", color: "#fff" }
                          : { background: "#27272a", color: "#71717a", border: "1px solid #3f3f46" }
                      }
                    >
                      #{entry.position}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{entry.teamName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-violet-400 font-semibold">{pts} pts</span>
                        <span className="text-[10px] text-zinc-500">({pp}pp + {kills}k)</span>
                      </div>
                    </div>
                  </div>

                  {/* Edit fields */}
                  <div className="px-4 py-3 space-y-3">
                    {/* Position */}
                    <div className="flex items-center gap-3">
                      <label className="text-[11px] text-zinc-500 shrink-0 w-14">Position</label>
                      <input
                        type="number"
                        min={1}
                        value={entry.position}
                        onChange={(e) => updateEntry(idx, "position", Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-16 bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white text-center focus:outline-none focus:border-violet-500/50 transition-colors"
                      />
                    </div>

                    {/* Player kills */}
                    <div>
                      <p className="text-[10px] text-zinc-500 mb-1.5">Player Kills</p>
                      <div className="space-y-1.5">
                        {Object.entries(entry.playerKills).map(([playerName, kills]) => (
                          <div key={playerName} className="flex items-center gap-2">
                            <span className="text-[11px] text-zinc-400 flex-1 truncate">{playerName}</span>
                            <input
                              type="number"
                              min={0}
                              value={kills}
                              onChange={(e) =>
                                updatePlayerKill(idx, playerName, Math.max(0, parseInt(e.target.value) || 0))
                              }
                              className="w-14 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white text-center focus:outline-none focus:border-violet-500/50 transition-colors"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Bottom actions */}
        <div className="sticky bottom-0 pb-6 pt-3" style={{ background: "linear-gradient(to top, #0c0914 70%, transparent)" }}>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl text-sm font-bold transition-all active:scale-95"
              style={{ background: "rgba(124,58,237,0.1)", color: "rgba(167,139,250,0.7)", border: "1px solid rgba(124,58,237,0.2)" }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-all active:scale-95"
              style={{ background: "linear-gradient(135deg,#7c3aed,#9333ea)", boxShadow: "0 4px 20px rgba(124,58,237,0.4)" }}
            >
              <CheckIcon className="h-4 w-4" /> Save All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
