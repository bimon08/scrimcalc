import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { resolveAuth } from "@/lib/resolveAuth";
import { uniqueSlug } from "@/lib/slugify";

/**
 * GET /api/tournament-pages/by-tournament?ids=id1,id2,...
 * Returns a map of savedTournamentId → { slug, pageId, regCount }
 * Auto-creates tournament pages for any that don't exist yet.
 */
export async function GET(req: Request) {
  const caller = await resolveAuth(req);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const ids = url.searchParams.get("ids")?.split(",").filter(Boolean) ?? [];
  if (ids.length === 0) return NextResponse.json({ pages: {} });

  // Fetch existing pages
  const pages = await prisma.tournamentPage.findMany({
    where: {
      userId: caller.userId,
      savedTournamentId: { in: ids },
    },
    select: {
      id: true,
      slug: true,
      savedTournamentId: true,
      isActive: true,
      _count: { select: { registrations: true } },
    },
  });

  const existingIds = new Set(pages.filter(p => p.savedTournamentId).map(p => p.savedTournamentId!));
  const missingIds = ids.filter(id => !existingIds.has(id));

  // Auto-create pages for tournaments that don't have one
  if (missingIds.length > 0) {
    // Fetch tournament names from SavedTournament
    const tournaments = await prisma.savedTournament.findMany({
      where: { id: { in: missingIds }, userId: caller.userId },
      select: { id: true, data: true, entryFee: true },
    });

    for (const t of tournaments) {
      try {
        const data = t.data as Record<string, unknown>;
        const name = (data?.name as string) || "Untitled Tournament";
        const slug = await uniqueSlug(name);
        const created = await prisma.tournamentPage.create({
          data: {
            slug,
            name,
            userId: caller.userId,
            savedTournamentId: t.id,
            entryFeeAmount: t.entryFee ?? 0,
            entryFee: t.entryFee ? `₹${t.entryFee}` : null,
            themeColor: "#8b5cf6",
            particleStyle: "sparks",
            isActive: true,
          },
        });
        pages.push({
          id: created.id,
          slug: created.slug,
          savedTournamentId: t.id,
          isActive: true,
          _count: { registrations: 0 },
        });
      } catch { /* slug collision or other — skip */ }
    }
  }

  const map: Record<string, { pageId: string; slug: string; isActive: boolean; regCount: number }> = {};
  for (const p of pages) {
    if (p.savedTournamentId) {
      map[p.savedTournamentId] = {
        pageId: p.id,
        slug: p.slug,
        isActive: p.isActive,
        regCount: p._count.registrations,
      };
    }
  }

  return NextResponse.json({ pages: map });
}
