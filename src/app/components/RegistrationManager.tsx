"use client";
import { useState, useEffect } from "react";
import {
  X, Check, XCircle, Clock, MessageCircle, Copy, ChevronDown, ChevronUp,
  Image as ImageIcon, Undo2, Link2, ExternalLink, Settings, ClipboardList,
  Send, Eye, EyeOff, Palette,
} from "lucide-react";
import { toast } from "sonner";
import { authFetch } from "@/lib/authFetch";

/* ═══════════════════════════ Types ═══════════════════════════ */

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
  extraPlayers: { ign: string; id: string }[] | null;
  utrNumber: string | null;
  paymentProofUrl: string | null;
  status: "PENDING" | "VERIFIED" | "REJECTED";
  createdAt: string;
}

interface Counts { total: number; pending: number; verified: number; rejected: number; }

interface PageSettings {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  description: string | null;
  themeColor: string;
  particleStyle: string;
  prizePool: string | null;
  entryFee: string | null;
  entryFeeAmount: number;
  gameMode: string | null;
  dateRange: string | null;
  deadline: string | null;
  region: string | null;
  eligibility: string | null;
  bonusText: string | null;
  upiId: string | null;
  qrImageUrl: string | null;
  fieldConfig: Record<string, string> | null;
  isActive: boolean;
}

interface Props {
  tournamentId: string;
  tournamentName: string;
  onClose: () => void;
}

/* ═══════════════════════════ Helpers ═══════════════════════════ */

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  PENDING:  { bg: "rgba(251,191,36,0.1)",  text: "#fbbf24", border: "rgba(251,191,36,0.3)" },
  VERIFIED: { bg: "rgba(34,197,94,0.1)",   text: "#22c55e", border: "rgba(34,197,94,0.3)" },
  REJECTED: { bg: "rgba(239,68,68,0.1)",   text: "#ef4444", border: "rgba(239,68,68,0.3)" },
};

const THEME_PRESETS = [
  { color: "#8b5cf6", label: "Violet" },
  { color: "#ec4899", label: "Pink" },
  { color: "#3b82f6", label: "Blue" },
  { color: "#10b981", label: "Emerald" },
  { color: "#f59e0b", label: "Amber" },
  { color: "#ef4444", label: "Red" },
  { color: "#06b6d4", label: "Cyan" },
  { color: "#f97316", label: "Orange" },
];

const PARTICLE_OPTIONS = [
  { value: "sparks", label: "✨ Sparks" },
  { value: "petals", label: "🌸 Petals" },
  { value: "snow", label: "❄️ Snow" },
  { value: "none", label: "None" },
];

const STEP_FIELDS = [
  {
    step: 0, label: "Step 1 — Team", emoji: "🏷️",
    fields: [
      { key: "state", label: "State / Region" },
      { key: "teamName", label: "Team Name" },
      { key: "teamLogo", label: "Team Logo" },
    ],
  },
  {
    step: 1, label: "Step 2 — Leader", emoji: "👑",
    fields: [
      { key: "iglName", label: "In-Game Name (IGN)" },
      { key: "iglId", label: "Player ID" },
      { key: "whatsapp", label: "WhatsApp Number" },
      { key: "email", label: "Email Address" },
    ],
  },
  {
    step: 2, label: "Step 3 — Squad", emoji: "👥",
    fields: [
      { key: "squadNames", label: "Member Names" },
      { key: "squadIds", label: "Member IDs" },
    ],
  },
  {
    step: 3, label: "Step 4 — Payment", emoji: "💳",
    fields: [
      { key: "utrNumber", label: "UTR Number" },
      { key: "paymentProof", label: "Payment Screenshot" },
    ],
  },
];

type Tab = "submissions" | "settings" | "link";

/* ═══════════════════════════ Component ═══════════════════════════ */

export default function RegistrationManager({ tournamentId, tournamentName, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("submissions");

  // ── Submissions state ──
  const [regs, setRegs] = useState<Registration[]>([]);
  const [counts, setCounts] = useState<Counts>({ total: 0, pending: 0, verified: 0, rejected: 0 });
  const [loadingRegs, setLoadingRegs] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"PENDING" | "VERIFIED" | "REJECTED">("PENDING");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updating, setUpdating] = useState<Set<string>>(new Set());
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // ── Settings state ──
  const [page, setPage] = useState<PageSettings | null>(null);
  const [loadingPage, setLoadingPage] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // ── Link state ──
  const [copied, setCopied] = useState(false);

  /* ────────────────────── Data Fetching ────────────────────── */

  const fetchRegs = async () => {
    try {
      const res = await authFetch(`/api/tournament-registrations?tournamentId=${tournamentId}`);
      if (!res.ok) return;
      const data = await res.json();
      setRegs(data.registrations ?? []);
      setCounts(data.counts ?? { total: 0, pending: 0, verified: 0, rejected: 0 });
    } catch { /* silent */ }
    setLoadingRegs(false);
  };

  const fetchPage = async () => {
    try {
      const res = await authFetch(`/api/tournament-pages/by-tournament?ids=${tournamentId}`);
      if (!res.ok) return;
      const data = await res.json();
      const info = data.pages?.[tournamentId];
      if (info?.pageId) {
        const pageRes = await authFetch(`/api/tournament-pages?slug=`); // We need to fetch full page data
        // Fetch from the main API using the pageId
        const fullRes = await authFetch(`/api/tournament-pages/detail?id=${info.pageId}`);
        if (fullRes.ok) {
          const pd = await fullRes.json();
          setPage(pd.page);
        }
      }
    } catch { /* silent */ }
    setLoadingPage(false);
  };

  useEffect(() => {
    fetchRegs();
    fetchPage();
  }, [tournamentId]);

  /* ────────────────────── Actions ────────────────────── */

  const updateRegStatus = async (id: string, status: "VERIFIED" | "REJECTED" | "PENDING") => {
    setUpdating(prev => new Set(prev).add(id));
    try {
      const res = await authFetch("/api/tournament-registrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) {
        toast.success(status === "VERIFIED" ? "Team verified ✅" : status === "REJECTED" ? "Team rejected" : "Moved to pending");
        await fetchRegs();
      }
    } catch { toast.error("Failed"); }
    setUpdating(prev => { const n = new Set(prev); n.delete(id); return n; });
  };

  const savePage = async () => {
    if (!page) return;
    setSaving(true);
    try {
      const res = await authFetch("/api/tournament-pages", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(page),
      });
      if (res.ok) {
        toast.success("Settings saved ✅");
        setDirty(false);
        const data = await res.json();
        setPage(data.page);
      } else {
        toast.error("Failed to save");
      }
    } catch { toast.error("Network error"); }
    setSaving(false);
  };

  const updateField = <K extends keyof PageSettings>(key: K, value: PageSettings[K]) => {
    if (!page) return;
    setPage({ ...page, [key]: value });
    setDirty(true);
  };

  const updateFieldConfig = (fieldKey: string, value: "required" | "optional" | "hidden") => {
    if (!page) return;
    const fc = { ...(page.fieldConfig || {}) };
    fc[fieldKey] = value;
    setPage({ ...page, fieldConfig: fc });
    setDirty(true);
  };

  const copyLink = () => {
    if (!page) return;
    const url = `${window.location.origin}/tournament/${page.slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      toast.success("Link copied!");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const openWhatsApp = (phone: string) => {
    const d = phone.replace(/\D/g, "");
    window.open(`https://wa.me/${d.startsWith("91") ? d : `91${d}`}`, "_blank");
  };

  const shareWhatsApp = () => {
    if (!page) return;
    const url = `${window.location.origin}/tournament/${page.slug}`;
    const text = `Register for ${page.name}!\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const filtered = regs.filter(r => r.status === statusFilter);

  /* ────────────────────── Tabs ────────────────────── */

  const tabs: { key: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: "submissions", label: "Teams", icon: <ClipboardList className="h-3.5 w-3.5" />, badge: counts.pending },
    { key: "settings", label: "Page", icon: <Settings className="h-3.5 w-3.5" /> },
    { key: "link", label: "Link", icon: <Link2 className="h-3.5 w-3.5" /> },
  ];

  /* ════════════════════════ RENDER ════════════════════════ */

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "#0a0614" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-2 shrink-0">
        <button onClick={onClose} className="p-2 rounded-full press-scale" style={{ background: "rgba(255,255,255,0.07)", color: "rgba(196,181,253,0.7)" }}>
          <X className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-white truncate">Registration</h2>
          <p className="text-xs truncate" style={{ color: "rgba(196,181,253,0.5)" }}>{tournamentName}</p>
        </div>
        {tab === "settings" && dirty && (
          <button onClick={savePage} disabled={saving} className="px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50" style={{ background: "rgba(34,197,94,0.2)", border: "1px solid rgba(34,197,94,0.4)", color: "#22c55e" }}>
            {saving ? "Saving..." : "Save"}
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 px-4 pb-3 shrink-0">
        {tabs.map(t => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex-1 justify-center"
              style={{
                background: active ? "rgba(139,92,246,0.15)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${active ? "rgba(139,92,246,0.4)" : "rgba(255,255,255,0.06)"}`,
                color: active ? "#c4b5fd" : "rgba(196,181,253,0.4)",
              }}
            >
              {t.icon}
              {t.label}
              {t.badge !== undefined && t.badge > 0 && (
                <span className="px-1 rounded-full text-[9px] font-black" style={{ background: "rgba(251,191,36,0.25)", color: "#fbbf24" }}>{t.badge}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-24">

        {/* ══════════ SUBMISSIONS TAB ══════════ */}
        {tab === "submissions" && (
          <>
            {/* Status filter pills */}
            <div className="flex gap-1.5 mb-3">
              {(["PENDING", "VERIFIED", "REJECTED"] as const).map(s => {
                const active = statusFilter === s;
                const sc = STATUS_COLORS[s];
                const c = s === "PENDING" ? counts.pending : s === "VERIFIED" ? counts.verified : counts.rejected;
                return (
                  <button key={s} onClick={() => setStatusFilter(s)} className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-all" style={{ background: active ? sc.bg : "transparent", border: `1px solid ${active ? sc.border : "rgba(255,255,255,0.08)"}`, color: active ? sc.text : "rgba(196,181,253,0.35)" }}>
                    {s === "PENDING" && <Clock className="h-3 w-3" />}
                    {s === "VERIFIED" && <Check className="h-3 w-3" />}
                    {s === "REJECTED" && <XCircle className="h-3 w-3" />}
                    {s.charAt(0) + s.slice(1).toLowerCase()}
                    {c > 0 && <span className="px-1 rounded-full text-[9px] font-black" style={{ background: active ? sc.border : "rgba(255,255,255,0.06)" }}>{c}</span>}
                  </button>
                );
              })}
            </div>

            {loadingRegs ? (
              <div className="space-y-3 pt-2">{[1,2,3].map(i => <div key={i} className="rounded-2xl p-4" style={{ background: "#150e25", border: "1px solid rgba(124,58,237,0.12)" }}><div className="h-4 rounded skeleton-pulse mb-2" style={{ width: `${50+i*15}%` }} /><div className="h-3 rounded skeleton-pulse" style={{ width: "40%" }} /></div>)}</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-sm" style={{ color: "rgba(196,181,253,0.4)" }}>No {statusFilter.toLowerCase()} teams</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map(reg => {
                  const isOpen = expandedId === reg.id;
                  const isUp = updating.has(reg.id);
                  const sc = STATUS_COLORS[reg.status];
                  return (
                    <div key={reg.id} className="rounded-2xl overflow-hidden" style={{ background: "#150e25", border: `1px solid ${sc.border}` }}>
                      <button onClick={() => setExpandedId(isOpen ? null : reg.id)} className="w-full flex items-center gap-3 p-3.5 text-left">
                        <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-black" style={{ background: sc.bg, color: sc.text }}>{reg.teamName.slice(0,2).toUpperCase()}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white truncate">{reg.teamName}</p>
                          <p className="text-[11px] mt-0.5" style={{ color: "rgba(196,181,253,0.5)" }}>IGL: {reg.iglName}{reg.state ? ` · ${reg.state}` : ""}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {reg.utrNumber && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(251,191,36,0.1)", color: "#fbbf24" }}>UTR</span>}
                          {reg.paymentProofUrl && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(59,130,246,0.1)", color: "#60a5fa" }}>📎</span>}
                          {isOpen ? <ChevronUp className="h-4 w-4" style={{ color: "rgba(196,181,253,0.3)" }} /> : <ChevronDown className="h-4 w-4" style={{ color: "rgba(196,181,253,0.3)" }} />}
                        </div>
                      </button>
                      <div style={{ display: "grid", gridTemplateRows: isOpen ? "1fr" : "0fr", transition: "grid-template-rows 250ms ease" }}>
                        <div style={{ overflow: "hidden" }}>
                          <div className="px-3.5 pb-3.5 space-y-3">
                            <div className="h-px" style={{ background: sc.border }} />
                            <div className="grid grid-cols-2 gap-2">
                              {reg.iglId && <div><p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: "rgba(196,181,253,0.35)" }}>Player ID</p><p className="text-xs text-white font-mono">{reg.iglId}</p></div>}
                              {reg.whatsapp && <div><p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: "rgba(196,181,253,0.35)" }}>WhatsApp</p><p className="text-xs text-white">{reg.whatsapp}</p></div>}
                              {reg.email && <div className="col-span-2"><p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: "rgba(196,181,253,0.35)" }}>Email</p><p className="text-xs text-white truncate">{reg.email}</p></div>}
                            </div>
                            {(reg.player2Ign || reg.player3Ign || reg.player4Ign || (reg.extraPlayers && reg.extraPlayers.length > 0)) && (
                              <div>
                                <p className="text-[9px] font-semibold uppercase tracking-wider mb-1" style={{ color: "rgba(196,181,253,0.35)" }}>Squad</p>
                                <div className="space-y-1">
                                  {[{ ign: reg.player2Ign, id: reg.player2Id }, { ign: reg.player3Ign, id: reg.player3Id }, { ign: reg.player4Ign, id: reg.player4Id }].filter(p => p.ign).map((p, i) => (
                                    <div key={i} className="flex items-center gap-2 text-xs"><span className="text-white">{p.ign}</span>{p.id && <span className="font-mono" style={{ color: "rgba(196,181,253,0.4)" }}>{p.id}</span>}</div>
                                  ))}
                                  {reg.extraPlayers?.map((p, i) => (
                                    <div key={`ex-${i}`} className="flex items-center gap-2 text-xs"><span className="text-white">{p.ign}</span>{p.id && <span className="font-mono" style={{ color: "rgba(196,181,253,0.4)" }}>{p.id}</span>}</div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {reg.utrNumber && (
                              <div>
                                <p className="text-[9px] font-semibold uppercase tracking-wider mb-1" style={{ color: "rgba(196,181,253,0.35)" }}>UTR Number</p>
                                <button onClick={() => { navigator.clipboard.writeText(reg.utrNumber!); toast.success("UTR copied!"); }} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-mono font-bold transition-all active:scale-95" style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", color: "#fbbf24" }}>
                                  {reg.utrNumber}<Copy className="h-3.5 w-3.5" style={{ color: "rgba(251,191,36,0.5)" }} />
                                </button>
                              </div>
                            )}
                            {reg.paymentProofUrl && (
                              <div>
                                <p className="text-[9px] font-semibold uppercase tracking-wider mb-1" style={{ color: "rgba(196,181,253,0.35)" }}>Payment Proof</p>
                                <button onClick={() => setPreviewImage(reg.paymentProofUrl)} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95" style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)", color: "#60a5fa" }}>
                                  <ImageIcon className="h-4 w-4" />View Screenshot
                                </button>
                              </div>
                            )}
                            <p className="text-[10px]" style={{ color: "rgba(196,181,253,0.3)" }}>Submitted {new Date(reg.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                            <div className="flex gap-2">
                              {reg.status === "PENDING" && (
                                <>
                                  <button onClick={() => updateRegStatus(reg.id, "VERIFIED")} disabled={isUp} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-40" style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.35)", color: "#22c55e" }}><Check className="h-4 w-4" />Verify</button>
                                  <button onClick={() => updateRegStatus(reg.id, "REJECTED")} disabled={isUp} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-40" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444" }}><XCircle className="h-4 w-4" />Reject</button>
                                </>
                              )}
                              {(reg.status === "VERIFIED" || reg.status === "REJECTED") && (
                                <button onClick={() => updateRegStatus(reg.id, "PENDING")} disabled={isUp} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-40" style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.25)", color: "#fbbf24" }}><Undo2 className="h-4 w-4" />Move to Pending</button>
                              )}
                              {reg.whatsapp && <button onClick={() => openWhatsApp(reg.whatsapp!)} className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95" style={{ background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.3)", color: "#25d366" }}><MessageCircle className="h-4 w-4" /></button>}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ══════════ SETTINGS TAB ══════════ */}
        {tab === "settings" && (
          loadingPage || !page ? (
            <div className="space-y-4 pt-2">{[1,2,3,4].map(i => <div key={i} className="rounded-2xl p-4" style={{ background: "#150e25", border: "1px solid rgba(124,58,237,0.12)" }}><div className="h-4 rounded skeleton-pulse mb-2" style={{ width: `${40+i*12}%` }} /><div className="h-8 rounded-lg skeleton-pulse" /></div>)}</div>
          ) : (
            <div className="space-y-4">
              {/* Active toggle */}
              <div className="rounded-2xl p-4 flex items-center justify-between" style={{ background: "#150e25", border: `1px solid ${page.isActive ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}` }}>
                <div>
                  <p className="text-sm font-bold text-white">Registration Status</p>
                  <p className="text-xs mt-0.5" style={{ color: page.isActive ? "#22c55e" : "#ef4444" }}>{page.isActive ? "Open — accepting teams" : "Closed — new submissions blocked"}</p>
                </div>
                <button onClick={() => updateField("isActive", !page.isActive)} className="relative w-12 h-7 rounded-full transition-colors" style={{ background: page.isActive ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.2)" }}>
                  <div className="absolute top-1 h-5 w-5 rounded-full transition-all" style={{ left: page.isActive ? 24 : 4, background: page.isActive ? "#22c55e" : "#ef4444" }} />
                </button>
              </div>

              {/* Basic info */}
              <SectionCard title="Basic Info">
                <Field label="Tournament Name" value={page.name} onChange={v => updateField("name", v)} />
                <Field label="Subtitle" value={page.subtitle || ""} onChange={v => updateField("subtitle", v || null)} placeholder="e.g. by Your Esports Org" />
                <Field label="URL Slug" value={page.slug} onChange={v => updateField("slug", v)} prefix="/" />
                <Field label="Description" value={page.description || ""} onChange={v => updateField("description", v || null)} multiline placeholder="About this tournament..." />
              </SectionCard>

              {/* Tournament details */}
              <SectionCard title="Tournament Details">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Prize Pool" value={page.prizePool || ""} onChange={v => updateField("prizePool", v || null)} placeholder="₹10,000" />
                  <Field label="Entry Fee" value={page.entryFee || ""} onChange={v => updateField("entryFee", v || null)} placeholder="₹400" />
                  <Field label="Game Mode" value={page.gameMode || ""} onChange={v => updateField("gameMode", v || null)} placeholder="BGMI · Squad" />
                  <Field label="Deadline" value={page.deadline || ""} onChange={v => updateField("deadline", v || null)} placeholder="21 Oct" />
                  <Field label="Date Range" value={page.dateRange || ""} onChange={v => updateField("dateRange", v || null)} placeholder="24 Oct — 7 Nov" />
                  <Field label="Region" value={page.region || ""} onChange={v => updateField("region", v || null)} placeholder="Northeast" />
                </div>
                <Field label="Eligibility" value={page.eligibility || ""} onChange={v => updateField("eligibility", v || null)} placeholder="NE States Only" />
                <Field label="Bonus Text" value={page.bonusText || ""} onChange={v => updateField("bonusText", v || null)} placeholder="+ Free passes, merch..." />
              </SectionCard>

              {/* Payment */}
              <SectionCard title="Payment">
                <Field label="UPI ID" value={page.upiId || ""} onChange={v => updateField("upiId", v || null)} placeholder="yourname@upi" />
                <Field label="QR Code Image URL" value={page.qrImageUrl || ""} onChange={v => updateField("qrImageUrl", v || null)} placeholder="https://..." />
              </SectionCard>

              {/* Appearance */}
              <SectionCard title="Appearance">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "rgba(196,181,253,0.4)" }}>Theme Color</p>
                  <div className="flex gap-2 flex-wrap">
                    {THEME_PRESETS.map(t => (
                      <button key={t.color} onClick={() => updateField("themeColor", t.color)} className="h-8 w-8 rounded-full transition-all active:scale-90" style={{ background: t.color, boxShadow: page.themeColor === t.color ? `0 0 0 3px ${t.color}40, 0 0 0 5px rgba(255,255,255,0.15)` : "none" }} title={t.label} />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "rgba(196,181,253,0.4)" }}>Particle Effect</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {PARTICLE_OPTIONS.map(p => (
                      <button key={p.value} onClick={() => updateField("particleStyle", p.value)} className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all" style={{ background: page.particleStyle === p.value ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.04)", border: `1px solid ${page.particleStyle === p.value ? "rgba(139,92,246,0.5)" : "rgba(255,255,255,0.08)"}`, color: page.particleStyle === p.value ? "#c4b5fd" : "rgba(196,181,253,0.4)" }}>{p.label}</button>
                    ))}
                  </div>
                </div>
              </SectionCard>

              {/* Field config */}
              {/* Field config — organized by steps */}
              <SectionCard title="Form Fields">
                <p className="text-[10px] mb-3" style={{ color: "rgba(196,181,253,0.35)" }}>Control what teams must fill in — organized by registration steps</p>
                <div className="space-y-3">
                  {STEP_FIELDS.map(group => {
                    // Check if entire step is hidden
                    const allHidden = group.fields.every(f => (page.fieldConfig?.[f.key] || "required") === "hidden");
                    return (
                      <div key={group.step} className="rounded-xl overflow-hidden" style={{ background: allHidden ? "rgba(239,68,68,0.04)" : "rgba(139,92,246,0.04)", border: `1px solid ${allHidden ? "rgba(239,68,68,0.15)" : "rgba(139,92,246,0.1)"}` }}>
                        {/* Step header */}
                        <div className="flex items-center justify-between px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{group.emoji}</span>
                            <span className="text-xs font-bold" style={{ color: allHidden ? "rgba(239,68,68,0.6)" : "#c4b5fd" }}>{group.label}</span>
                          </div>
                          {allHidden && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}>HIDDEN</span>}
                        </div>
                        {/* Fields */}
                        <div className="px-3 pb-2.5 space-y-0.5">
                          {group.fields.map(f => {
                            const val = page.fieldConfig?.[f.key] || "required";
                            return (
                              <div key={f.key} className="flex items-center justify-between py-1.5">
                                <span className="text-[11px] font-medium" style={{ color: val === "hidden" ? "rgba(196,181,253,0.25)" : "rgba(255,255,255,0.8)" }}>{f.label}</span>
                                <div className="flex gap-0.5">
                                  {(["required", "optional", "hidden"] as const).map(opt => (
                                    <button
                                      key={opt}
                                      onClick={() => updateFieldConfig(f.key, opt)}
                                      className="px-2 py-1 rounded text-[10px] font-bold transition-all active:scale-95"
                                      style={{
                                        background: val === opt
                                          ? opt === "hidden" ? "rgba(239,68,68,0.18)" : opt === "required" ? "rgba(34,197,94,0.18)" : "rgba(251,191,36,0.18)"
                                          : "transparent",
                                        color: val === opt
                                          ? opt === "hidden" ? "#ef4444" : opt === "required" ? "#22c55e" : "#fbbf24"
                                          : "rgba(196,181,253,0.25)",
                                        border: `1px solid ${
                                          val === opt
                                            ? opt === "hidden" ? "rgba(239,68,68,0.3)" : opt === "required" ? "rgba(34,197,94,0.3)" : "rgba(251,191,36,0.3)"
                                            : "transparent"
                                        }`,
                                      }}
                                    >
                                      {opt === "required" ? "Req" : opt === "optional" ? "Opt" : "Hide"}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>
            </div>
          )
        )}

        {/* ══════════ LINK TAB ══════════ */}
        {tab === "link" && (
          <div className="space-y-4 pt-2">
            {page ? (
              <>
                {/* Status */}
                <div className="rounded-2xl p-5 text-center" style={{ background: "#150e25", border: `1px solid ${page.isActive ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}` }}>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold mb-3" style={{ background: page.isActive ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)", color: page.isActive ? "#22c55e" : "#ef4444" }}>
                    {page.isActive ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    {page.isActive ? "Live — anyone with the link can register" : "Closed — registrations are paused"}
                  </div>
                  <p className="text-lg font-bold text-white mb-1">{page.name}</p>
                  <p className="text-xs font-mono" style={{ color: "rgba(196,181,253,0.5)" }}>/tournament/{page.slug}</p>
                </div>

                {/* Big copy button */}
                <button onClick={copyLink} className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]" style={{ background: copied ? "rgba(34,197,94,0.15)" : "rgba(139,92,246,0.12)", border: `1px solid ${copied ? "rgba(34,197,94,0.4)" : "rgba(139,92,246,0.3)"}`, color: copied ? "#22c55e" : "#c4b5fd" }}>
                  {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                  {copied ? "Copied!" : "Copy Registration Link"}
                </button>

                {/* Action buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => window.open(`/tournament/${page.slug}`, "_blank")} className="flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-bold transition-all active:scale-95" style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)", color: "#60a5fa" }}>
                    <ExternalLink className="h-4 w-4" />Preview Page
                  </button>
                  <button onClick={shareWhatsApp} className="flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-bold transition-all active:scale-95" style={{ background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.3)", color: "#25d366" }}>
                    <Send className="h-4 w-4" />Share via WA
                  </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Total", count: counts.total, color: "#c4b5fd" },
                    { label: "Verified", count: counts.verified, color: "#22c55e" },
                    { label: "Pending", count: counts.pending, color: "#fbbf24" },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: "#150e25", border: "1px solid rgba(124,58,237,0.12)" }}>
                      <p className="text-2xl font-black" style={{ color: s.color }}>{s.count}</p>
                      <p className="text-[10px] font-semibold" style={{ color: "rgba(196,181,253,0.4)" }}>{s.label}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : loadingPage ? (
              <div className="space-y-4">{[1,2].map(i => <div key={i} className="rounded-2xl p-6" style={{ background: "#150e25" }}><div className="h-6 rounded skeleton-pulse mx-auto" style={{ width: "60%" }} /></div>)}</div>
            ) : (
              <div className="text-center py-16">
                <p className="text-sm" style={{ color: "rgba(196,181,253,0.4)" }}>No registration page found</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Image preview modal */}
      {previewImage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.85)" }} onClick={() => setPreviewImage(null)}>
          <button className="absolute top-5 right-5 p-2 rounded-full" style={{ background: "rgba(255,255,255,0.1)", color: "white" }}><X className="h-5 w-5" /></button>
          <img src={previewImage} alt="Payment proof" className="max-w-full max-h-[80vh] rounded-2xl object-contain" />
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════ Sub-components ═══════════════════════════ */

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-4 space-y-3" style={{ background: "#150e25", border: "1px solid rgba(124,58,237,0.15)" }}>
      <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "rgba(196,181,253,0.5)" }}>{title}</p>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, prefix, multiline }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; prefix?: string; multiline?: boolean;
}) {
  const style = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(139,92,246,0.15)", color: "white" };
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "rgba(196,181,253,0.4)" }}>{label}</p>
      {prefix ? (
        <div className="flex items-center rounded-xl overflow-hidden" style={style}>
          <span className="pl-3 pr-1 text-xs font-mono" style={{ color: "rgba(196,181,253,0.4)" }}>{prefix}</span>
          <input value={value} onChange={e => onChange(e.target.value)} className="flex-1 bg-transparent py-2 pr-3 text-xs focus:outline-none text-white" placeholder={placeholder} />
        </div>
      ) : multiline ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} rows={3} className="w-full rounded-xl px-3 py-2 text-xs focus:outline-none resize-none" style={style} placeholder={placeholder} />
      ) : (
        <input value={value} onChange={e => onChange(e.target.value)} className="w-full rounded-xl px-3 py-2 text-xs focus:outline-none" style={style} placeholder={placeholder} />
      )}
    </div>
  );
}
