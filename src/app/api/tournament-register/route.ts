import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

/* ── Field config helpers ── */
type FieldVisibility = "required" | "optional" | "hidden";

interface FieldConfig {
  state: FieldVisibility;
  teamName: FieldVisibility;
  teamLogo: FieldVisibility;
  iglName: FieldVisibility;
  iglId: FieldVisibility;
  whatsapp: FieldVisibility;
  email: FieldVisibility;
  squadNames: FieldVisibility;
  squadIds: FieldVisibility;
  utrNumber: FieldVisibility;
  paymentProof: FieldVisibility;
}

const DEFAULT_FC: FieldConfig = {
  state: "required",
  teamName: "required",
  teamLogo: "optional",
  iglName: "required",
  iglId: "required",
  whatsapp: "required",
  email: "required",
  squadNames: "required",
  squadIds: "required",
  utrNumber: "required",
  paymentProof: "required",
};

function getFC(raw: Record<string, string> | null | undefined): FieldConfig {
  if (!raw) return { ...DEFAULT_FC };
  const result = { ...DEFAULT_FC };
  for (const key of Object.keys(DEFAULT_FC) as (keyof FieldConfig)[]) {
    if (raw[key] === "required" || raw[key] === "optional" || raw[key] === "hidden") {
      result[key] = raw[key] as FieldVisibility;
    }
  }
  return result;
}

function isRequired(fc: FieldConfig, key: keyof FieldConfig) { return fc[key] === "required"; }

// POST — submit a registration (public, no auth required)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      tournamentSlug,
      state,
      teamName,
      teamLogoUrl,
      iglName,
      iglId,
      whatsapp,
      email,
      player2Ign,
      player2Id,
      player3Ign,
      player3Id,
      player4Ign,
      player4Id,
      extraPlayers,
      utrNumber,
      paymentProofUrl,
    } = body;

    if (!tournamentSlug || !teamName || !iglName) {
      return Response.json({ error: "Missing required fields (tournamentSlug, teamName, iglName)" }, { status: 400 });
    }

    // Find tournament + its field config
    const tournament = await prisma.tournamentPage.findUnique({
      where: { slug: tournamentSlug },
      select: { id: true, isActive: true, fieldConfig: true },
    });
    if (!tournament) return Response.json({ error: "Tournament not found" }, { status: 404 });
    if (!tournament.isActive) return Response.json({ error: "Registration is closed" }, { status: 400 });

    const fc = getFC(tournament.fieldConfig as Record<string, string> | null);

    // Validate based on field config
    if (isRequired(fc, "state") && !state) {
      return Response.json({ error: "State is required" }, { status: 400 });
    }
    if (isRequired(fc, "iglId") && !iglId) {
      return Response.json({ error: "BGMI Player ID is required" }, { status: 400 });
    }
    if (isRequired(fc, "whatsapp") && (!whatsapp || whatsapp.trim().length < 10)) {
      return Response.json({ error: "WhatsApp number is required" }, { status: 400 });
    }
    if (isRequired(fc, "email") && (!email || !email.includes("@"))) {
      return Response.json({ error: "Valid email is required" }, { status: 400 });
    }
    if (isRequired(fc, "squadNames")) {
      if (!player2Ign || !player3Ign || !player4Ign) {
        return Response.json({ error: "All squad member names are required" }, { status: 400 });
      }
    }
    if (isRequired(fc, "squadIds")) {
      if (!player2Id || !player3Id || !player4Id) {
        return Response.json({ error: "All squad member IDs are required" }, { status: 400 });
      }
    }
    if (isRequired(fc, "utrNumber")) {
      if (!utrNumber || !/^\d{12}$/.test(utrNumber)) {
        return Response.json({ error: "Valid 12-digit UTR required" }, { status: 400 });
      }
    }

    const registration = await prisma.tournamentRegistration.create({
      data: {
        tournamentId: tournament.id,
        state: state || null,
        teamName,
        teamLogoUrl: teamLogoUrl || null,
        iglName,
        iglId: iglId || null,
        whatsapp: whatsapp || null,
        email: email || null,
        player2Ign: player2Ign || null,
        player2Id: player2Id || null,
        player3Ign: player3Ign || null,
        player3Id: player3Id || null,
        player4Ign: player4Ign || null,
        player4Id: player4Id || null,
        extraPlayers: Array.isArray(extraPlayers) && extraPlayers.length > 0 ? extraPlayers.slice(0, 2) : undefined,
        utrNumber: utrNumber || null,
        paymentProofUrl: paymentProofUrl || null,
      },
    });

    return Response.json({ registration: { id: registration.id, status: registration.status } }, { status: 201 });
  } catch (err) {
    console.error("Registration error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
