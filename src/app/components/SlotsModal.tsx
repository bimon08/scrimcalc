"use client";
import { useState, useCallback, useRef } from "react";
import { X, Check } from "lucide-react";
import html2canvas from "html2canvas-pro";
import { toast } from "sonner";
import { Tournament } from "@/lib/types";
import standingsThemes from "@/lib/standingsThemes";
import GroupFilterDropdown from "./GroupFilterDropdown";
import ExportPopover from "./ExportPopover";
import ThemeCarousel from "./ThemeCarousel";

const APP_NAME = "ScrimCalc";
type Theme = typeof standingsThemes[0];
type Format = "square" | "landscape";

interface Props {
  tournament: Tournament;
  groupFilter: string;
  setGroupFilter: (v: string) => void;
  onClose: () => void;
}

export default function SlotsModal({ tournament, groupFilter, setGroupFilter, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx]       = useState(0);
  const [format, setFormat]             = useState<Format>("landscape");
  const [startSlotStr, setStartSlotStr] = useState("3");
  const [showRoster, setShowRoster]     = useState(false);

  const startSlot = Math.max(1, parseInt(startSlotStr) || 1);

  const handleActiveIndexChange = (i: number) => {
    setActiveIdx(i);
  };

  // ── Slot data ────────────────────────────────────────────────────────────

  const slotAssignments = tournament.teams
    .filter(t => !t.out && (!tournament.splitEnabled || groupFilter === "all" || t.group === groupFilter))
    .map((t, i) => ({ ...t, slot: startSlot + i }));

  const maxPlayers = Math.min(
    Math.max(...slotAssignments.map(s => (s.players ?? []).length), 0),
    6
  );
  const totalPlayers = slotAssignments.reduce((s, t) => s + (t.players ?? []).length, 0);

  // ── Capture ──────────────────────────────────────────────────────────────

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

      const fileName = `${tournament.name || "slots"}-list.jpg`;

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
            await navigator.share({ files: [file], title: tournament.name || "Slot List" });
            return;
          } catch (shareErr: unknown) {
            if ((shareErr as Error).name === "AbortError") return;
            // Fall through to clipboard or download
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
  }, [tournament.name]);

  // ── Landscape Content ───────────────────────────────────────────────────

  const renderSlotsLandscape = (t: Theme) => {
    if (slotAssignments.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-6 gap-2 h-full">
          <span style={{ fontSize: "28px" }}>🎯</span>
          <p style={{ color: t.cellText, fontWeight: 700, fontSize: "12px" }}>No teams registered</p>
        </div>
      );
    }

    const total = slotAssignments.length;
    // When roster is off: 3 columns if total > 16, otherwise 2 columns
    const numCols = showRoster ? 1 : total > 16 ? 3 : 2;
    const perCol = Math.ceil(total / numCols);
    const cols: typeof slotAssignments[] = [];
    for (let c = 0; c < numCols; c++) {
      const s = slotAssignments.slice(c * perCol, (c + 1) * perCol);
      if (s.length > 0) cols.push(s);
    }

    const ac = t.accentColor;
    const isMinimal = t.layout === "minimal";
    const isBold = t.layout === "bold";

    // Proportional typography based on row count
    const fs = perCol > 14 ? "4.5px" : perCol > 11 ? "5.2px" : perCol > 8 ? "6.2px" : perCol > 5 ? "7.5px" : "8.5px";
    const slotFs = perCol > 14 ? "4px" : perCol > 11 ? "4.8px" : perCol > 8 ? "5.5px" : perCol > 5 ? "6.5px" : "7.5px";
    const slotW = perCol > 14 ? "12px" : perCol > 11 ? "13px" : perCol > 8 ? "15px" : "18px";
    const headerPad = perCol > 10 ? "1px 2px" : "1.5px 3px";
    const headerFs = perCol > 11 ? "4.5px" : perCol > 8 ? "5px" : "5.5px";
    const hTextColor = isMinimal ? t.legendText : t.headerText;

    if (showRoster) {
      const rFs = perCol > 14 ? "4.5px" : perCol > 10 ? "5px" : perCol > 7 ? "5.5px" : "6.5px";
      return (
        <div className="h-full overflow-hidden flex flex-col rounded-md" style={{ backgroundColor: isMinimal ? "transparent" : t.tableBg, border: isMinimal ? "none" : `1px solid ${t.tableBorder}` }}>
          <div style={{ flexShrink: 0, backgroundColor: isMinimal ? "transparent" : t.headerBg, borderBottom: `1px solid ${t.headerBorder}`, padding: headerPad, display: "flex", alignItems: "center" }}>
            <span style={{ width: slotW, fontSize: headerFs, fontWeight: 800, textAlign: "center", color: hTextColor }}>#</span>
            <span style={{ width: "55px", fontSize: headerFs, fontWeight: 800, textTransform: "uppercase", color: hTextColor, paddingLeft: "3px" }}>Team</span>
            {Array.from({ length: maxPlayers }, (_, i) => (
              <span key={i} style={{ flex: 1, fontSize: headerFs, fontWeight: 800, textAlign: "center", textTransform: "uppercase", color: hTextColor }}>P{i + 1}</span>
            ))}
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
            {slotAssignments.map((row, idx) => {
              const players = (row.players ?? []).slice(0, maxPlayers);
              const padded = [...players, ...Array(maxPlayers - players.length).fill("")];
              return (
                <div key={row.id} style={{ flex: 1, display: "flex", alignItems: "center", padding: "0 2px", borderBottom: idx < slotAssignments.length - 1 ? `1px solid ${t.rowBorder}` : "none", background: idx % 2 === 0 ? t.rowEven : t.rowOdd, minHeight: 0 }}>
                  <span style={{ width: slotW, textAlign: "center", color: ac, fontSize: slotFs, fontWeight: 900, fontFamily: "monospace" }}>{row.slot}</span>
                  <span style={{ width: "55px", color: t.cellText, fontSize: rFs, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", paddingLeft: "3px", display: "flex", alignItems: "center", gap: "2px" }}>
                    {row.logo && <img src={row.logo} alt="" style={{ width: rFs, height: rFs, borderRadius: "2px", objectFit: "cover", flexShrink: 0 }} />}
                    {row.name}
                  </span>
                  {padded.map((p, pi) => (
                    <span key={pi} style={{ flex: 1, textAlign: "center", color: p ? t.cellText : "rgba(255,255,255,0.2)", fontSize: rFs, whiteSpace: "nowrap", overflow: "hidden" }}>{p || "—"}</span>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div style={{ display: "flex", gap: "4px", height: "100%" }}>
        {cols.map((col, ci) => (
          <div key={ci} style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", borderRadius: "5px", backgroundColor: isMinimal ? "transparent" : t.tableBg, border: isMinimal ? "none" : isBold ? `1.5px solid ${ac}40` : `1px solid ${t.tableBorder}` }}>
            <div style={{ flexShrink: 0, backgroundColor: isMinimal ? "transparent" : t.headerBg, borderBottom: `1px solid ${t.headerBorder}`, padding: headerPad, display: "flex", alignItems: "center" }}>
              <span style={{ width: slotW, fontSize: headerFs, fontWeight: 800, textAlign: "center", color: hTextColor }}>SLOT</span>
              <span style={{ flex: 1, fontSize: headerFs, fontWeight: 800, textTransform: "uppercase", color: hTextColor, paddingLeft: "4px" }}>TEAM</span>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
              {col.map((row, idx) => (
                <div key={row.id} style={{ flex: 1, display: "flex", alignItems: "center", padding: "0 3px", borderBottom: idx < col.length - 1 ? `1px solid ${t.rowBorder}` : "none", background: idx % 2 === 0 ? t.rowEven : t.rowOdd, minHeight: 0 }}>
                  <span
                    className="inline-flex items-center justify-center font-black"
                    style={{
                      minWidth: slotW,
                      padding: "1px 2px",
                      height: "auto",
                      lineHeight: 1,
                      fontSize: slotFs,
                      background: `${ac}22`,
                      border: `1px solid ${ac}44`,
                      color: ac,
                      borderRadius: "2.5px",
                      flexShrink: 0,
                      fontFamily: "monospace"
                    }}
                  >
                    {row.slot}
                  </span>
                  <span style={{ flex: 1, color: t.cellText, fontSize: fs, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", paddingLeft: "4px", display: "flex", alignItems: "center", gap: "2px" }}>
                    {row.logo && <img src={row.logo} alt="" style={{ width: fs, height: fs, borderRadius: "2px", objectFit: "cover", flexShrink: 0 }} />}
                    {row.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ── Square Content ─────────────────────────────────────────────────────

  const renderSlotsSquare = (t: Theme) => {
    if (slotAssignments.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-10 gap-2 h-full">
          <span style={{ fontSize: "36px" }}>🎯</span>
          <p style={{ color: t.cellText, fontWeight: 700, fontSize: "14px" }}>No teams registered</p>
        </div>
      );
    }

    const total = slotAssignments.length;
    const numCols = total > 10 ? 2 : 1;
    const perCol = Math.ceil(total / numCols);
    const cols: typeof slotAssignments[] = [];
    for (let c = 0; c < numCols; c++) {
      const s = slotAssignments.slice(c * perCol, (c + 1) * perCol);
      if (s.length > 0) cols.push(s);
    }

    const ac = t.accentColor;
    const isMinimal = t.layout === "minimal";
    const isBold = t.layout === "bold";

    // Dynamic sizing for Square
    const fs = numCols === 1
      ? (perCol > 8 ? "10px" : "12px")
      : (perCol > 14 ? "6.5px" : perCol > 11 ? "7.5px" : perCol > 8 ? "8.5px" : "9.5px");
    const slotFs = numCols === 1
      ? (perCol > 8 ? "9px" : "11px")
      : (perCol > 14 ? "6px" : perCol > 11 ? "7px" : perCol > 8 ? "8px" : "9px");
    const slotW = numCols === 1
      ? (perCol > 8 ? "20px" : "24px")
      : (perCol > 14 ? "13px" : perCol > 11 ? "15px" : "18px");
    const headerPad = numCols === 1 ? "3px 6px" : "2px 4px";
    const headerFs = numCols === 1 ? "8px" : "6.5px";
    const hTextColor = isMinimal ? t.legendText : t.headerText;

    return (
      <div style={{ display: "flex", gap: "5px", height: "100%" }}>
        {cols.map((col, ci) => (
          <div key={ci} style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", borderRadius: "8px", backgroundColor: isMinimal ? "transparent" : t.tableBg, border: isMinimal ? "none" : isBold ? `2px solid ${ac}40` : `1px solid ${t.tableBorder}` }}>
            <div style={{ flexShrink: 0, backgroundColor: isMinimal ? "transparent" : t.headerBg, borderBottom: `1px solid ${t.headerBorder}`, padding: headerPad, display: "flex", alignItems: "center" }}>
              <span style={{ width: slotW, fontSize: headerFs, fontWeight: 800, textAlign: "center", color: hTextColor }}>SLOT</span>
              <span style={{ flex: 1, fontSize: headerFs, fontWeight: 800, textTransform: "uppercase", color: hTextColor, paddingLeft: "5px" }}>TEAM</span>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
              {col.map((row, idx) => (
                <div key={row.id} style={{ flex: 1, display: "flex", alignItems: "center", padding: "0 4px", borderBottom: idx < col.length - 1 ? `1px solid ${t.rowBorder}` : "none", background: idx % 2 === 0 ? t.rowEven : t.rowOdd, minHeight: 0 }}>
                  <span
                    className="inline-flex items-center justify-center font-black"
                    style={{
                      minWidth: slotW,
                      padding: "1px 2px",
                      height: "auto",
                      lineHeight: 1,
                      fontSize: slotFs,
                      background: `${ac}25`,
                      border: `1px solid ${ac}50`,
                      color: ac,
                      borderRadius: "3px",
                      flexShrink: 0,
                      fontFamily: "monospace"
                    }}
                  >
                    {row.slot}
                  </span>
                  <span style={{ flex: 1, color: t.cellText, fontSize: fs, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", paddingLeft: "5px", display: "flex", alignItems: "center", gap: "2px" }}>
                    {row.logo && <img src={row.logo} alt="" style={{ width: fs, height: fs, borderRadius: "2px", objectFit: "cover", flexShrink: 0 }} />}
                    {row.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ── Footer ──────────────────────────────────────────────────────────────

  const renderFooter = (t: Theme) => {
    const isLandscape = format === "landscape";
    const fs = isLandscape ? "6px" : "7px";
    const appFs = isLandscape ? "6px" : "8px";
    const mt = isLandscape ? "mt-0.5" : "mt-1";
    if (t.layout === "banner") {
      return (
        <div className={`${mt} flex items-center ${showRoster ? "justify-between" : "justify-end"}`}>
          {showRoster && <span style={{ fontSize: fs, fontWeight: 600, color: t.badgeText }}>Total Players: {totalPlayers}</span>}
          <span style={{ fontSize: fs, fontWeight: 700, letterSpacing: "0.1em", color: t.footerText, opacity: 0.5 }}>By {APP_NAME}</span>
        </div>
      );
    }
    if (t.layout === "minimal") {
      return (
        <div className={`${mt} pt-0.5 flex items-center ${showRoster ? "justify-between" : "justify-center"}`} style={{ borderTop: `1px solid ${t.rowBorder}20` }}>
          {showRoster && <span style={{ fontSize: fs, fontWeight: 600, color: t.badgeText }}>Total Players: {totalPlayers}</span>}
          <span style={{ fontSize: fs, fontWeight: 500, color: t.footerText, opacity: 0.4 }}>{APP_NAME}</span>
        </div>
      );
    }
    return (
      <div className={`${mt} flex items-center ${showRoster ? "justify-between px-0.5" : "justify-center"}`}>
        {showRoster && <span style={{ fontSize: fs, fontWeight: 600, color: t.badgeText }}>Total Players: {totalPlayers}</span>}
        <div className="flex items-center gap-1">
          <div className="h-px w-4" style={{ background: `linear-gradient(to right,transparent,${t.footerAccent})` }} />
          <span style={{ fontSize: appFs, fontWeight: 500, color: t.footerText }}>{APP_NAME}</span>
          <div className="h-px w-4" style={{ background: `linear-gradient(to left,transparent,${t.footerAccent})` }} />
        </div>
      </div>
    );
  };

  // ── Card Renderer ───────────────────────────────────────────────────────

  const renderCard = (t: Theme, cardIdx: number) => {
    const isLandscape = format === "landscape";
    const sqAspect = "1/1";
    const borderDecor = t.layout === "accent-bar" ? { borderLeft: `4px solid ${t.accentColor}` } : t.layout === "bold" ? { border: `2px solid ${t.accentColor}30` } : {};
    const ac = t.accentColor;
    const badgeLabel = tournament.splitEnabled && groupFilter !== "all" ? (groupFilter === "final" ? "Final" : `Group ${groupFilter}`) : "Slot List";

    // ── BANNER layout ──
    if (t.layout === "banner") {
      return (
        <div key={t.id} ref={cardIdx === activeIdx ? cardRef : undefined} className="shrink-0 relative overflow-hidden" style={{ width: "calc(100vw - 48px)", aspectRatio: isLandscape ? "16/9" : sqAspect, scrollSnapAlign: "center", borderRadius: "16px", background: t.bg, ...(t.bgImage ? { backgroundImage: `url(${t.bgImage})`, backgroundSize: "cover", backgroundPosition: "center" } : {}) }}>
          {t.overlay !== "none" && <div className="absolute inset-0" style={{ background: t.overlay }} />}
          <div className="relative z-10 h-full flex flex-col">
            <div style={{ background: `linear-gradient(90deg,${ac}55 0%,${ac}18 65%,transparent 100%)`, borderBottom: `2px solid ${ac}`, borderLeft: `4px solid ${ac}`, padding: isLandscape ? "3px 8px" : "8px 12px", flexShrink: 0 }}>
              <span style={{ fontSize: isLandscape ? "10px" : "14px", fontWeight: 900, color: t.titleColor, textShadow: t.titleShadow }}>{tournament.name}</span>
              <span style={{ fontSize: isLandscape ? "5.5px" : "7px", color: t.badgeText, fontWeight: 700, marginLeft: "6px", letterSpacing: "0.08em" }}>{badgeLabel}</span>
            </div>
            <div className="flex-1 px-1.5 py-1" style={{ overflow: "hidden", minHeight: 0 }}>
              {isLandscape ? renderSlotsLandscape(t) : renderSlotsSquare(t)}
            </div>
            <div className="px-1.5 pb-1">{renderFooter(t)}</div>
          </div>
        </div>
      );
    }

    // ── SPLIT layout ──
    if (t.layout === "split") {
      return (
        <div key={t.id} ref={cardIdx === activeIdx ? cardRef : undefined} className="shrink-0 relative overflow-hidden" style={{ width: "calc(100vw - 48px)", aspectRatio: isLandscape ? "16/9" : sqAspect, scrollSnapAlign: "center", borderRadius: "16px", background: t.bg, ...(t.bgImage ? { backgroundImage: `url(${t.bgImage})`, backgroundSize: "cover", backgroundPosition: "center" } : {}) }}>
          {t.overlay !== "none" && <div className="absolute inset-0" style={{ background: t.overlay }} />}
          <div className="relative z-10 h-full" style={{ display: "flex" }}>
            <div style={{ width: isLandscape ? "18px" : "26px", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", padding: "4px 0", background: `${ac}25`, borderRight: `1.5px solid ${ac}50` }}>
              <div style={{ width: "1px", height: "8px", background: ac, flexShrink: 0 }} />
              <span style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", color: t.titleColor, fontWeight: 900, fontSize: isLandscape ? "6.5px" : "9px", letterSpacing: "0.1em", flex: 1, display: "flex", alignItems: "center", justifyContent: "center", textTransform: "uppercase" }}>{tournament.name.slice(0, 16)}</span>
              <div style={{ width: "1px", height: "8px", background: ac, flexShrink: 0 }} />
            </div>
            <div className="flex-1 flex flex-col" style={{ padding: isLandscape ? "4px 6px" : "8px 10px" }}>
              <div style={{ fontSize: isLandscape ? "5.5px" : "7px", color: t.badgeText, marginBottom: "2px", flexShrink: 0 }}>{badgeLabel}</div>
              <div className="flex-1" style={{ overflow: "hidden", minHeight: 0 }}>
                {isLandscape ? renderSlotsLandscape(t) : renderSlotsSquare(t)}
              </div>
              {renderFooter(t)}
            </div>
          </div>
        </div>
      );
    }

    // ── BOLD layout ──
    if (t.layout === "bold") {
      return (
        <div key={t.id} ref={cardIdx === activeIdx ? cardRef : undefined} className="shrink-0 relative overflow-hidden" style={{ width: "calc(100vw - 48px)", aspectRatio: isLandscape ? "16/9" : sqAspect, scrollSnapAlign: "center", borderRadius: "18px", border: `2px solid ${ac}40`, background: t.bg, ...(t.bgImage ? { backgroundImage: `url(${t.bgImage})`, backgroundSize: "cover", backgroundPosition: "center" } : {}) }}>
          {t.overlay !== "none" && <div className="absolute inset-0" style={{ background: t.overlay, borderRadius: "16px" }} />}
          <div className="relative z-10 h-full flex flex-col" style={{ padding: isLandscape ? "4px 8px" : "10px 14px" }}>
            <div style={{ flexShrink: 0, textAlign: "center", marginBottom: isLandscape ? "2px" : "6px", borderBottom: `1px solid ${ac}50`, paddingBottom: "2px" }}>
              <span style={{ fontSize: isLandscape ? "11px" : "15px", fontWeight: 900, color: t.titleColor, textShadow: t.titleShadow, letterSpacing: "0.06em" }}>{tournament.name}</span>
              <span style={{ fontSize: isLandscape ? "5.5px" : "7px", color: ac, display: "block", fontWeight: 700, letterSpacing: "0.08em" }}>{badgeLabel}</span>
            </div>
            <div className="flex-1" style={{ overflow: "hidden", minHeight: 0 }}>
              {isLandscape ? renderSlotsLandscape(t) : renderSlotsSquare(t)}
            </div>
            {renderFooter(t)}
          </div>
        </div>
      );
    }

    // ── MINIMAL layout ──
    if (t.layout === "minimal") {
      return (
        <div key={t.id} ref={cardIdx === activeIdx ? cardRef : undefined} className="shrink-0 relative overflow-hidden" style={{ width: "calc(100vw - 48px)", aspectRatio: isLandscape ? "16/9" : sqAspect, scrollSnapAlign: "center", borderRadius: "16px", background: t.bg, ...(t.bgImage ? { backgroundImage: `url(${t.bgImage})`, backgroundSize: "cover", backgroundPosition: "center" } : {}) }}>
          {t.overlay !== "none" && <div className="absolute inset-0" style={{ background: t.overlay }} />}
          <div className="relative z-10 h-full flex flex-col" style={{ padding: isLandscape ? "5px 8px" : "12px 14px" }}>
            <div style={{ flexShrink: 0, marginBottom: isLandscape ? "3px" : "5px" }}>
              <span style={{ fontSize: isLandscape ? "9.5px" : "12px", fontWeight: 700, color: t.titleColor, textTransform: "uppercase", letterSpacing: "0.06em", opacity: 0.85 }}>{tournament.name}</span>
              <div style={{ height: "0.5px", background: `${ac}60`, margin: "2px 0 1px" }} />
              <span style={{ fontSize: isLandscape ? "5.5px" : "7px", color: t.legendText }}>{badgeLabel}</span>
            </div>
            <div className="flex-1" style={{ overflow: "hidden", minHeight: 0 }}>
              {isLandscape ? renderSlotsLandscape(t) : renderSlotsSquare(t)}
            </div>
            {renderFooter(t)}
          </div>
        </div>
      );
    }

    // ── ACCENT-BAR layout ──
    if (t.layout === "accent-bar") {
      return (
        <div key={t.id} ref={cardIdx === activeIdx ? cardRef : undefined} className="shrink-0 relative overflow-hidden" style={{ width: "calc(100vw - 48px)", aspectRatio: isLandscape ? "16/9" : sqAspect, scrollSnapAlign: "center", borderRadius: "16px", borderLeft: `4px solid ${ac}`, background: t.bg, ...(t.bgImage ? { backgroundImage: `url(${t.bgImage})`, backgroundSize: "cover", backgroundPosition: "center" } : {}) }}>
          {t.overlay !== "none" && <div className="absolute inset-0" style={{ background: t.overlay }} />}
          <div className="absolute inset-0" style={{ background: `linear-gradient(90deg,${ac}18 0%,transparent 50%)` }} />
          <div className="relative z-10 h-full flex flex-col" style={{ padding: isLandscape ? "4px 8px" : "10px 12px" }}>
            <div style={{ flexShrink: 0, marginBottom: isLandscape ? "3px" : "5px", textAlign: "center" }}>
              <span style={{ display: "inline-block", background: ac, borderRadius: "5px", padding: isLandscape ? "1.5px 8px" : "3px 12px", fontSize: isLandscape ? "9.5px" : "12px", fontWeight: 900, color: "#000" }}>{tournament.name}</span>
              <span style={{ display: "block", fontSize: isLandscape ? "5.5px" : "7px", color: t.badgeText, marginTop: "1px" }}>{badgeLabel}</span>
            </div>
            <div className="flex-1" style={{ overflow: "hidden", minHeight: 0 }}>
              {isLandscape ? renderSlotsLandscape(t) : renderSlotsSquare(t)}
            </div>
            {renderFooter(t)}
          </div>
        </div>
      );
    }

    // ── COMPACT layout ──
    if (t.layout === "compact") {
      return (
        <div key={t.id} ref={cardIdx === activeIdx ? cardRef : undefined} className="shrink-0 relative overflow-hidden" style={{ width: "calc(100vw - 48px)", aspectRatio: isLandscape ? "16/9" : sqAspect, scrollSnapAlign: "center", borderRadius: "10px", border: `1px solid ${ac}25`, background: t.bg, ...(t.bgImage ? { backgroundImage: `url(${t.bgImage})`, backgroundSize: "cover", backgroundPosition: "center" } : {}) }}>
          {t.overlay !== "none" && <div className="absolute inset-0" style={{ background: t.overlay }} />}
          <div className="relative z-10 h-full flex flex-col" style={{ padding: isLandscape ? "4px 6px" : "8px 10px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: isLandscape ? "2px" : "4px", flexShrink: 0, borderBottom: `1px solid ${ac}30`, paddingBottom: "2px", fontFamily: "monospace" }}>
              <div>
                <span style={{ color: t.titleColor, fontWeight: 900, fontSize: isLandscape ? "8.5px" : "11px" }}>{tournament.name}</span>
                <span style={{ color: t.legendText, fontSize: isLandscape ? "5.5px" : "7px", marginLeft: "4px" }}>{badgeLabel}</span>
              </div>
              <span style={{ color: ac, fontSize: isLandscape ? "8.5px" : "11px", fontWeight: 900, border: `1px solid ${ac}50`, padding: "0.5px 4px", borderRadius: "3px" }}>{slotAssignments.length}</span>
            </div>
            <div className="flex-1" style={{ overflow: "hidden", minHeight: 0 }}>
              {isLandscape ? renderSlotsLandscape(t) : renderSlotsSquare(t)}
            </div>
            {renderFooter(t)}
          </div>
        </div>
      );
    }

    // ── DEFAULT layout ──
    return (
      <div key={t.id} ref={cardIdx === activeIdx ? cardRef : undefined} className="shrink-0 relative overflow-hidden" style={{ width: "calc(100vw - 48px)", aspectRatio: isLandscape ? "16/9" : sqAspect, scrollSnapAlign: "center", borderRadius: "16px", background: t.bg, ...(t.bgImage ? { backgroundImage: `url(${t.bgImage})`, backgroundSize: "cover", backgroundPosition: "center" } : {}), ...borderDecor }}>
        {t.overlay !== "none" && <div className="absolute inset-0" style={{ background: t.overlay, borderRadius: "16px" }} />}
        <div className="relative z-10 h-full flex flex-col" style={{ padding: isLandscape ? "5px 8px" : "10px 12px" }}>
          <div className="flex items-center justify-between" style={{ marginBottom: isLandscape ? "3px" : "6px", flexShrink: 0 }}>
            <span style={{ fontSize: isLandscape ? "10.5px" : "14px", fontWeight: 900, color: t.titleColor, textShadow: t.titleShadow }}>{tournament.name}</span>
            <span style={{ fontSize: isLandscape ? "6px" : "8px", fontWeight: 700, color: t.badgeText, background: t.badgeBg, border: `1px solid ${t.badgeBorder}`, borderRadius: "3px", padding: "0.5px 4px", flexShrink: 0 }}>{badgeLabel}</span>
          </div>
          <div className="flex-1" style={{ overflow: "hidden", minHeight: 0 }}>
            {isLandscape ? renderSlotsLandscape(t) : renderSlotsSquare(t)}
          </div>
          {renderFooter(t)}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[55] flex flex-col" style={{ background: "#0a0a0a" }}>
      {/* Header bar */}
      <div className="shrink-0 flex items-center justify-between px-4 pt-4 pb-2">
        <button
          onClick={onClose}
          className="text-white/70 hover:text-white bg-white/5 border border-white/10 p-2 rounded-xl transition-all"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2">
          <p className="text-xs font-bold tracking-widest text-white/30">SLOT LIST</p>
          {tournament.splitEnabled && (
            <GroupFilterDropdown
              value={groupFilter}
              onChange={setGroupFilter}
              groupCount={tournament.groupCount ?? 2}
              showFinal={tournament.teams.some(t => t.group === "final")}
            />
          )}
        </div>

        <ExportPopover
          onShare={() => capture(false)}
          onDownload={() => capture(true)}
          format={format}
          onFormatChange={setFormat}
        >
          {/* Roster toggle (Landscape only) */}
          {format === "landscape" && (
            <button
              onClick={() => setShowRoster(v => !v)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors border-b border-white/[0.07]"
            >
              <span className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                Roster
              </span>
              <span className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                showRoster ? "bg-amber-500 border-amber-500" : "border-white/30"
              }`}>
                {showRoster && <Check className="h-3 w-3 text-black" strokeWidth={3} />}
              </span>
            </button>
          )}

          {/* Start slot */}
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-xs font-semibold text-white/70">Start slot</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const cur = parseInt(startSlotStr) || 1;
                  const next = Math.max(1, cur - 1);
                  setStartSlotStr(String(next));
                }}
                className="w-6 h-6 rounded-md bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-bold flex items-center justify-center transition-all border border-white/10 cursor-pointer"
              >
                -
              </button>
              <input
                type="number"
                value={startSlotStr}
                onChange={e => setStartSlotStr(e.target.value)}
                onBlur={() => {
                  const num = parseInt(startSlotStr);
                  if (!num || num < 1) setStartSlotStr("1");
                  else setStartSlotStr(String(num));
                }}
                className="w-10 bg-white/10 border border-white/20 rounded-md text-xs font-bold text-white text-center focus:outline-none focus:border-amber-500/50 py-0.5"
                min={1}
              />
              <button
                type="button"
                onClick={() => {
                  const cur = parseInt(startSlotStr) || 1;
                  const next = cur + 1;
                  setStartSlotStr(String(next));
                }}
                className="w-6 h-6 rounded-md bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-bold flex items-center justify-center transition-all border border-white/10 cursor-pointer"
              >
                +
              </button>
            </div>
          </div>
        </ExportPopover>
      </div>

      {/* Centered preview carousel */}
      <ThemeCarousel renderCard={renderCard} onActiveIndexChange={handleActiveIndexChange} />
    </div>
  );
}
