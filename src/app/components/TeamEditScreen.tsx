"use client";
import React, { useRef } from "react";
import { ChevronDown, Save, Trash2, Pencil, Phone, Tag, TrendingUp, X, BarChart2, Trophy, Hash, ListOrdered, UserPlus, Plus, Minus, ImageIcon, Camera } from "lucide-react";
import { Team, Tournament } from "@/lib/types";

interface EditForm { name: string; tags: string; players: string; phone: string; logo: string; }

interface Props {
  team: Team;
  tournament: Tournament;
  editTeamForm: EditForm;
  setEditTeamForm: (fn: (f: EditForm) => EditForm) => void;
  showTeamDetails: boolean;
  setShowTeamDetails: (fn: (v: boolean) => boolean) => void;
  editingPlayerIdx: number | null;
  setEditingPlayerIdx: (v: number | null) => void;
  save: (t: Tournament) => void;
  onSave: () => void;
  onClose: () => void;
}

export default function TeamEditScreen({
  team, tournament, editTeamForm, setEditTeamForm,
  showTeamDetails, setShowTeamDetails,
  editingPlayerIdx, setEditingPlayerIdx,
  save, onSave, onClose,
}: Props) {
  const liveTeam = tournament.teams.find((t) => t.id === team.id) || team;
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX = 256;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else { w = Math.round(w * MAX / h); h = MAX; }
        }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/webp", 0.8);
        setEditTeamForm((f) => ({ ...f, logo: dataUrl }));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const removeLogo = () => {
    setEditTeamForm((f) => ({ ...f, logo: "" }));
  };

  // Use editTeamForm.logo for preview (pending state), not liveTeam.logo
  const displayLogo = editTeamForm.logo;

  const standing = tournament.geminiData?.groups.find((g) => {
    const assignedId = tournament.assignments?.[g.group];
    return assignedId === liveTeam.id;
  });
  const pp = standing?.totals.totalPlacementPoints ?? 0;
  const kp = standing?.totals.totalKills ?? 0;
  const tp = standing?.totals.totalPoints ?? 0;
  const wins = standing?.totals.chickenDinners ?? 0;
  const matchCount = standing?.matches.length ?? 0;

  const statPill = (icon: React.ReactNode, label: string, val: number | string) => (
    <div className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2.5 rounded-2xl" style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.07)" }}>
      <div className="h-7 w-7 rounded-full flex items-center justify-center shrink-0" style={{ background:"rgba(124,58,237,0.25)" }}>{icon}</div>
      <div className="min-w-0"><p className="text-[9px] font-bold tracking-widest" style={{ color:"rgba(139,92,246,0.7)" }}>{label}</p><p className="text-sm font-bold text-white">{val}</p></div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] flex flex-col anim-fade-in" style={{ background:"#0d0820" }}>
      {/* Hidden file input */}
      <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-12 pb-4 shrink-0">
        <button onClick={onClose} className="p-2 rounded-xl press-scale" style={{ background:"rgba(255,255,255,0.06)" }}>
          <ChevronDown className="h-5 w-5 text-white rotate-90" />
        </button>
        <p className="text-base font-bold text-white truncate mx-3 flex-1 text-center min-w-0">{liveTeam.name}</p>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={onSave} className="flex items-center gap-2 px-5 py-2 rounded-full font-semibold text-sm press-scale" style={{ background:"rgba(139,92,246,0.25)", border:"1px solid rgba(139,92,246,0.4)", color:"#c4b5fd" }}>
            <Save className="h-4 w-4" /> Save
          </button>
          <button onClick={() => { save({ ...tournament, teams: tournament.teams.filter((t) => t.id !== liveTeam.id) }); onClose(); }} className="p-2 rounded-xl press-scale" style={{ background:"rgba(239,68,68,0.1)", color:"rgba(239,68,68,0.7)" }}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Team Logo */}
      <div className="flex items-center gap-4 px-5 pb-4">
        <button
          onClick={() => logoInputRef.current?.click()}
          className="relative h-16 w-16 rounded-2xl shrink-0 overflow-hidden press-scale group"
          style={{ background: displayLogo ? "transparent" : "rgba(124,58,237,0.15)", border: displayLogo ? "2px solid rgba(124,58,237,0.3)" : "2px dashed rgba(124,58,237,0.35)" }}
        >
          {displayLogo ? (
            <>
              <img src={displayLogo} alt="Team logo" className="h-full w-full object-cover" />
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="h-5 w-5 text-white" />
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full w-full gap-0.5">
              <ImageIcon className="h-5 w-5" style={{ color:"#8b5cf6" }} />
              <p className="text-[7px] font-semibold" style={{ color:"rgba(196,181,253,0.6)" }}>Add Logo</p>
            </div>
          )}
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-bold text-white truncate">{liveTeam.name}</p>
          {displayLogo && (
            <button onClick={removeLogo} className="text-[10px] font-medium mt-0.5 press-scale" style={{ color:"rgba(239,68,68,0.6)" }}>
              Remove logo
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 pb-32">
        {/* Collapsible details */}
        <button onClick={() => setShowTeamDetails(v => !v)} className="w-full flex items-center justify-between px-4 py-3 rounded-2xl mb-3 press-scale" style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)" }}>
          <span className="text-sm font-semibold" style={{ color:"rgba(196,181,253,0.7)" }}>Team details</span>
          <ChevronDown className="h-4 w-4 transition-transform duration-200" style={{ color:"rgba(196,181,253,0.5)", transform: showTeamDetails ? "rotate(180deg)" : "rotate(0deg)" }} />
        </button>

        {showTeamDetails && (
          <div className="space-y-3 mb-5">
            <div className="flex items-center gap-3 min-w-0">
              <p className="text-sm font-medium w-20 shrink-0" style={{ color:"rgba(196,181,253,0.6)" }}>Name</p>
              <div className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2.5 rounded-2xl overflow-hidden" style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)" }}>
                <Pencil className="h-3.5 w-3.5 shrink-0" style={{ color:"rgba(196,181,253,0.4)" }} />
                <input 
                  value={editTeamForm.name} 
                  onChange={(e) => setEditTeamForm((f) => ({ ...f, name: e.target.value }))} 
                  onBlur={() => {
                    const updated = { ...tournament, teams: tournament.teams.map((t) => t.id === liveTeam.id ? { ...t, name: editTeamForm.name.trim() || liveTeam.name } : t) };
                    save(updated);
                  }}
                  className="flex-1 bg-transparent text-white text-sm focus:outline-none min-w-0" 
                  style={{ caretColor:"#a78bfa" }} 
                />
              </div>
            </div>
            <div className="flex items-center gap-3 min-w-0">
              <p className="text-sm font-medium w-20 shrink-0" style={{ color:"rgba(196,181,253,0.6)" }}>Phone</p>
              <div className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2.5 rounded-2xl overflow-hidden" style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)" }}>
                <Phone className="h-3.5 w-3.5 shrink-0" style={{ color:"rgba(196,181,253,0.4)" }} />
                <input 
                  type="tel" 
                  value={editTeamForm.phone} 
                  onChange={(e) => setEditTeamForm((f) => ({ ...f, phone: e.target.value }))} 
                  onBlur={() => {
                    const updated = { ...tournament, teams: tournament.teams.map((t) => t.id === liveTeam.id ? { ...t, phone: editTeamForm.phone.trim() } : t) };
                    save(updated);
                  }}
                  placeholder="Leader phone" 
                  className="flex-1 bg-transparent text-white text-sm focus:outline-none min-w-0" 
                  style={{ caretColor:"#a78bfa" }} 
                />
              </div>
            </div>
            <div className="flex items-center gap-3 min-w-0">
              <p className="text-sm font-medium w-20 shrink-0" style={{ color:"rgba(196,181,253,0.6)" }}>Tags</p>
              <div className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2.5 rounded-2xl overflow-hidden" style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)" }}>
                <Tag className="h-3.5 w-3.5 shrink-0" style={{ color:"rgba(196,181,253,0.4)" }} />
                <input 
                  value={editTeamForm.tags} 
                  onChange={(e) => setEditTeamForm((f) => ({ ...f, tags: e.target.value }))} 
                  onBlur={() => {
                    const updated = { ...tournament, teams: tournament.teams.map((t) => t.id === liveTeam.id ? { ...t, tags: editTeamForm.tags.split(",").map(tg=>tg.trim()).filter(Boolean) } : t) };
                    save(updated);
                  }}
                  placeholder="Tags" 
                  className="flex-1 bg-transparent text-white text-sm focus:outline-none min-w-0" 
                  style={{ caretColor:"#a78bfa" }} 
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1">
              {statPill(<TrendingUp className="h-3.5 w-3.5" style={{ color:"#a78bfa" }} />, "PP", pp)}
              {statPill(<X className="h-3.5 w-3.5" style={{ color:"#a78bfa" }} />, "KP", kp)}
              {statPill(<BarChart2 className="h-3.5 w-3.5" style={{ color:"#a78bfa" }} />, "TP", tp)}
              {statPill(<Trophy className="h-3.5 w-3.5" style={{ color:"#a78bfa" }} />, "WIN", wins)}
              {statPill(<Hash className="h-3.5 w-3.5" style={{ color:"#a78bfa" }} />, "MP", matchCount)}
            </div>
          </div>
        )}

        {/* Edit Players */}
        <div className="rounded-2xl overflow-hidden mb-4" style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-center text-sm font-semibold text-white py-3" style={{ borderBottom:"1px solid rgba(255,255,255,0.06)" }}>Edit Players</p>
          {(liveTeam.players ?? []).map((player, pi) => (
            <div key={pi} className="flex items-center gap-3 px-4 py-2.5" style={{ borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
              <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0" style={{ background:"rgba(124,58,237,0.15)", border:"1px solid rgba(124,58,237,0.2)" }}>
                <UserPlus className="h-3.5 w-3.5" style={{ color:"rgba(196,181,253,0.4)" }} />
              </div>
              <div className="flex-1 min-w-0">
                {editingPlayerIdx === pi ? (
                  <input
                    autoFocus
                    defaultValue={player}
                    onBlur={(e) => {
                      const val = e.target.value.trim();
                      const newPlayers = [...(liveTeam.players ?? [])];
                      if (val) newPlayers[pi] = val; else newPlayers.splice(pi, 1);
                      const updated = { ...tournament, teams: tournament.teams.map((t) => t.id === liveTeam.id ? { ...t, players: newPlayers } : t) };
                      save(updated);
                      setEditingPlayerIdx(null);
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                    className="w-full bg-transparent text-sm text-white focus:outline-none border-b border-violet-500/40"
                  />
                ) : (
                  <p className="text-sm font-semibold text-white truncate" onClick={() => setEditingPlayerIdx(pi)} style={{ cursor: "text" }}>{player}</p>
                )}
              </div>
              <button onClick={() => {
                const newPlayers = (liveTeam.players ?? []).filter((_, i) => i !== pi);
                const updated = { ...tournament, teams: tournament.teams.map((t) => t.id === liveTeam.id ? { ...t, players: newPlayers } : t) };
                save(updated); setEditingPlayerIdx(null);
              }} className="p-1 shrink-0" style={{ color: "rgba(239,68,68,0.5)" }}><Minus className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          <button onClick={() => {
            const newPlayers = [...(liveTeam.players ?? []), ""];
            const updated = { ...tournament, teams: tournament.teams.map((t) => t.id === liveTeam.id ? { ...t, players: newPlayers } : t) };
            save(updated);
            setEditingPlayerIdx(newPlayers.length - 1);
          }} className="w-full py-3 flex items-center justify-center gap-2 text-sm font-medium" style={{ color:"rgba(196,181,253,0.5)" }}>
            <Plus className="h-4 w-4" /> Add a player
          </button>
        </div>
        <button className="w-full text-center text-sm font-semibold py-2" style={{ color:"#a78bfa" }}>Show team gfx</button>
      </div>
    </div>
  );
}
