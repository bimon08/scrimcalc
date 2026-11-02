"use client";
import { useState, useEffect } from "react";
import { X, Check, XCircle, Clock, MessageCircle, Copy, ChevronDown, ChevronUp, Image as ImageIcon, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { authFetch } from "@/lib/authFetch";

interface Registration {
  id: string;
  state: string | null;
  teamName: string;
  teamLogoUrl: string | null;
  iglName: string;
  iglId: string | null;
  whatsapp: string | null;
  email: string | null;
  player2Ign: string | null;
  player2Id: string | null;
  player3Ign: string | null;
  player3Id: string | null;
  player4Ign: string | null;
  player4Id: string | null;
  utrNumber: string | null;
  paymentProofUrl: string | null;
  status: "PENDING" | "VERIFIED" | "REJECTED";
  createdAt: string;
}

interface Counts { total: number; pending: number; verified: number; rejected: number; }

interface Props {
  tournamentId: string; // savedTournamentId
  tournamentName: string;
  onClose: () => void;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  PENDING: { bg: "rgba(251,191,36,0.1)", text: "#fbbf24", border: "rgba(251,191,36,0.3)" },
  VERIFIED: { bg: "rgba(34,197,94,0.1)", text: "#22c55e", border: "rgba(34,197,94,0.3)" },
  REJECTED: { bg: "rgba(239,68,68,0.1)", text: "#ef4444", border: "rgba(239,68,68,0.3)" },
};

export default function RegistrationsOverlay({ tournamentId, tournamentName, onClose }: Props) {
  const [regs, setRegs] = useState<Registration[]>([]);
  const [counts, setCounts] = useState<Counts>({ total: 0, pending: 0, verified: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"PENDING" | "VERIFIED" | "REJECTED">("PENDING");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updating, setUpdating] = useState<Set<string>>(new Set());
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const res = await authFetch(`/api/tournament-registrations?tournamentId=${tournamentId}`);
      if (!res.ok) { toast.error("Failed to load registrations"); return; }
      const data = await res.json();
      setRegs(data.registrations ?? []);
      setCounts(data.counts ?? { total: 0, pending: 0, verified: 0, rejected: 0 });
    } catch { toast.error("Network error"); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [tournamentId]);

  const updateStatus = async (id: string, status: "VERIFIED" | "REJECTED" | "PENDING") => {
    setUpdating(prev => new Set(prev).add(id));
    try {
      const res = await authFetch("/api/tournament-registrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) {
        toast.success(status === "VERIFIED" ? "Team verified ✅" : status === "REJECTED" ? "Team rejected" : "Moved back to pending");
        await fetchData();
      }
    } catch { toast.error("Failed to update"); }
    setUpdating(prev => { const n = new Set(prev); n.delete(id); return n; });
  };

  const openWhatsApp = (phone: string) => {
    const digits = phone.replace(/\D/g, "");
    const num = digits.startsWith("91") ? digits : `91${digits}`;
    window.open(`https://wa.me/${num}`, "_blank");
  };

  const copyUTR = (utr: string) => {
    navigator.clipboard.writeText(utr);
    toast.success("UTR copied!");
  };

  const filtered = regs.filter(r => r.status === tab);

  const tabCounts = [
    { key: "PENDING" as const, label: "Pending", count: counts.pending, icon: <Clock className="h-3 w-3" /> },
    { key: "VERIFIED" as const, label: "Verified", count: counts.verified, icon: <Check className="h-3 w-3" /> },
    { key: "REJECTED" as const, label: "Rejected", count: counts.rejected, icon: <XCircle className="h-3 w-3" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col anim-fade-in" style={{ background: "#0a0614" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-3">
        <button onClick={onClose} className="p-2 rounded-full press-scale" style={{ background: "rgba(255,255,255,0.07)", color: "rgba(196,181,253,0.7)" }}>
          <X className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-white truncate">Registrations</h2>
          <p className="text-xs truncate" style={{ color: "rgba(196,181,253,0.5)" }}>{tournamentName} · {counts.total} total</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 px-4 pb-3">
        {tabCounts.map(t => {
          const active = tab === t.key;
          const sc = STATUS_COLORS[t.key];
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{
                background: active ? sc.bg : "transparent",
                border: `1px solid ${active ? sc.border : "rgba(255,255,255,0.1)"}`,
                color: active ? sc.text : "rgba(196,181,253,0.4)",
              }}
            >
              {t.icon}
              {t.label}
              {t.count > 0 && (
                <span className="px-1 rounded-full text-[9px] font-black" style={{ background: active ? sc.border : "rgba(255,255,255,0.08)", color: active ? sc.text : "rgba(196,181,253,0.4)" }}>
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {loading ? (
          <div className="space-y-3 pt-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-2xl p-4" style={{ background: "#150e25", border: "1px solid rgba(124,58,237,0.12)" }}>
                <div className="h-4 rounded skeleton-pulse mb-2" style={{ width: `${50 + i * 15}%` }} />
                <div className="h-3 rounded skeleton-pulse" style={{ width: "40%" }} />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm" style={{ color: "rgba(196,181,253,0.4)" }}>
              No {tab.toLowerCase()} registrations
            </p>
          </div>
        ) : (
          <div className="space-y-2 pt-1">
            {filtered.map(reg => {
              const isExpanded = expandedId === reg.id;
              const isUpdating = updating.has(reg.id);
              const sc = STATUS_COLORS[reg.status];
              return (
                <div key={reg.id} className="rounded-2xl overflow-hidden" style={{ background: "#150e25", border: `1px solid ${sc.border}` }}>
                  {/* Summary row */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : reg.id)}
                    className="w-full flex items-center gap-3 p-3.5 text-left"
                  >
                    <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-black" style={{ background: sc.bg, color: sc.text }}>
                      {reg.teamName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{reg.teamName}</p>
                      <p className="text-[11px] mt-0.5" style={{ color: "rgba(196,181,253,0.5)" }}>
                        IGL: {reg.iglName}{reg.state ? ` · ${reg.state}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {reg.utrNumber && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(251,191,36,0.1)", color: "#fbbf24" }}>
                          UTR
                        </span>
                      )}
                      {reg.paymentProofUrl && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(59,130,246,0.1)", color: "#60a5fa" }}>
                          📎
                        </span>
                      )}
                      {isExpanded ? <ChevronUp className="h-4 w-4" style={{ color: "rgba(196,181,253,0.3)" }} /> : <ChevronDown className="h-4 w-4" style={{ color: "rgba(196,181,253,0.3)" }} />}
                    </div>
                  </button>

                  {/* Expanded details */}
                  <div style={{ display: "grid", gridTemplateRows: isExpanded ? "1fr" : "0fr", transition: "grid-template-rows 250ms ease" }}>
                    <div style={{ overflow: "hidden" }}>
                      <div className="px-3.5 pb-3.5 space-y-3">
                        <div className="h-px" style={{ background: sc.border }} />

                        {/* Team details */}
                        <div className="grid grid-cols-2 gap-2">
                          {reg.iglId && (
                            <div>
                              <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: "rgba(196,181,253,0.35)" }}>Player ID</p>
                              <p className="text-xs text-white font-mono">{reg.iglId}</p>
                            </div>
                          )}
                          {reg.whatsapp && (
                            <div>
                              <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: "rgba(196,181,253,0.35)" }}>WhatsApp</p>
                              <p className="text-xs text-white">{reg.whatsapp}</p>
                            </div>
                          )}
                          {reg.email && (
                            <div className="col-span-2">
                              <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: "rgba(196,181,253,0.35)" }}>Email</p>
                              <p className="text-xs text-white truncate">{reg.email}</p>
                            </div>
                          )}
                        </div>

                        {/* Squad */}
                        {(reg.player2Ign || reg.player3Ign || reg.player4Ign) && (
                          <div>
                            <p className="text-[9px] font-semibold uppercase tracking-wider mb-1" style={{ color: "rgba(196,181,253,0.35)" }}>Squad</p>
                            <div className="space-y-1">
                              {[
                                { ign: reg.player2Ign, id: reg.player2Id },
                                { ign: reg.player3Ign, id: reg.player3Id },
                                { ign: reg.player4Ign, id: reg.player4Id },
                              ].filter(p => p.ign).map((p, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs">
                                  <span className="text-white">{p.ign}</span>
                                  {p.id && <span className="font-mono" style={{ color: "rgba(196,181,253,0.4)" }}>{p.id}</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* UTR */}
                        {reg.utrNumber && (
                          <div>
                            <p className="text-[9px] font-semibold uppercase tracking-wider mb-1" style={{ color: "rgba(196,181,253,0.35)" }}>UTR Number</p>
                            <button
                              onClick={() => copyUTR(reg.utrNumber!)}
                              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-mono font-bold transition-all active:scale-95"
                              style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", color: "#fbbf24" }}
                            >
                              {reg.utrNumber}
                              <Copy className="h-3.5 w-3.5" style={{ color: "rgba(251,191,36,0.5)" }} />
                            </button>
                          </div>
                        )}

                        {/* Payment screenshot */}
                        {reg.paymentProofUrl && (
                          <div>
                            <p className="text-[9px] font-semibold uppercase tracking-wider mb-1" style={{ color: "rgba(196,181,253,0.35)" }}>Payment Proof</p>
                            <button
                              onClick={() => setPreviewImage(reg.paymentProofUrl)}
                              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95"
                              style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)", color: "#60a5fa" }}
                            >
                              <ImageIcon className="h-4 w-4" />
                              View Screenshot
                            </button>
                          </div>
                        )}

                        {/* Submitted time */}
                        <p className="text-[10px]" style={{ color: "rgba(196,181,253,0.3)" }}>
                          Submitted {new Date(reg.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </p>

                        {/* Actions */}
                        <div className="flex gap-2">
                          {reg.status === "PENDING" && (
                            <>
                              <button
                                onClick={() => updateStatus(reg.id, "VERIFIED")}
                                disabled={isUpdating}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-40"
                                style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.35)", color: "#22c55e" }}
                              >
                                <Check className="h-4 w-4" /> Verify
                              </button>
                              <button
                                onClick={() => updateStatus(reg.id, "REJECTED")}
                                disabled={isUpdating}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-40"
                                style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444" }}
                              >
                                <XCircle className="h-4 w-4" /> Reject
                              </button>
                            </>
                          )}
                          {reg.status === "VERIFIED" && (
                            <button
                              onClick={() => updateStatus(reg.id, "PENDING")}
                              disabled={isUpdating}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-40"
                              style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.25)", color: "#fbbf24" }}
                            >
                              <Undo2 className="h-4 w-4" /> Move to Pending
                            </button>
                          )}
                          {reg.status === "REJECTED" && (
                            <button
                              onClick={() => updateStatus(reg.id, "PENDING")}
                              disabled={isUpdating}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-40"
                              style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.25)", color: "#fbbf24" }}
                            >
                              <Undo2 className="h-4 w-4" /> Move to Pending
                            </button>
                          )}
                          {reg.whatsapp && (
                            <button
                              onClick={() => openWhatsApp(reg.whatsapp!)}
                              className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95"
                              style={{ background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.3)", color: "#25d366" }}
                            >
                              <MessageCircle className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Image preview modal */}
      {previewImage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 anim-fade-in" style={{ background: "rgba(0,0,0,0.85)" }} onClick={() => setPreviewImage(null)}>
          <button className="absolute top-5 right-5 p-2 rounded-full" style={{ background: "rgba(255,255,255,0.1)", color: "white" }}>
            <X className="h-5 w-5" />
          </button>
          <img src={previewImage} alt="Payment proof" className="max-w-full max-h-[80vh] rounded-2xl object-contain" />
        </div>
      )}
    </div>
  );
}
