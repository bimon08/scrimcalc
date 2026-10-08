"use client";
import { useRef, useState } from "react";
import { X, Flag, ArrowRight, Trophy, Upload, ChevronRight } from "lucide-react";
import { Tournament } from "@/lib/types";

interface Props {
  tournaments: Tournament[];
  createName: string;
  setCreateName: (v: string) => void;
  roundRobin: boolean;
  setRoundRobin: (fn: (v: boolean) => boolean) => void;
  onClose: () => void;
  onCreate: () => void;
  onClone: (t: Tournament) => void;
  onImportPC?: (file: File) => void;
}

export default function CreateScreen({
  tournaments, createName, setCreateName,
  roundRobin, setRoundRobin,
  onClose, onCreate, onClone, onImportPC,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [showPCGuide, setShowPCGuide] = useState(false);
  const isFirstTime = tournaments.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col anim-fade-in" style={{ background: "#0a0614" }}>
      <button
        onClick={onClose}
        className="absolute top-5 right-5 p-2 rounded-full press-scale"
        style={{ background: "rgba(255,255,255,0.07)", color: "rgba(196,181,253,0.7)" }}
      >
        <X className="h-5 w-5" />
      </button>

      <div className="flex flex-col flex-1 overflow-y-auto px-6 pt-16 pb-10">
        <h1 className="text-3xl mb-8 text-white" style={{ fontFamily: "'Dancing Script', cursive", fontWeight: 700, letterSpacing: "0.01em" }}>
          Create a tournament
        </h1>

        {/* First-time PointCalc migration prompt */}
        {isFirstTime && onImportPC && !showPCGuide && (
          <button
            onClick={() => setShowPCGuide(true)}
            className="w-full rounded-2xl p-4 mb-6 text-left press-scale transition-all"
            style={{ background: "linear-gradient(135deg, rgba(34,197,94,0.1), rgba(34,197,94,0.05))", border: "1px solid rgba(34,197,94,0.25)" }}
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl shrink-0 flex items-center justify-center" style={{ background: "rgba(34,197,94,0.15)" }}>
                <span className="text-lg">📱</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">Switching from PointCalc?</p>
                <p className="text-xs mt-0.5" style={{ color: "rgba(74,222,128,0.6)" }}>Import your tournaments in seconds</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0" style={{ color: "rgba(74,222,128,0.5)" }} />
            </div>
          </button>
        )}

        {/* PointCalc migration guide (expanded) */}
        {isFirstTime && showPCGuide && onImportPC && (
          <div className="rounded-2xl p-5 mb-6" style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)" }}>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-base">📱</span>
              <p className="text-sm font-bold text-white">Import from PointCalc</p>
              <button onClick={() => setShowPCGuide(false)} className="ml-auto p-1 rounded-lg" style={{ color: "rgba(196,181,253,0.4)" }}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-3 mb-5">
              {[
                { step: "1", text: "Open PointCalc on your phone" },
                { step: "2", text: "Go to your tournament → tap Share / Export" },
                { step: "3", text: "Save or send the .pc file to this device" },
                { step: "4", text: "Tap the button below to pick the file" },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-3">
                  <span className="h-5 w-5 rounded-full shrink-0 flex items-center justify-center text-[10px] font-black" style={{ background: "rgba(34,197,94,0.2)", color: "#4ade80" }}>{item.step}</span>
                  <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>{item.text}</p>
                </div>
              ))}
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white press-scale"
              style={{ background: "linear-gradient(135deg, #16a34a, #22c55e)" }}
            >
              <Upload className="h-4 w-4" />
              Choose .pc File
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".pc,.PC"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onImportPC(file);
                e.target.value = "";
              }}
            />
          </div>
        )}

        <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl mb-5" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <Flag className="h-4 w-4 shrink-0" style={{ color: "rgba(196,181,253,0.55)" }} />
          <input
            autoFocus={!isFirstTime || !onImportPC}
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && createName.trim()) onCreate(); }}
            placeholder="Enter Tourney Name"
            className="flex-1 bg-transparent text-white text-sm focus:outline-none"
            style={{ caretColor: "#a78bfa" }}
          />
        </div>

        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => setRoundRobin((v) => !v)} className="relative shrink-0 press-scale" style={{ width: 48, height: 28 }}>
            <div className="absolute inset-0 rounded-full transition-colors duration-200" style={{ background: roundRobin ? "rgba(124,58,237,0.9)" : "rgba(255,255,255,0.15)" }} />
            <div className="absolute top-1 left-1 transition-transform duration-200 h-5 w-5 rounded-full bg-white shadow" style={{ transform: roundRobin ? "translateX(20px)" : "translateX(0)" }} />
          </button>
          <span className="text-sm font-medium" style={{ color: roundRobin ? "#c4b5fd" : "rgba(196,181,253,0.5)" }}>Round Robin</span>
          <button onClick={onCreate} disabled={!createName.trim()} className="ml-auto flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold text-white disabled:opacity-30 press-scale" style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}>
            GO <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {/* Import from PointCalc (for returning users) */}
        {!isFirstTime && onImportPC && (
          <>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 border-t" style={{ borderColor: "rgba(255,255,255,0.12)", borderStyle: "dashed" }} />
              <span className="text-xs font-semibold tracking-widest" style={{ color: "rgba(196,181,253,0.45)" }}>IMPORT</span>
              <div className="flex-1 border-t" style={{ borderColor: "rgba(255,255,255,0.12)", borderStyle: "dashed" }} />
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl mb-6 press-scale transition-colors"
              style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}
            >
              <div className="h-11 w-11 rounded-xl shrink-0 flex items-center justify-center" style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)" }}>
                <Upload className="h-5 w-5" style={{ color: "#4ade80" }} />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-semibold text-white leading-tight">Import from PointCalc</p>
                <p className="text-xs mt-0.5" style={{ color: "rgba(74,222,128,0.6)" }}>Open a .pc file to migrate</p>
              </div>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".pc,.PC"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onImportPC(file);
                e.target.value = "";
              }}
            />
          </>
        )}

        {tournaments.length > 0 && (
          <>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 border-t" style={{ borderColor: "rgba(255,255,255,0.12)", borderStyle: "dashed" }} />
              <span className="text-xs font-semibold tracking-widest" style={{ color: "rgba(196,181,253,0.45)" }}>OR</span>
              <div className="flex-1 border-t" style={{ borderColor: "rgba(255,255,255,0.12)", borderStyle: "dashed" }} />
            </div>
            <p className="text-xs text-center italic mb-4" style={{ color: "rgba(196,181,253,0.4)" }}>Create from existing tourney</p>
            <div className="space-y-2 pb-4">
              {tournaments.map((t) => (
                <button key={t.id} onClick={() => onClone(t)} className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-left press-scale transition-colors" style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.15)" }}>
                  <div className="h-11 w-11 rounded-xl shrink-0 flex items-center justify-center" style={{ background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.3)" }}>
                    <Trophy className="h-5 w-5" style={{ color: "#a78bfa" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white leading-tight truncate">{t.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: "rgba(196,181,253,0.5)" }}>Total teams: {String(t.teams.length).padStart(2, "0")}</p>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
