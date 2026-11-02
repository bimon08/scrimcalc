"use client";

import { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import "./tournament-page.css";

/* ── Field config types ── */
type FieldVisibility = "required" | "optional" | "hidden";

interface FieldConfig {
  state: FieldVisibility;
  teamName: FieldVisibility;
  teamLogo: FieldVisibility;
  iglName: FieldVisibility;
  iglId: FieldVisibility;
  whatsapp: FieldVisibility;
  email: FieldVisibility;
  squadNames: FieldVisibility;  // controls player2-4 In-Game Names
  squadIds: FieldVisibility;    // controls player2-4 BGMI IDs
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

function getFieldConfig(raw: Record<string, string> | null | undefined): FieldConfig {
  if (!raw) return { ...DEFAULT_FIELD_CONFIG };
  const result = { ...DEFAULT_FIELD_CONFIG };
  for (const key of Object.keys(DEFAULT_FIELD_CONFIG) as (keyof FieldConfig)[]) {
    const v = raw[key] || raw[key === 'squadNames' ? 'squad' : ''] as string; // backwards compat with old 'squad' key
    if (v === 'required' || v === 'optional' || v === 'hidden') {
      result[key] = v;
    }
  }
  return result;
}

/** Returns true if a field is visible (required or optional) */
function vis(fc: FieldConfig, key: keyof FieldConfig) { return fc[key] !== "hidden"; }
/** Returns true if a field is required */
function req(fc: FieldConfig, key: keyof FieldConfig) { return fc[key] === "required"; }

/* ── Tournament Config Type ── */
interface TournamentConfig {
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
}

/* ── Color Helpers ── */
function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

function themeVars(color: string): React.CSSProperties {
  const { r, g, b } = hexToRgb(color);
  return {
    "--tc": color,
    "--tc-rgb": `${r}, ${g}, ${b}`,
    "--tc-light": `rgba(${r}, ${g}, ${b}, 0.08)`,
    "--tc-border": `rgba(${r}, ${g}, ${b}, 0.12)`,
    "--tc-bg": `rgba(${r}, ${g}, ${b}, 0.04)`,
  } as React.CSSProperties;
}

/* ── Particles ── */
function Particles({ style, color }: { style: string; color: string }) {
  if (style === "none") return null;
  const { r, g, b } = hexToRgb(color);

  const particleConfig: Record<string, { count: number; gradient: string; shape: string }> = {
    petals: {
      count: 15,
      gradient: `radial-gradient(ellipse at 30% 30%, rgba(${r},${g},${b},0.9), rgba(${r},${g},${b},0.7) 50%, rgba(${r},${g},${b},0.3))`,
      shape: "50% 0 50% 0",
    },
    snow: {
      count: 25,
      gradient: `radial-gradient(circle, rgba(255,255,255,0.95), rgba(220,230,255,0.6))`,
      shape: "50%",
    },
    sparks: {
      count: 20,
      gradient: `radial-gradient(circle, rgba(${r},${g},${b},1), rgba(255,200,50,0.8) 50%, rgba(${r},${g},${b},0.2))`,
      shape: "50%",
    },
  };
  const cfg = particleConfig[style] || particleConfig.petals;

  return (
    <div className="tp-particles" aria-hidden="true">
      {Array.from({ length: cfg.count }).map((_, i) => (
        <span key={i} className={`tp-particle tp-particle-${style}`} style={{
          "--size": `${style === "snow" ? 4 + Math.random() * 8 : 10 + Math.random() * 18}px`,
          "--left": `${Math.random() * 100}%`,
          "--delay": `${Math.random() * 16}s`,
          "--dur": `${8 + Math.random() * 10}s`,
          "--drift": `${-80 + Math.random() * 160}px`,
          "--rot": `${Math.random() * 360}deg`,
          "--sway": `${30 + Math.random() * 60}px`,
          background: cfg.gradient,
          borderRadius: cfg.shape,
        } as React.CSSProperties} />
      ))}
    </div>
  );
}

/* ── File Upload ── */
function FileZone({ id, label, hint, accept, file, onFile, maxMB = 10 }: {
  id: string; label: string; hint: string; accept: string; file: File | null; onFile: (f: File | null) => void; maxMB?: number;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const u = URL.createObjectURL(file); setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  return (
    <div className={`tp-drop-zone ${file ? "has-file" : ""}`} onClick={() => ref.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f && f.size <= maxMB * 1024 * 1024) onFile(f); else toast.error(`Max ${maxMB} MB`); }}>
      <input ref={ref} id={id} type="file" accept={accept} className="sr-only"
        onChange={(e) => { const f = e.target.files?.[0]; if (f && f.size <= maxMB * 1024 * 1024) onFile(f); else if (f) toast.error(`Max ${maxMB} MB`); }} />
      {file && preview ? (
        <div className="tp-file-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {file.type.startsWith("image/") ? <img src={preview} alt="" className="tp-preview-img" /> : <div className="tp-file-icon-box">PDF</div>}
          <div className="tp-file-meta"><span className="tp-file-name">{file.name}</span><span className="tp-file-size">{(file.size / 1024 / 1024).toFixed(1)} MB</span></div>
          <button type="button" className="tp-remove-btn" onClick={(e) => { e.stopPropagation(); onFile(null); if (ref.current) ref.current.value = ""; }}>✕</button>
        </div>
      ) : (
        <div className="tp-drop-empty">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <span className="tp-drop-text">{label}</span>
          <span className="tp-drop-sub">{hint}</span>
        </div>
      )}
    </div>
  );
}

/* ── Image with loading skeleton ── */
function LoadingImage({ src, alt, className }: { src: string; alt: string; className: string }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  return (
    <div className="tp-img-wrap" style={{ position: 'relative' }}>
      {!loaded && !error && <div className="tp-img-skeleton" />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={className}
        style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.3s ease' }}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </div>
  );
}

/* ── Label helper ── */
function FieldLabel({ text, fieldKey, fc }: { text: string; fieldKey: keyof FieldConfig; fc: FieldConfig }) {
  return (
    <label className="tp-fl">
      {text}{" "}
      {req(fc, fieldKey) ? <span className="tp-req">*</span> : <span className="tp-opt">(optional)</span>}
    </label>
  );
}

/* ── Main ── */
export default function TournamentRegistrationPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [config, setConfig] = useState<TournamentConfig | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form state
  const [state, setState] = useState("");
  const [teamName, setTeamName] = useState("");
  const [teamLogo, setTeamLogo] = useState<File | null>(null);
  const [iglName, setIglName] = useState("");
  const [iglId, setIglId] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [p2Ign, setP2Ign] = useState(""); const [p2Id, setP2Id] = useState("");
  const [p3Ign, setP3Ign] = useState(""); const [p3Id, setP3Id] = useState("");
  const [p4Ign, setP4Ign] = useState(""); const [p4Id, setP4Id] = useState("");
  const [extraPlayers, setExtraPlayers] = useState<{ ign: string; id: string }[]>([]);
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [utrNumber, setUtrNumber] = useState("");
  const [showUtrHelp, setShowUtrHelp] = useState(false);
  const [declaration, setDeclaration] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(0);
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    fetch(`/api/tournament-pages?slug=${slug}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => { setConfig(d.page); setLoading(false); })
      .catch(() => { setLoadError(true); setLoading(false); });
  }, [slug]);

  const fc = config ? getFieldConfig(config.fieldConfig) : DEFAULT_FIELD_CONFIG;

  /* ── Determine which steps to show ── */
  // Step 0: Team (state + teamName + teamLogo) — always shown if any of these are visible
  // Step 1: Leader (iglName + iglId + whatsapp + email) — shown if any visible
  // Step 2: Squad (player2-4 names/ids) — shown if either squadNames or squadIds is visible
  // Step 3: Payment (utr + proof + declaration) — shown if utr or paymentProof visible
  const stepDefs: { key: string; label: string; visible: boolean }[] = [
    { key: "team", label: "Team", visible: vis(fc, "state") || vis(fc, "teamName") || vis(fc, "teamLogo") },
    { key: "igl", label: "Leader", visible: vis(fc, "iglName") || vis(fc, "iglId") || vis(fc, "whatsapp") || vis(fc, "email") },
    { key: "squad", label: "Squad", visible: vis(fc, "squadNames") || vis(fc, "squadIds") },
    { key: "pay", label: "Pay", visible: vis(fc, "utrNumber") || vis(fc, "paymentProof") },
  ];
  const activeSteps = stepDefs.filter(s => s.visible);
  const activeStepLabels = activeSteps.map(s => s.label);
  const activeStepKey = activeSteps[step]?.key ?? "team";

  /* ── Validation per active step ── */
  const canNextForStep = (): boolean => {
    switch (activeStepKey) {
      case "team": {
        const stateOk = !req(fc, "state") || state !== "";
        const nameOk = !req(fc, "teamName") || teamName.trim().length >= 2;
        return stateOk && nameOk;
      }
      case "igl": {
        const nameOk = !req(fc, "iglName") || iglName.trim() !== "";
        const idOk = !req(fc, "iglId") || iglId.trim() !== "";
        const waOk = !req(fc, "whatsapp") || whatsapp.trim().length >= 10;
        const emOk = !req(fc, "email") || email.includes("@");
        return nameOk && idOk && waOk && emOk;
      }
      case "squad": {
        const namesOk = !req(fc, "squadNames") || [p2Ign, p3Ign, p4Ign].every(v => v.trim() !== "");
        const idsOk = !req(fc, "squadIds") || [p2Id, p3Id, p4Id].every(v => v.trim() !== "");
        return namesOk && idsOk;
      }
      case "pay": {
        const utrOk = !req(fc, "utrNumber") || /^\d{12}$/.test(utrNumber.trim());
        const proofOk = !req(fc, "paymentProof") || paymentProof !== null;
        return declaration && utrOk && proofOk;
      }
      default:
        return true;
    }
  };

  /* ── Validation hint messages per step ── */
  const getStepHints = (): string[] => {
    const hints: string[] = [];
    switch (activeStepKey) {
      case "team":
        if (req(fc, "state") && state === "") hints.push("Select your state");
        if (req(fc, "teamName") && teamName.trim().length < 2) hints.push("Enter team name (min 2 chars)");
        break;
      case "igl":
        if (req(fc, "iglName") && iglName.trim() === "") hints.push("Enter in-game name");
        if (req(fc, "iglId") && iglId.trim() === "") hints.push("Enter BGMI player ID");
        if (req(fc, "whatsapp") && whatsapp.trim().length < 10) hints.push("Enter WhatsApp number");
        if (req(fc, "email") && !email.includes("@")) hints.push("Enter valid email");
        break;
      case "squad":
        if (req(fc, "squadNames") && ![p2Ign, p3Ign, p4Ign].every(v => v.trim())) hints.push("Enter all player names");
        if (req(fc, "squadIds") && ![p2Id, p3Id, p4Id].every(v => v.trim())) hints.push("Enter all player IDs");
        break;
      case "pay":
        if (req(fc, "utrNumber") && !/^\d{12}$/.test(utrNumber.trim())) hints.push("Enter 12-digit UTR number");
        if (req(fc, "paymentProof") && paymentProof === null) hints.push("Upload payment screenshot");
        if (!declaration) hints.push("Accept the declaration");
        break;
    }
    return hints;
  };

  const uploadFile = async (file: File, folder: string): Promise<string | null> => {
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", folder);
      const res = await fetch("/api/upload/public", { method: "POST", body: fd });
      if (res.ok) { const d = await res.json(); return d.url; }
    } catch { /* silent */ }
    return null;
  };

  const handleSubmit = async () => {
    if (!config) return;
    setSubmitting(true);
    try {
      // Upload files first
      let paymentProofUrl: string | undefined;
      let teamLogoUrl: string | undefined;

      if (paymentProof) {
        const url = await uploadFile(paymentProof, `payments/${config.slug}`);
        if (!url) { toast.error("Failed to upload payment screenshot"); setSubmitting(false); return; }
        paymentProofUrl = url;
      }
      if (teamLogo) {
        const url = await uploadFile(teamLogo, `logos/${config.slug}`);
        if (url) teamLogoUrl = url;
      }

      const res = await fetch("/api/tournament-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentSlug: config.slug,
          state: vis(fc, "state") ? state : undefined,
          teamName,
          teamLogoUrl,
          iglName,
          iglId: vis(fc, "iglId") ? iglId : undefined,
          whatsapp: vis(fc, "whatsapp") ? whatsapp : undefined,
          email: vis(fc, "email") ? email : undefined,
          player2Ign: vis(fc, "squadNames") ? p2Ign : undefined,
          player2Id: vis(fc, "squadIds") ? p2Id : undefined,
          player3Ign: vis(fc, "squadNames") ? p3Ign : undefined,
          player3Id: vis(fc, "squadIds") ? p3Id : undefined,
          player4Ign: vis(fc, "squadNames") ? p4Ign : undefined,
          player4Id: vis(fc, "squadIds") ? p4Id : undefined,
          extraPlayers: extraPlayers.length > 0 ? extraPlayers.filter(p => p.ign.trim()) : undefined,
          utrNumber: vis(fc, "utrNumber") ? utrNumber : undefined,
          paymentProofUrl,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Registration failed");
        setSubmitting(false);
        return;
      }
      setSubmitted(true);
      toast.success("Registration submitted!");
    } catch {
      toast.error("Network error. Please try again.");
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="tp-page" style={themeVars("#ec4899")}>
        <div className="tp-center">
          <div className="tp-loading">
            <div className="tp-spinner" />
            <span>Loading tournament…</span>
          </div>
        </div>
      </div>
    );
  }

  if (loadError || !config) {
    return (
      <div className="tp-page" style={themeVars("#ef4444")}>
        <div className="tp-center">
          <div className="tp-error-card">
            <div className="tp-error-icon">✕</div>
            <h1>Tournament Not Found</h1>
            <p>This tournament page doesn&apos;t exist or has been removed.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!config.isActive) {
    return (
      <div className="tp-page" style={themeVars(config.themeColor)}>
        <Particles style={config.particleStyle} color={config.themeColor} />
        <div className="tp-center">
          <div className="tp-error-card">
            <div className="tp-error-icon">⏰</div>
            <h1>Registration Closed</h1>
            <p>Registration for <strong>{config.name}</strong> is currently closed.</p>
          </div>
        </div>
      </div>
    );
  }

  const states = config.stateList.length > 0 ? config.stateList : ["Arunachal Pradesh", "Assam", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Tripura", "Sikkim"];

  if (submitted) {
    return (
      <div className="tp-page" style={themeVars(config.themeColor)}>
        <Particles style={config.particleStyle} color={config.themeColor} />
        <div className="tp-center">
          <div className="tp-success-card">
            <div className="tp-success-icon">✓</div>
            <h1>Registration Received!</h1>
            <p>Thank you <strong>{teamName}</strong></p>
            <div className="tp-s-rows">
              <div className="tp-s-row"><span>Team</span><strong>{teamName}</strong></div>
              {vis(fc, "iglName") && <div className="tp-s-row"><span>IGL</span><strong>{iglName}</strong></div>}
              {vis(fc, "state") && state && <div className="tp-s-row"><span>State</span><strong>{state}</strong></div>}
              {vis(fc, "utrNumber") && utrNumber && <div className="tp-s-row"><span>UTR / Ref</span><code className="tp-s-utr">{utrNumber}</code></div>}
              <div className="tp-s-row"><span>Status</span><span className="tp-s-badge">Pending</span></div>
            </div>
            <p className="tp-s-note">We&apos;ll verify your registration and confirm via WhatsApp.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="tp-page"
      style={{
        ...themeVars(config.themeColor),
        "--bg-image": config.backgroundUrl ? `url(${config.backgroundUrl})` : "none",
      } as React.CSSProperties}
    >
      <Particles style={config.particleStyle} color={config.themeColor} />

      <div className="tp-center">
        {/* Banner */}
        {config.bannerUrl && (
          <LoadingImage src={config.bannerUrl} alt={config.name} className="tp-banner" />
        )}

        {/* Info Bar */}
        <div className="tp-info-bar">
          {config.prizePool && (
            <>
              <div className="tp-ib-item"><span className="tp-ib-label">Prize Pool</span><span className="tp-ib-val gold">{config.prizePool}</span></div>
              <div className="tp-ib-sep" />
            </>
          )}
          {config.entryFee && (
            <>
              <div className="tp-ib-item"><span className="tp-ib-label">Entry Fee</span><span className="tp-ib-val">{config.entryFee}</span></div>
              <div className="tp-ib-sep" />
            </>
          )}
          {config.region && (
            <>
              <div className="tp-ib-item"><span className="tp-ib-label">Region</span><span className="tp-ib-val">{config.region}</span></div>
              <div className="tp-ib-sep" />
            </>
          )}
          {config.deadline && (
            <div className="tp-ib-item"><span className="tp-ib-label">Deadline</span><span className="tp-ib-val">{config.deadline}</span></div>
          )}
        </div>

        {config.bonusText && <p className="tp-bonus">{config.bonusText}</p>}

        {/* Quick Details */}
        <div className="tp-details">
          {config.gameMode && <div className="tp-fd-chip">{config.gameMode}</div>}
          {config.dateRange && <div className="tp-fd-chip">{config.dateRange}</div>}
          {config.eligibility && <div className="tp-fd-chip">{config.eligibility}</div>}
        </div>

        {/* About Section */}
        <div className="tp-about">
          <h2 className="tp-about-title">{config.name} {config.subtitle && <span>{config.subtitle}</span>}</h2>
          {config.description && <p className="tp-about-text">{config.description}</p>}
          <div className="tp-about-grid">
            {config.prizePool && (
              <div className="tp-about-item">
                <span className="tp-about-icon">💰</span>
                <div><strong>Prize Pool</strong><span>{config.prizePool}{config.bonusText ? ` ${config.bonusText}` : ""}</span></div>
              </div>
            )}
            {config.eligibility && (
              <div className="tp-about-item">
                <span className="tp-about-icon">📍</span>
                <div><strong>Eligibility</strong><span>{config.termsEligibility || config.eligibility}</span></div>
              </div>
            )}
            {config.termsExtra && (
              <div className="tp-about-item">
                <span className="tp-about-icon">⚠️</span>
                <div><strong>Terms</strong><span>{config.termsExtra}</span></div>
              </div>
            )}
          </div>
          <p className="tp-about-cta">Ready to dominate? Fill out the registration below accurately to secure your slot!</p>
        </div>

        {/* ── Form ── */}
        <div className="tp-card">
          <h2 className="tp-card-title">Register Your Squad</h2>

          {/* Steps */}
          <div className="tp-steps">
            {activeStepLabels.map((t, i) => (
              <div key={i} className={`tp-stp ${i < step ? "done" : ""} ${i === step ? "cur" : ""}`}>
                <div className="tp-stp-dot">
                  {i < step ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <span>{i + 1}</span>
                  )}
                </div>
                <span className="tp-stp-label">{t}</span>
              </div>
            ))}
            <div className="tp-stp-track"><div className="tp-stp-fill" style={{ width: `${(step / Math.max(activeSteps.length - 1, 1)) * 100}%` }} /></div>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); if (step < activeSteps.length - 1) setStep(step + 1); else handleSubmit(); }}>

            {/* ── STEP: Team ── */}
            {activeStepKey === "team" && (
              <div className="tp-form-step">
                {vis(fc, "state") && (
                  <div className="tp-field">
                    <FieldLabel text="State" fieldKey="state" fc={fc} />
                    <div className="tp-state-grid">
                      {states.map(s => (
                        <button key={s} type="button" className={`tp-st-chip ${state === s ? "sel" : ""}`} onClick={() => setState(s)}>
                          <span className="tp-st-radio" />{s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {vis(fc, "teamName") && (
                  <div className="tp-field">
                    <FieldLabel text="Team Name" fieldKey="teamName" fc={fc} />
                    <input id="tn" className="tp-fi" placeholder="Your squad name" value={teamName} onChange={e => setTeamName(e.target.value)} />
                  </div>
                )}
                {vis(fc, "teamLogo") && (
                  <div className="tp-field">
                    <FieldLabel text="Team Logo" fieldKey="teamLogo" fc={fc} />
                    <FileZone id="tl" label="Upload logo" hint="PNG, JPG · max 100 MB" accept="image/*" file={teamLogo} onFile={setTeamLogo} maxMB={100} />
                  </div>
                )}
              </div>
            )}

            {/* ── STEP: IGL ── */}
            {activeStepKey === "igl" && (
              <div className="tp-form-step">
                <div className="tp-row2">
                  {vis(fc, "iglName") && (
                    <div className="tp-field">
                      <FieldLabel text="In-Game Name" fieldKey="iglName" fc={fc} />
                      <input className="tp-fi" placeholder="IGN" value={iglName} onChange={e => setIglName(e.target.value)} />
                    </div>
                  )}
                  {vis(fc, "iglId") && (
                    <div className="tp-field">
                      <FieldLabel text="BGMI Player ID" fieldKey="iglId" fc={fc} />
                      <input className="tp-fi" placeholder="Numeric ID" value={iglId} onChange={e => setIglId(e.target.value)} />
                    </div>
                  )}
                </div>
                {vis(fc, "whatsapp") && (
                  <div className="tp-field">
                    <FieldLabel text="WhatsApp Number" fieldKey="whatsapp" fc={fc} />
                    <input className="tp-fi" type="tel" placeholder="+91 XXXXX XXXXX" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} />
                  </div>
                )}
                {vis(fc, "email") && (
                  <div className="tp-field">
                    <FieldLabel text="Email" fieldKey="email" fc={fc} />
                    <input className="tp-fi" type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} />
                  </div>
                )}
              </div>
            )}

            {activeStepKey === "squad" && (
              <div className="tp-form-step">
                {/* Max 5 total: IGL + Player 2-4 + 1 sub */}
                {[{ l: "Player 2", ig: p2Ign, sI: setP2Ign, pi: p2Id, sP: setP2Id },
                  { l: "Player 3", ig: p3Ign, sI: setP3Ign, pi: p3Id, sP: setP3Id },
                  { l: "Player 4", ig: p4Ign, sI: setP4Ign, pi: p4Id, sP: setP4Id }].map((p, idx) => (
                  <div key={p.l} className="tp-player-block">
                    <span className="tp-pb-label">{p.l}</span>
                    <div className="tp-row2">
                      {vis(fc, "squadNames") && (
                        <input className="tp-fi" placeholder="In-Game Name" value={p.ig}
                          onChange={e => {
                            p.sI(e.target.value);
                            if (idx === 2 && e.target.value.trim() && extraPlayers.length === 0 && extraPlayers.length < 1) {
                              setExtraPlayers([{ ign: "", id: "" }]);
                            }
                          }} />
                      )}
                      {vis(fc, "squadIds") && (
                        <input className="tp-fi" placeholder="BGMI ID" value={p.pi}
                          onChange={e => {
                            p.sP(e.target.value);
                            if (idx === 2 && e.target.value.trim() && extraPlayers.length === 0 && extraPlayers.length < 1 && !vis(fc, "squadNames")) {
                              setExtraPlayers([{ ign: "", id: "" }]);
                            }
                          }} />
                      )}
                    </div>
                  </div>
                ))}
                {extraPlayers.map((ep, idx) => (
                  <div key={`extra-${idx}`} className="tp-player-block" style={{ animation: "fadeSlideIn 200ms ease" }}>
                    <div className="tp-pb-label" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span>Player {5 + idx}</span>
                      <button type="button" onClick={() => setExtraPlayers(prev => prev.filter((_, i) => i !== idx))} style={{ background: "none", border: "none", color: "var(--tp-muted)", fontSize: "12px", cursor: "pointer", padding: "2px 6px", opacity: 0.6 }}>✕</button>
                    </div>
                    <div className="tp-row2">
                      {vis(fc, "squadNames") && (
                        <input className="tp-fi" placeholder="In-Game Name" value={ep.ign}
                          onChange={e => {
                            const v = e.target.value;
                            setExtraPlayers(prev => prev.map((p, i) => i === idx ? { ...p, ign: v } : p));
                            if (idx === extraPlayers.length - 1 && v.trim() && extraPlayers.length < 1) {
                              setExtraPlayers(prev => [...prev, { ign: "", id: "" }]);
                            }
                          }}
                          onBlur={() => {
                            setExtraPlayers(prev => {
                              const cleaned = [...prev];
                              while (cleaned.length > 0 && !cleaned[cleaned.length - 1].ign.trim() && !cleaned[cleaned.length - 1].id.trim()) {
                                cleaned.pop();
                              }
                              return cleaned;
                            });
                          }}
                        />
                      )}
                      {vis(fc, "squadIds") && (
                        <input className="tp-fi" placeholder="BGMI ID" value={ep.id}
                          onChange={e => {
                            const v = e.target.value;
                            setExtraPlayers(prev => prev.map((p, i) => i === idx ? { ...p, id: v } : p));
                            if (!vis(fc, "squadNames") && idx === extraPlayers.length - 1 && v.trim() && extraPlayers.length < 1) {
                              setExtraPlayers(prev => [...prev, { ign: "", id: "" }]);
                            }
                          }}
                          onBlur={() => {
                            if (!vis(fc, "squadNames")) {
                              setExtraPlayers(prev => {
                                const cleaned = [...prev];
                                while (cleaned.length > 0 && !cleaned[cleaned.length - 1].ign.trim() && !cleaned[cleaned.length - 1].id.trim()) {
                                  cleaned.pop();
                                }
                                return cleaned;
                              });
                            }
                          }}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── STEP: Payment ── */}
            {activeStepKey === "pay" && (
              <div className="tp-form-step">
                <h3 className="tp-pay-title">Payment Verification</h3>
                <p className="tp-pay-instructions">Please pay the entry fee of <strong>{config.entryFee || "the required amount"}</strong> to the official tournament UPI ID / QR Code below.</p>

                {/* QR */}
                {(config.qrImageUrl || config.upiId) && (
                  <div className="tp-qr-section">
                    {config.qrImageUrl && (
                      <div className="tp-qr-wrap">
                        <LoadingImage src={config.qrImageUrl} alt="Payment QR" className="tp-qr-img" />
                      </div>
                    )}
                    <div className="tp-qr-bottom">
                      {config.upiId && (
                        <div className="tp-qr-upi-row">
                          <code>{config.upiId}</code>
                          <button type="button" className="tp-copy-btn" onClick={() => { navigator.clipboard.writeText(config.upiId!); toast.success("Copied!"); }}>
                            Copy
                          </button>
                        </div>
                      )}
                      {config.entryFee && <span className="tp-qr-amt">Amount: <strong>{config.entryFee}</strong></span>}
                    </div>
                  </div>
                )}

                {vis(fc, "utrNumber") && (
                  <div className="tp-field">
                    <div className="tp-fl-row">
                      <FieldLabel text="12-Digit UPI Transaction ID / UTR" fieldKey="utrNumber" fc={fc} />
                      <button
                        type="button"
                        className={`tp-hint-btn ${shaking && req(fc, "utrNumber") && !/^\d{12}$/.test(utrNumber.trim()) ? "tp-glow" : ""}`}
                        onClick={() => setShowUtrHelp(true)}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        Where to find this?
                      </button>
                    </div>
                    <input
                      id="utr"
                      className={`tp-fi tp-utr-input ${shaking && req(fc, "utrNumber") && !/^\d{12}$/.test(utrNumber.trim()) ? "tp-shake" : ""}`}
                      placeholder="Enter 12-digit UTR (e.g. 664195439987)"
                      value={utrNumber}
                      maxLength={12}
                      inputMode="numeric"
                      onChange={e => setUtrNumber(e.target.value.replace(/\D/g, '').slice(0, 12))}
                    />
                    <div className="tp-utr-counter-row">
                      <span className="tp-utr-pending">Must be 12 digits</span>
                      <span className={`tp-utr-count ${utrNumber.length === 12 ? "done" : ""}`}>{utrNumber.length}/12</span>
                    </div>
                  </div>
                )}

                {vis(fc, "paymentProof") && (
                  <div className="tp-field">
                    <FieldLabel text="Payment Screenshot" fieldKey="paymentProof" fc={fc} />
                    <FileZone id="pp" label="Upload payment screenshot" hint="PNG, JPG · max 10 MB" accept="image/*" file={paymentProof} onFile={setPaymentProof} maxMB={10} />
                  </div>
                )}

                <label className="tp-decl">
                  <input type="checkbox" checked={declaration} onChange={e => setDeclaration(e.target.checked)} />
                  <span className="tp-decl-box" />
                  <span className="tp-decl-text">I confirm all details are accurate and all players are eligible representatives of the selected state. False info may lead to disqualification.</span>
                </label>
              </div>
            )}

            {/* Nav */}
            <div className="tp-form-btns">
              {step > 0 && <button type="button" className="tp-btn-secondary" onClick={() => setStep(step - 1)}>← Back</button>}
              <div style={{ position: 'relative', flex: 1 }}>
                <button type="submit" className={`tp-btn-primary ${!canNextForStep() ? "off" : ""}`} disabled={!canNextForStep() || submitting} style={{ width: '100%' }}>
                  {submitting ? "Submitting…" : step < activeSteps.length - 1 ? "Continue →" : "Submit Registration"}
                </button>
                {!canNextForStep() && !submitting && (
                  <div
                    style={{ position: 'absolute', inset: 0, cursor: 'pointer', zIndex: 2 }}
                    onClick={() => {
                      setShaking(true);
                      setTimeout(() => setShaking(false), 600);
                    }}
                  />
                )}
              </div>
            </div>
          </form>
        </div>

        {/* Terms */}
        {(config.termsEligibility || config.termsDates || config.termsExtra) && (
          <div className="tp-terms">
            {config.termsEligibility && (
              <div className="tp-term-block">
                <strong>Eligibility</strong>
                <span>{config.termsEligibility}</span>
              </div>
            )}
            {config.termsDates && (
              <div className="tp-term-block">
                <strong>Dates</strong>
                <span>{config.termsDates}</span>
              </div>
            )}
            {config.termsExtra && (
              <div className="tp-term-block">
                <strong>Terms</strong>
                <span>{config.termsExtra}</span>
              </div>
            )}
          </div>
        )}

        {config.footerText && (
          <footer className="tp-foot">{config.footerText}</footer>
        )}
      </div>

      {/* ── UTR Visual Guide Modal ── */}
      {showUtrHelp && (
        <div className="tp-utr-modal-overlay" onClick={() => setShowUtrHelp(false)}>
          <div className="tp-utr-modal-card" onClick={e => e.stopPropagation()}>
            <div className="tp-utr-modal-head">
              <div>
                <h3 className="tp-utr-modal-title">12-Digit UPI Transaction ID</h3>
                <p className="tp-utr-modal-sub">Look for the 12 digits shown on your receipt</p>
              </div>
              <button type="button" className="tp-utr-modal-close" onClick={() => setShowUtrHelp(false)} aria-label="Close">✕</button>
            </div>
            <div className="tp-utr-modal-body">
              <div className="tp-utr-app-bar">
                <span className="tp-app-tag"><b>GPay:</b> UPI transaction ID</span>
                <span className="tp-app-tag"><b>PhonePe:</b> UTR</span>
                <span className="tp-app-tag"><b>Paytm:</b> UPI Ref No.</span>
              </div>
              <div className="tp-utr-sample-wrap">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/upi-id-guide.png" alt="UPI transaction ID receipt example" className="tp-utr-sample-img" />
              </div>
            </div>
            <div className="tp-utr-modal-foot">
              <button type="button" className="tp-btn-primary tp-utr-got-it" onClick={() => setShowUtrHelp(false)}>
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
