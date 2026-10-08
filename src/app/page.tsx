"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession, signIn } from "next-auth/react";
import { toast } from "sonner";
import { Team, Tournament, StandingRow, GeminiOutput, AssignedGroup, PointSystem, DEFAULT_BGMI_POINTS } from "@/lib/types";
import {
  CreateScreen, BookingsModal, ShareCodeModal, ImportCodeModal,
  CollabDeleteConfirm, TeamEditScreen, PointSystemModal, EditSheet,
  AddTeamsScreen, AdvancedScreen, SplitScreen, StandingsModal,
  SlotsModal, RoomInfoModal, CalculateScreen, MainView, RulesModal,
  MatchEditOverlay,
} from "./components";
import { useCloudSync } from "./hooks/useCloudSync";
import { useSubscription } from "./hooks/useSubscription";
import { createTournament, parsePointCalcFile } from "@/lib/storage";
import { computeStandings as computeStandingsFromTournament, normalizeAndAssign } from "@/lib/standings";
import { parseTeamPaste } from "@/lib/parseTeam";
import { generatePrompt } from "@/lib/prompt";
import { authFetch } from "@/lib/authFetch";
import { normalizeGeminiData, mergeGeminiData, uniquePlayers, autoAssignAndEnrich } from "@/lib/gemini";
import SubscriptionNudge from "@/components/subscription-gate";
import ActivationPopup from "@/components/activation-popup";

const APP_NAME = "ScrimCalc";

export default function TeamsPage() {
  const { data: session, status } = useSession();

  // ── Auth gate: must be signed in to use the app ──
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0c0914" }}>
        <div className="flex flex-col items-center gap-5">
          <div className="relative">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-xl shadow-violet-500/25 animate-pulse">
              <span className="text-2xl font-black text-white">SC</span>
            </div>
            <div className="absolute -inset-2 rounded-3xl border-2 border-violet-500/30 border-t-violet-400 animate-spin" />
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <p className="text-sm font-medium text-violet-300/70">Loading…</p>
            <div className="flex gap-1">
              <span className="h-1 w-1 rounded-full bg-violet-400/50 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="h-1 w-1 rounded-full bg-violet-400/50 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="h-1 w-1 rounded-full bg-violet-400/50 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#0c0914" }}>
        <div
          className="w-full max-w-sm rounded-2xl p-6 space-y-5 text-center"
          style={{ background: "linear-gradient(135deg,#1a1030,#0f0a1e)", border: "1px solid rgba(124,58,237,0.3)" }}
        >
          <div>
            <div className="mx-auto h-16 w-16 rounded-xl flex items-center justify-center mb-4" style={{ background: "linear-gradient(135deg,rgba(124,58,237,0.3),rgba(168,85,247,0.2))" }}>
              <svg className="h-8 w-8 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0" /></svg>
            </div>
            <h1 className="text-xl font-black text-white">{APP_NAME}</h1>
            <p className="text-xs mt-2" style={{ color: "rgba(167,139,250,0.55)" }}>
              Sign in with your Google account to get started.
            </p>
          </div>

          <button
            onClick={() => signIn("google")}
            className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl text-sm font-bold text-white active:scale-95 transition-all"
            style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", boxShadow: "0 4px 20px rgba(124,58,237,0.3)" }}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Sign in with Google
          </button>

          <p className="text-[10px]" style={{ color: "rgba(167,139,250,0.25)" }}>
            Your data syncs securely with your Google account
          </p>
        </div>
      </div>
    );
  }

  // ── Authenticated — render full app ──
  return <AuthenticatedApp session={session} />;
}

function AuthenticatedApp({ session }: { session: ReturnType<typeof useSession>["data"] }) {
  const {
    tournaments, setTournaments, tournament, setTournament,
    pastTeams, setPastTeams, pageLoaded,
    save: rawSave,
  } = useCloudSync();
  const sub = useSubscription();
  const { guard } = sub;

  // Auto-show activation popup when user has a pending plan
  useEffect(() => {
    if (sub.pendingPlanDays && sub.pendingPlanDays > 0 && pageLoaded) {
      sub.setShowActivation(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sub.pendingPlanDays, pageLoaded]);

  // Save is always allowed — subscription gates specific features, not saving itself
  const save = useCallback((t: Tournament) => {
    rawSave(t);
  }, [rawSave]);

  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [roundRobin, setRoundRobin] = useState(false);
  const [clonedFromId, setClonedFromId] = useState<string | null>(null);
  const [excludedCloneTeams, setExcludedCloneTeams] = useState<Set<string>>(new Set());
  const [pendingCloneDraft, setPendingCloneDraft] = useState<import("@/lib/types").Tournament | null>(null);

  const [showAddScreen, setShowAddScreen] = useState(false);
  const [addScreenTab, setAddScreenTab] = useState<"add" | "entered" | "past">("add");

  const [addScreenMode, setAddScreenMode] = useState<"create" | "edit">("create");
  const [addForm, setAddForm] = useState({ name: "", tags: "", phone: "" });
  const [playerInputs, setPlayerInputs] = useState<string[]>([""]);  
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [editTeamForm, setEditTeamForm] = useState({ name: "", tags: "", players: "", phone: "", logo: "" });

  const [addScreenSnapshot, setAddScreenSnapshot] = useState<{ teamCount: number; entryFee: number; isActive: boolean } | null>(null);
  const [showSlots, setShowSlots] = useState(false);
  const [showStandings, setShowStandings] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const [showPointSystem, setShowPointSystem] = useState(false);
  const [editingPoints, setEditingPoints] = useState<PointSystem>(DEFAULT_BGMI_POINTS);
  const [showMorePositions, setShowMorePositions] = useState(false);
  const [standingsTab, setStandingsTab] = useState<"table" | "warhead" | "fraggers">("table");
  const [showStats, setShowStats] = useState(false);

  const playerInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [groups, setGroups] = useState<AssignedGroup[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [matchesDetected, setMatchesDetected] = useState(0);

  const [showShareModal, setShowShareModal] = useState(false);
  const [shareInfo, setShareInfo] = useState<{ code: string; url: string; name: string } | null>(null);
  const [showImportCode, setShowImportCode] = useState(false);
  const [importCode, setImportCode] = useState("");
  const [importLoading, setImportLoading] = useState(false);

  const [editingPlayerIdx, setEditingPlayerIdx] = useState<number | null>(null);
  const [showTeamDetails, setShowTeamDetails] = useState(false);
  const [showRoomInfo, setShowRoomInfo] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showBookings, setShowBookings] = useState(false);
  const [showPasteTip, setShowPasteTip] = useState(false);
  const [pendingPasteData, setPendingPasteData] = useState<GeminiOutput | null>(null);

  const [collabDeleteId, setCollabDeleteId] = useState<string | null>(null);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSplit, setShowSplit] = useState(false);
  const [showMatchEdit, setShowMatchEdit] = useState(false);
  const [groupFilter, setGroupFilter] = useState<string>("all");

  // Tracks whether we've pushed a history entry for the current overlay session.
  // We only ever want ONE entry pushed per session so one back-press closes it.
  const overlayPushed = useRef(false);

  // Back-button: push exactly ONE history entry when any overlay opens.
  // One back-press closes the top-most overlay; does NOT exit the website.
  useEffect(() => {
    const anyOpen =
      showCreate || showAddScreen || !!editingTeam ||
      showStats || showStandings || showSlots ||
      showPointSystem || showEdit ||
      showAdvanced || showSplit || showMatchEdit;

    if (anyOpen && !overlayPushed.current) {
      // Push with a hash so the URL changes and the system back button
      // is guaranteed to fire popstate instead of leaving the page.
      history.pushState({ overlay: true }, '', '#');
      overlayPushed.current = true;
    } else if (!anyOpen && overlayPushed.current) {
      // All overlays closed — clean the hash without adding a history entry
      history.replaceState({}, '', window.location.pathname + window.location.search);
      overlayPushed.current = false;
    }

    const onPop = () => {
      overlayPushed.current = false;
      // Close in reverse-depth order (deepest first)
      if (showMatchEdit)  { setShowMatchEdit(false); return; }
      if (showSplit)      { setShowSplit(false); return; }
      if (showAdvanced)   { setShowAdvanced(false); return; }
      if (editingTeam)    { setEditingTeam(null); return; }
      if (showStats)      { setShowStats(false); return; }
      if (showStandings)  { setShowStandings(false); return; }
      if (showSlots)      { setShowSlots(false); return; }
      if (showPointSystem){ setShowPointSystem(false); return; }
      if (showAddScreen)  { setShowAddScreen(false); return; }
      if (showEdit)       { setShowEdit(false); return; }
      if (showCreate)     { setShowCreate(false); setCreateName(''); setRoundRobin(false); return; }
    };

    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [showCreate, showAddScreen, editingTeam, showStats, showStandings,
      showSlots, showPointSystem, showEdit, showAdvanced, showSplit, showMatchEdit]);

  /**
   * Close an overlay via the close BUTTON.
   * Calls the closer, then calls history.back() to consume the pushed entry
   * so the history stack stays clean.
   */
  const closeOverlay = (closer: () => void) => {
    closer();
    if (overlayPushed.current) {
      overlayPushed.current = false;
      history.back();
    }
  };

  const recomputeStandings = (t: Tournament) => setStandings(computeStandingsFromTournament(t));

  // Only premium actions are gated; basic features (edit, bookings, room-info, rules) are free
  const PAID_ACTIONS = new Set(["calculate", "tables", "warheads", "fraggers", "slots"]);
  const openAction = (t: Tournament, action: string) => {
    if (PAID_ACTIONS.has(action) && !sub.isActive && !sub.isAdmin) { sub.setShowNudge(true); return; }
    setTournament(t);
    const { groups: g, assignments: a, matchesDetected: md } = normalizeAndAssign(t);
    setGroups(g); setAssignments(a); setMatchesDetected(md);
    setStandings(computeStandingsFromTournament(t));
    switch (action) {
      case "calculate": setShowStats(true); break;
      case "tables": setStandingsTab("table"); setShowStandings(true); break;
      case "warheads": setStandingsTab("warhead"); setShowStandings(true); break;
      case "fraggers": setStandingsTab("fraggers"); setShowStandings(true); break;
      case "slots": setShowSlots(true); break;
      case "edit": setShowEdit(true); break;
      case "bookings": setShowBookings(true); break;
      case "room-info": setShowRoomInfo(true); break;
      case "rules": setShowRulesModal(true); break;
      default: toast("Coming soon 🚀");
    }
  };

  const handleCreate = () => {
    // Tournament creation is free for all users
    if (!createName.trim()) return;
    const t = createTournament(createName.trim());
    setTournaments((prev) => [...prev, t]);
    setTournament(t);
    save(t);
    setCreateName(""); setRoundRobin(false); setShowCreate(false);
    setAddForm({ name: "", tags: "", phone: "" });
    setAddScreenTab("add"); setAddScreenMode("create"); setShowAddScreen(true);
    setAddScreenSnapshot({ teamCount: t.teams.length, entryFee: t.entryFee ?? 0, isActive: t.isActive ?? false });
  };

  const handleCloneCreate = (source: Tournament) => {
    // Build a unique name but do NOT save anything yet — draft lives in memory only
    const existingNames = new Set(tournaments.map(t => t.name));
    const baseName = source.name.replace(/ \(Copy(?:-\d+)?\)$/, "");
    let copyName = `${baseName} (Copy)`;
    let n = 2;
    while (existingNames.has(copyName)) { copyName = `${baseName} (Copy-${n++})`; }

    const draft: Tournament = {
      ...createTournament(copyName),
      teams: source.teams.filter((tm) => !tm.out).map((tm) => ({ ...tm, id: crypto.randomUUID(), out: true })),
      pointSystem: source.pointSystem,
      isActive: false, // copies always start with booking Off
    };

    // Store draft in memory — will only be saved if user confirms
    setPendingCloneDraft(draft);
    // Start ALL teams as OUT (not booked) — user marks each one IN before cloning
    setExcludedCloneTeams(new Set(draft.teams.map(t => t.id)));
    setShowCreate(false);
    setAddForm({ name: "", tags: "", phone: "" });
    setAddScreenTab("entered"); setAddScreenMode("create"); setShowAddScreen(true);
    setAddScreenSnapshot({ teamCount: draft.teams.length, entryFee: draft.entryFee ?? 0, isActive: draft.isActive ?? false });
  };

  const handleImportPC = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const imported = parsePointCalcFile(buffer);
      // Store as draft — will only be saved if user confirms (same as clone flow)
      setPendingCloneDraft(imported);
      setExcludedCloneTeams(new Set()); // all teams start included for imports
      setShowCreate(false);
      setCreateName("");
      toast.success(`"${imported.name}" loaded — review and confirm`);
      setAddForm({ name: "", tags: "", phone: "" });
      setAddScreenTab("entered"); setAddScreenMode("create"); setShowAddScreen(true);
      setAddScreenSnapshot({ teamCount: imported.teams.length, entryFee: imported.entryFee ?? 0, isActive: imported.isActive ?? false });
    } catch (err) {
      toast.error((err as Error).message || "Failed to read PointCalc file");
    }
  };

  const handleAddTeamToScreen = () => {
    if (!tournament || !addForm.name.trim()) return;

    // Phone is required for wallet auto-creation
    const phoneDigits = addForm.phone.trim().replace(/\D/g, "");
    if (!phoneDigits) {
      toast.error("Leader phone is required");
      return;
    }

    // Duplicate phone check
    const dup = tournament.teams.find(
      (t) => t.phone && t.phone.replace(/\D/g, "") === phoneDigits
    );
    if (dup) {
      toast.error(`📵 ${phoneDigits} already registered under "${dup.name}"`);
      return;
    }

    const players = playerInputs.map((p) => p.trim()).filter(Boolean);
    const newTeam: Team = {
      id: crypto.randomUUID(),
      name: addForm.name.trim(),
      players: players.length > 0 ? uniquePlayers(players) : undefined,
      phone: phoneDigits,
      out: false, // always IN when manually added
    };
    const updated = { ...tournament, teams: [...tournament.teams, newTeam] };
    save(updated);
    // Auto-create leader wallet (captain name or team name)
    const captainName = players[0] || newTeam.name;
    upsertLeaderWallet(captainName, phoneDigits);
    setAddForm({ name: "", tags: "", phone: "" });
    setPlayerInputs([""]);
    toast.success(`"${newTeam.name}" added!`);
  };

  const handleTeamNamePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    const parsed = parseTeamPaste(text);
    if (!parsed) return;
    e.preventDefault();
    if (parsed.teamName) setAddForm((f) => ({ ...f, name: parsed.teamName, phone: parsed.phone || f.phone }));
    if (parsed.players.length > 0) setPlayerInputs(parsed.players);
    toast.success('Team pasted!');
  };

  const saveEditTeam = () => {
    if (!tournament || !editingTeam) return;
    const liveTeam = tournament.teams.find(t => t.id === editingTeam.id) || editingTeam;
    const updatedTeam = {
      ...liveTeam,
      name: editTeamForm.name.trim() || liveTeam.name,
      tags: editTeamForm.tags.split(",").map(t=>t.trim()).filter(Boolean),
      phone: editTeamForm.phone.trim() || liveTeam.phone,
      logo: editTeamForm.logo || undefined,
    };
    const updated = tournament.teams.map((t) => t.id === editingTeam.id ? updatedTeam : t);
    save({ ...tournament, teams: updated });
    // Auto-upsert wallet when phone is present
    if (updatedTeam.phone) {
      const captainName = updatedTeam.players?.[0] || updatedTeam.name;
      upsertLeaderWallet(captainName, updatedTeam.phone);
    }
    setEditingTeam(null);
    toast.success('Team updated!');
  };

  const handleDeleteTournament = async (id: string) => {
    // Tournament deletion is free for all users
    setTournaments((prev) => {
      const next = prev.filter(t => t.id !== id);
      // Update local cache so deleted tournament doesn't flash back on refresh
      try { localStorage.setItem('bgmi-tournaments-cache', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    toast.success("Deleted");
    // Delete from server
    try {
      const res = await authFetch(`/api/tournaments/${id}`, { method: "DELETE" });
      if (!res.ok) toast.error("Server delete failed");
    } catch { /* offline */ }
  };

  const handleShare = async (t: Tournament) => {
    if (!sub.isActive && !sub.isAdmin) { sub.setShowNudge(true); return; }
    // If tokens already cached locally → open instantly, no network call
    if (t.shareToken && t.shortCode) {
      const url = `${window.location.origin}/t/${t.shareToken}`;
      setShareInfo({ code: t.shortCode, url, name: t.name });
      setShowShareModal(true);
      return;
    }
    // First time — fetch/generate tokens from server
    try {
      const res = await authFetch(`/api/tournaments/${t.id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: t }),
      });
      if (!res.ok) { toast.error(res.status === 401 ? "Sign in to share" : "Share failed"); return; }
      const { token, shortCode } = await res.json();
      const url = `${window.location.origin}/t/${token}`;
      // Cache tokens in local tournament data so next open is instant
      const updated = { ...t, shareToken: token, shortCode };
      save(updated);
      setShareInfo({ code: shortCode, url, name: t.name });
      setShowShareModal(true);
    } catch (e: unknown) {
      if ((e as Error).name !== "AbortError") toast.error("Share failed");
    }
  };

  const handleImportByCode = async () => {
    if (!sub.isActive && !sub.isAdmin) { sub.setShowNudge(true); return; }
    const code = importCode.trim().toUpperCase();
    if (code.length !== 6) { toast.error("Enter a valid 6-character code"); return; }
    setImportLoading(true);
    try {
      const res = await fetch(`/api/share/${code}`);
      if (!res.ok) { toast.error("Code not found — check and try again"); return; }
      const { tournament: t } = await res.json();
      if (!t) { toast.error("Invalid code"); return; }

      const existing = tournaments;

      // Block self-import: user is trying to import their own tournament
      const ownedIds = new Set(existing.filter(e => !e.sharedFrom).map(e => e.id));
      if (ownedIds.has(t.id)) {
        toast.error("That\'s your own tournament — you can\'t import it");
        setImportCode(""); setShowImportCode(false);
        return;
      }

      // Store sharedFrom so changes sync back to the owner's DB via the share code
      const alreadyImported = existing.find(e => e.sharedFrom === code);
      if (alreadyImported) {
        toast.info(`Already have "${t.name}" — it will sync automatically`);
        setImportCode(""); setShowImportCode(false);
        return;
      }
      const cloned: Tournament = { ...t, id: t.id ?? crypto.randomUUID(), sharedFrom: code, updatedAt: new Date().toISOString() };
      setTournaments((prev) => [cloned, ...prev]);
      setImportCode(""); setShowImportCode(false);
      toast.success(`"${t.name}" imported! Changes will sync back to the owner.`);
    } catch { toast.error("Import failed"); }
    finally { setImportLoading(false); }
  };

  /** True when this tournament was imported via share code and cannot be deleted */
  const isCollab = (t: Tournament) => !!(t.sharedFrom || t.name?.endsWith('(imported)'));

  /** Auto-create a leader wallet if one doesn't exist yet for that phone */
  const upsertLeaderWallet = (playerName: string, phone: string) => {
    fetch("/api/wallets/upsert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerName, phone }),
    }).catch(() => {}); // fire-and-forget, silently ignore errors
  };

  const copyPrompt = () => { if (!sub.isActive && !sub.isAdmin) { sub.setShowNudge(true); return; } if (!tournament) return; navigator.clipboard.writeText(generatePrompt(tournament.teams.filter(t => !t.out))); toast.success("Prompt copied!"); };

  const pasteJson = async () => { if (!sub.isActive && !sub.isAdmin) { sub.setShowNudge(true); return; } try { processJson(await navigator.clipboard.readText()); } catch { toast.error("Allow clipboard access"); } };

  /** Extract JSON from raw text — handles markdown code fences, leading text, etc. */
  const extractJson = (text: string): string => {
    // Try to extract from ```json ... ``` or ``` ... ``` fences
    const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    if (fenced) return fenced[1].trim();
    // Try to find the first { ... } block
    const braceStart = text.indexOf('{');
    const braceEnd = text.lastIndexOf('}');
    if (braceStart !== -1 && braceEnd > braceStart) return text.slice(braceStart, braceEnd + 1);
    return text.trim();
  };

  const processJson = (text: string) => {
    if (!tournament) return;
    try {
      const jsonStr = extractJson(text);
      const raw = JSON.parse(jsonStr) as GeminiOutput;
      if (!raw.groups || !Array.isArray(raw.groups)) throw new Error("Invalid JSON");
      const data = normalizeGeminiData(raw, tournament);

      // If data already exists, show confirmation modal instead of replacing immediately
      if (tournament.geminiData && tournament.geminiData.groups.length > 0) {
        setPendingPasteData(data);
        return;
      }

      // No existing data — apply directly
      applyGeminiData(data);
    } catch (err: unknown) { toast.error((err as Error).message || "Invalid JSON"); }
  };

  /** Apply gemini data directly (replace mode or first paste) */
  const applyGeminiData = (data: GeminiOutput) => {
    if (!tournament) return;
    const { assigned, autoAssignments, enrichedTeams } = autoAssignAndEnrich(tournament, data, assignments);
    setGroups(assigned);
    setAssignments(autoAssignments);
    setMatchesDetected(data.matches_detected || 0);
    const updated = { ...tournament, teams: enrichedTeams, geminiData: data, assignments: autoAssignments };
    save(updated);
    recomputeStandings(updated);
    const autoCount = Object.keys(autoAssignments).length;
    const enriched = enrichedTeams.filter((t, i) => t !== tournament.teams[i]).length;
    toast.success(`${data.groups.length} groups · ${data.matches_detected} matches · ${autoCount} assigned${enriched ? ` · ${enriched} rosters updated` : ""}`);
  };

  /** Accumulate: merge new matches into existing data */
  const handlePasteAccumulate = () => {
    if (!tournament || !pendingPasteData || !tournament.geminiData) return;
    const merged = mergeGeminiData(tournament.geminiData, pendingPasteData, tournament);
    const { assigned, autoAssignments, enrichedTeams } = autoAssignAndEnrich(tournament, merged, assignments);
    setGroups(assigned);
    setAssignments(autoAssignments);
    setMatchesDetected(merged.matches_detected || 0);
    const updated = { ...tournament, teams: enrichedTeams, geminiData: merged, assignments: autoAssignments };
    save(updated);
    recomputeStandings(updated);
    const existingCount = tournament.geminiData.matches_detected;
    const newCount = merged.matches_detected - existingCount;
    toast.success(`Added ${newCount} new matches (M${existingCount + 1}–M${merged.matches_detected}) · ${merged.matches_detected} total`);
    setPendingPasteData(null);
  };

  /** Replace: wipe existing data and use new data */
  const handlePasteReplace = () => {
    if (!pendingPasteData) return;
    applyGeminiData(pendingPasteData);
    setPendingPasteData(null);
  };
  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text");
    const trimmed = text.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("```")) { e.preventDefault(); processJson(text); }
  };
  const assignTeam = (groupLabel: string, teamId: string) => {
    if (!tournament) return;
    const na = { ...assignments, [groupLabel]: teamId }; setAssignments(na);
    setGroups((prev) => prev.map((g) => g.group === groupLabel ? { ...g, teamId, teamName: tournament.teams.find((t) => t.id === teamId)?.name } : g));
    const updated = { ...tournament, assignments: na }; save(updated); recomputeStandings(updated);
  };
  const unassignTeam = (groupLabel: string) => {
    if (!tournament) return;
    const na = { ...assignments }; delete na[groupLabel]; setAssignments(na);
    setGroups((prev) => prev.map((g) => g.group === groupLabel ? { ...g, teamId: undefined, teamName: undefined } : g));
    const updated = { ...tournament, assignments: na }; save(updated); recomputeStandings(updated);
  };

  // Hide bottom nav when any sheet/modal is open
  const anyModalOpen = showCreate || showAddScreen || showEdit || showStats || showStandings || showSlots || showPointSystem || showAdvanced || showSplit || showMatchEdit;
  // Lock body scroll when any modal/overlay is open
  useEffect(() => {
    document.body.dataset.modal = anyModalOpen ? "open" : "";
    document.body.style.overflow = anyModalOpen ? "hidden" : "";
    return () => { document.body.dataset.modal = ""; document.body.style.overflow = ""; };
  }, [anyModalOpen]);

  return (
    <div className="min-h-screen pb-36" style={{ background: "#0c0914" }} onPaste={handlePaste}>

      <MainView
        appName={APP_NAME}
        tournaments={tournaments}
        tournament={tournament}
        setTournament={setTournament}
        pageLoaded={pageLoaded}
        isCollab={isCollab}
        onOpenAction={openAction}
        onShare={handleShare}
        onDelete={handleDeleteTournament}
        onCollabDelete={setCollabDeleteId}
        onCreateOpen={() => setShowCreate(true)}
        onImportOpen={() => setShowImportCode(true)}
        save={save}
        sub={sub}
      />

      {/* CREATE SCREEN */}
      {showCreate && (
        <CreateScreen
          tournaments={tournaments}
          createName={createName}
          setCreateName={setCreateName}
          roundRobin={roundRobin}
          setRoundRobin={setRoundRobin}
          onClose={() => closeOverlay(() => { setShowCreate(false); setCreateName(""); setRoundRobin(false); })}
          onCreate={handleCreate}
          onClone={handleCloneCreate}
          onImportPC={handleImportPC}
        />
      )}
      {/* ADD TEAMS SCREEN */}
      {showAddScreen && (tournament || pendingCloneDraft) && (
        <AddTeamsScreen
          tournament={pendingCloneDraft ?? tournament!}
          addScreenTab={addScreenTab}
          setAddScreenTab={setAddScreenTab}
          addScreenMode={addScreenMode}
          addScreenSnapshot={addScreenSnapshot}
          addForm={addForm}
          setAddForm={setAddForm}
          playerInputs={playerInputs}
          setPlayerInputs={setPlayerInputs}
          playerInputRefs={playerInputRefs}
          clonedFromId={clonedFromId}
          setClonedFromId={setClonedFromId}
          excludedCloneTeams={excludedCloneTeams}
          setExcludedCloneTeams={setExcludedCloneTeams}
          showPasteTip={showPasteTip}
          setShowPasteTip={setShowPasteTip}
          handleAddTeamToScreen={handleAddTeamToScreen}
          handleTeamNamePaste={handleTeamNamePaste}
          parseTeamPaste={parseTeamPaste}
          handleDeleteTournament={handleDeleteTournament}
          save={save}
          setShowAddScreen={setShowAddScreen}
          setShowCreate={setShowCreate}
          setAddScreenSnapshot={setAddScreenSnapshot}
          isPendingClone={pendingCloneDraft !== null}
          onConfirmClone={(bookedTeamIds) => {
            // Clone ALL teams — set out:true for those not booked, out:false for booked ones
            const final = {
              ...pendingCloneDraft!,
              teams: pendingCloneDraft!.teams.map(t => ({ ...t, out: !bookedTeamIds.has(t.id) }))
            };
            setTournaments((prev) => [...prev, final]);
            setTournament(final);
            save(final);
            setPendingCloneDraft(null);
            setExcludedCloneTeams(new Set());
            setShowAddScreen(false);
            setAddScreenSnapshot(null);
            toast.success(`"${final.name}" created!`);
          }}
          onCancelClone={() => {
            setPendingCloneDraft(null);
            setExcludedCloneTeams(new Set());
            setShowAddScreen(false);
            setShowCreate(true);
          }}
          onEditTeam={(team) => {
            setEditingTeam(team);
            setEditTeamForm({
              name: team.name,
              tags: "",
              players: (team.players ?? []).join(", "),
              phone: team.phone ?? "",
              logo: team.logo ?? "",
            });
          }}
          pastTeams={pastTeams}
          onAddPastTeam={(pt) => {
            const t = pendingCloneDraft ?? tournament!;
            const newTeam: Team = {
              id: crypto.randomUUID(),
              name: pt.name,
              phone: pt.phone,
              players: pt.players,
              out: false,
            };
            const updated = { ...t, teams: [...t.teams, newTeam] };
            if (pendingCloneDraft) {
              setPendingCloneDraft(updated);
            } else {
              save(updated);
            }
          }}
          onDeletePastTeam={(pt) => {
            const updated = pastTeams.filter(p => p.name.toLowerCase().trim() !== pt.name.toLowerCase().trim());
            setPastTeams(updated);
            import("@/lib/storage").then(({ savePastTeams }) => savePastTeams(updated));
          }}
          onUpdatePastTeam={(pt) => {
            const updated = pastTeams.map(p => p.name.toLowerCase().trim() === pt.name.toLowerCase().trim() ? pt : p);
            setPastTeams(updated);
            import("@/lib/storage").then(({ savePastTeams }) => savePastTeams(updated));
          }}
        />
      )}

      {/* TEAM EDIT SCREEN */}
      {editingTeam && tournament && (
        <TeamEditScreen
          team={editingTeam}
          tournament={tournament}
          editTeamForm={editTeamForm}
          setEditTeamForm={setEditTeamForm}
          showTeamDetails={showTeamDetails}
          setShowTeamDetails={setShowTeamDetails}
          editingPlayerIdx={editingPlayerIdx}
          setEditingPlayerIdx={setEditingPlayerIdx}
          save={save}
          onSave={saveEditTeam}
          onClose={() => closeOverlay(() => { setEditingTeam(null); setShowTeamDetails(false); })}
        />
      )}

      {/* ADD TEAMS MODAL */}

      {/* POINT SYSTEM MODAL */}
      {showPointSystem && tournament && (
        <PointSystemModal
          tournament={tournament}
          editingPoints={editingPoints}
          setEditingPoints={setEditingPoints}
          showMorePositions={showMorePositions}
          setShowMorePositions={setShowMorePositions}
          save={save}
          onClose={() => closeOverlay(() => setShowPointSystem(false))}
        />
      )}

      {/* EDIT SHEET */}
      {showEdit && tournament && (
        <EditSheet
          tournament={tournament}
          save={save}
          onClose={() => closeOverlay(() => setShowEdit(false))}
          onEditTeams={() => {
            setShowEdit(false);
            setAddForm({ name: "", tags: "", phone: "" });
            setPlayerInputs([""]);
            setAddScreenTab("entered"); // open on Entered so user sees all teams + can toggle booked/not
            setAddScreenMode("edit");

            setAddScreenSnapshot({ teamCount: tournament?.teams.length ?? 0, entryFee: tournament?.entryFee ?? 0, isActive: tournament?.isActive ?? false });
            setShowAddScreen(true);
          }}
          onOpenPointSystem={() => {
            setShowEdit(false);
            setEditingPoints(tournament.pointSystem ?? DEFAULT_BGMI_POINTS);
            setShowPointSystem(true);
          }}
          onOpenAdvanced={() => { setShowEdit(false); setShowAdvanced(true); }}
          onEditPoints={() => { setShowEdit(false); setShowMatchEdit(true); }}
          onDelete={handleDeleteTournament}
        />
      )}

      {/* MATCH EDIT OVERLAY */}
      {showMatchEdit && tournament && groups.length > 0 && (
        <MatchEditOverlay
          tournament={tournament}
          groups={groups}
          matchesDetected={matchesDetected}
          onClose={() => closeOverlay(() => setShowMatchEdit(false))}
          onSave={(updates) => {
            if (!tournament?.geminiData) return;
            const ps = tournament.pointSystem ?? DEFAULT_BGMI_POINTS;
            const newGroups = tournament.geminiData.groups.map(g => {
              const update = updates.find(u => u.groupLabel === g.group);
              if (!update) return g;
              const matches = update.matches;
              const totals = {
                totalPoints: matches.reduce((a, m) => a + m.matchPoints, 0),
                chickenDinners: matches.filter(m => m.position === 1).length,
                totalPlacementPoints: matches.reduce((a, m) => a + m.placementPoints, 0),
                totalKills: matches.reduce((a, m) => a + m.teamKills, 0),
                lastMatchPosition: matches[matches.length - 1]?.position ?? 0,
              };
              return { ...g, matches, totals };
            });
            const updatedData = { ...tournament.geminiData, groups: newGroups };
            const updated = { ...tournament, geminiData: updatedData };
            save(updated);
            const { groups: refreshedGroups, assignments: a, matchesDetected: md } = normalizeAndAssign(updated);
            setGroups(refreshedGroups);
            setAssignments(a);
            setMatchesDetected(md);
            recomputeStandings(updated);
            closeOverlay(() => setShowMatchEdit(false));
          }}
          onAddMatch={() => {
            if (!tournament?.geminiData) return;
            const ps = tournament.pointSystem ?? DEFAULT_BGMI_POINTS;
            const newMatchNum = matchesDetected + 1;
            const newGroups = tournament.geminiData.groups.map(g => {
              const blankMatch = {
                match: newMatchNum,
                position: g.matches.length > 0 ? Math.max(...g.matches.map(m => m.position)) : 1,
                playerKills: Object.fromEntries(g.players.map(p => [p, 0])),
                teamKills: 0,
                placementPoints: 0,
                matchPoints: 0,
              };
              const matches = [...g.matches, blankMatch];
              const totals = {
                totalPoints: matches.reduce((a, m) => a + m.matchPoints, 0),
                chickenDinners: matches.filter(m => m.position === 1).length,
                totalPlacementPoints: matches.reduce((a, m) => a + m.placementPoints, 0),
                totalKills: matches.reduce((a, m) => a + m.teamKills, 0),
                lastMatchPosition: matches[matches.length - 1]?.position ?? 0,
              };
              return { ...g, matches, totals };
            });
            const updatedData = { ...tournament.geminiData, groups: newGroups, matches_detected: newMatchNum };
            const updated = { ...tournament, geminiData: updatedData };
            save(updated);
            const { groups: refreshedGroups, assignments: a, matchesDetected: md } = normalizeAndAssign(updated);
            setGroups(refreshedGroups);
            setAssignments(a);
            setMatchesDetected(md);
            recomputeStandings(updated);
            toast.success(`Match ${newMatchNum} added`);
          }}
          onDeleteMatch={(matchNum) => {
            if (!tournament?.geminiData) return;
            const newGroups = tournament.geminiData.groups.map(g => {
              const matches = g.matches
                .filter(m => m.match !== matchNum)
                .map(m => ({ ...m, match: m.match > matchNum ? m.match - 1 : m.match }));
              const totals = {
                totalPoints: matches.reduce((a, m) => a + m.matchPoints, 0),
                chickenDinners: matches.filter(m => m.position === 1).length,
                totalPlacementPoints: matches.reduce((a, m) => a + m.placementPoints, 0),
                totalKills: matches.reduce((a, m) => a + m.teamKills, 0),
                lastMatchPosition: matches[matches.length - 1]?.position ?? 0,
              };
              return { ...g, matches, totals };
            });
            const newDetected = Math.max(0, matchesDetected - 1);
            const updatedData = { ...tournament.geminiData, groups: newGroups, matches_detected: newDetected };
            const updated = { ...tournament, geminiData: updatedData };
            save(updated);
            const { groups: refreshedGroups, assignments: a, matchesDetected: md } = normalizeAndAssign(updated);
            setGroups(refreshedGroups);
            setAssignments(a);
            setMatchesDetected(md);
            recomputeStandings(updated);
            toast.success(`Match ${matchNum} deleted · renumbered`);
          }}
        />
      )}

      {/* ADVANCED SCREEN */}
      {showAdvanced && tournament && (
        <AdvancedScreen
          tournament={tournament}
          standings={standings}
          save={save}
          onClose={() => closeOverlay(() => setShowAdvanced(false))}
          onOpenSplit={() => { setShowAdvanced(false); setShowSplit(true); }}
        />
      )}

      {/* SPLIT SCREEN */}
      {showSplit && tournament && (
        <SplitScreen
          tournament={tournament}
          save={save}
          onClose={() => closeOverlay(() => setShowSplit(false))}
        />
      )}

      {/* STATS / CALCULATE MODAL */}
      {showStats && tournament && (
        <CalculateScreen
          tournament={tournament}
          groups={groups}
          assignments={assignments}
          matchesDetected={matchesDetected}
          standings={standings}
          groupFilter={groupFilter}
          setGroupFilter={setGroupFilter}
          onAssignTeam={assignTeam}
          onUnassignTeam={unassignTeam}
          onCopyPrompt={copyPrompt}
          onPasteJson={pasteJson}
          onClearData={() => {
            if (!tournament) return;
            const updated = { ...tournament, geminiData: undefined, assignments: {} };
            save(updated); setGroups([]); setAssignments({}); setMatchesDetected(0); setStandings([]);
            toast.success("Match data cleared");
          }}
          onClose={() => closeOverlay(() => setShowStats(false))}
        />
      )}

      {/* SLOTS MODAL */}
      {showSlots && tournament && (
        <SlotsModal tournament={tournament} groupFilter={groupFilter} setGroupFilter={setGroupFilter} onClose={() => closeOverlay(() => setShowSlots(false))} />
      )}

      {/* STANDINGS MODAL */}
      {showStandings && tournament && (
        <StandingsModal tournament={tournament} standings={standings} standingsTab={standingsTab} groupFilter={groupFilter} setGroupFilter={setGroupFilter} onClose={() => closeOverlay(() => setShowStandings(false))} />
      )}

      {/* SHARE CODE MODAL */}
      {showShareModal && shareInfo && tournament && (
        <ShareCodeModal tournament={tournament} save={save} shareInfo={shareInfo} onClose={() => setShowShareModal(false)} />
      )}

      {/* IMPORT BY CODE MODAL */}
      {showImportCode && (
        <ImportCodeModal
          importCode={importCode}
          setImportCode={setImportCode}
          importLoading={importLoading}
          onImport={handleImportByCode}
          onClose={() => setShowImportCode(false)}
        />
      )}

      {/* COLLAB LOCAL DELETE CONFIRM */}
      {collabDeleteId && (
        <CollabDeleteConfirm
          tournamentId={collabDeleteId}
          onConfirm={handleDeleteTournament}
          onCancel={() => setCollabDeleteId(null)}
        />
      )}

      {/* ROOM INFO */}
      {showRoomInfo && tournament && (
        <RoomInfoModal tournament={tournament} save={save} onClose={() => setShowRoomInfo(false)} />
      )}

      {/* BOOKINGS MODAL */}
      {showBookings && tournament && (
        <BookingsModal tournament={tournament} save={save} onClose={() => setShowBookings(false)} />
      )}

      {/* RULES MODAL */}
      {showRulesModal && tournament && (
        <RulesModal tournament={tournament} save={save} onClose={() => setShowRulesModal(false)} />
      )}

      {/* SUBSCRIPTION NUDGE */}
      {sub.showNudge && (
        <SubscriptionNudge
          userName={session?.user?.name}
          userEmail={session?.user?.email}
          isLoggedIn={sub.isLoggedIn}
          onClose={() => sub.setShowNudge(false)}
        />
      )}

      {/* ACTIVATION POPUP */}
      {sub.showActivation && sub.pendingPlanDays && sub.pendingPlanDays > 0 && (
        <ActivationPopup
          pendingDays={sub.pendingPlanDays}
          onClose={() => sub.setShowActivation(false)}
          onActivated={() => {
            sub.setShowActivation(false);
            // Force session refresh to pick up the new subscriptionEnd
            window.location.reload();
          }}
        />
      )}

      {/* PASTE ACCUMULATE/REPLACE MODAL */}
      {pendingPasteData && tournament && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
          <div className="w-full max-w-sm rounded-2xl p-5 space-y-4" style={{ background: "linear-gradient(135deg,#1a1030,#0f0a1e)", border: "1px solid rgba(124,58,237,0.3)" }}>
            <div>
              <h2 className="text-base font-bold text-white">Match data already exists</h2>
              <p className="text-xs mt-1.5" style={{ color: "rgba(167,139,250,0.55)" }}>
                You have {matchesDetected} matches (M1–M{matchesDetected}). What do you want to do with the new data?
              </p>
            </div>
            <div className="space-y-2">
              <button
                onClick={handlePasteAccumulate}
                className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all active:scale-[0.98]"
                style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)" }}
              >
                <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 text-lg" style={{ background: "rgba(124,58,237,0.25)" }}>➕</div>
                <div>
                  <p className="text-sm font-bold text-white">Add to existing</p>
                  <p className="text-[11px] mt-0.5" style={{ color: "rgba(167,139,250,0.5)" }}>
                    New matches become M{matchesDetected + 1}, M{matchesDetected + 2}…
                  </p>
                </div>
              </button>
              <button
                onClick={handlePasteReplace}
                className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all active:scale-[0.98]"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
              >
                <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 text-lg" style={{ background: "rgba(239,68,68,0.15)" }}>🔄</div>
                <div>
                  <p className="text-sm font-bold text-white">Replace all</p>
                  <p className="text-[11px] mt-0.5" style={{ color: "rgba(239,68,68,0.5)" }}>
                    Clear everything and start fresh
                  </p>
                </div>
              </button>
            </div>
            <button
              onClick={() => setPendingPasteData(null)}
              className="w-full py-2 text-xs font-medium rounded-lg transition-colors"
              style={{ color: "rgba(167,139,250,0.4)" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
