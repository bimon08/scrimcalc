import { NextResponse } from "next/server";
import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";

/** POST /api/subscription/activate — user activates their pending plan */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (!user.pendingPlanDays || user.pendingPlanDays <= 0) {
    return NextResponse.json({ error: "No pending plan to activate" }, { status: 400 });
  }

  const days = user.pendingPlanDays;
  const now = new Date();

  // If there's an active subscription, extend from its end date
  const currentEnd = user.subscriptionEnd && user.subscriptionEnd > now
    ? user.subscriptionEnd
    : now;
  const newEnd = new Date(currentEnd);
  newEnd.setDate(newEnd.getDate() + days);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      subscriptionEnd: newEnd,
      pendingPlanDays: null, // clear the pending plan
      isTrial: false,       // paid plan activated, no longer trial
    },
  });

  return NextResponse.json({
    success: true,
    subscriptionEnd: newEnd.toISOString(),
    days,
    message: `${days}-day plan activated! Expires ${newEnd.toLocaleDateString("en-IN")}`,
  });
}
