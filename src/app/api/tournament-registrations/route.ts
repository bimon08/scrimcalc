import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@root/auth";

/** Get current user */
async function getUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return { id: session.user.id };
}

// GET /api/tournament-registrations?tournamentId=<savedTournamentId>
// Returns registrations for a tournament page linked to the given savedTournamentId
export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const tournamentId = req.nextUrl.searchParams.get("tournamentId");
  if (!tournamentId) return Response.json({ error: "tournamentId required" }, { status: 400 });

  // Find the tournament page linked to this saved tournament
  const page = await prisma.tournamentPage.findUnique({
    where: { savedTournamentId: tournamentId },
    select: { id: true, userId: true, name: true, slug: true },
  });
  if (!page) return Response.json({ error: "No registration page found" }, { status: 404 });
  if (page.userId !== user.id) return Response.json({ error: "Forbidden" }, { status: 403 });

  const registrations = await prisma.tournamentRegistration.findMany({
    where: { tournamentId: page.id },
    orderBy: { createdAt: "desc" },
  });

  const counts = {
    total: registrations.length,
    pending: registrations.filter(r => r.status === "PENDING").length,
    verified: registrations.filter(r => r.status === "VERIFIED").length,
    rejected: registrations.filter(r => r.status === "REJECTED").length,
  };

  return Response.json({ registrations, counts, page: { name: page.name, slug: page.slug } });
}

// PATCH /api/tournament-registrations — update registration status
export async function PATCH(req: NextRequest) {
  const user = await getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id, status } = await req.json();
  if (!id || !["VERIFIED", "REJECTED", "PENDING"].includes(status)) {
    return Response.json({ error: "id and valid status required" }, { status: 400 });
  }

  // Verify ownership through the tournament page
  const reg = await prisma.tournamentRegistration.findUnique({
    where: { id },
    select: { tournament: { select: { userId: true } } },
  });
  if (!reg) return Response.json({ error: "Not found" }, { status: 404 });
  if (reg.tournament.userId !== user.id) return Response.json({ error: "Forbidden" }, { status: 403 });

  const updated = await prisma.tournamentRegistration.update({
    where: { id },
    data: { status },
  });

  return Response.json({ registration: updated });
}
