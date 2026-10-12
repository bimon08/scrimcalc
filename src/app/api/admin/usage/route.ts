import { NextResponse } from "next/server";
import { auth } from "@root/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_EMAIL = "bimonlangnongsiej@gmail.com";

/** GET /api/admin/usage — get API usage statistics (admin only) */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

  const url = new URL(req.url);
  const days = parseInt(url.searchParams.get("days") || "30", 10);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Get all usage records in the time range
  const records = await prisma.apiUsage.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
  });

  // Aggregate stats
  const totalCalls = records.length;
  const successCalls = records.filter((r) => r.status === "success").length;
  const errorCalls = records.filter((r) => r.status === "error").length;
  const totalImages = records.reduce((sum, r) => sum + r.imageCount, 0);
  const totalInputTokens = records.reduce((sum, r) => sum + r.inputTokens, 0);
  const totalOutputTokens = records.reduce((sum, r) => sum + r.outputTokens, 0);
  const avgDuration = totalCalls > 0
    ? Math.round(records.reduce((sum, r) => sum + r.durationMs, 0) / totalCalls)
    : 0;

  // Per-user breakdown
  const userMap = new Map<string, {
    email: string;
    calls: number;
    images: number;
    inputTokens: number;
    outputTokens: number;
    errors: number;
  }>();

  for (const r of records) {
    const existing = userMap.get(r.userId) ?? {
      email: r.userEmail,
      calls: 0,
      images: 0,
      inputTokens: 0,
      outputTokens: 0,
      errors: 0,
    };
    existing.calls++;
    existing.images += r.imageCount;
    existing.inputTokens += r.inputTokens;
    existing.outputTokens += r.outputTokens;
    if (r.status === "error") existing.errors++;
    userMap.set(r.userId, existing);
  }

  const perUser = Array.from(userMap.entries())
    .map(([userId, stats]) => ({ userId, ...stats }))
    .sort((a, b) => b.calls - a.calls);

  // Per-model breakdown
  const modelMap = new Map<string, { calls: number; inputTokens: number; outputTokens: number }>();
  for (const r of records) {
    const existing = modelMap.get(r.model) ?? { calls: 0, inputTokens: 0, outputTokens: 0 };
    existing.calls++;
    existing.inputTokens += r.inputTokens;
    existing.outputTokens += r.outputTokens;
    modelMap.set(r.model, existing);
  }

  const perModel = Array.from(modelMap.entries())
    .map(([model, stats]) => ({ model, ...stats }))
    .sort((a, b) => b.calls - a.calls);

  // Daily breakdown (last N days)
  const dailyMap = new Map<string, { calls: number; images: number; tokens: number }>();
  for (const r of records) {
    const day = r.createdAt.toISOString().slice(0, 10);
    const existing = dailyMap.get(day) ?? { calls: 0, images: 0, tokens: 0 };
    existing.calls++;
    existing.images += r.imageCount;
    existing.tokens += r.inputTokens + r.outputTokens;
    dailyMap.set(day, existing);
  }

  const daily = Array.from(dailyMap.entries())
    .map(([date, stats]) => ({ date, ...stats }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Recent calls (last 20)
  const recent = records.slice(0, 20).map((r) => ({
    id: r.id,
    userEmail: r.userEmail,
    model: r.model,
    imageCount: r.imageCount,
    inputTokens: r.inputTokens,
    outputTokens: r.outputTokens,
    durationMs: r.durationMs,
    status: r.status,
    errorMessage: r.errorMessage,
    createdAt: r.createdAt.toISOString(),
  }));

  return NextResponse.json({
    period: { days, since: since.toISOString() },
    summary: {
      totalCalls,
      successCalls,
      errorCalls,
      totalImages,
      totalInputTokens,
      totalOutputTokens,
      totalTokens: totalInputTokens + totalOutputTokens,
      avgDurationMs: avgDuration,
    },
    perUser,
    perModel,
    daily,
    recent,
  });
  } catch (err: unknown) {
    console.error("Admin usage API error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
