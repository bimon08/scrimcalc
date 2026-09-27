"use client";

import { useState } from "react";
import { X, Zap, CalendarClock, Check } from "lucide-react";
import { toast } from "sonner";

interface Props {
  pendingDays: number;
  onClose: () => void;
  onActivated: () => void;
}

function formatEndDate(days: number): string {
  const end = new Date();
  end.setDate(end.getDate() + days);
  return end.toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDuration(days: number): string {
  if (days >= 365) return `${Math.floor(days / 365)} Year${days >= 730 ? "s" : ""}`;
  if (days >= 30) return `${Math.floor(days / 30)} Month${days >= 60 ? "s" : ""}`;
  if (days >= 7) return `${Math.floor(days / 7)} Week${days >= 14 ? "s" : ""}`;
  return `${days} Day${days !== 1 ? "s" : ""}`;
}

export default function ActivationPopup({ pendingDays, onClose, onActivated }: Props) {
  const [activating, setActivating] = useState(false);
  const [activated, setActivated] = useState(false);
  const [endDate, setEndDate] = useState("");

  const handleActivate = async () => {
    setActivating(true);
    try {
      const res = await fetch("/api/subscription/activate", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setEndDate(new Date(data.subscriptionEnd).toLocaleString("en-IN", {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }));
        setActivated(true);
        toast.success("Plan activated! 🎉");
      } else {
        toast.error(data.error || "Activation failed");
      }
    } catch {
      toast.error("Network error — try again");
    }
    setActivating(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-sm mx-4 rounded-2xl p-5 space-y-4 animate-in slide-in-from-bottom-4"
        style={{ background: "linear-gradient(135deg,#1a1030,#0f0a1e)", border: "1px solid rgba(124,58,237,0.3)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={activated ? onActivated : onClose} className="absolute top-3 right-3 p-1.5 rounded-lg" style={{ color: "rgba(167,139,250,0.4)" }}>
          <X className="h-4 w-4" />
        </button>

        {activated ? (
          /* ── Success state ── */
          <div className="text-center pt-2 space-y-3">
            <div className="mx-auto h-14 w-14 rounded-xl flex items-center justify-center mb-3" style={{ background: "linear-gradient(135deg,rgba(74,222,128,0.25),rgba(34,197,94,0.15))" }}>
              <Check className="h-7 w-7 text-emerald-400" />
            </div>
            <h2 className="text-lg font-black text-white">Plan Activated! 🎉</h2>
            <p className="text-xs" style={{ color: "rgba(167,139,250,0.65)" }}>
              Your <span className="text-white font-bold">{formatDuration(pendingDays)}</span> plan is now active
            </p>

            <div className="rounded-xl p-3" style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.15)" }}>
              <div className="flex items-center gap-2 justify-center">
                <CalendarClock className="h-3.5 w-3.5 text-violet-400" />
                <span className="text-[11px] text-zinc-400">Expires on</span>
              </div>
              <p className="text-sm font-bold text-white mt-1">{endDate}</p>
            </div>

            <button
              onClick={onActivated}
              className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all active:scale-95"
              style={{ background: "linear-gradient(135deg,#7c3aed,#9333ea)", boxShadow: "0 4px 20px rgba(124,58,237,0.4)" }}
            >
              Got it!
            </button>
          </div>
        ) : (
          /* ── Activation prompt ── */
          <div className="text-center pt-2 space-y-4">
            <div className="mx-auto h-14 w-14 rounded-xl flex items-center justify-center mb-3" style={{ background: "linear-gradient(135deg,rgba(124,58,237,0.3),rgba(168,85,247,0.2))" }}>
              <Zap className="h-7 w-7 text-violet-400" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">You have a plan!</h2>
              <p className="text-xs mt-1.5" style={{ color: "rgba(167,139,250,0.65)" }}>
                A <span className="text-white font-bold">{formatDuration(pendingDays)}</span> plan has been assigned to you.
                Activate it when you&apos;re ready — it stays until you do.
              </p>
            </div>

            {/* Preview end date */}
            <div className="rounded-xl p-3" style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.15)" }}>
              <div className="flex items-center gap-2 justify-center">
                <CalendarClock className="h-3.5 w-3.5 text-violet-400" />
                <span className="text-[11px] text-zinc-400">If activated now, expires on</span>
              </div>
              <p className="text-sm font-bold text-white mt-1">{formatEndDate(pendingDays)}</p>
            </div>

            <div className="space-y-2">
              <button
                onClick={handleActivate}
                disabled={activating}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-60"
                style={{ background: "linear-gradient(135deg,#7c3aed,#9333ea)", boxShadow: "0 4px 20px rgba(124,58,237,0.4)" }}
              >
                {activating ? (
                  <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                {activating ? "Activating…" : "Activate Now"}
              </button>

              <button
                onClick={onClose}
                className="w-full py-2.5 rounded-xl text-xs font-medium transition-all active:scale-95"
                style={{ color: "rgba(167,139,250,0.5)" }}
              >
                I&apos;ll activate later
              </button>
            </div>

            <p className="text-[10px]" style={{ color: "rgba(167,139,250,0.3)" }}>
              The timer starts only after you activate
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
