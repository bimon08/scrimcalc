"use client";

import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import "./festival-cup.css";

const NE_STATES = ["Arunachal Pradesh", "Assam", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Tripura", "Sikkim"] as const;

/* ── Petals ── */
function Petals() {
  return (
    <div className="petals-container" aria-hidden="true">
      {Array.from({ length: 15 }).map((_, i) => (
        <span key={i} className="petal" style={{
          "--size": `${10 + Math.random() * 18}px`, "--left": `${Math.random() * 100}%`,
          "--delay": `${Math.random() * 16}s`, "--dur": `${8 + Math.random() * 10}s`,
          "--drift": `${-80 + Math.random() * 160}px`, "--rot": `${Math.random() * 360}deg`,
          "--sway": `${30 + Math.random() * 60}px`,
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
    <div className={`drop-zone ${file ? "has-file" : ""}`} onClick={() => ref.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f && f.size <= maxMB * 1024 * 1024) onFile(f); else toast.error(`Max ${maxMB} MB`); }}>
      <input ref={ref} id={id} type="file" accept={accept} className="sr-only"
        onChange={(e) => { const f = e.target.files?.[0]; if (f && f.size <= maxMB * 1024 * 1024) onFile(f); else if (f) toast.error(`Max ${maxMB} MB`); }} />
      {file && preview ? (
        <div className="file-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {file.type.startsWith("image/") ? <img src={preview} alt="" className="preview-img" /> : <div className="file-icon-box">PDF</div>}
          <div className="file-meta"><span className="file-name">{file.name}</span><span className="file-size">{(file.size / 1024 / 1024).toFixed(1)} MB</span></div>
          <button type="button" className="remove-btn" onClick={(e) => { e.stopPropagation(); onFile(null); if (ref.current) ref.current.value = ""; }}>✕</button>
        </div>
      ) : (
        <div className="drop-empty">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <span className="drop-text">{label}</span>
          <span className="drop-sub">{hint}</span>
        </div>
      )}
    </div>
  );
}

/* ── Main ── */
export default function FestivalCupPage() {
  const isDev = process.env.NODE_ENV === "development";
  const [state, setState] = useState(isDev ? "Assam" : "");
  const [teamName, setTeamName] = useState(isDev ? "iQOO Soul" : "");
  const [teamLogo, setTeamLogo] = useState<File | null>(null);
  const [iglName, setIglName] = useState(isDev ? "SouLAman" : "");
  const [iglId, setIglId] = useState(isDev ? "5124897630" : "");
  const [whatsapp, setWhatsapp] = useState(isDev ? "+91 98765 43210" : "");
  const [email, setEmail] = useState(isDev ? "soul.esports@gmail.com" : "");
  const [p2Ign, setP2Ign] = useState(isDev ? "SouLRegaltos" : ""); const [p2Id, setP2Id] = useState(isDev ? "5198342671" : "");
  const [p3Ign, setP3Ign] = useState(isDev ? "SouLViper" : ""); const [p3Id, setP3Id] = useState(isDev ? "5287431960" : "");
  const [p4Ign, setP4Ign] = useState(isDev ? "SouLRonak" : ""); const [p4Id, setP4Id] = useState(isDev ? "5301278465" : "");
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [declaration, setDeclaration] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(0);

  const canNext = [
    () => state !== "" && teamName.trim().length >= 2,
    () => iglName.trim() !== "" && iglId.trim() !== "" && whatsapp.trim().length >= 10 && email.includes("@"),
    () => [p2Ign, p2Id, p3Ign, p3Id, p4Ign, p4Id].every(v => v.trim() !== ""),
    () => declaration,
  ];

  const handleSubmit = async () => {
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 2000));
    setSubmitting(false);
    setSubmitted(true);
    toast.success("Registration submitted!");
  };

  if (submitted) {
    return (
      <div className="fc-page"><Petals />
        <div className="fc-center">
          <div className="success-card">
            <div className="success-icon">✓</div>
            <h1>Registration Received!</h1>
            <p>Thank you <strong>{teamName}</strong></p>
            <div className="s-rows">
              <div className="s-row"><span>Team</span><strong>{teamName}</strong></div>
              <div className="s-row"><span>IGL</span><strong>{iglName}</strong></div>
              <div className="s-row"><span>State</span><strong>{state}</strong></div>
              <div className="s-row"><span>Status</span><span className="s-badge">Pending</span></div>
            </div>
            <p className="s-note">We&apos;ll verify your payment and confirm via WhatsApp.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fc-page">
      <Petals />

      <div className="fc-center">
        {/* Banner */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/festival-cup-banner.png" alt="Festival Cup" className="fc-banner" />

        {/* Info Bar */}
        <div className="fc-info-bar">
          <div className="ib-item"><span className="ib-label">Prize Pool</span><span className="ib-val gold">₹10,000</span></div>
          <div className="ib-sep" />
          <div className="ib-item"><span className="ib-label">Entry Fee</span><span className="ib-val">₹400</span></div>
          <div className="ib-sep" />
          <div className="ib-item"><span className="ib-label">Region</span><span className="ib-val">Northeast</span></div>
          <div className="ib-sep" />
          <div className="ib-item"><span className="ib-label">Deadline</span><span className="ib-val">21 Oct</span></div>
        </div>

        <p className="fc-bonus">+ 4 Cherry Blossom Festival Passes for the Winning Squad</p>

        {/* Quick Details */}
        <div className="fc-details">
          <div className="fd-chip">BGMI · Squad</div>
          <div className="fd-chip">24 Oct — 7 Nov</div>
          <div className="fd-chip">NE States Only</div>
        </div>

        {/* About Section */}
        <div className="fc-about">
          <h2 className="about-title">Festival Cup <span>by Jubilant Divine Esports</span></h2>
          <p className="about-text">Welcome to the Festival Cup! Gather your squad, prove your skills, and battle it out for massive rewards and an unforgettable festival experience.</p>
          <div className="about-grid">
            <div className="about-item">
              <span className="about-icon">💰</span>
              <div><strong>Prize Pool</strong><span>₹10,000 + 4 Free Cherry Blossom Festival Tickets for the winners</span></div>
            </div>
            <div className="about-item">
              <span className="about-icon">📍</span>
              <div><strong>Eligibility</strong><span>Northeast region exclusive — strictly region-locked</span></div>
            </div>
            <div className="about-item">
              <span className="about-icon">⚠️</span>
              <div><strong>Terms</strong><span>Festival tickets are non-transferable and cannot be exchanged for cash. Entry fee ₹400/team. False info = DQ.</span></div>
            </div>
          </div>
          <p className="about-cta">Ready to dominate? Fill out the registration below accurately to secure your slot!</p>
        </div>

        {/* ── Form ── */}
        <div className="fc-card">
          <h2 className="fc-card-title">Register Your Squad</h2>

          {/* Steps */}
          <div className="fc-steps">
            {["Team", "IGL", "Squad", "Pay"].map((t, i) => (
              <div key={i} className={`stp ${i < step ? "done" : ""} ${i === step ? "cur" : ""}`}>
                <div className="stp-dot">{i < step ? "✓" : i + 1}</div>
                <span>{t}</span>
              </div>
            ))}
            <div className="stp-line"><div className="stp-fill" style={{ width: `${(step / 3) * 100}%` }} /></div>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); if (step < 3) setStep(step + 1); else handleSubmit(); }}>

            {step === 0 && (
              <div className="form-step">
                <div className="field">
                  <label className="fl">State <span className="req">*</span></label>
                  <div className="state-grid">
                    {NE_STATES.map(s => (
                      <button key={s} type="button" className={`st-chip ${state === s ? "sel" : ""}`} onClick={() => setState(s)}>
                        <span className="st-radio" />{s}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="tn" className="fl">Team Name <span className="req">*</span></label>
                  <input id="tn" className="fi" placeholder="Your squad name" value={teamName} onChange={e => setTeamName(e.target.value)} />
                </div>
                <div className="field">
                  <label className="fl">Team Logo <span className="opt">(optional)</span></label>
                  <FileZone id="tl" label="Upload logo" hint="PNG, JPG · max 100 MB" accept="image/*" file={teamLogo} onFile={setTeamLogo} maxMB={100} />
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="form-step">
                <div className="row2">
                  <div className="field"><label className="fl">In-Game Name <span className="req">*</span></label>
                    <input className="fi" placeholder="IGN" value={iglName} onChange={e => setIglName(e.target.value)} /></div>
                  <div className="field"><label className="fl">BGMI Player ID <span className="req">*</span></label>
                    <input className="fi" placeholder="Numeric ID" value={iglId} onChange={e => setIglId(e.target.value)} /></div>
                </div>
                <div className="field"><label className="fl">WhatsApp Number <span className="req">*</span></label>
                  <input className="fi" type="tel" placeholder="+91 XXXXX XXXXX" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} /></div>
                <div className="field"><label className="fl">Email <span className="req">*</span></label>
                  <input className="fi" type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} /></div>
              </div>
            )}

            {step === 2 && (
              <div className="form-step">
                {[{ l: "Player 2", ig: p2Ign, sI: setP2Ign, pi: p2Id, sP: setP2Id },
                  { l: "Player 3", ig: p3Ign, sI: setP3Ign, pi: p3Id, sP: setP3Id },
                  { l: "Player 4", ig: p4Ign, sI: setP4Ign, pi: p4Id, sP: setP4Id }].map(p => (
                  <div key={p.l} className="player-block">
                    <span className="pb-label">{p.l}</span>
                    <div className="row2">
                      <input className="fi" placeholder="In-Game Name" value={p.ig} onChange={e => p.sI(e.target.value)} />
                      <input className="fi" placeholder="BGMI ID" value={p.pi} onChange={e => p.sP(e.target.value)} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {step === 3 && (
              <div className="form-step">
                <h3 className="pay-title">Payment Verification</h3>
                <p className="pay-instructions">Please pay the entry fee of <strong>₹400</strong> to the official tournament UPI ID / QR Code below.</p>

                {/* QR */}
                <div className="qr-section">
                  <div className="qr-wrap-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/images/payment-qr.jpg" alt="Payment QR — DJ Wanshan" className="qr-img-full" />
                  </div>
                  <div className="qr-bottom">
                    <div className="qr-upi-row">
                      <code>alandysuchiang@oksbi</code>
                      <button type="button" className="copy-btn" onClick={() => { navigator.clipboard.writeText("alandysuchiang@oksbi"); toast.success("Copied!"); }}>
                        Copy
                      </button>
                    </div>
                    <span className="qr-amt">Amount: <strong>₹400</strong></span>
                  </div>
                </div>

                <div className="field">
                  <label className="fl">Payment Screenshot <span className="req">*</span></label>
                  <p className="pay-note">Upload your payment image here for confirmation. Make sure the screenshot clearly shows the <strong>UTR / Transaction ID</strong>.</p>
                  <FileZone id="pp" label="Upload payment screenshot" hint="Image or PDF · max 10 MB" accept="image/*,.pdf" file={paymentProof} onFile={setPaymentProof} maxMB={10} />
                </div>

                <label className="decl">
                  <input type="checkbox" checked={declaration} onChange={e => setDeclaration(e.target.checked)} />
                  <span className="decl-box" />
                  <span className="decl-text">I confirm all details are accurate and all players are eligible representatives of the selected state. False info may lead to disqualification.</span>
                </label>
              </div>
            )}

            {/* Nav */}
            <div className="form-btns">
              {step > 0 && <button type="button" className="btn-secondary" onClick={() => setStep(step - 1)}>← Back</button>}
              <button type="submit" className={`btn-primary ${!canNext[step]() ? "off" : ""}`} disabled={!canNext[step]() || submitting}>
                {submitting ? "Submitting…" : step < 3 ? "Continue →" : "Submit Registration"}
              </button>
            </div>
          </form>
        </div>

        {/* Terms */}
        <div className="fc-terms">
          <div className="term-block">
            <strong>Eligibility</strong>
            <span>Northeast region exclusive · Squad of 4 · BGMI</span>
          </div>
          <div className="term-block">
            <strong>Dates</strong>
            <span>24th October — 7th November</span>
          </div>
          <div className="term-block">
            <strong>Terms</strong>
            <span>4 Cherry Blossom Festival tickets for winners are non-transferable and cannot be exchanged for cash · ₹400/team · False info = DQ</span>
          </div>
        </div>

        <footer className="fc-foot">
          Festival Cup · Hosted by Jubilant Divine Esports
        </footer>
      </div>
    </div>
  );
}
