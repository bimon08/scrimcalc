"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { X, Sparkles, LogIn, Check } from "lucide-react";

interface Props {
  userName?: string | null;
  userEmail?: string | null;
  isLoggedIn?: boolean;
  onClose: () => void;
}

const PLANS = [
  { id: "1w", duration: "1 Week", price: "₹50", popular: false, badge: "" },
  { id: "1m", duration: "1 Month", price: "₹150", popular: true, badge: "POPULAR" },
  { id: "1y", duration: "1 Year", price: "₹1,500", popular: false, badge: "BEST VALUE" },
];

export default function SubscriptionNudge({ userName, userEmail, isLoggedIn = true, onClose }: Props) {
  const [selectedPlanId, setSelectedPlanId] = useState("1m");
  const selectedPlan = PLANS.find((p) => p.id === selectedPlanId) || PLANS[1];

  const whatsappMessage = `Hi, I'd like to subscribe to ScrimCalc.\n\nName: ${userName ?? "—"}\nEmail: ${userEmail ?? "—"}\nPlan: ${selectedPlan.duration} (${selectedPlan.price})\n\nPlease send the payment details.`;
  const whatsappLink = `https://wa.me/918837011018?text=${encodeURIComponent(whatsappMessage)}`;

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
              <h2 className="text-lg font-black text-white">Choose Your Plan</h2>
              <p className="text-xs mt-1.5" style={{ color: "rgba(167,139,250,0.65)" }}>
                Select a plan to subscribe and activate unlimited access.
              </p>
            </div>

            {/* Plans List */}
            <div className="space-y-2">
              {PLANS.map((plan) => {
                const isSelected = plan.id === selectedPlanId;
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setSelectedPlanId(plan.id)}
                    className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl transition-all text-left cursor-pointer active:scale-[0.98]"
                    style={{
                      background: isSelected
                        ? "linear-gradient(135deg, rgba(124,58,237,0.25), rgba(168,85,247,0.18))"
                        : "rgba(255,255,255,0.03)",
                      border: isSelected
                        ? "1.5px solid #a855f7"
                        : "1px solid rgba(255,255,255,0.07)",
                      boxShadow: isSelected ? "0 0 16px rgba(168,85,247,0.25)" : "none",
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      {/* Selection radio check */}
                      <div
                        className="w-4 h-4 rounded-full flex items-center justify-center transition-all"
                        style={{
                          background: isSelected ? "#a855f7" : "transparent",
                          border: isSelected ? "1.5px solid #c084fc" : "1.5px solid rgba(167,139,250,0.35)",
                        }}
                      >
                        {isSelected && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                      </div>

                      <span className={`text-sm font-bold ${isSelected ? "text-white" : "text-violet-200"}`}>
                        {plan.duration}
                      </span>

                      {(plan.popular || plan.badge) && (
                        <span
                          className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                          style={{
                            background: plan.badge === "BEST VALUE" ? "rgba(37,211,102,0.2)" : "rgba(124,58,237,0.35)",
                            color: plan.badge === "BEST VALUE" ? "#4ade80" : "#c4b5fd",
                            border: `1px solid ${plan.badge === "BEST VALUE" ? "rgba(37,211,102,0.35)" : "rgba(168,85,247,0.4)"}`,
                          }}
                        >
                          {plan.badge || "POPULAR"}
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-black text-violet-300">{plan.price}</span>
                  </button>
                );
              })}
            </div>

            {/* WhatsApp CTA */}
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white active:scale-95 transition-all hover:brightness-110"
              style={{
                background: "linear-gradient(135deg,#25d366,#128C7E)",
                boxShadow: "0 4px 20px rgba(37,211,102,0.3)",
              }}
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              <span>Subscribe for {selectedPlan.price} via WhatsApp</span>
            </a>

            <p className="text-[10px] text-center" style={{ color: "rgba(167,139,250,0.35)" }}>
              Pay via GPay / UPI · Activated within minutes
            </p>
          </>
        )}
      </div>
    </div>
  );
}
