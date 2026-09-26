"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authFetch } from "@/lib/authFetch";
import { Crown, ChevronLeft, RefreshCw, Clock, UserCheck, UserX, Search } from "lucide-react";
import { toast } from "sonner";

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: string;
  subscriptionEnd: string | null;
  createdAt: string;
  _count: { savedTournaments: number };
}

const DURATION_OPTIONS = [
  { label: "7 days", days: 7 },
  { label: "1 month", days: 30 },
  { label: "3 months", days: 90 },
  { label: "6 months", days: 180 },
  { label: "1 year", days: 365 },
];

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/admin/users");
      if (res.status === 403) { router.push("/"); return; }
      const data = await res.json();
      setUsers(data.users ?? []);
    } catch { toast.error("Failed to load users"); }
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const extendSub = async (userId: string, days: number) => {
    setActionLoading(userId);
    try {
      const res = await authFetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, days }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        fetchUsers();
      } else {
        toast.error(data.error || "Failed");
      }
    } catch { toast.error("Failed"); }
    setActionLoading(null);
  };

  const revokeSub = async (userId: string) => {
    setActionLoading(userId);
    try {
      const res = await authFetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, revoke: true }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Subscription revoked");
        fetchUsers();
      }
    } catch { toast.error("Failed"); }
    setActionLoading(null);
  };

  const getSubStatus = (u: UserRow) => {
    if (u.role === "ADMIN") return { label: "Admin", color: "#fbbf24", active: true };
    if (!u.subscriptionEnd) return { label: "No sub", color: "#6b7280", active: false };
    const end = new Date(u.subscriptionEnd);
    const days = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days > 0) return { label: `${days}d left`, color: days <= 3 ? "#f97316" : "#4ade80", active: true };
    return { label: "Expired", color: "#ef4444", active: false };
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return u.email.toLowerCase().includes(q) || (u.name?.toLowerCase().includes(q) ?? false);
  });

  if (!session) return null;

  return (
    <div className="min-h-screen pb-24" style={{ background: "#0c0914" }}>
      {/* Header */}
      <div className="px-4 pt-10 pb-5 sticky top-0 z-10 backdrop-blur-md" style={{ background: "rgba(12,9,20,0.9)", borderBottom: "1px solid rgba(124,58,237,0.15)" }}>
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => router.push("/")} className="p-1.5 rounded-lg" style={{ color: "rgba(167,139,250,0.5)" }}>
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-black text-white flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-400" /> Admin
            </h1>
            <p className="text-[10px]" style={{ color: "rgba(167,139,250,0.45)" }}>{users.length} users</p>
          </div>
          <button onClick={fetchUsers} className="p-2 rounded-lg" style={{ color: "rgba(167,139,250,0.5)" }}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: "rgba(167,139,250,0.35)" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-transparent text-sm text-white placeholder-zinc-600 focus:outline-none"
            style={{ background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.15)" }}
          />
        </div>
      </div>

      {/* Users list */}
      <div className="px-4 pt-4 space-y-2">
        {loading && users.length === 0 ? (
          <div className="flex justify-center py-16">
            <div className="h-6 w-6 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center py-12 text-sm text-zinc-600">No users found</p>
        ) : (
          filtered.map((u) => {
            const sub = getSubStatus(u);
            const isProcessing = actionLoading === u.id;
            return (
              <div key={u.id} className="rounded-xl p-3.5 space-y-2.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(124,58,237,0.1)" }}>
                {/* User info row */}
                <div className="flex items-center gap-3">
                  {u.image ? (
                    <img src={u.image} className="h-9 w-9 rounded-full ring-1 ring-zinc-700 shrink-0" alt="" />
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-zinc-800 flex items-center justify-center text-sm font-bold text-zinc-400 shrink-0">
                      {u.name?.[0] ?? "?"}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{u.name ?? "—"}</p>
                    <p className="text-[10px] text-zinc-500 truncate">{u.email}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${sub.color}15`, color: sub.color }}>
                      {sub.label}
                    </span>
                    <p className="text-[9px] text-zinc-600 mt-0.5">{u._count.savedTournaments} tournaments</p>
                  </div>
                </div>

                {/* Action buttons — not for admin */}
                {u.role !== "ADMIN" && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {DURATION_OPTIONS.map((opt) => (
                      <button
                        key={opt.days}
                        onClick={() => extendSub(u.id, opt.days)}
                        disabled={isProcessing}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all active:scale-95 disabled:opacity-40"
                        style={{ background: "rgba(124,58,237,0.1)", color: "#c4b5fd", border: "1px solid rgba(124,58,237,0.2)" }}
                      >
                        +{opt.label}
                      </button>
                    ))}
                    {sub.active && (
                      <button
                        onClick={() => revokeSub(u.id)}
                        disabled={isProcessing}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all active:scale-95 disabled:opacity-40 ml-auto"
                        style={{ background: "rgba(239,68,68,0.08)", color: "#f87171", border: "1px solid rgba(239,68,68,0.15)" }}
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
