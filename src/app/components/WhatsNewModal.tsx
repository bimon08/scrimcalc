"use client";

interface Props {
  onClose: () => void;
}

export const WHATS_NEW_STORAGE_KEY = "scrimcalc-whatsnew-gemini4";

export default function WhatsNewModal({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center p-4"
      style={{ background: "rgba(4,8,20,0.82)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-3xl anim-slide-up shadow-2xl"
        style={{
          background: "#0b1428",
          border: "1px solid rgba(96,165,250,0.28)",
          boxShadow: "0 24px 60px rgba(15, 60, 150, 0.35)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle ambient image glow behind the card */}
        <div
          className="pointer-events-none absolute inset-0 opacity-20 blur-2xl scale-110 bg-cover bg-center"
          style={{ backgroundImage: "url('/images/gemini-4-hydrogen.png')" }}
        />

        {/* Hero banner */}
        <div
          className="relative h-40 w-full bg-cover bg-center"
          style={{ backgroundImage: "url('/images/gemini-4-hydrogen.png')" }}
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to bottom, rgba(11,20,40,0.05) 45%, #0b1428 100%)",
            }}
          />
          <span
            className="absolute top-3.5 left-4 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-widest uppercase"
            style={{
              background: "rgba(11,20,40,0.55)",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "#e0f2fe",
              backdropFilter: "blur(8px)",
            }}
          >
            Heads Up
          </span>
        </div>

        {/* Content */}
        <div className="relative px-6 pb-6 pt-1">
          <h2 className="text-lg font-bold text-white text-center mb-3.5">
            Upgraded to Gemini 4 + Plan Update
          </h2>

          <div
            className="rounded-2xl p-4 mb-5 space-y-2.5 text-sm leading-relaxed"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(147,197,253,0.16)",
              color: "#dbeafe",
            }}
          >
            <p>
              We&apos;ve upgraded our screenshot OCR engine to{" "}
              <span className="font-semibold text-white">Gemini 4</span> for
              faster processing and better scoreboard accuracy.
            </p>
            <p>
              Starting <span className="font-semibold text-white">Dec 1</span>,
              plans will adjust (starting{" "}
              <span className="font-semibold text-white">₹50 → ₹60</span>) to
              support the upgraded model and infrastructure.
            </p>
            <p className="text-xs" style={{ color: "rgba(191,219,254,0.7)" }}>
              Existing active plans stay at their current rate until renewal.
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-full py-3.5 rounded-xl font-bold text-sm text-white press-scale"
            style={{
              background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
              boxShadow: "0 8px 24px rgba(37,99,235,0.35)",
            }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
