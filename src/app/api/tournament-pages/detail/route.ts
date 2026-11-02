import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@root/auth";

// GET /api/tournament-pages/detail?id=<pageId>
// Returns full page data for the owner
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });

  const page = await prisma.tournamentPage.findUnique({ where: { id } });
  if (!page) return Response.json({ error: "Not found" }, { status: 404 });
  if (page.userId !== session.user.id) return Response.json({ error: "Forbidden" }, { status: 403 });

  return Response.json({ page });
}
