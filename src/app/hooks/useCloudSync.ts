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

/** Write cache — persists tournaments locally so they survive page refresh */
function writeCache(tournaments: Tournament[]): void {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(tournaments)); } catch { /* quota exceeded, ignore */ }
}

interface SyncResult {
  tournaments: Tournament[];
  setTournaments: React.Dispatch<React.SetStateAction<Tournament[]>>;
  tournament: Tournament | null;
  setTournament: React.Dispatch<React.SetStateAction<Tournament | null>>;
  pastTeams: PastTeam[];
  setPastTeams: React.Dispatch<React.SetStateAction<PastTeam[]>>;
  pageLoaded: boolean;
  save: (t: Tournament) => void;
}

export function useCloudSync(): SyncResult {
  const [tournaments, _setTournaments] = useState<Tournament[]>([]);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [pastTeams, setPastTeams] = useState<PastTeam[]>([]);
  const [pageLoaded, setPageLoaded] = useState(false);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pushInProgress = useRef(false);

  // ── Ref that always mirrors the tournaments state ──
  // React 18 automatic batching can prevent functional-update state reads
  // from working synchronously when another setState has already dirtied
  // the fiber's lanes. A ref is immune to this and always readable.
  const tournamentsRef = useRef<Tournament[]>([]);

  // Wrapped setTournaments that keeps the ref in sync
  const setTournaments: React.Dispatch<React.SetStateAction<Tournament[]>> = useCallback(
    (action: React.SetStateAction<Tournament[]>) => {
      _setTournaments(prev => {
        const next = typeof action === 'function' ? action(prev) : action;
        tournamentsRef.current = next;
        return next;
      });
    },
    [],
  );

  // ── Push to API ──
  // Sends the current in-memory tournaments to the server.
  // Called on a debounce after every save().
  const pushToServer = useCallback(async () => {
    if (!navigator.onLine) return;
    if (pushInProgress.current) return;
    pushInProgress.current = true;
    try {
      // Read latest in-memory state from the ref (always up-to-date)
      const latest = tournamentsRef.current;

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
        if (!res.ok && res.status !== 401) throw new Error("Push failed");
      }

      // After successful push, update cache
      writeCache(latest);
    } catch {
      // Retry in 5s on failure
      if (pushTimer.current) clearTimeout(pushTimer.current);
      pushTimer.current = setTimeout(() => pushToServer(), 5000);
    } finally {
      pushInProgress.current = false;
    }
  }, []);

  // Debounced push — called after every save()
  const scheduleSyncDebounce = useCallback(() => {
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => pushToServer(), 500);
  }, [pushToServer]);

  // ── Save ──
  // Updates in-memory state + local cache immediately, then pushes to cloud via debounce.
  const save = useCallback((t: Tournament) => {
    const updated = { ...t, updatedAt: new Date().toISOString() };
    setTournament(updated);
    setTournaments(prev => {
      const idx = prev.findIndex(x => x.id === updated.id);
      const next = idx >= 0
        ? prev.map(x => x.id === updated.id ? updated : x)
        : [...prev, updated];
      // Persist to local cache immediately so data survives refresh
      writeCache(next);
      return next;
    });
    scheduleSyncDebounce();
  }, [scheduleSyncDebounce, setTournaments]);

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
      })
      .catch(() => {
        // Offline or error — use cache
        setPageLoaded(true);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Push pending data on page close (safety net) ──
  useEffect(() => {
    const onBeforeUnload = () => {
      if (pushTimer.current) {
        clearTimeout(pushTimer.current);
        pushTimer.current = null;
      }
      // Always try to push unsaved changes via sendBeacon
      const latest = tournamentsRef.current;
      const owned = latest.filter(t => !t.sharedFrom);
      if (owned.length > 0) {
        navigator.sendBeacon(
          "/api/tournaments",
          new Blob([JSON.stringify({ tournaments: owned })], { type: "application/json" }),
        );
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  return {
    tournaments, setTournaments,
    tournament, setTournament,
    pastTeams, setPastTeams,
    pageLoaded,
    save,
  };
}
