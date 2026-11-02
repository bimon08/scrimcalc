import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { resolveAuth } from "@/lib/resolveAuth";

/**
 * GET /api/tournament-pages/by-tournament?ids=id1,id2,...
 * Returns a map of savedTournamentId → { slug, pageId, regCount }
 * for the current user's tournament pages.
 */
export async function GET(req: Request) {
  const caller = await resolveAuth(req);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const ids = url.searchParams.get("ids")?.split(",").filter(Boolean) ?? [];
  if (ids.length === 0) return NextResponse.json({ pages: {} });

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
