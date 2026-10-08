import { Tournament } from "./types";

const KEY = "bgmi-tournaments";
const LEGACY_KEY = "bgmi-simple-stats";

export function loadTournaments(): Tournament[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(KEY);
  if (raw) {
    try {
      const all = JSON.parse(raw) as Tournament[];
      // Deduplicate by ID — keep the most recently updated copy
      const seen = new Map<string, Tournament>();
      for (const t of all) {
        const existing = seen.get(t.id);
        if (!existing || (t.updatedAt ?? "") >= (existing.updatedAt ?? "")) seen.set(t.id, t);
      }
      return [...seen.values()];
    } catch { return []; }
  }
  // Migrate legacy single tournament
  const legacy = localStorage.getItem(LEGACY_KEY);
  if (legacy) {
    try {
      const t = JSON.parse(legacy) as Tournament;
      const arr = [t];
      localStorage.setItem(KEY, JSON.stringify(arr));
      return arr;
    } catch { return []; }
  }
  return [];
}

export function saveTournaments(tournaments: Tournament[]): void {
  localStorage.setItem(KEY, JSON.stringify(tournaments));
}

export function upsertTournament(t: Tournament, all: Tournament[]): Tournament[] {
  const stamped = { ...t, updatedAt: new Date().toISOString() };
  const idx = all.findIndex(x => x.id === t.id);
  const updated = idx >= 0 ? all.map(x => x.id === t.id ? stamped : x) : [...all, stamped];
  saveTournaments(updated);
  return updated;
}

/** Merge remote tournaments into local ones. Newer updatedAt wins per id. */
export function mergeTournaments(local: Tournament[], remote: Tournament[]): Tournament[] {
  const map = new Map<string, Tournament>();
  for (const t of local) map.set(t.id, t);
  for (const t of remote) {
    const existing = map.get(t.id);
    if (!existing) { map.set(t.id, t); continue; }
    const localTs = existing.updatedAt ?? existing.createdAt;
    const remoteTs = t.updatedAt ?? t.createdAt;
    if (remoteTs > localTs) map.set(t.id, t);
  }
  return Array.from(map.values());
}

export function createTournament(name: string): Tournament {
  return {
    id: crypto.randomUUID(),
    name,
    createdAt: new Date().toISOString(),
    teams: [],
  };
}

export function deleteTournamentById(id: string, all: Tournament[]): Tournament[] {
  const updated = all.filter(t => t.id !== id);
  saveTournaments(updated);
  // Track deleted IDs so sync doesn't re-add them from DB
  markTournamentDeleted(id);
  return updated;
}

const DELETED_KEY = "bgmi-deleted-tournaments";

export function markTournamentDeleted(id: string): void {
  const ids = getDeletedTournamentIds();
  ids.add(id);
  localStorage.setItem(DELETED_KEY, JSON.stringify([...ids]));
}

export function getDeletedTournamentIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch { return new Set(); }
}

export function clearDeletedTournamentId(id: string): void {
  const ids = getDeletedTournamentIds();
  ids.delete(id);
  localStorage.setItem(DELETED_KEY, JSON.stringify([...ids]));
}

// Legacy compat exports
export function loadTournament(): Tournament | null {
  const all = loadTournaments();
  return all[0] ?? null;
}
export function saveTournament(t: Tournament): void {
  const all = loadTournaments();
  upsertTournament(t, all);
}
export function deleteTournament(): void {
  const all = loadTournaments();
  if (all[0]) deleteTournamentById(all[0].id, all);
}
export function exportData(): string {
  return JSON.stringify(loadTournaments(), null, 2);
}
export function importData(json: string): Tournament {
  const t = JSON.parse(json) as Tournament;
  const all = loadTournaments();
  upsertTournament(t, all);
  return t;
}

/* ─── PointCalc .pc File Import ─── */

interface PCTournament {
  name: string;
  killPoint?: number;
  roundRobinGroups?: unknown[];
  timestamp?: number;
}

interface PCTeamEntity {
  id?: number;
  teamName?: string;
  name?: string;
  slot?: number;
  phone?: string;
  contactNumber?: string;
  players?: string[];
  playerNames?: string[];
}

interface PCPointSystem {
  position: number;
  points: number;
}

interface PCFile {
  tournament: PCTournament;
  teamEntities: PCTeamEntity[];
  players?: Array<{ name?: string; teamName?: string; teamId?: number }>;
  pointSystemEntity: PCPointSystem[];
  teamLogosCount?: number;
  playerLogosCount?: number;
}

/**
 * Parse a PointCalc `.pc` file (binary with TNSP header) into a ScrimCalc Tournament.
 * Format: 4-byte magic "TNSP" + 4-byte big-endian JSON length + JSON body.
 */
export function parsePointCalcFile(buffer: ArrayBuffer): Tournament {
  const bytes = new Uint8Array(buffer);

  // Validate magic header "TNSP"
  const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (magic !== "TNSP") {
    throw new Error("Not a valid PointCalc file (missing TNSP header)");
  }

  // Find the start of JSON (first '{' byte)
  let jsonStart = -1;
  for (let i = 4; i < Math.min(bytes.length, 32); i++) {
    if (bytes[i] === 0x7B) { // '{'
      jsonStart = i;
      break;
    }
  }
  if (jsonStart === -1) throw new Error("Could not find JSON data in PointCalc file");

  const decoder = new TextDecoder("utf-8");
  const jsonStr = decoder.decode(bytes.slice(jsonStart));
  const pc: PCFile = JSON.parse(jsonStr);

  // Convert teams
  const teams: import("./types").Team[] = (pc.teamEntities ?? []).map((te, i) => {
    const name = te.teamName || te.name || `Team ${i + 1}`;
    const phone = te.phone || te.contactNumber || undefined;

    // Collect player names from team entity or from the players array
    let playerNames = te.players || te.playerNames || [];
    if (playerNames.length === 0 && pc.players) {
      const teamId = te.id;
      const teamName = te.teamName || te.name;
      playerNames = pc.players
        .filter(p => p.teamId === teamId || p.teamName === teamName)
        .map(p => p.name ?? "")
        .filter(Boolean);
    }

    return {
      id: crypto.randomUUID(),
      name,
      phone,
      slot: te.slot ?? (i + 1),
      players: playerNames,
    };
  });

  // Convert point system — sort by position ascending
  const sorted = [...(pc.pointSystemEntity ?? [])].sort((a, b) => a.position - b.position);
  // Extract position points (positions 1..N where points > 0)
  const positionPoints: number[] = [];
  for (const entry of sorted) {
    if (entry.points > 0) {
      positionPoints.push(entry.points);
    }
  }

  const pointSystem: import("./types").PointSystem = {
    killPoints: pc.tournament.killPoint ?? 1,
    positionPoints: positionPoints.length > 0 ? positionPoints : [10, 6, 5, 4, 3, 2, 1, 1],
  };

  return {
    id: crypto.randomUUID(),
    name: pc.tournament.name || "Imported Tournament",
    createdAt: new Date().toISOString(),
    teams,
    pointSystem,
  };
}

/* ─── Past Teams Pool ─── */
export interface PastTeam {
  name: string;
  phone?: string;
  players: string[];
}

const PAST_TEAMS_KEY = "bgmi_past_teams";

export function loadPastTeams(): PastTeam[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(PAST_TEAMS_KEY) || "[]") as PastTeam[];
  } catch { return []; }
}

export function savePastTeams(teams: PastTeam[]): void {
  localStorage.setItem(PAST_TEAMS_KEY, JSON.stringify(teams));
}

/** Collect all teams from all tournaments into the past teams pool (deduped by name) */
export function syncPastTeamsFromTournaments(tournaments: Tournament[]): PastTeam[] {
  const existing = loadPastTeams();
  const byName = new Map<string, PastTeam>();
  // Existing first
  existing.forEach(t => byName.set(t.name.toLowerCase().trim(), t));
  // Then all tournament teams (newer data wins)
  tournaments.forEach(tour => {
    tour.teams.forEach(team => {
      const key = team.name.toLowerCase().trim();
      // Filter out purely numeric entries (phone numbers, indices) and single chars
      const cleanPlayers = (team.players ?? []).filter(p => {
        const trimmed = p.trim();
        if (!trimmed) return false;
        if (/^\d+$/.test(trimmed)) return false; // purely numeric
        if (trimmed.length <= 1) return false; // single char
        return true;
      });
      byName.set(key, {
        name: team.name,
        phone: team.phone,
        players: cleanPlayers,
      });
    });
  });
  const merged = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  savePastTeams(merged);
  return merged;
}

/** Split active teams randomly into two groups.
 *  Odd count → latest-added team (last in array) goes to waiting list. */
export function splitTeamsRandomly(teams: import("./types").Team[], groupCount: number = 2): {
  groups: Record<string, string[]>;  // label → team IDs
  waiting: string[];
} {
  const { groupLabels } = require("./groups");
  const labels: string[] = groupLabels(groupCount);
  const active = teams.filter(t => !t.out);
  const result: Record<string, string[]> = {};
  labels.forEach(l => { result[l] = []; });

  if (active.length === 0) return { groups: result, waiting: [] };

  const toSplit = [...active];
  const waiting: string[] = [];

  // Remove leftovers that don't divide evenly into groupCount
  const remainder = toSplit.length % groupCount;
  for (let i = 0; i < remainder; i++) {
    waiting.push(toSplit.pop()!.id);
  }

  // Fisher-Yates shuffle
  for (let i = toSplit.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [toSplit[i], toSplit[j]] = [toSplit[j], toSplit[i]];
  }

  // Distribute evenly across groups
  const perGroup = Math.floor(toSplit.length / groupCount);
  labels.forEach((label, idx) => {
    result[label] = toSplit.slice(idx * perGroup, (idx + 1) * perGroup).map(t => t.id);
  });

  return { groups: result, waiting };
}

