"use client";

import { signIn } from "next-auth/react";
import { X, MessageCircle, Sparkles, LogIn } from "lucide-react";

interface Props {
  userName?: string | null;
  userEmail?: string | null;
  isLoggedIn?: boolean;
  onClose: () => void;
}

export default function SubscriptionNudge({ userName, userEmail, isLoggedIn = true, onClose }: Props) {
  const whatsappLink = `https://wa.me/918837011018?text=${encodeURIComponent(
    `Hi, I'd like to subscribe to ScrimCalc.\nName: ${userName ?? "—"}\nEmail: ${userEmail ?? "—"}`
  )}`;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-sm mx-4 mb-4 sm:mb-0 rounded-2xl p-5 space-y-4 animate-in slide-in-from-bottom-4"
        style={{ background: "linear-gradient(135deg,#1a1030,#0f0a1e)", border: "1px solid rgba(124,58,237,0.3)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-lg" style={{ color: "rgba(167,139,250,0.4)" }}>
          <X className="h-4 w-4" />
        </button>

        {!isLoggedIn ? (
          /* ── Sign-in prompt for logged-out users ── */
          <>
            <div className="text-center pt-2">
              <div className="mx-auto h-14 w-14 rounded-xl flex items-center justify-center mb-3" style={{ background: "linear-gradient(135deg,rgba(124,58,237,0.3),rgba(168,85,247,0.2))" }}>
                <LogIn className="h-7 w-7 text-violet-400" />
              </div>
              <h2 className="text-lg font-black text-white">Sign in to continue</h2>
              <p className="text-xs mt-1.5" style={{ color: "rgba(167,139,250,0.55)" }}>
                Sign in with your Google account to access all features.
              </p>
            </div>

            <button
              onClick={() => signIn("google")}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white active:scale-95 transition-all"
              style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", boxShadow: "0 4px 20px rgba(124,58,237,0.3)" }}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Sign in with Google
            </button>
          </>
        ) : (
          /* ── Subscription plans for logged-in users ── */
          <>
            <div className="text-center pt-2">
              <div className="mx-auto h-14 w-14 rounded-xl flex items-center justify-center mb-3" style={{ background: "linear-gradient(135deg,rgba(124,58,237,0.3),rgba(168,85,247,0.2))" }}>
                <Sparkles className="h-7 w-7 text-violet-400" />
              </div>
              <h2 className="text-lg font-black text-white">Free Trial Ended</h2>
              <p className="text-xs mt-1.5" style={{ color: "rgba(167,139,250,0.55)" }}>
                Your 7-day free trial has ended. Subscribe to save changes, add teams, and sync data.
              </p>
            </div>

            {/* Plans */}
            <div className="space-y-1.5">
              {[
                { duration: "1 Week", price: "₹50" },
                { duration: "1 Month", price: "₹150", popular: true },
                { duration: "1 Year", price: "₹1,500", badge: "BEST VALUE" },
              ].map((plan) => (
                <div
                  key={plan.duration}
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-xl"
                  style={{
                    background: plan.popular ? "rgba(124,58,237,0.15)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${plan.popular ? "rgba(124,58,237,0.35)" : "rgba(255,255,255,0.06)"}`,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{plan.duration}</span>
                    {(plan.popular || plan.badge) && (
                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: plan.badge ? "rgba(37,211,102,0.2)" : "rgba(124,58,237,0.3)", color: plan.badge ? "#4ade80" : "#c4b5fd" }}>
                        {plan.badge || "POPULAR"}
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-black text-violet-400">{plan.price}</span>
                </div>
              ))}
            </div>

            {/* WhatsApp CTA */}
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white active:scale-95 transition-all"
              style={{ background: "linear-gradient(135deg,#25d366,#128C7E)", boxShadow: "0 4px 20px rgba(37,211,102,0.25)" }}
            >
              <MessageCircle className="h-4 w-4" />
              Subscribe via WhatsApp
            </a>

            <p className="text-[10px] text-center" style={{ color: "rgba(167,139,250,0.25)" }}>
              Pay via GPay / Cash · Activated within minutes
            </p>
          </>
        )}
      </div>
    </div>
  );
}
