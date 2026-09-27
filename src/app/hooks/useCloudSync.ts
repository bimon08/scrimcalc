"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Tournament } from "@/lib/types";
import { syncPastTeamsFromTournaments } from "@/lib/storage";
import type { PastTeam } from "@/lib/storage";
import { authFetch } from "@/lib/authFetch";

const CACHE_KEY = "bgmi-tournaments-cache";

/** Read-only cache — used only for instant initial render while API loads */
function readCache(): Tournament[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Tournament[]) : [];
  } catch { return []; }
}

/** Write cache — called after successful API responses */
function writeCache(tournaments: Tournament[]): void {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(tournaments)); } catch { /* quota exceeded, ignore */ }
}

export type SyncStatus = 'idle' | 'pending' | 'syncing' | 'offline' | 'synced' | 'unauthed';

interface SyncResult {
  tournaments: Tournament[];
  setTournaments: React.Dispatch<React.SetStateAction<Tournament[]>>;
  tournament: Tournament | null;
  setTournament: React.Dispatch<React.SetStateAction<Tournament | null>>;
  pastTeams: PastTeam[];
  setPastTeams: React.Dispatch<React.SetStateAction<PastTeam[]>>;
  pageLoaded: boolean;
  syncStatus: SyncStatus;
  save: (t: Tournament) => void;
  handleSync: () => void;
  scheduleSyncDebounce: () => void;
}

export function useCloudSync(): SyncResult {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [pastTeams, setPastTeams] = useState<PastTeam[]>([]);
  const [pageLoaded, setPageLoaded] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pushInProgress = useRef(false);

  // ── Push to API ──
  // Sends the current in-memory tournaments to the server.
  // Called on a debounce after every save().
  const pushToServer = useCallback(async (showToast = false) => {
    if (!navigator.onLine) { setSyncStatus('offline'); return; }
    if (pushInProgress.current) return;
    pushInProgress.current = true;
    setSyncStatus('syncing');
    try {
      // Read latest in-memory state via functional update trick
      let latest: Tournament[] = [];
      setTournaments(prev => { latest = prev; return prev; });

      const owned = latest.filter(t => !t.sharedFrom);
      const sharedCodes = latest
        .filter(t => t.sharedFrom)
        .map(t => t.sharedFrom!)
        .filter((v, i, a) => a.indexOf(v) === i);

      if (owned.length > 0 || sharedCodes.length > 0) {
        const res = await authFetch("/api/tournaments", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tournaments: owned, sharedCodes }),
        });
        if (res.status === 401) {
          setSyncStatus('unauthed');
          if (showToast) toast.error("Not logged in — changes not saved");
          return;
        }
        if (!res.ok) throw new Error("Push failed");
      }

      // After successful push, update cache
      writeCache(latest);
      setSyncStatus('synced');
      if (showToast) toast.success("Synced ☁️");
    } catch {
      if (!navigator.onLine) {
        setSyncStatus('offline');
      } else {
        setSyncStatus('idle');
        // Retry in 5s
        if (pushTimer.current) clearTimeout(pushTimer.current);
        pushTimer.current = setTimeout(() => pushToServer(false), 5000);
      }
    } finally {
      pushInProgress.current = false;
    }
  }, []);

  // Debounced push — called after every save()
  const scheduleSyncDebounce = useCallback(() => {
    setSyncStatus('pending');
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => pushToServer(false), 500);
  }, [pushToServer]);

  // ── Save ──
  // Updates in-memory state immediately → schedules debounced push to API
  const save = useCallback((t: Tournament) => {
    const updated = { ...t, updatedAt: new Date().toISOString() };
    setTournament(updated);
    setTournaments(prev => {
      const idx = prev.findIndex(x => x.id === updated.id);
      const next = idx >= 0
        ? prev.map(x => x.id === updated.id ? updated : x)
        : [...prev, updated];
      return next;
    });
    scheduleSyncDebounce();
  }, [scheduleSyncDebounce]);

  // ── Full pull from server (manual sync button) ──
  const handleSync = useCallback(() => {
    if (pushTimer.current) { clearTimeout(pushTimer.current); pushTimer.current = null; }
    const doFullSync = async () => {
      if (!navigator.onLine) { setSyncStatus('offline'); toast.error("You're offline"); return; }
      setSyncStatus('syncing');
      try {
        // First push any pending changes
        let latest: Tournament[] = [];
        setTournaments(prev => { latest = prev; return prev; });

        const owned = latest.filter(t => !t.sharedFrom);
        const sharedCodes = latest
          .filter(t => t.sharedFrom)
          .map(t => t.sharedFrom!)
          .filter((v, i, a) => a.indexOf(v) === i);

        if (owned.length > 0 || sharedCodes.length > 0) {
          await authFetch("/api/tournaments", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tournaments: owned, sharedCodes }),
          });
        }

        // Then pull fresh data from server
        const pullRes = await authFetch("/api/tournaments");
        if (pullRes.status === 401) { setSyncStatus('unauthed'); toast.error("Not logged in"); return; }
        if (!pullRes.ok) throw new Error("Pull failed");

        const { tournaments: remote, sharedCodes: serverSharedCodes } = await pullRes.json() as {
          tournaments: Tournament[];
          sharedCodes: string[];
        };

        // Pull shared tournaments
        const sharedTournaments: Tournament[] = [];
        for (const code of (serverSharedCodes ?? [])) {
          try {
            const sRes = await fetch(`/api/share/${code}`);
            if (!sRes.ok) continue;
            const { tournament: t } = await sRes.json() as { tournament: Tournament };
            if (t && !remote.some(r => r.id === t.id)) {
              sharedTournaments.push({ ...t, sharedFrom: code });
            }
          } catch { /* skip */ }
        }

        const merged = [...remote, ...sharedTournaments];
        setTournaments(merged);
        setTournament(prev => prev ? (merged.find(t => t.id === prev.id) ?? prev) : prev);
        setPastTeams(syncPastTeamsFromTournaments(merged));
        writeCache(merged);
        setSyncStatus('synced');
        toast.success("Synced ☁️");
      } catch {
        setSyncStatus(navigator.onLine ? 'idle' : 'offline');
        toast.error("Sync failed");
      }
    };
    doFullSync();
  }, []);

  // ── Initial load — cloud-first, cache fallback ──
  useEffect(() => {
    // Show cached data immediately for fast initial render
    const cached = readCache();
    if (cached.length > 0) {
      setTournaments(cached);
      setPastTeams(syncPastTeamsFromTournaments(cached));
    }

    // Fetch from server (source of truth)
    authFetch("/api/tournaments")
      .then(r => r.ok ? r.json() : null)
      .then(async (json) => {
        if (!json?.tournaments) {
          // API failed — keep cached data
          setPageLoaded(true);
          setSyncStatus(navigator.onLine ? 'idle' : 'offline');
          return;
        }

        const remote: Tournament[] = json.tournaments;
        const serverSharedCodes: string[] = json.sharedCodes ?? [];

        // Pull shared tournaments
        const sharedTournaments: Tournament[] = [];
        for (const code of serverSharedCodes) {
          try {
            const sRes = await fetch(`/api/share/${code}`);
            if (!sRes.ok) continue;
            const { tournament: t } = await sRes.json() as { tournament: Tournament };
            if (t && !remote.some(r => r.id === t.id)) {
              sharedTournaments.push({ ...t, sharedFrom: code });
            }
          } catch { /* skip */ }
        }

        const merged = [...remote, ...sharedTournaments];
        setTournaments(merged);
        setPastTeams(syncPastTeamsFromTournaments(merged));
        writeCache(merged);
        setPageLoaded(true);
        setSyncStatus('synced');
      })
      .catch(() => {
        // Offline or error — use cache
        setPageLoaded(true);
        if (!navigator.onLine) setSyncStatus('offline');
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Push pending data on page close ──
  useEffect(() => {
    const onBeforeUnload = () => {
      if (pushTimer.current) {
        clearTimeout(pushTimer.current);
        pushTimer.current = null;
        // Use sendBeacon for reliable last-chance push
        let latest: Tournament[] = [];
        setTournaments(prev => { latest = prev; return prev; });
        const owned = latest.filter(t => !t.sharedFrom);
        if (owned.length > 0) {
          navigator.sendBeacon(
            "/api/tournaments",
            new Blob([JSON.stringify({ tournaments: owned })], { type: "application/json" })
          );
        }
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  return {
    tournaments, setTournaments,
    tournament, setTournament,
    pastTeams, setPastTeams,
    pageLoaded, syncStatus,
    save, handleSync, scheduleSyncDebounce,
  };
}
