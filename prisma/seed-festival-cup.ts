/**
 * Seed: Cherry Blossom Festival Cup
 * 
 * Creates the default "festival-cup" tournament in the database if it doesn't exist.
 * Run with: npx tsx prisma/seed-festival-cup.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const FESTIVAL_CUP_SLUG = "festival-cup";

async function main() {
  const existing = await prisma.tournamentPage.findUnique({
    where: { slug: FESTIVAL_CUP_SLUG },
  });

  if (existing) {
    console.log(`✅ Tournament "${FESTIVAL_CUP_SLUG}" already exists (id: ${existing.id}). Skipping.`);
    return;
  }

  const page = await prisma.tournamentPage.create({
    data: {
      slug: FESTIVAL_CUP_SLUG,
      name: "Cherry Blossom Festival Cup",
      subtitle: "by Jubilant Divine Esports",
      description:
        "Join the biggest BGMI tournament celebrating the Cherry Blossom season in Northeast India! Compete against the best squads from across 8 NE states for a prize pool of ₹10,000 plus exclusive Cherry Blossom Festival passes.",
      themeColor: "#ec4899",
      particleStyle: "petals",
      prizePool: "₹10,000",
      entryFee: "₹400",
      entryFeeAmount: 400,
      region: "Northeast",
      deadline: "21 Oct",
      bonusText: "+ 4 Cherry Blossom Festival Passes for the winning squad",
      gameMode: "BGMI · Squad",
      dateRange: "24 Oct — 7 Nov",
      eligibility: "NE States Only",
      stateList: [
        "Arunachal Pradesh",
        "Assam",
        "Manipur",
        "Meghalaya",
        "Mizoram",
        "Nagaland",
        "Tripura",
        "Sikkim",
      ],
      upiId: "alandysuchiang@oksbi",
      termsEligibility:
        "Open to residents of the 8 NE states (Arunachal Pradesh, Assam, Manipur, Meghalaya, Mizoram, Nagaland, Tripura, Sikkim). Squad of 4 players. BGMI only.",
      termsDates: "Registration: Until 21 Oct · Matches: 24 Oct — 7 Nov",
      termsExtra:
        "Entry fee of ₹400 per squad (non-refundable). Cheating, hacking or emulators → instant DQ. Festival passes are non-transferable.",
      footerText: "Cherry Blossom Festival Cup · Hosted by Jubilant Divine Esports",
      isActive: true,
      fieldConfig: {
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
      },
    },
  });

  console.log(`🌸 Created "${page.name}" tournament (id: ${page.id}, slug: ${page.slug})`);
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
