"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { authFetch } from "@/lib/authFetch";
import { Crown, ChevronLeft, Plus, Trash2, ExternalLink, Copy, Edit3, Eye, EyeOff, Users, X } from "lucide-react";
import { toast } from "sonner";

type FieldVisibility = "required" | "optional" | "hidden";

interface FieldConfig {
  state: FieldVisibility;
  teamName: FieldVisibility;
  teamLogo: FieldVisibility;
  iglName: FieldVisibility;
  iglId: FieldVisibility;
  whatsapp: FieldVisibility;
  email: FieldVisibility;
  squadNames: FieldVisibility;
  squadIds: FieldVisibility;
  utrNumber: FieldVisibility;
  paymentProof: FieldVisibility;
}

const DEFAULT_FIELD_CONFIG: FieldConfig = {
  state: "required",
  teamName: "required",
  teamLogo: "optional",
  iglName: "required",
  iglId: "required",
  whatsapp: "required",
  email: "required",
  squadNames: "required",
  squadIds: "required",
  utrNumber: "required",
  paymentProof: "required",
};

const FIELD_LABELS: { key: keyof FieldConfig; label: string; group: string }[] = [
  { key: "state", label: "State / Region", group: "Team" },
  { key: "teamName", label: "Team Name", group: "Team" },
  { key: "teamLogo", label: "Team Logo", group: "Team" },
  { key: "iglName", label: "IGL In-Game Name", group: "Leader" },
  { key: "iglId", label: "BGMI Player ID", group: "Leader" },
  { key: "whatsapp", label: "WhatsApp Number", group: "Leader" },
  { key: "email", label: "Email Address", group: "Leader" },
  { key: "squadNames", label: "Squad Player Names", group: "Squad" },
  { key: "squadIds", label: "Squad Player IDs", group: "Squad" },
  { key: "utrNumber", label: "UTR / Transaction ID", group: "Payment" },
  { key: "paymentProof", label: "Payment Screenshot", group: "Payment" },
];

interface TournamentPageRow {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  description: string | null;
  bannerUrl: string | null;
  backgroundUrl: string | null;
  themeColor: string;
  particleStyle: string;
  prizePool: string | null;
  entryFee: string | null;
  entryFeeAmount: number;
  region: string | null;
  deadline: string | null;
  bonusText: string | null;
  gameMode: string | null;
  dateRange: string | null;
  eligibility: string | null;
  stateList: string[];
  upiId: string | null;
  qrImageUrl: string | null;
  termsEligibility: string | null;
  termsDates: string | null;
  termsExtra: string | null;
  footerText: string | null;
  fieldConfig: Record<string, string> | null;
  isActive: boolean;
  createdAt: string;
  _count: { registrations: number };
}

const DEFAULT_STATES = ["Arunachal Pradesh", "Assam", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Tripura", "Sikkim"];
const PARTICLE_OPTIONS = ["petals", "snow", "sparks", "none"];

/** Tournaments with these slugs cannot be deleted from the admin UI */
const PROTECTED_SLUGS = ["festival-cup"];
const THEME_PRESETS = [
  { name: "Cherry Blossom", color: "#ec4899" },
  { name: "Ocean Blue", color: "#3b82f6" },
  { name: "Emerald", color: "#10b981" },
  { name: "Amber Fire", color: "#f59e0b" },
  { name: "Royal Purple", color: "#8b5cf6" },
  { name: "Crimson", color: "#ef4444" },
  { name: "Teal", color: "#14b8a6" },
  { name: "Indigo", color: "#6366f1" },
];

export default function AdminTournamentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [pages, setPages] = useState<TournamentPageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<TournamentPageRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const fetchPages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/tournament-pages");
      if (res.status === 403) { router.push("/"); return; }
      const data = await res.json();
      setPages(data.pages ?? []);
    } catch { toast.error("Failed to load"); }
    setLoading(false);
  }, [router]);

  useEffect(() => { fetchPages(); }, [fetchPages]);

  const deletePage = async (id: string) => {
    if (!confirm("Delete this tournament page? All registrations will be lost.")) return;
    try {
      const res = await authFetch("/api/tournament-pages", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) { toast.success("Deleted"); fetchPages(); }
      else toast.error("Failed to delete");
    } catch { toast.error("Failed"); }
  };

  const toggleActive = async (page: TournamentPageRow) => {
    try {
      const res = await authFetch("/api/tournament-pages", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: page.id, isActive: !page.isActive }),
      });
      if (res.ok) { toast.success(page.isActive ? "Deactivated" : "Activated"); fetchPages(); }
    } catch { toast.error("Failed"); }
  };

  if (!session) return null;

  return (
    <div className="min-h-screen pb-24" style={{ background: "#0c0914" }}>
      {/* Header */}
      <div className="px-4 pt-10 pb-3 sticky top-0 z-10 backdrop-blur-md" style={{ background: "rgba(12,9,20,0.9)", borderBottom: "1px solid rgba(124,58,237,0.15)" }}>
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => router.push("/admin")} className="p-1.5 rounded-lg" style={{ color: "rgba(167,139,250,0.5)" }}>
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-black text-white flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-400" /> Tournament Pages
            </h1>
            <p className="text-[10px]" style={{ color: "rgba(167,139,250,0.45)" }}>{pages.length} tournaments</p>
          </div>
          <button
            onClick={() => { setCreating(true); setEditing(null); }}
            className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5"
            style={{ background: "rgba(124,58,237,0.2)", color: "#c4b5fd", border: "1px solid rgba(124,58,237,0.3)" }}
          >
            <Plus className="h-3.5 w-3.5" /> New
          </button>
        </div>
      </div>

      {/* List */}
      <div className="px-4 pt-4 space-y-2">
        {loading && pages.length === 0 ? (
          <div className="flex justify-center py-16">
            <div className="h-6 w-6 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
          </div>
        ) : pages.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-zinc-600 mb-3">No tournament pages yet</p>
            <button
              onClick={() => setCreating(true)}
              className="px-4 py-2 rounded-xl text-sm font-bold"
              style={{ background: "rgba(124,58,237,0.15)", color: "#c4b5fd", border: "1px solid rgba(124,58,237,0.25)" }}
            >
              Create your first tournament
            </button>
          </div>
        ) : (
          pages.map((p) => (
            <div key={p.id} className="rounded-xl p-3.5 space-y-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(124,58,237,0.1)" }}>
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: p.themeColor + "20" }}>
                  <div className="h-4 w-4 rounded-full" style={{ background: p.themeColor }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate flex items-center gap-1.5">
                    {p.name}
                    {PROTECTED_SLUGS.includes(p.slug) && (
                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(250,204,21,0.12)", color: "#facc15", border: "1px solid rgba(250,204,21,0.2)" }}>DEFAULT</span>
                    )}
                  </p>
                  <p className="text-[10px] text-zinc-500 truncate">/tournament/{p.slug}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.isActive ? "" : ""}`}
                    style={{ background: p.isActive ? "rgba(74,222,128,0.1)" : "rgba(107,114,128,0.1)", color: p.isActive ? "#4ade80" : "#6b7280" }}>
                    {p.isActive ? "Active" : "Inactive"}
                  </span>
                  <p className="text-[9px] text-zinc-600 mt-0.5 flex items-center gap-1 justify-end">
                    <Users className="h-2.5 w-2.5" /> {p._count.registrations} registrations
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => { setEditing(p); setCreating(false); }}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1"
                  style={{ background: "rgba(124,58,237,0.1)", color: "#c4b5fd", border: "1px solid rgba(124,58,237,0.2)" }}
                >
                  <Edit3 className="h-3 w-3" /> Edit
                </button>
                <button
                  onClick={() => toggleActive(p)}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1"
                  style={{ background: "rgba(124,58,237,0.1)", color: "#c4b5fd", border: "1px solid rgba(124,58,237,0.2)" }}
                >
                  {p.isActive ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  {p.isActive ? "Deactivate" : "Activate"}
                </button>
                <button
                  onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/tournament/${p.slug}`); toast.success("Link copied!"); }}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1"
                  style={{ background: "rgba(124,58,237,0.1)", color: "#c4b5fd", border: "1px solid rgba(124,58,237,0.2)" }}
                >
                  <Copy className="h-3 w-3" /> Link
                </button>
                <a
                  href={`/tournament/${p.slug}`}
                  target="_blank"
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 no-underline"
                  style={{ background: "rgba(124,58,237,0.1)", color: "#c4b5fd", border: "1px solid rgba(124,58,237,0.2)" }}
                >
                  <ExternalLink className="h-3 w-3" /> Preview
                </a>
                {!PROTECTED_SLUGS.includes(p.slug) && (
                  <button
                    onClick={() => deletePage(p.id)}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 ml-auto"
                    style={{ background: "rgba(239,68,68,0.08)", color: "#f87171", border: "1px solid rgba(239,68,68,0.15)" }}
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Editor Modal */}
      {(editing || creating) && (
        <TournamentEditor
          initial={editing}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { setEditing(null); setCreating(false); fetchPages(); }}
          saving={saving}
          setSaving={setSaving}
        />
      )}
    </div>
  );
}

/* ── Tournament Editor Modal ── */
function TournamentEditor({
  initial,
  onClose,
  onSaved,
  saving,
  setSaving,
}: {
  initial: TournamentPageRow | null;
  onClose: () => void;
  onSaved: () => void;
  saving: boolean;
  setSaving: (v: boolean) => void;
}) {
  const isNew = !initial;
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [subtitle, setSubtitle] = useState(initial?.subtitle ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [bannerUrl, setBannerUrl] = useState(initial?.bannerUrl ?? "");
  const [backgroundUrl, setBackgroundUrl] = useState(initial?.backgroundUrl ?? "");
  const [themeColor, setThemeColor] = useState(initial?.themeColor ?? "#ec4899");
  const [particleStyle, setParticleStyle] = useState(initial?.particleStyle ?? "petals");
  const [prizePool, setPrizePool] = useState(initial?.prizePool ?? "");
  const [entryFee, setEntryFee] = useState(initial?.entryFee ?? "");
  const [entryFeeAmount, setEntryFeeAmount] = useState(initial?.entryFeeAmount ?? 0);
  const [region, setRegion] = useState(initial?.region ?? "");
  const [deadline, setDeadline] = useState(initial?.deadline ?? "");
  const [bonusText, setBonusText] = useState(initial?.bonusText ?? "");
  const [gameMode, setGameMode] = useState(initial?.gameMode ?? "");
  const [dateRange, setDateRange] = useState(initial?.dateRange ?? "");
  const [eligibility, setEligibility] = useState(initial?.eligibility ?? "");
  const [stateListStr, setStateListStr] = useState((initial?.stateList ?? DEFAULT_STATES).join(", "));
  const [upiId, setUpiId] = useState(initial?.upiId ?? "");
  const [qrImageUrl, setQrImageUrl] = useState(initial?.qrImageUrl ?? "");
  const [termsEligibility, setTermsEligibility] = useState(initial?.termsEligibility ?? "");
  const [termsDates, setTermsDates] = useState(initial?.termsDates ?? "");
  const [termsExtra, setTermsExtra] = useState(initial?.termsExtra ?? "");
  const [footerText, setFooterText] = useState(initial?.footerText ?? "");

  // Field config state
  const initFC = initial?.fieldConfig
    ? { ...DEFAULT_FIELD_CONFIG, ...(initial.fieldConfig as Partial<FieldConfig>) }
    : { ...DEFAULT_FIELD_CONFIG };
  const [fieldConfig, setFieldConfig] = useState<FieldConfig>(initFC);
  const setFieldVis = (key: keyof FieldConfig, val: FieldVisibility) =>
    setFieldConfig(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    if (!slug.trim() || !name.trim()) { toast.error("Slug and name are required"); return; }
    setSaving(true);
    try {
      const stateList = stateListStr.split(",").map(s => s.trim()).filter(Boolean);
      const body: Record<string, unknown> = {
        slug: slug.trim().toLowerCase().replace(/\s+/g, "-"),
        name, subtitle: subtitle || null, description: description || null,
        bannerUrl: bannerUrl || null, backgroundUrl: backgroundUrl || null,
        themeColor, particleStyle,
        prizePool: prizePool || null, entryFee: entryFee || null, entryFeeAmount,
        region: region || null, deadline: deadline || null,
        bonusText: bonusText || null, gameMode: gameMode || null,
        dateRange: dateRange || null, eligibility: eligibility || null,
        stateList,
        upiId: upiId || null, qrImageUrl: qrImageUrl || null,
        termsEligibility: termsEligibility || null,
        termsDates: termsDates || null,
        termsExtra: termsExtra || null,
        footerText: footerText || null,
        fieldConfig,
      };

      if (!isNew) body.id = initial!.id;

      const res = await authFetch("/api/tournament-pages", {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast.success(isNew ? "Tournament created!" : "Tournament updated!");
        onSaved();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to save");
      }
    } catch { toast.error("Failed to save"); }
    setSaving(false);
  };

  const inp = "w-full px-3 py-2 rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none";
  const inpStyle = { background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.15)" };
  const lbl = "text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1";

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-8 pb-8 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-lg mx-4 rounded-2xl p-5 space-y-4" style={{ background: "#13101f", border: "1px solid rgba(124,58,237,0.2)" }} onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between">
          <h2 className="text-base font-black text-white">{isNew ? "Create Tournament" : "Edit Tournament"}</h2>
          <button onClick={onClose} className="p-1 rounded-lg" style={{ color: "rgba(167,139,250,0.5)" }}><X className="h-5 w-5" /></button>
        </div>

        {/* Basic Info */}
        <Section title="Basic Info">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className={lbl}>Slug (URL) *</p>
              <input className={inp} style={inpStyle} placeholder="e.g. winter-showdown" value={slug} onChange={e => setSlug(e.target.value)} disabled={!isNew} />
            </div>
            <div>
              <p className={lbl}>Name *</p>
              <input className={inp} style={inpStyle} placeholder="e.g. Winter Showdown Cup" value={name} onChange={e => setName(e.target.value)} />
            </div>
          </div>
          <div>
            <p className={lbl}>Subtitle</p>
            <input className={inp} style={inpStyle} placeholder="e.g. by Divine Esports" value={subtitle} onChange={e => setSubtitle(e.target.value)} />
          </div>
          <div>
            <p className={lbl}>Description</p>
            <textarea className={`${inp} min-h-[60px] resize-y`} style={inpStyle} placeholder="About this tournament…" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
        </Section>

        {/* Theme */}
        <Section title="Theme & Visuals">
          <div>
            <p className={lbl}>Theme Color</p>
            <div className="flex items-center gap-2 flex-wrap">
              {THEME_PRESETS.map(t => (
                <button key={t.color} onClick={() => setThemeColor(t.color)}
                  className="h-7 w-7 rounded-full border-2 transition-all"
                  style={{ background: t.color, borderColor: themeColor === t.color ? "#fff" : "transparent", transform: themeColor === t.color ? "scale(1.2)" : "scale(1)" }}
                  title={t.name} />
              ))}
              <input type="color" value={themeColor} onChange={e => setThemeColor(e.target.value)}
                className="h-7 w-7 rounded-full cursor-pointer border-0 p-0" style={{ background: "transparent" }} />
            </div>
          </div>
          <div>
            <p className={lbl}>Particle Style</p>
            <div className="flex gap-1.5">
              {PARTICLE_OPTIONS.map(ps => (
                <button key={ps} onClick={() => setParticleStyle(ps)}
                  className="px-3 py-1 rounded-lg text-[11px] font-bold capitalize"
                  style={{
                    background: particleStyle === ps ? "rgba(124,58,237,0.2)" : "rgba(124,58,237,0.06)",
                    color: particleStyle === ps ? "#c4b5fd" : "rgba(167,139,250,0.4)",
                    border: `1px solid ${particleStyle === ps ? "rgba(124,58,237,0.3)" : "rgba(124,58,237,0.1)"}`,
                  }}>
                  {ps === "none" ? "None" : ps === "petals" ? "🌸 Petals" : ps === "snow" ? "❄️ Snow" : "✨ Sparks"}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className={lbl}>Banner Image URL</p>
              <input className={inp} style={inpStyle} placeholder="/images/banner.png" value={bannerUrl} onChange={e => setBannerUrl(e.target.value)} />
            </div>
            <div>
              <p className={lbl}>Background Image URL</p>
              <input className={inp} style={inpStyle} placeholder="/images/bg.jpg" value={backgroundUrl} onChange={e => setBackgroundUrl(e.target.value)} />
            </div>
          </div>
        </Section>

        {/* Tournament Details */}
        <Section title="Tournament Details">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className={lbl}>Prize Pool</p>
              <input className={inp} style={inpStyle} placeholder="₹10,000" value={prizePool} onChange={e => setPrizePool(e.target.value)} />
            </div>
            <div>
              <p className={lbl}>Entry Fee (display)</p>
              <input className={inp} style={inpStyle} placeholder="₹400" value={entryFee} onChange={e => setEntryFee(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <p className={lbl}>Fee Amount (₹)</p>
              <input className={inp} style={inpStyle} type="number" placeholder="400" value={entryFeeAmount || ""} onChange={e => setEntryFeeAmount(Number(e.target.value))} />
            </div>
            <div>
              <p className={lbl}>Region</p>
              <input className={inp} style={inpStyle} placeholder="Northeast" value={region} onChange={e => setRegion(e.target.value)} />
            </div>
            <div>
              <p className={lbl}>Deadline</p>
              <input className={inp} style={inpStyle} placeholder="21 Oct" value={deadline} onChange={e => setDeadline(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className={lbl}>Game Mode</p>
              <input className={inp} style={inpStyle} placeholder="BGMI · Squad" value={gameMode} onChange={e => setGameMode(e.target.value)} />
            </div>
            <div>
              <p className={lbl}>Date Range</p>
              <input className={inp} style={inpStyle} placeholder="24 Oct — 7 Nov" value={dateRange} onChange={e => setDateRange(e.target.value)} />
            </div>
          </div>
          <div>
            <p className={lbl}>Eligibility Chip</p>
            <input className={inp} style={inpStyle} placeholder="NE States Only" value={eligibility} onChange={e => setEligibility(e.target.value)} />
          </div>
          <div>
            <p className={lbl}>Bonus Text</p>
            <input className={inp} style={inpStyle} placeholder="+ 4 Festival Passes for winners" value={bonusText} onChange={e => setBonusText(e.target.value)} />
          </div>
        </Section>

        {/* States */}
        <Section title="State / Region Options">
          <div>
            <p className={lbl}>States (comma separated)</p>
            <textarea className={`${inp} min-h-[50px] resize-y`} style={inpStyle} value={stateListStr}
              onChange={e => setStateListStr(e.target.value)}
              placeholder="Arunachal Pradesh, Assam, Manipur, …" />
          </div>
        </Section>

        {/* Payment */}
        <Section title="Payment Details">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className={lbl}>UPI ID</p>
              <input className={inp} style={inpStyle} placeholder="name@upi" value={upiId} onChange={e => setUpiId(e.target.value)} />
            </div>
            <div>
              <p className={lbl}>QR Image URL</p>
              <input className={inp} style={inpStyle} placeholder="/images/qr.jpg" value={qrImageUrl} onChange={e => setQrImageUrl(e.target.value)} />
            </div>
          </div>
        </Section>

        {/* Terms */}
        <Section title="Terms & Footer">
          <div>
            <p className={lbl}>Terms — Eligibility</p>
            <input className={inp} style={inpStyle} placeholder="NE exclusive · Squad of 4 · BGMI" value={termsEligibility} onChange={e => setTermsEligibility(e.target.value)} />
          </div>
          <div>
            <p className={lbl}>Terms — Dates</p>
            <input className={inp} style={inpStyle} placeholder="24th October — 7th November" value={termsDates} onChange={e => setTermsDates(e.target.value)} />
          </div>
          <div>
            <p className={lbl}>Terms — Extra</p>
            <textarea className={`${inp} min-h-[50px] resize-y`} style={inpStyle} value={termsExtra}
              onChange={e => setTermsExtra(e.target.value)}
              placeholder="Entry fee, DQ policy, ticket terms…" />
          </div>
          <div>
            <p className={lbl}>Footer Text</p>
            <input className={inp} style={inpStyle} placeholder="Tournament · Hosted by …" value={footerText} onChange={e => setFooterText(e.target.value)} />
          </div>
        </Section>

        {/* Form Fields Config */}
        <Section title="Form Fields">
          <p className="text-[10px] text-zinc-500 mb-2">Control which fields appear on the registration form and whether they&apos;re required or optional.</p>
          <div className="space-y-1">
            {FIELD_LABELS.map(({ key, label, group }, i) => {
              const prevGroup = i > 0 ? FIELD_LABELS[i - 1].group : null;
              return (
                <div key={key}>
                  {group !== prevGroup && (
                    <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mt-2 mb-1">Step: {group}</p>
                  )}
                  <div className="flex items-center justify-between rounded-lg px-2.5 py-1.5" style={{ background: "rgba(124,58,237,0.04)", border: "1px solid rgba(124,58,237,0.08)" }}>
                    <span className="text-[11px] text-zinc-300 font-medium">{label}</span>
                    <div className="flex gap-0.5">
                      {(["required", "optional", "hidden"] as FieldVisibility[]).map(v => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setFieldVis(key, v)}
                          className="px-2 py-0.5 rounded text-[9px] font-bold capitalize transition-all"
                          style={{
                            background: fieldConfig[key] === v
                              ? v === "required" ? "rgba(74,222,128,0.15)" : v === "optional" ? "rgba(250,204,21,0.12)" : "rgba(239,68,68,0.1)"
                              : "transparent",
                            color: fieldConfig[key] === v
                              ? v === "required" ? "#4ade80" : v === "optional" ? "#facc15" : "#f87171"
                              : "rgba(107,114,128,0.5)",
                            border: fieldConfig[key] === v
                              ? `1px solid ${v === "required" ? "rgba(74,222,128,0.25)" : v === "optional" ? "rgba(250,204,21,0.2)" : "rgba(239,68,68,0.2)"}`
                              : "1px solid transparent",
                          }}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        {/* Save */}
        <div className="flex items-center gap-2 pt-2">
          <button onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: "rgba(124,58,237,0.06)", color: "rgba(167,139,250,0.5)", border: "1px solid rgba(124,58,237,0.12)" }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-40"
            style={{ background: "rgba(124,58,237,0.25)", color: "#c4b5fd", border: "1px solid rgba(124,58,237,0.4)" }}>
            {saving ? "Saving…" : isNew ? "Create Tournament" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-3.5 space-y-2.5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(124,58,237,0.08)" }}>
      <h3 className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">{title}</h3>
      {children}
    </div>
  );
}
