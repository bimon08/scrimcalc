import { NextResponse } from "next/server";
import { resolveAuth } from "@/lib/resolveAuth";

/**
 * GET /api/ocr/config
 * Returns a Gemini API key and model list to authenticated users.
 * The browser makes the Gemini call directly (from the user's residential IP),
 * bypassing Vercel's cloud IP which Google rate-limits on free tier.
 */
export async function GET(req: Request) {
  const caller = await resolveAuth(req);
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKeys = (process.env.GEMINI_API_KEYS || process.env.GOOGLE_GEMINI_API_KEY || "")
    .split(",")
    .map(k => k.trim())
    .filter(Boolean);

  if (apiKeys.length === 0) {
    return NextResponse.json({ error: "No API keys configured" }, { status: 500 });
  }

  // Pick a random key for load distribution
  const key = apiKeys[Math.floor(Math.random() * apiKeys.length)];

  return NextResponse.json({
    key,
    models: [
      "gemini-3.8-flash",
      "gemini-3.7-flash",
      "gemini-3.6-flash",
      "gemini-3.5-flash",
    ],
  });
}
