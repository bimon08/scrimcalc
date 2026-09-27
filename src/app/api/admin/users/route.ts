import { NextResponse } from "next/server";
import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";

const ADMIN_EMAIL = "bimonlangnongsiej@gmail.com";

/** GET /api/admin/users — list all users (admin only) */
export async function GET() {
  const session = await auth();
  if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      role: true,
      subscriptionEnd: true,
      pendingPlanDays: true,
      createdAt: true,
      _count: { select: { savedTournaments: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ users });
}

/** PUT /api/admin/users — update subscription for a user (admin only)
 *  Body: { userId: string, days: number } — extends subscription by N days from now
 *        { userId: string, revoke: true }  — revokes subscription immediately
 */
export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json();
  const { userId, days, revoke } = body as { userId: string; days?: number; revoke?: boolean };

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  if (revoke) {
    // Set subscription to past date
    await prisma.user.update({
      where: { id: userId },
      data: { subscriptionEnd: new Date(0) },
    });
    return NextResponse.json({ success: true, message: "Subscription revoked" });
  }

  if (!days || days <= 0) {
    return NextResponse.json({ error: "days must be > 0" }, { status: 400 });
  }

  // Store as a pending plan — user activates it themselves
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  await prisma.user.update({
    where: { id: userId },
    data: { pendingPlanDays: days },
  });

  return NextResponse.json({
    success: true,
    pendingPlanDays: days,
    message: `${days}-day plan assigned — user will activate it on their next login`,
  });
}
