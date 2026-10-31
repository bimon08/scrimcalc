"use client";
import { useState, useRef, useCallback, type ReactNode } from "react";
import {
  ChevronLeft,
  Palette,
  ImagePlus,
  Share2,
  Download,
  Trash2,
  X,
  Plus,
} from "lucide-react";
import html2canvas from "html2canvas-pro";
import { toast } from "sonner";
import standingsThemes from "@/lib/standingsThemes";

type Theme = (typeof standingsThemes)[0];
type Format = "square" | "landscape";

/* ── Logo types ─────────────────────────────────────────────────────────── */

type LogoShape = "none" | "circle" | "rounded" | "square" | "hexagon";

interface Logo {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  shape: LogoShape;
}

const SHAPE_CLIP: Record<LogoShape, string | undefined> = {
  none: undefined,
  circle: "circle(50%)",
  rounded: "inset(0 round 20%)",
  square: "inset(0)",
  hexagon: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
};

const SHAPE_ICONS: Record<LogoShape, string> = {
  none: "—",
  circle: "●",
  rounded: "▢",
  square: "■",
  hexagon: "⬡",
};

/* ── Color filter types ─────────────────────────────────────────────────── */

interface ColorFilters {
  hue: number;
  saturate: number;
  brightness: number;
  contrast: number;
}

const DEFAULT_FILTERS: ColorFilters = { hue: 0, saturate: 100, brightness: 100, contrast: 100 };

const FILTER_DEFS = [
  { label: "Hue", key: "hue" as const, min: 0, max: 360, def: 0 },
  { label: "Saturation", key: "saturate" as const, min: 0, max: 200, def: 100 },
  { label: "Brightness", key: "brightness" as const, min: 0, max: 200, def: 100 },
  { label: "Contrast", key: "contrast" as const, min: 0, max: 200, def: 100 },
];

/* ── Background color presets ───────────────────────────────────────────── */

const BG_PRESETS = [
  "transparent", "#ffffff", "#000000", "#0a0a0a", "#1a1a2e",
  "#e74c3c", "#e67e22", "#f1c40f", "#2ecc71", "#3498db",
  "#9b59b6", "#e91e63", "#00bcd4", "#795548",
];

/* ── Slider background helper ───────────────────────────────────────────── */

const sliderBg = (v: number, min: number, max: number) => {
  const pct = ((v - min) / (max - min)) * 100;
  return `linear-gradient(to right, #a855f7 ${pct}%, rgba(255,255,255,0.12) ${pct}%)`;
};

/* ── Props ──────────────────────────────────────────────────────────────── */

interface TemplateEditorProps {
  renderCard: (theme: Theme, cardIdx: number) => ReactNode;
  themeIdx: number;
  onBack: () => void;
  exportFileName: string;
  format: Format;
  onFormatChange: (f: Format) => void;
}

/* ══════════════════════════════════════════════════════════════════════════ */

export default function TemplateEditor({
  renderCard,
  themeIdx,
  onBack,
  exportFileName,
  format,
  onFormatChange,
}: TemplateEditorProps) {
  const captureRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgImageInputRef = useRef<HTMLInputElement>(null);

  /* ── state ──────────────────────────────────────────────────────────── */

  const [bgColor, setBgColor] = useState("transparent");
  const [filters, setFilters] = useState<ColorFilters>({ ...DEFAULT_FILTERS });
  const [pendingFilters, setPendingFilters] = useState<ColorFilters>({ ...DEFAULT_FILTERS });
  const [logos, setLogos] = useState<Logo[]>([]);
  const [selectedLogoId, setSelectedLogoId] = useState<string | null>(null);
  const [activeSheet, setActiveSheet] = useState<"color" | "background" | null>(null);
  const [customBgImage, setCustomBgImage] = useState<string | null>(null);

  // Drag / resize transient state
  const dragRef = useRef<{
    logoId: string; startX: number; startY: number; logoStartX: number; logoStartY: number;
  } | null>(null);
  const resizeRef = useRef<{
    logoId: string; startX: number; startY: number; startW: number; startH: number;
  } | null>(null);

  /* ── derived ────────────────────────────────────────────────────────── */

  const theme = standingsThemes[themeIdx];
  const modifiedTheme = customBgImage ? { ...theme, bgImage: customBgImage } : theme;

  // Real-time preview while color sheet is open
  const activeFilters = activeSheet === "color" ? pendingFilters : filters;
  const isDefault =
    activeFilters.hue === 0 && activeFilters.saturate === 100 &&
    activeFilters.brightness === 100 && activeFilters.contrast === 100;
  const filterString = isDefault
    ? "none"
    : `hue-rotate(${activeFilters.hue}deg) saturate(${activeFilters.saturate}%) brightness(${activeFilters.brightness}%) contrast(${activeFilters.contrast}%)`;

  const selectedLogo = logos.find((l) => l.id === selectedLogoId);
  const hasBgPadding = bgColor !== "transparent" && bgColor !== "#0a0a0a";

  /* ── capture ────────────────────────────────────────────────────────── */

  const capture = useCallback(
    async (download: boolean) => {
      const el = captureRef.current;
      if (!el) { toast.error("Card not ready"); return; }

      // Hide selection UI during capture
      const prev = selectedLogoId;
      setSelectedLogoId(null);
      await new Promise((r) => setTimeout(r, 60));

      const prevRadius = el.style.borderRadius;
      el.style.borderRadius = "0px";
      const overlays = el.querySelectorAll<HTMLElement>(".absolute.inset-0");
      const prevOverlays = [...overlays].map((o) => o.style.borderRadius);
      overlays.forEach((o) => { o.style.borderRadius = "0px"; });

      try {
        const canvas = await html2canvas(el, {
          useCORS: true,
          allowTaint: true,
          scale: Math.max(2, window.devicePixelRatio || 2),
          backgroundColor: null,
          logging: false,
          imageTimeout: 5000,
        });

        const fileName = `${exportFileName}.jpg`;

        if (download) {
          const url = canvas.toDataURL("image/jpeg", 0.95);
          const a = document.createElement("a");
          a.download = fileName; a.href = url; a.click();
          toast.success("Downloaded!"); return;
        }

        const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.95));
        if (blob && navigator.share) {
          const file = new File([blob], fileName, { type: "image/jpeg" });
          if (navigator.canShare?.({ files: [file] })) {
            try { await navigator.share({ files: [file], title: exportFileName }); return; }
            catch (e: unknown) { if ((e as Error).name === "AbortError") return; }
          }
        }
        if (navigator.clipboard && window.ClipboardItem) {
          try {
            const png = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
            if (png) { await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]); toast.success("Copied to clipboard!"); return; }
          } catch { /* fall through */ }
        }
        const url = canvas.toDataURL("image/jpeg", 0.95);
        const a = document.createElement("a");
        a.download = fileName; a.href = url; a.click();
        toast.success("Downloaded image");
      } catch (err: unknown) {
        if ((err as Error).name !== "AbortError") { console.error(err); toast.error("Failed to generate image"); }
      } finally {
        el.style.borderRadius = prevRadius;
        overlays.forEach((o, i) => { o.style.borderRadius = prevOverlays[i] || ""; });
        setSelectedLogoId(prev);
      }
    },
    [exportFileName, selectedLogoId],
  );

  /* ── file uploads ───────────────────────────────────────────────────── */

  const handleLogoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      const img = new window.Image();
      img.onload = () => {
        const max = 80;
        const r = img.width / img.height;
        const w = r > 1 ? max : max * r;
        const h = r > 1 ? max / r : max;
        const logo: Logo = { id: Date.now().toString(), src, x: 40, y: 40, width: w, height: h, shape: "none" };
        setLogos((p) => [...p, logo]);
        setSelectedLogoId(logo.id);
        setActiveSheet(null);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, []);

  const handleBgImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCustomBgImage(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  }, []);

  /* ── pointer handlers for drag / resize ─────────────────────────────── */

  const handleLogoPointerDown = useCallback(
    (e: React.PointerEvent, logoId: string) => {
      e.preventDefault();
      e.stopPropagation();
      setSelectedLogoId(logoId);
      const logo = logos.find((l) => l.id === logoId);
      if (!logo) return;
      dragRef.current = {
        logoId, startX: e.clientX, startY: e.clientY,
        logoStartX: logo.x, logoStartY: logo.y,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [logos],
  );

  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent, logoId: string) => {
      e.preventDefault();
      e.stopPropagation();
      const logo = logos.find((l) => l.id === logoId);
      if (!logo) return;
      resizeRef.current = {
        logoId, startX: e.clientX, startY: e.clientY,
        startW: logo.width, startH: logo.height,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [logos],
  );

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    const r = resizeRef.current;
    if (d) {
      setLogos((p) =>
        p.map((l) => l.id === d.logoId
          ? { ...l, x: d.logoStartX + (e.clientX - d.startX), y: d.logoStartY + (e.clientY - d.startY) }
          : l),
      );
    }
    if (r) {
      setLogos((p) =>
        p.map((l) => l.id === r.logoId
          ? { ...l, width: Math.max(20, r.startW + (e.clientX - r.startX)), height: Math.max(20, r.startH + (e.clientY - r.startY)) }
          : l),
      );
    }
  }, []);

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
    resizeRef.current = null;
  }, []);

  /* ── logo helpers ───────────────────────────────────────────────────── */

  const deleteLogo = useCallback((id: string) => {
    setLogos((p) => p.filter((l) => l.id !== id));
    setSelectedLogoId(null);
  }, []);

  const setLogoShape = useCallback((id: string, shape: LogoShape) => {
    setLogos((p) => p.map((l) => (l.id === id ? { ...l, shape } : l)));
  }, []);

  /* ── dismiss helpers ────────────────────────────────────────────────── */

  const dismissAll = () => { setSelectedLogoId(null); setActiveSheet(null); };

  /* ═══════════════════════════════════════════════════════════════════════ */

  return (
    <div
      className="fixed inset-0 z-[56] flex flex-col"
      style={{ background: "#0a0a0a" }}
      onClick={dismissAll}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div
        className="shrink-0 flex items-center justify-between px-4 pt-4 pb-2"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-0.5 text-white/80 hover:text-white text-sm font-semibold transition-colors"
        >
          <ChevronLeft className="h-5 w-5" /> Back
        </button>

        {/* Format toggle */}
        <div className="flex gap-0.5 bg-white/5 border border-white/10 rounded-lg p-0.5">
          <button
            onClick={() => onFormatChange("square")}
            className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all ${
              format === "square" ? "bg-purple-500 text-white shadow" : "text-white/40 hover:text-white/60"
            }`}
          >
            1:1
          </button>
          <button
            onClick={() => onFormatChange("landscape")}
            className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all ${
              format === "landscape" ? "bg-purple-500 text-white shadow" : "text-white/40 hover:text-white/60"
            }`}
          >
            16:9
          </button>
        </div>

        {/* Share / Download */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => capture(false)}
            className="p-2 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white transition-all active:scale-95"
          >
            <Share2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => capture(true)}
            className="p-2 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white transition-all active:scale-95"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Card preview area ───────────────────────────────────────────── */}
      <div
        className="flex-1 flex items-center justify-center overflow-hidden px-2"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div
          ref={captureRef}
          style={{
            background: bgColor === "transparent"
              ? "transparent"
              : bgColor,
            padding: hasBgPadding ? "16px" : "0px",
            borderRadius: "8px",
            display: "inline-block",
          }}
          onClick={(e) => { e.stopPropagation(); setSelectedLogoId(null); }}
        >
          <div style={{ position: "relative" }}>
            {/* Card with CSS filters applied */}
            <div style={{ filter: filterString }}>
              {renderCard(modifiedTheme, themeIdx)}
            </div>

            {/* ── Draggable logos ────────────────────────────────────── */}
            {logos.map((logo) => {
              const sel = logo.id === selectedLogoId;
              const cp = SHAPE_CLIP[logo.shape];
              return (
                <div
                  key={logo.id}
                  style={{
                    position: "absolute",
                    left: logo.x,
                    top: logo.y,
                    width: logo.width,
                    height: logo.height,
                    zIndex: sel ? 30 : 20,
                    cursor: "move",
                    touchAction: "none",
                  }}
                  onPointerDown={(e) => handleLogoPointerDown(e, logo.id)}
                >
                  <img
                    src={logo.src}
                    alt=""
                    draggable={false}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      clipPath: cp,
                      WebkitClipPath: cp,
                      pointerEvents: "none",
                    }}
                  />
                  {sel && (
                    <>
                      {/* Selection border */}
                      <div
                        style={{
                          position: "absolute", inset: -2,
                          border: "2px dashed #a855f7", borderRadius: "4px",
                          pointerEvents: "none",
                        }}
                      />
                      {/* Resize handle — bottom-right */}
                      <div
                        style={{
                          position: "absolute", right: -7, bottom: -7,
                          width: 14, height: 14,
                          background: "#a855f7", borderRadius: "50%",
                          border: "2px solid white",
                          cursor: "se-resize", touchAction: "none",
                        }}
                        onPointerDown={(e) => handleResizePointerDown(e, logo.id)}
                      />
                      {/* Delete button — top-right */}
                      <button
                        style={{
                          position: "absolute", top: -8, right: -8,
                          width: 18, height: 18,
                          background: "#ef4444", borderRadius: "50%",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          border: "2px solid white", cursor: "pointer",
                        }}
                        onPointerDown={(e) => { e.stopPropagation(); deleteLogo(logo.id); }}
                      >
                        <X style={{ width: 9, height: 9, color: "white" }} />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Shape selector (visible when a logo is selected) ────────── */}
      {selectedLogo && (
        <div className="shrink-0 px-4 py-1.5" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-center gap-1.5 bg-white/[0.04] border border-white/10 rounded-2xl px-3 py-2">
            <span className="text-[9px] text-white/40 font-bold tracking-widest mr-1">SHAPE</span>
            {(Object.keys(SHAPE_ICONS) as LogoShape[]).map((s) => (
              <button
                key={s}
                onClick={() => setLogoShape(selectedLogo.id, s)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all ${
                  selectedLogo.shape === s
                    ? "bg-purple-500 text-white shadow-lg shadow-purple-500/30"
                    : "bg-white/[0.06] text-white/50 hover:bg-white/10"
                }`}
              >
                {SHAPE_ICONS[s]}
              </button>
            ))}
            <div className="w-px h-5 bg-white/10 mx-0.5" />
            <button
              onClick={() => deleteLogo(selectedLogo.id)}
              className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-all"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── Bottom toolbar ──────────────────────────────────────────── */}
      <div className="shrink-0 px-4 pb-4 pt-1" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          {/* Tool buttons: Color · Background · Game Logo */}
          <div className="flex items-center gap-0.5 bg-white/[0.04] border border-white/10 rounded-2xl px-1.5 py-1">
            <button
              onClick={() => {
                if (activeSheet !== "color") setPendingFilters({ ...filters });
                setActiveSheet(activeSheet === "color" ? null : "color");
              }}
              className={`p-2.5 rounded-xl transition-all ${
                activeSheet === "color"
                  ? "bg-purple-500/25 text-purple-400"
                  : "text-white/50 hover:text-white hover:bg-white/10"
              }`}
            >
              <Palette className="h-5 w-5" />
            </button>
            <button
              onClick={() => setActiveSheet(activeSheet === "background" ? null : "background")}
              className={`p-2.5 rounded-xl transition-all ${
                activeSheet === "background"
                  ? "bg-purple-500/25 text-purple-400"
                  : "text-white/50 hover:text-white hover:bg-white/10"
              }`}
            >
              <ImagePlus className="h-5 w-5" />
            </button>
          </div>

          {/* Add Logos */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 bg-purple-500/15 border border-purple-500/25 text-purple-300 hover:bg-purple-500/25 rounded-2xl px-4 py-3 text-sm font-semibold transition-all active:scale-[0.97]"
          >
            <ImagePlus className="h-4 w-4" />
            Add Logos
          </button>
        </div>
      </div>

      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
      <input ref={bgImageInputRef} type="file" accept="image/*" className="hidden" onChange={handleBgImageUpload} />

      {/* ── Color Adjust Sheet ──────────────────────────────────────── */}
      {activeSheet === "color" && (
        <div
          className="absolute bottom-0 left-0 right-0 z-30 rounded-t-3xl"
          style={{
            background: "rgba(18, 18, 36, 0.97)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            maxHeight: "65vh",
            overflowY: "auto",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Handle bar */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-white/20 rounded-full" />
          </div>

          <div className="px-5 py-3">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold text-lg">Color Adjust</h3>
              <button
                onClick={() => { setFilters({ ...pendingFilters }); setActiveSheet(null); }}
                className="bg-purple-500 hover:bg-purple-400 text-white font-bold text-sm px-5 py-2 rounded-full transition-all active:scale-95"
              >
                Apply
              </button>
            </div>

            {/* Small preview */}
            <div className="flex justify-center mb-5">
              <div
                className="w-36 rounded-xl overflow-hidden shadow-2xl"
                style={{
                  aspectRatio: "1/1",
                  background: modifiedTheme.bg,
                  ...(modifiedTheme.bgImage
                    ? { backgroundImage: `url(${modifiedTheme.bgImage})`, backgroundSize: "cover", backgroundPosition: "center" }
                    : {}),
                  filter: `hue-rotate(${pendingFilters.hue}deg) saturate(${pendingFilters.saturate}%) brightness(${pendingFilters.brightness}%) contrast(${pendingFilters.contrast}%)`,
                }}
              />
            </div>

            {/* Sliders */}
            {FILTER_DEFS.map(({ label, key, min, max }) => (
              <div key={key} className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-white/80 font-semibold text-sm">{label}</span>
                  <span className="text-white/30 text-xs font-mono tabular-nums">{pendingFilters[key]}</span>
                </div>
                <input
                  type="range"
                  min={min}
                  max={max}
                  value={pendingFilters[key]}
                  onChange={(e) => setPendingFilters((p) => ({ ...p, [key]: parseInt(e.target.value) }))}
                  className="w-full h-1.5 rounded-full outline-none editor-slider"
                  style={{
                    WebkitAppearance: "none",
                    appearance: "none",
                    background: sliderBg(pendingFilters[key], min, max),
                  }}
                />
              </div>
            ))}

            {/* Reset */}
            <button
              onClick={() => setPendingFilters({ ...DEFAULT_FILTERS })}
              className="w-full mt-1 mb-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white/40 text-sm font-semibold hover:bg-white/[0.08] transition-all"
            >
              Reset to Default
            </button>
          </div>
        </div>
      )}

      {/* ── Background Sheet ────────────────────────────────────────── */}
      {activeSheet === "background" && (
        <div
          className="absolute bottom-0 left-0 right-0 z-30 rounded-t-3xl"
          style={{
            background: "rgba(18, 18, 36, 0.97)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            maxHeight: "55vh",
            overflowY: "auto",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-white/20 rounded-full" />
          </div>

          <div className="px-5 py-3">
            <h3 className="text-white font-bold text-lg mb-4">Background</h3>

            {/* Page color presets */}
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-2">Page Color</p>
            <div className="flex flex-wrap gap-2 mb-5">
              {BG_PRESETS.map((c) => (
                <button
                  key={c}
                  onClick={() => setBgColor(c)}
                  className={`w-9 h-9 rounded-xl transition-all ${
                    bgColor === c ? "ring-2 ring-purple-500 ring-offset-2 ring-offset-[#121224] scale-105" : "border border-white/10 hover:border-white/25"
                  }`}
                  style={{
                    background:
                      c === "transparent"
                        ? "repeating-conic-gradient(#555 0% 25%, #333 0% 50%) 50% / 10px 10px"
                        : c,
                  }}
                />
              ))}
              {/* Custom color picker */}
              <label className="w-9 h-9 rounded-xl border border-white/10 overflow-hidden relative cursor-pointer hover:border-white/25 transition-all">
                <input
                  type="color"
                  value={bgColor === "transparent" ? "#000000" : bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="w-full h-full bg-gradient-conic from-red-500 via-green-500 to-blue-500 flex items-center justify-center">
                  <Plus className="h-3.5 w-3.5 text-white drop-shadow-lg" />
                </div>
              </label>
            </div>

            {/* Card bg image */}
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-2">Card Background Image</p>
            <div className="flex items-center gap-2 mb-5">
              <button
                onClick={() => bgImageInputRef.current?.click()}
                className="flex items-center gap-2 bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white/60 hover:bg-white/[0.08] transition-all"
              >
                <ImagePlus className="h-4 w-4" />
                Upload Image
              </button>
              {customBgImage && (
                <button
                  onClick={() => setCustomBgImage(null)}
                  className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/20 transition-all"
                >
                  <X className="h-3.5 w-3.5" />
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
