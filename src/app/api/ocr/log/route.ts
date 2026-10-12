import { NextResponse } from "next/server";
import { resolveAuth } from "@/lib/resolveAuth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/ocr/log
 * Logs a successful client-side OCR call for usage tracking.
 */
export async function POST(req: Request) {
  const caller = await resolveAuth(req);
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { auth: getAuth } = await import("@root/auth");
    const session = await getAuth();
    const userEmail = session?.user?.email ?? "unknown";

    const body = await req.json();
    const { model, imageCount, inputTokens, outputTokens, durationMs, status, errorMessage } = body;

    await prisma.apiUsage.create({
      data: {
        userId: caller.userId,
        userEmail,
        model: model || "unknown",
        imageCount: imageCount || 0,
        inputTokens: inputTokens || 0,
        outputTokens: outputTokens || 0,
        durationMs: durationMs || 0,
        status: status || "success",
        errorMessage: errorMessage || undefined,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Failed to log OCR usage:", e);
    return NextResponse.json({ ok: false });
  }
}
