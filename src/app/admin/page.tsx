"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authFetch } from "@/lib/authFetch";
import { Crown, ChevronLeft, RefreshCw, Clock, UserCheck, UserX, Search, Activity, Zap, Image, Timer, AlertTriangle, BarChart3 } from "lucide-react";
import { toast } from "sonner";

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: string;
  subscriptionEnd: string | null;
  pendingPlanDays: number | null;
  createdAt: string;
  _count: { savedTournaments: number };
}

interface UsageSummary {
  totalCalls: number;
  successCalls: number;
  errorCalls: number;
  totalImages: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  avgDurationMs: number;
}

interface UsagePerUser {
  userId: string;
  email: string;
  calls: number;
  images: number;
  inputTokens: number;
  outputTokens: number;
  errors: number;
}

interface UsageRecent {
  id: string;
  userEmail: string;
  model: string;
  imageCount: number;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  status: string;
  errorMessage: string | null;
  createdAt: string;
}

interface UsageData {
  period: { days: number; since: string };
  summary: UsageSummary;
  perUser: UsagePerUser[];
  perModel: { model: string; calls: number; inputTokens: number; outputTokens: number }[];
  daily: { date: string; calls: number; images: number; tokens: number }[];
  recent: UsageRecent[];
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
  const [activeTab, setActiveTab] = useState<"users" | "usage">("users");

  // Usage state
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageDays, setUsageDays] = useState(30);

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

  const fetchUsage = async (days: number) => {
    setUsageLoading(true);
    try {
      const res = await authFetch(`/api/admin/usage?days=${days}`);
      if (res.ok) {
        const data = await res.json();
        setUsageData(data);
      } else {
        toast.error("Failed to load usage data");
      }
    } catch { toast.error("Failed to load usage data"); }
    setUsageLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);
  useEffect(() => {
    if (activeTab === "usage") fetchUsage(usageDays);
  }, [activeTab, usageDays]);

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
    if (u.pendingPlanDays) return { label: `Pending ${u.pendingPlanDays}d`, color: "#60a5fa", active: false };
    if (!u.subscriptionEnd) return { label: "No sub", color: "#6b7280", active: false };
    const end = new Date(u.subscriptionEnd);
    const msLeft = end.getTime() - Date.now();
    const days = Math.floor(msLeft / (1000 * 60 * 60 * 24));
    if (msLeft > 0) {
      const displayLabel = days > 0
        ? `${days}d left`
        : `${Math.floor((msLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))}h left`;
      return { label: displayLabel, color: days <= 3 ? "#f97316" : "#4ade80", active: true };
    }
    return { label: "Expired", color: "#ef4444", active: false };
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return u.email.toLowerCase().includes(q) || (u.name?.toLowerCase().includes(q) ?? false);
  });

  const formatTokens = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toString();
  };

  const formatDuration = (ms: number) => {
    if (ms >= 60000) return `${(ms / 60000).toFixed(1)}m`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatTimeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  if (!session) return null;

  return (
    <div className="min-h-screen pb-24" style={{ background: "#0c0914" }}>
      {/* Header */}
      <div className="px-4 pt-10 pb-3 sticky top-0 z-10 backdrop-blur-md" style={{ background: "rgba(12,9,20,0.9)", borderBottom: "1px solid rgba(124,58,237,0.15)" }}>
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
          <button
            onClick={() => activeTab === "users" ? fetchUsers() : fetchUsage(usageDays)}
            className="p-2 rounded-lg"
            style={{ color: "rgba(167,139,250,0.5)" }}
          >
            <RefreshCw className={`h-4 w-4 ${loading || usageLoading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 p-0.5 rounded-xl mb-3" style={{ background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.12)" }}>
          <button
            onClick={() => setActiveTab("users")}
            className="flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5"
            style={{
              background: activeTab === "users" ? "rgba(124,58,237,0.2)" : "transparent",
              color: activeTab === "users" ? "#c4b5fd" : "rgba(167,139,250,0.4)",
              border: activeTab === "users" ? "1px solid rgba(124,58,237,0.3)" : "1px solid transparent",
            }}
          >
            <UserCheck className="h-3.5 w-3.5" /> Users
          </button>
          <button
            onClick={() => setActiveTab("usage")}
            className="flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5"
            style={{
              background: activeTab === "usage" ? "rgba(124,58,237,0.2)" : "transparent",
              color: activeTab === "usage" ? "#c4b5fd" : "rgba(167,139,250,0.4)",
              border: activeTab === "usage" ? "1px solid rgba(124,58,237,0.3)" : "1px solid transparent",
            }}
          >
            <Activity className="h-3.5 w-3.5" /> API Usage
          </button>
        </div>

        {/* Search — only for Users tab */}
        {activeTab === "users" && (
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
        )}
      </div>

      {/* Tab Content */}
      <div className="px-4 pt-4">
        {activeTab === "users" ? (
          /* ======== USERS TAB ======== */
          <div className="space-y-2">
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
        ) : (
          /* ======== USAGE TAB ======== */
          <div className="space-y-4">
            {/* Time range selector */}
            <div className="flex gap-1.5">
              {[7, 30, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setUsageDays(d)}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all"
                  style={{
                    background: usageDays === d ? "rgba(124,58,237,0.2)" : "rgba(124,58,237,0.06)",
                    color: usageDays === d ? "#c4b5fd" : "rgba(167,139,250,0.4)",
                    border: `1px solid ${usageDays === d ? "rgba(124,58,237,0.3)" : "rgba(124,58,237,0.1)"}`,
                  }}
                >
                  {d}d
                </button>
              ))}
            </div>

            {usageLoading && !usageData ? (
              <div className="flex justify-center py-16">
                <div className="h-6 w-6 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
              </div>
            ) : usageData ? (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-2 gap-2">
                  <StatCard icon={<Zap className="h-4 w-4" />} label="Total API Calls" value={usageData.summary.totalCalls.toString()} color="#a78bfa" />
                  <StatCard icon={<BarChart3 className="h-4 w-4" />} label="Total Tokens" value={formatTokens(usageData.summary.totalTokens)} sublabel={`In: ${formatTokens(usageData.summary.totalInputTokens)} / Out: ${formatTokens(usageData.summary.totalOutputTokens)}`} color="#60a5fa" />
                  <StatCard icon={<Image className="h-4 w-4" />} label="Images Processed" value={usageData.summary.totalImages.toString()} color="#4ade80" />
                  <StatCard icon={<Timer className="h-4 w-4" />} label="Avg Response" value={formatDuration(usageData.summary.avgDurationMs)} color="#fbbf24" />
                  <StatCard icon={<Activity className="h-4 w-4" />} label="Success Rate" value={usageData.summary.totalCalls > 0 ? `${((usageData.summary.successCalls / usageData.summary.totalCalls) * 100).toFixed(0)}%` : "—"} color="#4ade80" />
                  <StatCard icon={<AlertTriangle className="h-4 w-4" />} label="Errors" value={usageData.summary.errorCalls.toString()} color={usageData.summary.errorCalls > 0 ? "#f87171" : "#4ade80"} />
                </div>

                {/* Model breakdown */}
                {usageData.perModel.length > 0 && (
                  <div className="rounded-xl p-3.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(124,58,237,0.1)" }}>
                    <h3 className="text-xs font-bold text-zinc-400 mb-2 flex items-center gap-1.5">
                      <Zap className="h-3 w-3" /> Models Used
                    </h3>
                    <div className="space-y-1.5">
                      {usageData.perModel.map((m) => (
                        <div key={m.model} className="flex items-center justify-between">
                          <span className="text-[11px] font-mono text-violet-300">{m.model}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] text-zinc-500">{formatTokens(m.inputTokens + m.outputTokens)} tokens</span>
                            <span className="text-[11px] font-bold text-white">{m.calls} calls</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Per-user breakdown */}
                {usageData.perUser.length > 0 && (
                  <div className="rounded-xl p-3.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(124,58,237,0.1)" }}>
                    <h3 className="text-xs font-bold text-zinc-400 mb-2 flex items-center gap-1.5">
                      <UserCheck className="h-3 w-3" /> Usage by User
                    </h3>
                    <div className="space-y-2">
                      {usageData.perUser.map((u) => (
                        <div key={u.userId} className="flex items-center justify-between py-1.5" style={{ borderBottom: "1px solid rgba(124,58,237,0.06)" }}>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-bold text-white truncate">{u.email}</p>
                            <p className="text-[9px] text-zinc-500">{u.images} images · {formatTokens(u.inputTokens + u.outputTokens)} tokens</p>
                          </div>
                          <div className="text-right shrink-0 ml-2">
                            <span className="text-[11px] font-bold text-violet-300">{u.calls} calls</span>
                            {u.errors > 0 && (
                              <p className="text-[9px] text-red-400">{u.errors} errors</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent calls */}
                {usageData.recent.length > 0 && (
                  <div className="rounded-xl p-3.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(124,58,237,0.1)" }}>
                    <h3 className="text-xs font-bold text-zinc-400 mb-2 flex items-center gap-1.5">
                      <Clock className="h-3 w-3" /> Recent API Calls
                    </h3>
                    <div className="space-y-1.5">
                      {usageData.recent.map((r) => (
                        <div key={r.id} className="flex items-center gap-2 py-1.5" style={{ borderBottom: "1px solid rgba(124,58,237,0.05)" }}>
                          {/* Status dot */}
                          <div
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ background: r.status === "success" ? "#4ade80" : "#f87171" }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-white truncate">{r.userEmail.split("@")[0]}</span>
                              <span className="text-[9px] font-mono text-zinc-500">{r.model.replace("gemini-", "")}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[9px] text-zinc-600">
                              <span>{r.imageCount} img</span>
                              <span>{formatTokens(r.inputTokens + r.outputTokens)} tok</span>
                              <span>{formatDuration(r.durationMs)}</span>
                              {r.errorMessage && (
                                <span className="text-red-400 truncate">{r.errorMessage}</span>
                              )}
                            </div>
                          </div>
                          <span className="text-[9px] text-zinc-600 shrink-0">{formatTimeAgo(r.createdAt)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-center py-12 text-sm text-zinc-600">No usage data</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Reusable stat card component */
function StatCard({ icon, label, value, sublabel, color }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sublabel?: string;
  color: string;
}) {
  return (
    <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(124,58,237,0.1)" }}>
      <div className="flex items-center gap-1.5 mb-1" style={{ color: `${color}80` }}>
        {icon}
        <span className="text-[9px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-xl font-black" style={{ color }}>{value}</p>
      {sublabel && <p className="text-[9px] text-zinc-500 mt-0.5">{sublabel}</p>}
    </div>
  );
}

