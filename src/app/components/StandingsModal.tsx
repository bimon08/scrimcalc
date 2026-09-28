"use client";
import { useState, useRef, useCallback } from "react";
import { X } from "lucide-react";
import html2canvas from "html2canvas-pro";
import { toast } from "sonner";
import { Tournament, StandingRow } from "@/lib/types";
import standingsThemes from "@/lib/standingsThemes";
import GroupFilterDropdown from "./GroupFilterDropdown";
import ExportPopover from "./ExportPopover";
import ThemeCarousel from "./ThemeCarousel";

const APP_NAME = "ScrimCalc";
type Theme = typeof standingsThemes[0];
type Format = "square" | "landscape";

interface Props {
  tournament: Tournament;
  standings: StandingRow[];
  standingsTab: "table" | "warhead" | "fraggers";
  groupFilter: string;
  setGroupFilter: (v: string) => void;
  onClose: () => void;
}

export default function StandingsModal({ tournament, standings, standingsTab, groupFilter, setGroupFilter, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [format, setFormat] = useState<Format>("landscape");

  const handleActiveIndexChange = (i: number) => { setActiveIdx(i); };

  // Group-aware filtering & fallback to registered teams if no matches/pasted data yet
  const activeTeams = tournament.teams.filter(
    (t) => !t.out && (!tournament.splitEnabled || groupFilter === "all" || t.group === groupFilter)
  );

  const rawFilteredStandings = tournament.splitEnabled && groupFilter !== "all"
    ? standings.filter(row => { const team = tournament.teams.find(t => t.id === row.teamId); return team?.group === groupFilter; })
    : standings;

  const filteredStandings: StandingRow[] = rawFilteredStandings.length > 0
    ? rawFilteredStandings
    : activeTeams.map((team) => ({
        teamId: team.id,
        teamName: team.name,
        group: team.group || "—",
        players: team.players ?? [],
        totalPoints: 0,
        chickenDinners: 0,
        placementPoints: 0,
        totalKills: 0,
        lastMatchPosition: 0,
        positions: [],
        matchCount: 0,
      }));

  const warheadData = [...filteredStandings].sort((a, b) => b.totalKills - a.totalKills);

  const filteredTeamIds = tournament.splitEnabled && groupFilter !== "all"
    ? new Set(tournament.teams.filter(t => t.group === groupFilter).map(t => t.id))
    : null;

  const killMap = new Map<string, number>();
  tournament.geminiData?.groups.forEach((group) => {
    if (filteredTeamIds) {
      const assignedTeamId = tournament.assignments?.[group.group];
      if (assignedTeamId && !filteredTeamIds.has(assignedTeamId)) return;
    }
    group.matches.forEach((match) => Object.entries(match.playerKills).forEach(([p, k]) => killMap.set(p, (killMap.get(p) || 0) + k)));
  });
  let topFraggers = [...killMap.entries()].map(([name, kills]) => ({ name, kills })).sort((a, b) => b.kills - a.kills).slice(0, 20);
  if (topFraggers.length === 0) {
    const playerList: { name: string; kills: number }[] = [];
    activeTeams.forEach((t) => {
      (t.players ?? []).forEach((p) => {
        if (p && p.trim()) playerList.push({ name: p.trim(), kills: 0 });
      });
    });
    topFraggers = playerList.length > 0
      ? playerList.slice(0, 20)
      : activeTeams.map(t => ({ name: t.name, kills: 0 })).slice(0, 20);
  }

  // Image capture
  const capture = useCallback(async (download: boolean) => {
    const el = cardRef.current;
    if (!el) {
      toast.error("Card not ready");
      return;
    }

    // Temporarily make outer container square-cornered so full background bleeds to all 4 edges without white corners
    const prevRadius = el.style.borderRadius;
    el.style.borderRadius = "0px";
    const overlayEls = el.querySelectorAll<HTMLElement>(".absolute.inset-0");
    const prevOverlayRadii: string[] = [];
    overlayEls.forEach((o) => {
      prevOverlayRadii.push(o.style.borderRadius);
      o.style.borderRadius = "0px";
    });

    try {
      const canvas = await html2canvas(el, {
        useCORS: true,
        allowTaint: true,
        scale: Math.max(2, typeof window !== "undefined" ? window.devicePixelRatio || 2 : 2),
        backgroundColor: null,
        logging: false,
        imageTimeout: 5000,
      });

      const fileName = `${tournament.name || "standings"}-${standingsTab}.jpg`;

      // 1. Direct download
      if (download) {
        const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
        const a = document.createElement("a");
        a.download = fileName;
        a.href = dataUrl;
        a.click();
        toast.success("Downloaded!");
        return;
      }

      // 2. Web Share API (mobile & supported browsers)
      const jpegBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.95));
      if (jpegBlob && typeof navigator !== "undefined" && navigator.share) {
        const file = new File([jpegBlob], fileName, { type: "image/jpeg" });
        if (navigator.canShare?.({ files: [file] })) {
          try {
            await navigator.share({ files: [file], title: tournament.name || "Standings" });
            return;
          } catch (shareErr: unknown) {
            if ((shareErr as Error).name === "AbortError") return;
            // Fall through to clipboard or download on share failure
          }
        }
      }

      // 3. Fallback: Copy to clipboard (Browsers require image/png for ClipboardItem)
      if (typeof navigator !== "undefined" && navigator.clipboard && window.ClipboardItem) {
        try {
          const pngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
          if (pngBlob) {
            await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob })]);
            toast.success("Image copied to clipboard!");
            return;
          }
        } catch {
          // Fall through to download
        }
      }

      // 4. Fallback: Download file directly
      const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
      const a = document.createElement("a");
      a.download = fileName;
      a.href = dataUrl;
      a.click();
      toast.success("Downloaded image");
    } catch (err: unknown) {
      if ((err as Error).name !== "AbortError") {
        console.error("Capture error:", err);
        toast.error("Failed to generate image");
      }
    } finally {
      el.style.borderRadius = prevRadius;
      overlayEls.forEach((o, i) => {
        o.style.borderRadius = prevOverlayRadii[i] || "";
      });
    }
  }, [tournament.name, standingsTab]);

  // Helpers
  const groupSuffix = tournament.splitEnabled && groupFilter !== "all" ? ` · ${groupFilter === "final" ? "Final" : `Group ${groupFilter}`}` : "";
  const badgeLabel = (standingsTab === "table" ? "🏆 Overall Rankings" : standingsTab === "warhead" ? "💀 Team Kills" : "🔫 Top Fraggers") + groupSuffix;

  const renderTitle = (t: Theme) => {
    const titleProps = { name: tournament.name, badge: badgeLabel, count: filteredStandings.length };
    switch (t.layout) {
      case "banner": return <div className="mb-2"><div style={{ borderLeft: `4px solid ${t.accentColor}`, paddingLeft: "12px" }}><h2 className="text-lg font-black tracking-wider uppercase" style={{ color: t.titleColor, textShadow: t.titleShadow }}>{titleProps.name}</h2><span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: t.accentColor }}>{titleProps.badge}</span></div></div>;
      case "bold": return <div className="text-center mb-2"><h2 className="text-xl font-black tracking-widest uppercase" style={{ color: t.titleColor, textShadow: t.titleShadow, letterSpacing: "0.15em" }}>{titleProps.name}</h2><div className="mt-1 flex items-center justify-center gap-3"><div className="h-0.5 w-8" style={{ background: t.accentColor }} /><span className="text-[9px] font-black uppercase tracking-widest" style={{ color: t.accentColor }}>{titleProps.badge}</span><div className="h-0.5 w-8" style={{ background: t.accentColor }} /></div></div>;
      case "minimal": return <div className="mb-2"><h2 className="text-sm font-bold tracking-wider uppercase" style={{ color: t.titleColor, opacity: 0.7 }}>{titleProps.name}</h2><span className="text-[8px] font-medium uppercase tracking-widest" style={{ color: t.legendText }}>{titleProps.badge}</span></div>;
      case "accent-bar": return <div className="text-center mb-2"><div className="inline-block px-4 py-1.5 rounded-lg mb-1" style={{ background: t.accentColor }}><h2 className="text-sm font-black tracking-wide" style={{ color: "#000", textShadow: "none" }}>{titleProps.name}</h2></div><div><span className="text-[9px] font-semibold" style={{ color: t.badgeText }}>{titleProps.badge}</span></div></div>;
      case "compact": return <div className="flex items-center justify-between mb-2"><div><h2 className="text-sm font-bold" style={{ color: t.titleColor, textShadow: t.titleShadow }}>{titleProps.name}</h2><span className="text-[7px] font-semibold uppercase tracking-wider" style={{ color: t.legendText }}>{titleProps.badge}</span></div><div className="px-2 py-1 rounded-md" style={{ background: t.badgeBg, border: `1px solid ${t.badgeBorder}` }}><span className="text-[10px] font-black" style={{ color: t.accentColor }}>{titleProps.count}</span></div></div>;
      case "split": return <div className="text-center mb-2"><h2 className="text-base font-bold italic tracking-wide" style={{ color: t.titleColor, textShadow: t.titleShadow }}>{titleProps.name}</h2><div className="mt-1 inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full" style={{ background: t.badgeBg, border: `1px solid ${t.badgeBorder}` }}><span className="text-[9px] font-semibold" style={{ color: t.badgeText }}>{titleProps.badge}</span></div></div>;
      default: return <div className="text-center mb-2"><h2 className="text-base font-bold tracking-wide" style={{ color: t.titleColor, textShadow: t.titleShadow }}>{titleProps.name}</h2><div className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full" style={{ background: t.badgeBg, border: `1px solid ${t.badgeBorder}` }}><span className="text-[9px] font-semibold" style={{ color: t.badgeText }}>{titleProps.badge}</span></div></div>;
    }
  };

  // ── SQUARE: 7 fully distinct layout styles ───────────────────────────
  const renderTableSquare = (t: Theme) => {
    if (filteredStandings.length === 0) return <div className="flex flex-col items-center justify-center py-12 gap-2"><span style={{ fontSize: "36px" }}>📊</span><p style={{ color: t.cellText, fontWeight: 700, fontSize: "14px" }}>No standings yet</p></div>;
    const total = filteredStandings.length;
    const perCol = Math.ceil(total / 2);
    const cols: typeof filteredStandings[] = [];
    for (let c = 0; c < 2; c++) { const s = filteredStandings.slice(c * perCol, (c + 1) * perCol); if (s.length > 0) cols.push(s); }

    const ac = t.accentColor;
    const isBoldLyt = t.layout === "bold";
    // Font/size scaling (same logic as before — unchanged)
    const fs       = perCol > 12 ? "7px"   : perCol > 9 ? "7.5px" : perCol > 7 ? "8px"   : "9px";
    const scoreFs  = perCol > 12 ? "7.5px" : perCol > 9 ? "8px"   : perCol > 7 ? "9px"   : "10px";
    const rankSize = perCol > 12 ? "11px"  : perCol > 9 ? "12px"  : perCol > 7 ? "14px"  : isBoldLyt ? "20px" : "16px";
    const rankFs   = perCol > 12 ? "5.5px" : perCol > 9 ? "6px"   : perCol > 7 ? "7px"   : isBoldLyt ? "9px"  : "8px";
    const hPad     = perCol > 12 ? "1px 2px" : perCol > 9 ? "2px 3px" : "3px 4px";
    const hFs      = perCol > 12 ? "5px"   : perCol > 9 ? "5.5px" : "6px";
    const rowPad   = perCol > 12 ? "1px 2px" : perCol > 9 ? "1px 3px" : perCol > 7 ? "2px 3px" : "3px 4px";
    const getRankBg   = (_r: number) => t.rankDefault;
    const getRankText = (_r: number) => t.rankDefaultText;
    const dinCol      = (n: number) => n > 0 ? "#facc15" : "rgba(255,255,255,0.15)";
    const maxScore    = filteredStandings[0]?.totalPoints || 1;
    const maxPtsDigits = Math.max(1, ...filteredStandings.map(r => String(r.totalPoints).length));
    const tColWidth    = maxPtsDigits >= 3 ? "20px" : maxPtsDigits === 2 ? "15px" : "12px";

    // ── banner: HUD/radar overlay — gradient rows, left stripe, plain rank number ──
    if (t.layout === "banner") return (
      <div style={{ display: "flex", gap: "4px", height: "100%", flex: 1, minHeight: 0 }}>
        {cols.map((col, ci) => (
          <div key={ci} style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", padding: hPad, borderBottom: `1px solid ${ac}50`, marginBottom: "1px", fontFamily: "monospace", flexShrink: 0 }}>
              <span style={{ width: "16px", fontSize: hFs, fontWeight: 800, textAlign: "center", color: ac }}>#</span>
              <span style={{ flex: 1, fontSize: hFs, fontWeight: 700, letterSpacing: "0.08em", color: t.headerText }}>TEAM</span>
              <span style={{ width: "14px", fontSize: hFs, textAlign: "center", color: t.headerText }}>🍗</span>
              <span style={{ width: "16px", fontSize: hFs, textAlign: "center", color: t.headerText }}>PP</span>
              <span style={{ width: "16px", fontSize: hFs, textAlign: "center", color: t.headerText }}>MP</span>
              <span style={{ width: "16px", fontSize: hFs, textAlign: "center", color: t.headerText }}>K</span>
              <span style={{ width: tColWidth, fontSize: hFs, textAlign: "center", color: ac, fontWeight: 800 }}>T</span>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
              {col.map((row, idx) => { const rank = ci * perCol + idx + 1; return (
                <div key={row.teamId} style={{ flex: 1, display: "flex", alignItems: "center", padding: rowPad, borderBottom: idx < col.length - 1 ? `1px solid ${t.rowBorder}` : "none", background: `linear-gradient(90deg,${ac}0c 0%,transparent 72%)`, position: "relative", minHeight: 0 }}>
                  <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "2px", background: `${ac}28`, borderRadius: "0 1px 1px 0" }} />
                  <span style={{ width: "16px", textAlign: "center", color: t.rankDefaultText, fontSize: scoreFs, fontWeight: 900, fontFamily: "monospace" }}>{rank}</span>
                  <span style={{ flex: 1, color: t.cellText, fontSize: fs, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", paddingLeft: "3px" }}>{row.teamName.slice(0, 7)}</span>
                  <span style={{ width: "14px", textAlign: "center", fontSize: fs, fontFamily: "monospace", color: dinCol(row.chickenDinners) }}>{row.chickenDinners}</span>
                  <span style={{ width: "16px", textAlign: "center", color: t.cellText, fontSize: fs, fontFamily: "monospace" }}>{row.placementPoints}</span>
                  <span style={{ width: "16px", textAlign: "center", color: t.cellText, fontSize: fs, fontFamily: "monospace", opacity: 0.7 }}>{row.matchCount}</span>
                  <span style={{ width: "16px", textAlign: "center", color: t.cellText, fontSize: fs, fontFamily: "monospace" }}>{row.totalKills}</span>
                  <span style={{ color: ac, fontSize: scoreFs, fontWeight: 900, fontFamily: "monospace", width: tColWidth, textAlign: "center" }}>{row.totalPoints}</span>
                </div>
              ); })}
            </div>
          </div>
        ))}
      </div>
    );

    // ── split: pill-card rows — each row is its own rounded card ──
    if (t.layout === "split") return (
      <div style={{ display: "flex", gap: "4px", height: "100%", flex: 1, minHeight: 0 }}>
        {cols.map((col, ci) => (
          <div key={ci} style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", padding: hPad, marginBottom: "2px", flexShrink: 0 }}>
              <span style={{ width: "16px", fontSize: hFs, fontWeight: 800, textAlign: "center", color: t.headerText }}>#</span>
              <span style={{ flex: 1, fontSize: hFs, fontWeight: 800, color: t.headerText }}>Team</span>
              <span style={{ width: "14px", fontSize: hFs, textAlign: "center", color: t.headerText }}>🍗</span>
              <span style={{ width: "16px", fontSize: hFs, textAlign: "center", color: t.headerText }}>PP</span>
              <span style={{ width: "16px", fontSize: hFs, textAlign: "center", color: t.headerText }}>MP</span>
              <span style={{ width: "16px", fontSize: hFs, textAlign: "center", color: t.headerText }}>K</span>
              <span style={{ width: tColWidth, fontSize: hFs, textAlign: "center", color: ac }}>T</span>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px", minHeight: 0 }}>
              {col.map((row, idx) => { const rank = ci * perCol + idx + 1; return (
                <div key={row.teamId} style={{ flex: 1, display: "flex", alignItems: "center", padding: rowPad, background: t.tableBg, borderRadius: "5px", border: `1px solid ${t.tableBorder}`, minHeight: 0 }}>
                  <span className="inline-flex items-center justify-center font-black" style={{ width: rankSize, height: rankSize, fontSize: rankFs, background: getRankBg(rank), color: getRankText(rank), borderRadius: "50%", flexShrink: 0, marginRight: "3px" }}>{rank}</span>
                  <span style={{ flex: 1, color: t.cellText, fontSize: fs, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.teamName.slice(0, 7)}</span>
                  <span style={{ width: "14px", textAlign: "center", fontSize: fs, fontFamily: "monospace", color: dinCol(row.chickenDinners) }}>{row.chickenDinners}</span>
                  <span style={{ width: "16px", textAlign: "center", color: t.cellText, fontSize: fs, fontFamily: "monospace" }}>{row.placementPoints}</span>
                  <span style={{ width: "16px", textAlign: "center", color: t.cellText, fontSize: fs, fontFamily: "monospace", opacity: 0.7 }}>{row.matchCount}</span>
                  <span style={{ width: "16px", textAlign: "center", color: t.cellText, fontSize: fs, fontFamily: "monospace" }}>{row.totalKills}</span>
                  <span style={{ color: ac, fontSize: scoreFs, fontWeight: 900, fontFamily: "monospace", width: tColWidth, textAlign: "center" }}>{row.totalPoints}</span>
                </div>
              ); })}
            </div>
          </div>
        ))}
      </div>
    );

    // ── bold: brutalist — circle badges, top-3 left border, uniform rows ──
    if (t.layout === "bold") return (
      <div style={{ display: "flex", gap: "6px", height: "100%", flex: 1, minHeight: 0 }}>
        {cols.map((col, ci) => (
          <div key={ci} className="flex-1 overflow-hidden" style={{ borderRadius: "12px", backgroundColor: t.tableBg, border: `2px solid ${ac}38`, display: "flex", flexDirection: "column" }}>
            <div style={{ background: `linear-gradient(135deg,${ac}25,${ac}08)`, borderBottom: `2px solid ${ac}60`, padding: hPad, display: "flex", alignItems: "center", flexShrink: 0 }}>
              <span style={{ width: rankSize, fontSize: hFs, fontWeight: 900, textAlign: "center", color: ac }}>★</span>
              <span style={{ flex: 1, fontSize: hFs, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em", color: t.headerText }}>Team</span>
              <span style={{ width: "14px", fontSize: hFs, textAlign: "center", color: t.headerText }}>🍗</span>
              <span style={{ width: "16px", fontSize: hFs, textAlign: "center", color: t.headerText }}>PP</span>
              <span style={{ width: "16px", fontSize: hFs, textAlign: "center", color: t.headerText }}>MP</span>
              <span style={{ width: "16px", fontSize: hFs, textAlign: "center", color: t.headerText }}>K</span>
              <span style={{ width: tColWidth, fontSize: hFs, textAlign: "center", color: ac, fontWeight: 900 }}>T</span>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
              {col.map((row, idx) => { const rank = ci * perCol + idx + 1; return (
                <div key={row.teamId} style={{ flex: 1, display: "flex", alignItems: "center", padding: rowPad, borderBottom: idx < col.length - 1 ? `1px solid ${t.rowBorder}` : "none", background: t.rowEven, minHeight: 0 }}>
                  <span className="inline-flex items-center justify-center font-black" style={{ width: rankSize, height: rankSize, fontSize: rankFs, background: getRankBg(rank), color: getRankText(rank), borderRadius: "50%", flexShrink: 0, marginRight: "3px" }}>{rank}</span>
                  <span style={{ flex: 1, color: t.cellText, fontSize: fs, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.teamName.slice(0, 7)}</span>
                  <span style={{ width: "14px", textAlign: "center", fontSize: fs, fontFamily: "monospace", color: dinCol(row.chickenDinners) }}>{row.chickenDinners}</span>
                  <span style={{ width: "16px", textAlign: "center", color: t.cellText, fontSize: fs, fontFamily: "monospace" }}>{row.placementPoints}</span>
                  <span style={{ width: "16px", textAlign: "center", color: t.cellText, fontSize: fs, fontFamily: "monospace", opacity: 0.7 }}>{row.matchCount}</span>
                  <span style={{ width: "16px", textAlign: "center", color: t.cellText, fontSize: fs, fontFamily: "monospace" }}>{row.totalKills}</span>
                  <span style={{ color: ac, fontSize: scoreFs, fontWeight: 900, fontFamily: "monospace", width: tColWidth, textAlign: "center" }}>{row.totalPoints}</span>
                </div>
              ); })}
            </div>
          </div>
        ))}
      </div>
    );

    // ── minimal: terminal clean — 01. numbering, no box, hairline dividers ──
    if (t.layout === "minimal") return (
      <div style={{ display: "flex", gap: "8px", height: "100%", flex: 1, minHeight: 0 }}>
        {cols.map((col, ci) => (
          <div key={ci} style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", padding: hPad, borderBottom: `0.5px solid ${ac}55`, marginBottom: "1px", flexShrink: 0 }}>
              <span style={{ width: "20px", fontSize: hFs, color: t.legendText, fontFamily: "monospace" }}>#</span>
              <span style={{ flex: 1, fontSize: hFs, color: t.legendText, letterSpacing: "0.06em" }}>TEAM</span>
              <span style={{ width: "14px", fontSize: hFs, textAlign: "center", color: t.legendText }}>🍗</span>
              <span style={{ width: "16px", fontSize: hFs, textAlign: "center", color: t.legendText, fontFamily: "monospace" }}>PP</span>
              <span style={{ width: "16px", fontSize: hFs, textAlign: "center", color: t.legendText, fontFamily: "monospace" }}>MP</span>
              <span style={{ width: "16px", fontSize: hFs, textAlign: "center", color: t.legendText, fontFamily: "monospace" }}>K</span>
              <span style={{ width: tColWidth, fontSize: hFs, textAlign: "center", color: ac, fontFamily: "monospace" }}>T</span>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
              {col.map((row, idx) => { const rank = ci * perCol + idx + 1; return (
                <div key={row.teamId} style={{ flex: 1, display: "flex", alignItems: "center", padding: rowPad, borderBottom: idx < col.length - 1 ? `0.5px solid ${t.rowBorder}22` : "none", background: "transparent", minHeight: 0 }}>
                  <span style={{ width: "20px", textAlign: "left", color: t.legendText, fontSize: fs, fontWeight: 900, fontFamily: "monospace" }}>{String(rank).padStart(2, "0")}.</span>
                  <span style={{ flex: 1, color: t.cellText, fontSize: fs, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.teamName.slice(0, 7)}</span>
                  <span style={{ width: "14px", textAlign: "center", fontSize: fs, fontFamily: "monospace", color: dinCol(row.chickenDinners) }}>{row.chickenDinners}</span>
                  <span style={{ width: "16px", textAlign: "center", color: t.cellText, fontSize: fs, fontFamily: "monospace" }}>{row.placementPoints}</span>
                  <span style={{ width: "16px", textAlign: "center", color: t.cellText, fontSize: fs, fontFamily: "monospace", opacity: 0.55 }}>{row.matchCount}</span>
                  <span style={{ width: "16px", textAlign: "center", color: t.cellText, fontSize: fs, fontFamily: "monospace" }}>{row.totalKills}</span>
                  <span style={{ color: t.cellText, fontSize: scoreFs, fontWeight: 900, fontFamily: "monospace", width: tColWidth, textAlign: "center" }}>{row.totalPoints}</span>
                </div>
              ); })}
            </div>
          </div>
        ))}
      </div>
    );

    // ── accent-bar: leaderboard — score bar behind each row ──
    if (t.layout === "accent-bar") return (
      <div style={{ display: "flex", gap: "6px", height: "100%", flex: 1, minHeight: 0 }}>
        {cols.map((col, ci) => (
          <div key={ci} className="flex-1 overflow-hidden" style={{ borderRadius: "8px", backgroundColor: t.tableBg, border: `1px solid ${t.tableBorder}`, display: "flex", flexDirection: "column" }}>
            <div style={{ backgroundColor: t.headerBg, borderBottom: `1px solid ${t.headerBorder}`, padding: hPad, display: "flex", alignItems: "center", flexShrink: 0 }}>
              <span style={{ width: "18px", fontSize: hFs, fontWeight: 800, textAlign: "center", color: t.headerText }}>#</span>
              <span style={{ flex: 1, fontSize: hFs, fontWeight: 800, color: t.headerText }}>Team</span>
              <span style={{ width: "14px", fontSize: hFs, textAlign: "center", color: t.headerText }}>🍗</span>
              <span style={{ width: "16px", fontSize: hFs, textAlign: "center", color: t.headerText }}>PP</span>
              <span style={{ width: "16px", fontSize: hFs, textAlign: "center", color: t.headerText }}>MP</span>
              <span style={{ width: "16px", fontSize: hFs, textAlign: "center", color: t.headerText }}>K</span>
              <span style={{ width: tColWidth, fontSize: hFs, textAlign: "center", color: ac }}>T</span>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
              {col.map((row, idx) => { const rank = ci * perCol + idx + 1; const barPct = Math.round((row.totalPoints / maxScore) * 100); return (
                <div key={row.teamId} style={{ flex: 1, display: "flex", alignItems: "center", padding: rowPad, borderBottom: idx < col.length - 1 ? `1px solid ${t.rowBorder}` : "none", background: idx % 2 === 0 ? t.rowEven : t.rowOdd, position: "relative", overflow: "hidden", minHeight: 0 }}>
                  {/* Score progress bar */}
                  <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${barPct}%`, background: `linear-gradient(90deg,${ac}1c 0%,${ac}06 100%)`, pointerEvents: "none" }} />
                  {/* Left accent stripe */}
                  <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "3px", background: "transparent" }} />
                  <span className="inline-flex items-center justify-center rounded font-black" style={{ width: rankSize, height: rankSize, fontSize: rankFs, background: getRankBg(rank), color: getRankText(rank), flexShrink: 0, marginRight: "3px", marginLeft: "5px", position: "relative" }}>{rank}</span>
                  <span style={{ flex: 1, color: t.cellText, fontSize: fs, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", position: "relative" }}>{row.teamName.slice(0, 7)}</span>
                  <span style={{ width: "14px", textAlign: "center", fontSize: fs, fontFamily: "monospace", color: dinCol(row.chickenDinners), position: "relative" }}>{row.chickenDinners}</span>
                  <span style={{ width: "16px", textAlign: "center", color: t.cellText, fontSize: fs, fontFamily: "monospace", position: "relative" }}>{row.placementPoints}</span>
                  <span style={{ width: "16px", textAlign: "center", color: t.cellText, fontSize: fs, fontFamily: "monospace", opacity: 0.7, position: "relative" }}>{row.matchCount}</span>
                  <span style={{ width: "16px", textAlign: "center", color: t.cellText, fontSize: fs, fontFamily: "monospace", position: "relative" }}>{row.totalKills}</span>
                  <span style={{ color: ac, fontSize: scoreFs, fontWeight: 900, fontFamily: "monospace", width: tColWidth, textAlign: "center", position: "relative" }}>{row.totalPoints}</span>
                </div>
              ); })}
            </div>
          </div>
        ))}
      </div>
    );

    // ── compact: military terminal — [01] rank, monospace grid, accent header ──
    if (t.layout === "compact") return (
      <div style={{ display: "flex", gap: "4px", height: "100%", flex: 1, minHeight: 0 }}>
        {cols.map((col, ci) => (
          <div key={ci} className="flex-1 overflow-hidden" style={{ backgroundColor: t.tableBg, border: `1px solid ${t.tableBorder}`, borderRadius: "4px", display: "flex", flexDirection: "column" }}>
            <div style={{ background: `${ac}28`, borderBottom: `1px solid ${ac}`, padding: hPad, display: "flex", alignItems: "center", fontFamily: "monospace", flexShrink: 0 }}>
              <span style={{ width: "24px", fontSize: hFs, fontWeight: 900, textAlign: "center", color: ac }}>RK</span>
              <span style={{ flex: 1, fontSize: hFs, fontWeight: 800, color: t.headerText }}>SQUAD</span>
              <span style={{ width: "14px", fontSize: hFs, textAlign: "center", color: t.headerText }}>🍗</span>
              <span style={{ width: "16px", fontSize: hFs, textAlign: "center", color: t.headerText }}>PP</span>
              <span style={{ width: "16px", fontSize: hFs, textAlign: "center", color: t.headerText }}>MP</span>
              <span style={{ width: "16px", fontSize: hFs, textAlign: "center", color: t.headerText }}>EL</span>
              <span style={{ width: tColWidth, fontSize: hFs, textAlign: "center", color: ac, fontWeight: 900 }}>PTS</span>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
              {col.map((row, idx) => { const rank = ci * perCol + idx + 1; return (
                <div key={row.teamId} style={{ flex: 1, display: "flex", alignItems: "center", padding: rowPad, borderBottom: idx < col.length - 1 ? `1px solid ${t.rowBorder}` : "none", background: idx % 2 === 0 ? t.rowEven : t.rowOdd, fontFamily: "monospace", minHeight: 0 }}>
                  <span style={{ width: "24px", textAlign: "center", color: t.rankDefaultText, fontSize: fs, fontWeight: 700 }}>[{String(rank).padStart(2, "0")}]</span>
                  <span style={{ flex: 1, color: t.cellText, fontSize: fs, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.teamName.slice(0, 7)}</span>
                  <span style={{ width: "14px", textAlign: "center", fontSize: fs, color: dinCol(row.chickenDinners) }}>{row.chickenDinners}</span>
                  <span style={{ width: "16px", textAlign: "center", color: t.cellText, fontSize: fs }}>{row.placementPoints}</span>
                  <span style={{ width: "16px", textAlign: "center", color: t.cellText, fontSize: fs, opacity: 0.7 }}>{row.matchCount}</span>
                  <span style={{ width: "16px", textAlign: "center", color: t.cellText, fontSize: fs }}>{row.totalKills}</span>
                  <span style={{ color: t.cellText, fontSize: scoreFs, fontWeight: 900, width: tColWidth, textAlign: "center" }}>{row.totalPoints}</span>
                </div>
              ); })}
            </div>
          </div>
        ))}
      </div>
    );

    // ── default: classic glass card — alternating rows, square rank badge ──
    return (
      <div style={{ display: "flex", gap: "6px", height: "100%" }}>
        {cols.map((col, ci) => (
          <div key={ci} className="flex-1 overflow-hidden" style={{ borderRadius: "8px", backgroundColor: t.tableBg, border: `1px solid ${t.tableBorder}`, display: "flex", flexDirection: "column" }}>
            <div style={{ backgroundColor: t.headerBg, borderBottom: `1px solid ${t.headerBorder}`, padding: hPad, display: "flex", alignItems: "center", flexShrink: 0 }}>
              <span style={{ width: "18px", fontSize: hFs, fontWeight: 800, textTransform: "uppercase", textAlign: "center", color: t.headerText }}>#</span>
              <span style={{ flex: 1, fontSize: hFs, fontWeight: 800, textTransform: "uppercase", color: t.headerText }}>Team</span>
              <span style={{ width: "14px", fontSize: hFs, fontWeight: 800, textAlign: "center", color: t.headerText }}>🍗</span>
              <span style={{ width: "16px", fontSize: hFs, fontWeight: 800, textTransform: "uppercase", textAlign: "center", color: t.headerText }}>PP</span>
              <span style={{ width: "16px", fontSize: hFs, fontWeight: 800, textTransform: "uppercase", textAlign: "center", color: t.headerText }}>MP</span>
              <span style={{ width: "16px", fontSize: hFs, fontWeight: 800, textTransform: "uppercase", textAlign: "center", color: t.headerText }}>K</span>
              <span style={{ width: tColWidth, fontSize: hFs, fontWeight: 800, textTransform: "uppercase", textAlign: "center", color: ac }}>T</span>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
              {col.map((row, idx) => { const rank = ci * perCol + idx + 1; return (
                <div key={row.teamId} style={{ flex: 1, display: "flex", alignItems: "center", padding: "0 2px", borderBottom: idx < col.length - 1 ? `1px solid ${t.rowBorder}` : "none", background: idx % 2 === 0 ? t.rowEven : t.rowOdd, minHeight: 0 }}>
                  <span className="inline-flex items-center justify-center rounded font-black" style={{ width: rankSize, height: rankSize, fontSize: rankFs, background: getRankBg(rank), color: getRankText(rank), flexShrink: 0, marginRight: "3px" }}>{rank}</span>
                  <span style={{ flex: 1, color: t.cellText, fontSize: fs, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.teamName.slice(0, 7)}</span>
                  <span style={{ width: "14px", textAlign: "center", fontSize: fs, fontWeight: 700, fontFamily: "monospace", color: dinCol(row.chickenDinners) }}>{row.chickenDinners}</span>
                  <span style={{ width: "16px", textAlign: "center", color: t.cellText, fontSize: fs, fontWeight: 600, fontFamily: "monospace" }}>{row.placementPoints}</span>
                  <span style={{ width: "16px", textAlign: "center", color: t.cellText, fontSize: fs, fontWeight: 600, fontFamily: "monospace", opacity: 0.7 }}>{row.matchCount}</span>
                  <span style={{ width: "16px", textAlign: "center", color: t.cellText, fontSize: fs, fontWeight: 600, fontFamily: "monospace" }}>{row.totalKills}</span>
                  <span style={{ color: ac, fontSize: scoreFs, fontWeight: 900, fontFamily: "monospace", width: tColWidth, textAlign: "center" }}>{row.totalPoints}</span>
                </div>
              ); })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ── LANDSCAPE: full names, dynamic cols, tight sizing ────────────────
  const renderTableLandscape = (t: Theme) => {
    if (filteredStandings.length === 0) return <div className="flex flex-col items-center justify-center py-12 gap-2"><span style={{ fontSize: "36px" }}>📊</span><p style={{ color: t.cellText, fontWeight: 700, fontSize: "14px" }}>No standings yet</p></div>;
    const total = filteredStandings.length;
    const numCols = 2;
    const perCol = Math.ceil(total / numCols);
    const cols: typeof filteredStandings[] = [];
    for (let c = 0; c < numCols; c++) { const s = filteredStandings.slice(c * perCol, (c + 1) * perCol); if (s.length > 0) cols.push(s); }
    const isBold = t.layout === "bold", isMinimal = t.layout === "minimal", isAccentBar = t.layout === "accent-bar";
    const fs       = perCol > 14 ? "5px"   : perCol > 11 ? "5.5px" : perCol > 8 ? "6.2px" : perCol > 5 ? "7px"   : "8px";
    const scoreFs  = perCol > 14 ? "5.2px" : perCol > 11 ? "6px"   : perCol > 8 ? "6.8px" : perCol > 5 ? "7.5px" : "8.5px";
    const rankSize = perCol > 14 ? "9px"   : perCol > 11 ? "10px"  : perCol > 8 ? "11px"  : perCol > 5 ? "13px"  : "15px";
    const rankFs   = perCol > 14 ? "4.5px" : perCol > 11 ? "5px"   : perCol > 8 ? "5.5px" : perCol > 5 ? "6.5px" : "7.5px";
    const headerPad = perCol > 11 ? "1px 2px" : "1.5px 3px";
    const headerFs  = perCol > 11 ? "5px" : "6px";
    const show3cols = false;
    const maxPtsDigits = Math.max(1, ...filteredStandings.map(r => String(r.totalPoints).length));
    const tColWidth    = maxPtsDigits >= 3 ? "16px" : maxPtsDigits === 2 ? "13px" : "11px";
    const getRankBg = (_r: number) => t.rankDefault;
    const getRankText = (_r: number) => t.rankDefaultText;
    const hTextColor = isMinimal ? t.legendText : t.headerText;
    return (
      <div style={{ display: "flex", gap: "3px", height: "100%", flex: 1, minHeight: 0 }}>
        {cols.map((col, ci) => (
          <div key={ci} style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", borderRadius: "6px", backgroundColor: isMinimal ? "transparent" : t.tableBg, border: isMinimal ? "none" : isBold ? `2px solid ${t.accentColor}` : `1px solid ${t.tableBorder}` }}>
            <div style={{ flexShrink: 0, backgroundColor: isMinimal ? "transparent" : t.headerBg, borderBottom: `1px solid ${t.headerBorder}`, padding: headerPad, display: "flex", alignItems: "center" }}>
              <span style={{ width: rankSize, fontSize: headerFs, fontWeight: 800, textAlign: "center", color: hTextColor }}>#</span>
              <span style={{ flex: 1, fontSize: headerFs, fontWeight: 800, textTransform: "uppercase", color: hTextColor }}>Team</span>
              {!show3cols && <span style={{ width: "13px", fontSize: headerFs, fontWeight: 800, textAlign: "center", color: hTextColor }}>🍗</span>}
              <span style={{ width: "14px", fontSize: headerFs, fontWeight: 800, textAlign: "center", color: hTextColor }}>PP</span>
              {!show3cols && <span style={{ width: "13px", fontSize: headerFs, fontWeight: 800, textAlign: "center", color: hTextColor }}>K</span>}
              <span style={{ width: tColWidth, fontSize: headerFs, fontWeight: 800, textAlign: "center", color: t.accentColor }}>T</span>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
              {col.map((row, idx) => {
                const rank = ci * perCol + idx + 1;
                return (
                  <div key={row.teamId} style={{ flex: 1, display: "flex", alignItems: "center", padding: "0 2px", borderBottom: idx < col.length - 1 ? `1px solid ${t.rowBorder}` : "none", background: idx % 2 === 0 ? t.rowEven : t.rowOdd, minHeight: 0 }}>
                    {isAccentBar && <div style={{ width: "2px", alignSelf: "stretch", background: "transparent", marginRight: "2px" }} />}
                    {isMinimal
                      ? <span style={{ width: rankSize, textAlign: "center", color: t.legendText, fontSize: fs, fontWeight: 900, fontFamily: "monospace" }}>{rank}</span>
                      : <span className="inline-flex items-center justify-center rounded font-black" style={{ width: rankSize, height: rankSize, fontSize: rankFs, background: getRankBg(rank), color: getRankText(rank), flexShrink: 0, marginRight: "2px" }}>{rank}</span>
                    }
                    <span style={{ flex: 1, color: t.cellText, fontSize: fs, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.teamName}</span>
                    {!show3cols && <span style={{ width: "13px", textAlign: "center", fontSize: fs, fontFamily: "monospace", color: row.chickenDinners > 0 ? "#facc15" : "rgba(255,255,255,0.15)" }}>{row.chickenDinners}</span>}
                    <span style={{ width: "14px", textAlign: "center", color: t.cellText, fontSize: fs, fontWeight: 600, fontFamily: "monospace" }}>{row.placementPoints}</span>
                    {!show3cols && <span style={{ width: "13px", textAlign: "center", color: t.cellText, fontSize: fs, fontFamily: "monospace" }}>{row.totalKills}</span>}
                    <span style={{ width: tColWidth, textAlign: "center", color: t.accentColor, fontSize: scoreFs, fontWeight: 900, fontFamily: "monospace" }}>{row.totalPoints}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };



  const renderList = (t: Theme, data: Array<{ teamName?: string; name?: string; totalKills?: number; kills?: number }>, type: "warhead" | "fraggers") => {
    const medalStyle = (_r: number) => ({ bg: t.rankDefault, color: t.rankDefaultText });
    const icon = type === "warhead" ? "💀" : "🔫";
    if (t.layout === "minimal") {
      return <div>{data.map((item, idx) => { const label = type === "warhead" ? item.teamName : item.name; const val = type === "warhead" ? item.totalKills : item.kills; return <div key={label} className="flex items-center" style={{ padding: "5px 8px", borderBottom: `1px solid ${t.rowBorder}20` }}><span style={{ width: "18px", textAlign: "center", color: t.legendText, fontSize: "10px", fontWeight: 900, marginRight: "8px" }}>{idx + 1}</span><span style={{ flex: 1, color: t.cellText, fontSize: "11px", fontWeight: 600 }}>{label}</span><span style={{ color: t.cellText, fontSize: "13px", fontWeight: 900, fontFamily: "monospace" }}>{val}</span></div>; })}</div>;
    }
    return (
      <div className="overflow-hidden rounded-xl" style={{ backgroundColor: t.tableBg, border: `1px solid ${t.tableBorder}` }}>
        <div style={{ background: `linear-gradient(90deg,${t.headerBg},transparent)`, padding: "7px 12px", borderBottom: `1px solid ${t.rowBorder}` }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: "8px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: t.headerText }}><span>Rank · {type === "warhead" ? "Team" : "Player"}</span><span>Kills</span></div></div>
        {data.map((item, idx) => { const m = medalStyle(idx + 1); const label = type === "warhead" ? item.teamName : item.name; const val = type === "warhead" ? item.totalKills : item.kills; return <div key={label} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "7px 12px", borderBottom: `1px solid ${t.rowBorder}`, background: idx % 2 === 0 ? t.rowEven : t.rowOdd }}><span style={{ background: m.bg, color: m.color, borderRadius: "6px", width: "22px", height: "22px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 900, flexShrink: 0 }}>{idx + 1}</span><span style={{ flex: 1, color: t.cellText, fontSize: "12px", fontWeight: 700 }}>{label}</span><span style={{ color: t.cellText, fontSize: "14px", fontWeight: 900, fontFamily: "monospace" }}>{val}</span><span style={{ color: t.legendText, fontSize: "9px" }}>{icon}</span></div>; })}
      </div>
    );
  };

  const renderFooter = (t: Theme) => {
    if (t.layout === "banner") return <div className="mt-1 text-right"><span className="text-[8px] font-bold tracking-widest" style={{ color: t.footerText, opacity: 0.5 }}>By {APP_NAME}</span></div>;
    if (t.layout === "minimal") return <div className="mt-2 pt-1" style={{ borderTop: `1px solid ${t.rowBorder}20` }}><span className="text-[8px] font-medium" style={{ color: t.footerText, opacity: 0.4 }}>{APP_NAME}</span></div>;
    return <div className="mt-2 flex items-center justify-center gap-2 text-[9px]"><div className="h-px w-6" style={{ background: `linear-gradient(to right,transparent,${t.footerAccent})` }} /><span className="font-medium" style={{ color: t.footerText }}>{APP_NAME}</span><div className="h-px w-6" style={{ background: `linear-gradient(to left,transparent,${t.footerAccent})` }} /></div>;
  };

  const renderCard = (t: Theme, cardIdx: number) => {
    const isLandscape = format === "landscape";
    const sqAspect    = "1/1"; // always 1:1 for non-landscape (square)
    const borderDecor = t.layout === "accent-bar" ? { borderLeft: `5px solid ${t.accentColor}` } : t.layout === "bold" ? { border: `3px solid ${t.accentColor}30` } : {};

    // ── SQUARE: per-layout card structure ──
    if (!isLandscape) {
      const ac = t.accentColor;
      const tableContent = (
        <div style={{ flex: 1, overflow: "hidden", minHeight: 0, height: "100%", display: "flex", flexDirection: "column" }}>
          {standingsTab === "table" && renderTableSquare(t)}
          {standingsTab === "warhead" && renderList(t, warheadData, "warhead")}
          {standingsTab === "fraggers" && renderList(t, topFraggers, "fraggers")}
        </div>
      );

      // ── BANNER: prominent accent top-bar containing title ──
      if (t.layout === "banner") return (
        <div key={t.id} ref={cardIdx === activeIdx ? cardRef : undefined} className="shrink-0 relative overflow-hidden" style={{ width: "calc(100vw - 48px)", aspectRatio: sqAspect, scrollSnapAlign: "center", borderRadius: "20px", background: t.bg, ...(t.bgImage ? { backgroundImage: `url(${t.bgImage})`, backgroundSize: "cover", backgroundPosition: "center" } : {}) }}>
          {t.overlay !== "none" && <div className="absolute inset-0" style={{ background: t.overlay }} />}
          <div className="relative z-10 h-full flex flex-col">
            {/* Accent top bar — the defining feature of banner layout */}
            <div style={{ background: `linear-gradient(90deg,${ac}60 0%,${ac}25 60%,transparent 100%)`, borderBottom: `3px solid ${ac}`, padding: "10px 12px", flexShrink: 0, borderLeft: `6px solid ${ac}` }}>
              <h2 style={{ color: t.titleColor, fontWeight: 900, fontSize: "15px", textShadow: t.titleShadow, letterSpacing: "0.04em", lineHeight: 1.1 }}>{tournament.name}</h2>
              <span style={{ fontSize: "7px", color: t.badgeText, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>{badgeLabel}</span>
            </div>
            <div className="flex-1 px-3 py-2">{tableContent}</div>
            <div className="px-3 pb-2">{renderFooter(t)}</div>
          </div>
        </div>
      );

      // ── SPLIT: vertical sidebar title on the left ──
      if (t.layout === "split") return (
        <div key={t.id} ref={cardIdx === activeIdx ? cardRef : undefined} className="shrink-0 relative overflow-hidden" style={{ width: "calc(100vw - 48px)", aspectRatio: sqAspect, scrollSnapAlign: "center", borderRadius: "20px", background: t.bg, ...(t.bgImage ? { backgroundImage: `url(${t.bgImage})`, backgroundSize: "cover", backgroundPosition: "center" } : {}) }}>
          {t.overlay !== "none" && <div className="absolute inset-0" style={{ background: t.overlay }} />}
          <div className="relative z-10 h-full" style={{ display: "flex" }}>
            {/* Left sidebar with vertical title */}
            <div style={{ width: "28px", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 0", background: `linear-gradient(to bottom,${ac}35,${ac}10)`, borderRight: `2px solid ${ac}50` }}>
              <div style={{ width: "2px", height: "20px", background: ac, borderRadius: "1px", flexShrink: 0 }} />
              <span style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", color: t.titleColor, fontWeight: 900, fontSize: "9px", letterSpacing: "0.12em", textShadow: t.titleShadow, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", textTransform: "uppercase" }}>
                {tournament.name.slice(0, 16)}
              </span>
              <div style={{ width: "2px", height: "20px", background: ac, borderRadius: "1px", flexShrink: 0 }} />
            </div>
            {/* Right: badge + table + footer */}
            <div className="flex-1 flex flex-col" style={{ padding: "8px 10px 8px 8px" }}>
              <div style={{ fontSize: "7px", color: t.badgeText, background: t.badgeBg, border: `1px solid ${t.badgeBorder}`, borderRadius: "4px", padding: "2px 6px", alignSelf: "flex-start", marginBottom: "5px", flexShrink: 0 }}>{badgeLabel}</div>
              <div className="flex-1">{tableContent}</div>
              {renderFooter(t)}
            </div>
          </div>
        </div>
      );

      // ── BOLD: large centered title + accent divider ──
      if (t.layout === "bold") return (
        <div key={t.id} ref={cardIdx === activeIdx ? cardRef : undefined} className="shrink-0 relative overflow-hidden" style={{ width: "calc(100vw - 48px)", aspectRatio: sqAspect, scrollSnapAlign: "center", borderRadius: "24px", background: t.bg, border: `3px solid ${ac}40`, ...(t.bgImage ? { backgroundImage: `url(${t.bgImage})`, backgroundSize: "cover", backgroundPosition: "center" } : {}) }}>
          {t.overlay !== "none" && <div className="absolute inset-0" style={{ background: t.overlay, borderRadius: "20px" }} />}
          <div className="relative z-10 h-full flex flex-col px-4">
            {/* Large title block */}
            <div style={{ flexShrink: 0, textAlign: "center", paddingTop: "16px", paddingBottom: "10px", borderBottom: `2px solid ${ac}50`, marginBottom: "8px" }}>
              <h2 style={{ color: t.titleColor, fontWeight: 900, fontSize: "20px", textShadow: t.titleShadow, letterSpacing: "0.06em", lineHeight: 1.1 }}>{tournament.name}</h2>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginTop: "6px" }}>
                <div style={{ height: "2px", flex: 1, background: `linear-gradient(to right,transparent,${ac})` }} />
                <span style={{ fontSize: "8px", fontWeight: 800, color: ac, letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{badgeLabel}</span>
                <div style={{ height: "2px", flex: 1, background: `linear-gradient(to left,transparent,${ac})` }} />
              </div>
            </div>
            <div className="flex-1">{tableContent}</div>
            <div className="py-2">{renderFooter(t)}</div>
          </div>
        </div>
      );

      // ── MINIMAL: floating text, no box, airy layout ──
      if (t.layout === "minimal") return (
        <div key={t.id} ref={cardIdx === activeIdx ? cardRef : undefined} className="shrink-0 relative overflow-hidden" style={{ width: "calc(100vw - 48px)", aspectRatio: sqAspect, scrollSnapAlign: "center", borderRadius: "20px", background: t.bg, ...(t.bgImage ? { backgroundImage: `url(${t.bgImage})`, backgroundSize: "cover", backgroundPosition: "center" } : {}) }}>
          {t.overlay !== "none" && <div className="absolute inset-0" style={{ background: t.overlay }} />}
          <div className="relative z-10 h-full flex flex-col" style={{ padding: "14px 14px 10px" }}>
            <div style={{ flexShrink: 0, marginBottom: "8px" }}>
              <h2 style={{ color: t.titleColor, fontWeight: 700, fontSize: "12px", letterSpacing: "0.06em", textTransform: "uppercase", opacity: 0.85 }}>{tournament.name}</h2>
              <div style={{ height: "1px", background: `${ac}60`, marginTop: "5px" }} />
              <span style={{ fontSize: "7px", color: t.legendText, fontWeight: 500, letterSpacing: "0.08em" }}>{badgeLabel}</span>
            </div>
            <div className="flex-1">{tableContent}</div>
            {renderFooter(t)}
          </div>
        </div>
      );

      // ── ACCENT-BAR: full-card accent gradient tint, pill title ──
      if (t.layout === "accent-bar") return (
        <div key={t.id} ref={cardIdx === activeIdx ? cardRef : undefined} className="shrink-0 relative overflow-hidden" style={{ width: "calc(100vw - 48px)", aspectRatio: sqAspect, scrollSnapAlign: "center", borderRadius: "20px", background: t.bg, borderLeft: `6px solid ${ac}`, ...(t.bgImage ? { backgroundImage: `url(${t.bgImage})`, backgroundSize: "cover", backgroundPosition: "center" } : {}) }}>
          {t.overlay !== "none" && <div className="absolute inset-0" style={{ background: t.overlay }} />}
          {/* Full-card left-to-right accent tint */}
          <div className="absolute inset-0" style={{ background: `linear-gradient(90deg,${ac}20 0%,${ac}06 40%,transparent 100%)` }} />
          <div className="relative z-10 h-full flex flex-col px-3 py-3">
            <div style={{ flexShrink: 0, marginBottom: "6px", textAlign: "center" }}>
              <div style={{ display: "inline-block", background: ac, borderRadius: "8px", padding: "4px 14px", marginBottom: "3px" }}>
                <h2 style={{ color: "#000", fontWeight: 900, fontSize: "12px", letterSpacing: "0.04em" }}>{tournament.name}</h2>
              </div>
              <div><span style={{ fontSize: "7px", color: t.badgeText, fontWeight: 600 }}>{badgeLabel}</span></div>
            </div>
            <div className="flex-1">{tableContent}</div>
            {renderFooter(t)}
          </div>
        </div>
      );

      // ── COMPACT: dense terminal — inline title + count ──
      if (t.layout === "compact") return (
        <div key={t.id} ref={cardIdx === activeIdx ? cardRef : undefined} className="shrink-0 relative overflow-hidden" style={{ width: "calc(100vw - 48px)", aspectRatio: sqAspect, scrollSnapAlign: "center", borderRadius: "12px", background: t.bg, border: `1px solid ${ac}25`, ...(t.bgImage ? { backgroundImage: `url(${t.bgImage})`, backgroundSize: "cover", backgroundPosition: "center" } : {}) }}>
          {t.overlay !== "none" && <div className="absolute inset-0" style={{ background: t.overlay }} />}
          <div className="relative z-10 h-full flex flex-col" style={{ padding: "8px 10px" }}>
            {/* Dense title row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "5px", flexShrink: 0, borderBottom: `1px solid ${ac}30`, paddingBottom: "5px" }}>
              <div>
                <span style={{ color: t.titleColor, fontWeight: 900, fontSize: "11px", letterSpacing: "0.02em" }}>{tournament.name}</span>
                <span style={{ color: t.legendText, fontSize: "7px", marginLeft: "6px" }}>{badgeLabel}</span>
              </div>
              <div style={{ background: `${ac}20`, border: `1px solid ${ac}50`, borderRadius: "4px", padding: "2px 6px" }}>
                <span style={{ color: ac, fontSize: "11px", fontWeight: 900, fontFamily: "monospace" }}>{filteredStandings.length}</span>
              </div>
            </div>
            <div className="flex-1">{tableContent}</div>
            {renderFooter(t)}
          </div>
        </div>
      );

      // ── DEFAULT: standard glass card ──
      return (
        <div key={t.id} ref={cardIdx === activeIdx ? cardRef : undefined} className="shrink-0 relative overflow-hidden" style={{ width: "calc(100vw - 48px)", aspectRatio: sqAspect, scrollSnapAlign: "center", borderRadius: "20px", background: t.bg, ...(t.bgImage ? { backgroundImage: `url(${t.bgImage})`, backgroundSize: "cover", backgroundPosition: "center" } : {}) }}>
          {t.overlay !== "none" && <div className="absolute inset-0" style={{ background: t.overlay, borderRadius: "20px" }} />}
          <div className="relative z-10 px-3 py-3 h-full flex flex-col">
            {renderTitle(t)}
            <div className="flex-1">{tableContent}</div>
            {standingsTab === "table" && <div style={{ textAlign: "center", marginTop: "2px", fontSize: "6px", color: t.legendText }}>🍗 Dinners · M Matches · P Placement · E Eliminations · T Total</div>}
            {renderFooter(t)}
          </div>
        </div>
      );
    }

    const ac = t.accentColor;
    const lsContent = (
      <div style={{ flex: 1, overflow: "hidden", minHeight: 0, height: "100%", display: "flex", flexDirection: "column" }}>
        {standingsTab === "table" && renderTableLandscape(t)}
        {standingsTab === "warhead" && renderList(t, warheadData, "warhead")}
        {standingsTab === "fraggers" && renderList(t, topFraggers, "fraggers")}
      </div>
    );

    // banner landscape: thick left-bar accent header (no side-by-side)
    if (t.layout === "banner") return (
      <div key={t.id} ref={cardIdx === activeIdx ? cardRef : undefined} className="shrink-0 relative overflow-hidden" style={{ width: "calc(100vw - 48px)", aspectRatio: "16/9", scrollSnapAlign: "center", borderRadius: "20px", background: t.bg, ...(t.bgImage ? { backgroundImage: `url(${t.bgImage})`, backgroundSize: "cover", backgroundPosition: "center" } : {}) }}>
        {t.overlay !== "none" && <div className="absolute inset-0" style={{ background: t.overlay }} />}
        <div className="relative z-10 h-full flex flex-col">
          <div style={{ background: `linear-gradient(90deg,${ac}55 0%,${ac}18 65%,transparent 100%)`, borderBottom: `2px solid ${ac}`, borderLeft: `5px solid ${ac}`, padding: "5px 10px", flexShrink: 0 }}>
            <span style={{ fontSize: "11px", fontWeight: 900, color: t.titleColor, textShadow: t.titleShadow }}>{tournament.name}</span>
            <span style={{ fontSize: "6px", color: t.badgeText, fontWeight: 700, marginLeft: "8px", letterSpacing: "0.1em" }}>{badgeLabel}</span>
          </div>
          <div className="flex-1 px-2 py-1" style={{ overflow: "hidden", minHeight: 0 }}>{lsContent}</div>
          <div className="px-2 pb-1">{renderFooter(t)}</div>
        </div>
      </div>
    );

    // split landscape: left sidebar with rotated title
    if (t.layout === "split") return (
      <div key={t.id} ref={cardIdx === activeIdx ? cardRef : undefined} className="shrink-0 relative overflow-hidden" style={{ width: "calc(100vw - 48px)", aspectRatio: "16/9", scrollSnapAlign: "center", borderRadius: "20px", background: t.bg, ...(t.bgImage ? { backgroundImage: `url(${t.bgImage})`, backgroundSize: "cover", backgroundPosition: "center" } : {}) }}>
        {t.overlay !== "none" && <div className="absolute inset-0" style={{ background: t.overlay }} />}
        <div className="relative z-10 h-full" style={{ display: "flex" }}>
          <div style={{ width: "22px", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", padding: "6px 0", background: `${ac}25`, borderRight: `2px solid ${ac}50` }}>
            <div style={{ width: "1px", height: "12px", background: ac, flexShrink: 0 }} />
            <span style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", color: t.titleColor, fontWeight: 900, fontSize: "7px", letterSpacing: "0.1em", flex: 1, display: "flex", alignItems: "center", justifyContent: "center", textTransform: "uppercase" }}>{tournament.name.slice(0, 16)}</span>
            <div style={{ width: "1px", height: "12px", background: ac, flexShrink: 0 }} />
          </div>
          <div className="flex-1 flex flex-col" style={{ padding: "6px 8px" }}>
            <div style={{ fontSize: "6px", color: t.badgeText, marginBottom: "4px", flexShrink: 0 }}>{badgeLabel}</div>
            {lsContent}
            {renderFooter(t)}
          </div>
        </div>
      </div>
    );

    // bold landscape: centered title + dividers
    if (t.layout === "bold") return (
      <div key={t.id} ref={cardIdx === activeIdx ? cardRef : undefined} className="shrink-0 relative overflow-hidden" style={{ width: "calc(100vw - 48px)", aspectRatio: "16/9", scrollSnapAlign: "center", borderRadius: "24px", border: `2px solid ${ac}40`, background: t.bg, ...(t.bgImage ? { backgroundImage: `url(${t.bgImage})`, backgroundSize: "cover", backgroundPosition: "center" } : {}) }}>
        {t.overlay !== "none" && <div className="absolute inset-0" style={{ background: t.overlay, borderRadius: "20px" }} />}
        <div className="relative z-10 h-full flex flex-col" style={{ padding: "6px 12px" }}>
          <div style={{ flexShrink: 0, textAlign: "center", marginBottom: "4px", borderBottom: `1px solid ${ac}50`, paddingBottom: "4px" }}>
            <span style={{ fontSize: "13px", fontWeight: 900, color: t.titleColor, textShadow: t.titleShadow, letterSpacing: "0.06em" }}>{tournament.name}</span>
            <span style={{ fontSize: "6px", color: ac, display: "block", fontWeight: 700, letterSpacing: "0.1em" }}>{badgeLabel}</span>
          </div>
          {lsContent}
          {renderFooter(t)}
        </div>
      </div>
    );

    // minimal landscape: thin underline title, floating data
    if (t.layout === "minimal") return (
      <div key={t.id} ref={cardIdx === activeIdx ? cardRef : undefined} className="shrink-0 relative overflow-hidden" style={{ width: "calc(100vw - 48px)", aspectRatio: "16/9", scrollSnapAlign: "center", borderRadius: "20px", background: t.bg, ...(t.bgImage ? { backgroundImage: `url(${t.bgImage})`, backgroundSize: "cover", backgroundPosition: "center" } : {}) }}>
        {t.overlay !== "none" && <div className="absolute inset-0" style={{ background: t.overlay }} />}
        <div className="relative z-10 h-full flex flex-col" style={{ padding: "8px 12px" }}>
          <div style={{ flexShrink: 0, marginBottom: "5px" }}>
            <span style={{ fontSize: "10px", fontWeight: 700, color: t.titleColor, textTransform: "uppercase", letterSpacing: "0.06em", opacity: 0.85 }}>{tournament.name}</span>
            <div style={{ height: "0.5px", background: `${ac}60`, margin: "3px 0 1px" }} />
            <span style={{ fontSize: "6px", color: t.legendText }}>{badgeLabel}</span>
          </div>
          {lsContent}
          {renderFooter(t)}
        </div>
      </div>
    );

    // accent-bar landscape: pill title + card tint
    if (t.layout === "accent-bar") return (
      <div key={t.id} ref={cardIdx === activeIdx ? cardRef : undefined} className="shrink-0 relative overflow-hidden" style={{ width: "calc(100vw - 48px)", aspectRatio: "16/9", scrollSnapAlign: "center", borderRadius: "20px", borderLeft: `5px solid ${ac}`, background: t.bg, ...(t.bgImage ? { backgroundImage: `url(${t.bgImage})`, backgroundSize: "cover", backgroundPosition: "center" } : {}) }}>
        {t.overlay !== "none" && <div className="absolute inset-0" style={{ background: t.overlay }} />}
        <div className="absolute inset-0" style={{ background: `linear-gradient(90deg,${ac}18 0%,transparent 50%)` }} />
        <div className="relative z-10 h-full flex flex-col" style={{ padding: "7px 10px" }}>
          <div style={{ flexShrink: 0, marginBottom: "5px", textAlign: "center" }}>
            <span style={{ display: "inline-block", background: ac, borderRadius: "6px", padding: "2px 10px", fontSize: "10px", fontWeight: 900, color: "#000" }}>{tournament.name}</span>
            <span style={{ display: "block", fontSize: "6px", color: t.badgeText, marginTop: "2px" }}>{badgeLabel}</span>
          </div>
          {lsContent}
          {renderFooter(t)}
        </div>
      </div>
    );

    // compact landscape: dense terminal header
    if (t.layout === "compact") return (
      <div key={t.id} ref={cardIdx === activeIdx ? cardRef : undefined} className="shrink-0 relative overflow-hidden" style={{ width: "calc(100vw - 48px)", aspectRatio: "16/9", scrollSnapAlign: "center", borderRadius: "10px", border: `1px solid ${ac}25`, background: t.bg, ...(t.bgImage ? { backgroundImage: `url(${t.bgImage})`, backgroundSize: "cover", backgroundPosition: "center" } : {}) }}>
        {t.overlay !== "none" && <div className="absolute inset-0" style={{ background: t.overlay }} />}
        <div className="relative z-10 h-full flex flex-col" style={{ padding: "6px 8px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px", flexShrink: 0, borderBottom: `1px solid ${ac}30`, paddingBottom: "4px", fontFamily: "monospace" }}>
            <div>
              <span style={{ color: t.titleColor, fontWeight: 900, fontSize: "9px" }}>{tournament.name}</span>
              <span style={{ color: t.legendText, fontSize: "6px", marginLeft: "5px" }}>{badgeLabel}</span>
            </div>
            <span style={{ color: ac, fontSize: "9px", fontWeight: 900, border: `1px solid ${ac}50`, padding: "1px 5px", borderRadius: "3px" }}>{filteredStandings.length}</span>
          </div>
          {lsContent}
          {renderFooter(t)}
        </div>
      </div>
    );

    // default landscape: title + badge side by side
    return (
      <div key={t.id} ref={cardIdx === activeIdx ? cardRef : undefined} className="shrink-0 relative overflow-hidden" style={{ width: "calc(100vw - 48px)", aspectRatio: "16/9", scrollSnapAlign: "center", borderRadius: "20px", background: t.bg, ...(t.bgImage ? { backgroundImage: `url(${t.bgImage})`, backgroundSize: "cover", backgroundPosition: "center" } : {}), ...borderDecor }}>
        {t.overlay !== "none" && <div className="absolute inset-0" style={{ background: t.overlay, borderRadius: "20px" }} />}
        <div className="relative z-10 h-full flex flex-col" style={{ padding: "10px 12px" }}>
          <div className="flex items-center justify-between" style={{ marginBottom: "6px", flexShrink: 0 }}>
            <span style={{ fontSize: "12px", fontWeight: 900, color: t.titleColor, textShadow: t.titleShadow }}>{tournament.name}</span>
            <span style={{ fontSize: "7px", fontWeight: 700, color: t.badgeText, background: t.badgeBg, border: `1px solid ${t.badgeBorder}`, borderRadius: "4px", padding: "1px 5px", flexShrink: 0 }}>{badgeLabel}</span>
          </div>
          {lsContent}
          {renderFooter(t)}
        </div>
      </div>
    );
  };


  return (
    <div className="fixed inset-0 z-[55] flex flex-col" style={{ background: "#0a0a0a" }}>
      <div className="shrink-0 flex items-center justify-between px-4 pt-4 pb-2">
        <button onClick={onClose} className="text-white/70 hover:text-white bg-white/5 border border-white/10 p-2 rounded-xl transition-all"><X className="h-5 w-5" /></button>
        <div className="flex items-center gap-2">
          <p className="text-xs font-bold tracking-widest text-white/30">STANDINGS</p>
          {tournament.splitEnabled && <GroupFilterDropdown value={groupFilter} onChange={setGroupFilter} groupCount={tournament.groupCount ?? 2} showFinal={tournament.teams.some(t => t.group === "final")} />}
        </div>
        <ExportPopover onShare={() => capture(false)} onDownload={() => capture(true)} format={format} onFormatChange={setFormat} />
      </div>
      <ThemeCarousel renderCard={renderCard} onActiveIndexChange={handleActiveIndexChange} />
    </div>
  );
}
