import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@root/auth";

async function isAdmin() {
  const session = await auth();
  if (!session?.user?.id) return false;
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  return user?.role === "ADMIN";
}

// GET — public: fetch by slug (?slug=xxx), admin: fetch all
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");

  if (slug) {
    const page = await prisma.tournamentPage.findUnique({
      where: { slug },
      include: { _count: { select: { registrations: true } } },
    });
    if (!page) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ page });
  }

  // List all — admin only
  if (!(await isAdmin())) return Response.json({ error: "Forbidden" }, { status: 403 });
  const pages = await prisma.tournamentPage.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { registrations: true } } },
  });
  return Response.json({ pages });
}

// POST — create
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return Response.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const { slug, name, ...rest } = body;
  if (!slug || !name) return Response.json({ error: "slug and name required" }, { status: 400 });

  // Check slug uniqueness
  const existing = await prisma.tournamentPage.findUnique({ where: { slug } });
  if (existing) return Response.json({ error: "Slug already exists" }, { status: 409 });

  const page = await prisma.tournamentPage.create({
    data: { slug, name, ...rest },
  });
  return Response.json({ page }, { status: 201 });
}

// PUT — update
export async function PUT(req: NextRequest) {
  if (!(await isAdmin())) return Response.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const { id, ...data } = body;
  if (!id) return Response.json({ error: "id required" }, { status: 400 });

  const page = await prisma.tournamentPage.update({
    where: { id },
    data,
  });
  return Response.json({ page });
}

// DELETE
export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) return Response.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await req.json();
  if (!id) return Response.json({ error: "id required" }, { status: 400 });

  await prisma.tournamentPage.delete({ where: { id } });
  return Response.json({ success: true });
}
