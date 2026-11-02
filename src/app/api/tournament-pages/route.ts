import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@root/auth";
import { uniqueSlug } from "@/lib/slugify";

/** Get the current user's ID + subscription status (active = admin OR unexpired sub/trial) */
async function getActiveUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, subscriptionEnd: true },
  });
  if (!user) return null;

  const isAdmin = user.role === "ADMIN";
  let isActive = isAdmin;
  if (!isAdmin && user.subscriptionEnd) {
    isActive = new Date(user.subscriptionEnd).getTime() > Date.now();
  }
  return { id: user.id, isAdmin, isActive };
}

// GET — fetch pages for the current user (?slug=xxx for public lookup)
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");

  // Public: lookup by slug (for the /tournament/[slug] page)
  if (slug) {
    const page = await prisma.tournamentPage.findUnique({
      where: { slug },
      include: { _count: { select: { registrations: true } } },
    });
    if (!page) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ page });
  }

  // Authenticated: list this user's own pages only
  const user = await getActiveUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const pages = await prisma.tournamentPage.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { registrations: true } } },
  });
  return Response.json({ pages });
}

// POST — create a new tournament page (paid users + admin)
export async function POST(req: NextRequest) {
  const user = await getActiveUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isActive) return Response.json({ error: "Subscription expired" }, { status: 403 });

  const body = await req.json();
  const { name, savedTournamentId, ...rest } = body;
  if (!name) return Response.json({ error: "name required" }, { status: 400 });

  // Generate slug from name
  const slug = body.slug || await uniqueSlug(name);

  // If slug was manually specified, check uniqueness
  if (body.slug) {
    const existing = await prisma.tournamentPage.findUnique({ where: { slug } });
    if (existing) return Response.json({ error: "Slug already exists" }, { status: 409 });
  }

  const page = await prisma.tournamentPage.create({
    data: {
      slug,
      name,
      userId: user.id,
      savedTournamentId: savedTournamentId || null,
      ...rest,
    },
  });
  return Response.json({ page }, { status: 201 });
}

// PUT — update (owner or admin)
export async function PUT(req: NextRequest) {
  const user = await getActiveUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isActive) return Response.json({ error: "Subscription expired" }, { status: 403 });

  const body = await req.json();
  const { id, ...data } = body;
  if (!id) return Response.json({ error: "id required" }, { status: 400 });

  // Verify ownership (admin can edit any)
  const page = await prisma.tournamentPage.findUnique({ where: { id }, select: { userId: true } });
  if (!page) return Response.json({ error: "Not found" }, { status: 404 });
  if (!user.isAdmin && page.userId !== user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await prisma.tournamentPage.update({
    where: { id },
    data,
  });
  return Response.json({ page: updated });
}

// DELETE
export async function DELETE(req: NextRequest) {
  const user = await getActiveUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return Response.json({ error: "id required" }, { status: 400 });

  // Verify ownership
  const page = await prisma.tournamentPage.findUnique({ where: { id }, select: { userId: true } });
  if (!page) return Response.json({ error: "Not found" }, { status: 404 });
  if (!user.isAdmin && page.userId !== user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.tournamentPage.delete({ where: { id } });
  return Response.json({ success: true });
}
