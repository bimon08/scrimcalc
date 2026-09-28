"use client";

import { useState, useMemo } from "react";
import {
  Wallet,
  CalendarCheck,
  Trophy,
  LayoutGrid,
  Calculator,
  BarChart3,
  Users2,
  BookOpen,
  HelpCircle,
  Search,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Check,
  ShieldCheck,
  Share2,
  Flame,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface StepItem {
  title: string;
  desc: string;
  badge?: string;
}

interface GuideSection {
  id: string;
  category: string;
  title: string;
  icon: any;
  accent: string;
  description: string;
  routeHref?: string;
  routeLabel?: string;
  steps: StepItem[];
  tips?: string[];
}

interface FaqItem {
  q: string;
  a: string;
  category: string;
}

const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "wallet",
    category: "Finance & Dues",
    title: "Player Wallet & Ledger",
    icon: Wallet,
    accent: "#a78bfa",
    description:
      "Manage player entry fee dues, track payments, view transaction histories, and share individual zero-login payment statement links with players.",
    routeHref: "/wallet",
    routeLabel: "Go to Wallet",
    steps: [
      {
        title: "Open Player Wallet",
        desc: "Tap the hamburger menu in the top-left corner and select 'Player Wallet' to view all registered player ledgers and balances.",
        badge: "Step 1",
      },
      {
        title: "Create or Select a Player",
        desc: "Tap '+ Add Player' and input the player or clan leader's name and 10-digit mobile number. Phone numbers automatically link with tournament slot bookings.",
        badge: "Step 2",
      },
      {
        title: "Record 'Owes' (Debt) or 'Paid' (Credit)",
        desc: "Select a player card, tap '+ Add Entry', choose whether they 'Owe' entry fees or 'Paid' via UPI/Cash, enter the amount, and add an optional note (e.g. 'Daily Scrim Slot #4').",
        badge: "Step 3",
      },
      {
        title: "Share Private Statement Link (/pay/[token])",
        desc: "Copy the player's unique share link and send it via WhatsApp or Discord. The player can view their full ledger statement, UPI ID to pay, and book upcoming scrim slots without needing to create an account!",
        badge: "Step 4",
      },
      {
        title: "Sort & Filter by Outstanding Dues",
        desc: "Use the filter pills ('Debts', 'Credits', 'A-Z') or instant search to quickly see which players owe money before approving their slot.",
        badge: "Step 5",
      },
    ],
    tips: [
      "Negative balances (in red) mean the player owes you money.",
      "Positive balances (in green) mean the player has paid an advance or won prize money.",
      "Each player's payment URL is private and persistent—they can bookmark it to track all scrims.",
    ],
  },
  {
    id: "bookings",
    category: "Finance & Dues",
    title: "Slot Bookings & Online Registration",
    icon: CalendarCheck,
    accent: "#38bdf8",
    description:
      "Let players book tournament slots online through their payment link, register rosters, and deduct entry fees from their wallets in one click.",
    steps: [
      {
        title: "Set Entry Fee & Enable Bookings",
        desc: "On your tournament card, tap the 'Bookings' pill button. Enter the tournament entry fee (e.g. ₹50) and toggle Bookings to 'ON'.",
        badge: "Step 1",
      },
      {
        title: "Players Register from their Link",
        desc: "Players open their personal payment link (/pay/[token]). Active tournaments with open bookings will appear with a 'Book Slot' button where they input their Team Name and player roster.",
        badge: "Step 2",
      },
      {
        title: "Review Incoming Bookings",
        desc: "The Bookings modal displays all registered teams categorized as Confirmed, Pending, or Admin Booked. Teams with matched phone numbers link directly to player wallets.",
        badge: "Step 3",
      },
      {
        title: "Skip Invited or Excluded Teams",
        desc: "If an invited tier-1 team or sponsor team plays for free, tap 'Skip' next to their slot so their wallet balance is not debited.",
        badge: "Step 4",
      },
      {
        title: "One-Click 'Debit All'",
        desc: "Once registrations close, click 'Debit All'. ScrimCalc automatically deducts the entry fee from every eligible player's wallet and records timestamped transactions instantly!",
        badge: "Step 5",
      },
    ],
    tips: [
      "You can toggle Bookings 'Off' anytime to freeze incoming registrations.",
      "Players can update their submitted team name and roster directly from their payment link before scrims start.",
    ],
  },
  {
    id: "tournaments",
    category: "Tournaments",
    title: "Tournaments & Team Setup",
    icon: Trophy,
    accent: "#f59e0b",
    description:
      "Create scrim events, choose standard or custom point formats, import team lists, and manage player lineups.",
    routeHref: "/",
    routeLabel: "Go to Tournaments",
    steps: [
      {
        title: "Create a Tournament",
        desc: "Tap the floating '+' button on the home screen. Enter your tournament title, number of slots (e.g. 16, 20, 25), and total matches planned.",
        badge: "Step 1",
      },
      {
        title: "Select or Customize Point System",
        desc: "Pick BGMI Standard 10-point system, 15-point system, or configure a custom points distribution (points per placement rank and kill points).",
        badge: "Step 2",
      },
      {
        title: "Add Teams (Single or Fast Paste)",
        desc: "Add teams one by one with their logos and phone numbers, or use 'Paste Teams' to bulk import an entire text list from WhatsApp or Discord in seconds.",
        badge: "Step 3",
      },
      {
        title: "Manage Rosters & Group Splits",
        desc: "Add player IGNs under each team. For multi-pool qualifiers, enable Group Split to assign teams into Group A, Group B, or Waiting List.",
        badge: "Step 4",
      },
    ],
    tips: [
      "You can reorder teams or swap slots at any time by dragging or editing slot numbers.",
      "Toggling a team 'OUT' temporarily excludes them from matches without deleting their roster.",
    ],
  },
  {
    id: "slots",
    category: "Graphics & Broadcast",
    title: "Slot Lists & Graphic Posters",
    icon: LayoutGrid,
    accent: "#ec4899",
    description:
      "Generate broadcast-ready slot posters in 16:9 Landscape or 1:1 Square with custom starting slots, roster toggles, and clean export.",
    steps: [
      {
        title: "Open Slots View",
        desc: "On your tournament card, tap 'Slots' to view the visual team roster board.",
        badge: "Step 1",
      },
      {
        title: "Select Aspect Ratio (16:9 vs 1:1)",
        desc: "Choose '16:9 Landscape' for stream overlays and YouTube banners, or '1:1 Square' for Instagram and WhatsApp status posts.",
        badge: "Step 2",
      },
      {
        title: "Set Starting Slot Number",
        desc: "Organizers often reserve Slot 1 for admins or casters. Change 'Start Slot' from 1 to 2 (or any number) so team numbering begins exactly where you want.",
        badge: "Step 3",
      },
      {
        title: "Toggle Team Rosters",
        desc: "Turn Rosters 'ON' to display all player names, or 'OFF' for a sleek team-names-only card. Turning Rosters OFF automatically hides the total player count for a clean look.",
        badge: "Step 4",
      },
      {
        title: "Choose Theme & Export",
        desc: "Pick your favorite visual style (Cyberpunk, Violet Glass, Dark Slate, Neon, etc.), then tap 'Export' to save a high-res image or 'Share' to post directly without white border artifacts!",
        badge: "Step 5",
      },
    ],
    tips: [
      "On mobile browsers, 'Share' triggers the native share sheet to send directly to WhatsApp or Instagram.",
      "If your browser doesn't support direct file sharing, ScrimCalc automatically copies the image to your clipboard and provides a direct download fallback.",
    ],
  },
  {
    id: "scoring",
    category: "Scoring & Matches",
    title: "Match Scoring & Auto-Calculation",
    icon: Calculator,
    accent: "#10b981",
    description:
      "Record match placements and kills manually or bulk-paste in-game scoreboard text to calculate points and rankings instantly.",
    steps: [
      {
        title: "Select Match Number",
        desc: "Switch between Match 1, Match 2, Match 3 tabs along the top of your tournament dashboard.",
        badge: "Step 1",
      },
      {
        title: "Fast Paste Results",
        desc: "Copy the raw post-match text from the in-game summary, OCR screenshot bot, or referee notes, and paste it into the Fast Paste box. The parser auto-matches team names, placements, and kills.",
        badge: "Step 2",
      },
      {
        title: "Review & Adjust",
        desc: "Fine-tune kill points or placement ranks directly in the table if there were any in-game penalties or tie adjustments.",
        badge: "Step 3",
      },
      {
        title: "Auto Points Computation",
        desc: "ScrimCalc automatically multiplies kill points and adds rank placement points according to your tournament's rules.",
        badge: "Step 4",
      },
    ],
    tips: [
      "Ties in total points are automatically resolved by: (1) Total WWCDs, (2) Total Placement Points, (3) Total Kill Points.",
      "You can edit previous matches at any time without losing overall standings integrity.",
    ],
  },
  {
    id: "standings",
    category: "Graphics & Broadcast",
    title: "Overall Standings & Leaderboards",
    icon: BarChart3,
    accent: "#8b5cf6",
    description:
      "Broadcast-grade leaderboards featuring overall ranks, WWCD badges, Warhead team kill charts, and MVP Top Fraggers across 7 premium themes.",
    steps: [
      {
        title: "Open Standings Modal",
        desc: "Tap 'Standings' from the tournament card. If no matches have been played yet, ScrimCalc still previews all registered teams with 0 points so you can export a pre-scrim lineup!",
        badge: "Step 1",
      },
      {
        title: "Explore Sections (Overall, Warhead, MVPs)",
        desc: "Switch between Overall Points Table, Warhead (top squad kill leaders), and Top Fraggers (individual player MVP rankings).",
        badge: "Step 2",
      },
      {
        title: "Choose Visual Theme",
        desc: "Select from 7 curated themes: Dark Violet, Crimson Red, Neon Cyberpunk, Royal Gold, Emerald Esports, Deep Navy, or Minimal Mono.",
        badge: "Step 3",
      },
      {
        title: "Export & Share Clean Graphics",
        desc: "Choose 16:9 Landscape or 1:1 Square, tap 'Export' or 'Share' to generate an ultra-crisp image with rounded borders and zero white corner artifacts.",
        badge: "Step 4",
      },
    ],
    tips: [
      "Custom sponsor titles and event headers can be previewed live on the poster.",
      "The standings poster is optimized for high pixel density so text remains readable on mobile displays.",
    ],
  },
  {
    id: "collab",
    category: "Collaboration & Tools",
    title: "Cloud Sync & Tournament Sharing",
    icon: Users2,
    accent: "#6366f1",
    description:
      "Collaborate with co-hosts, casters, and referees in real-time using simple 6-character tournament share codes.",
    steps: [
      {
        title: "Generate Share Code",
        desc: "Tap the 'Share' icon on any tournament card to generate a unique 6-character short code.",
        badge: "Step 1",
      },
      {
        title: "Send Code to Co-Organizer",
        desc: "Give the code to your caster or assistant referee.",
        badge: "Step 2",
      },
      {
        title: "Import on Another Device",
        desc: "Your co-organizer opens ScrimCalc on their phone or laptop, clicks 'Import Code', enters the 6-character code, and the tournament syncs instantly.",
        badge: "Step 3",
      },
      {
        title: "Real-Time Cloud Sync",
        desc: "Scores and team edits update live across all devices backed by our cloud database.",
        badge: "Step 4",
      },
    ],
    tips: [
      "Imported tournaments appear in your 'Shared' tab on the home screen.",
      "You can revoke or regenerate codes at any time from tournament settings.",
    ],
  },
  {
    id: "rules",
    category: "Collaboration & Tools",
    title: "Tournament Rules & Room Distribution",
    icon: BookOpen,
    accent: "#e11d48",
    description:
      "Set official competitive guidelines and quickly copy formatted Room ID & Password messages to broadcast to team captains.",
    routeHref: "/rules",
    routeLabel: "Go to Rules",
    steps: [
      {
        title: "Configure Competitive Rules",
        desc: "Open 'Rules' from the hamburger menu (/rules) to add or edit custom rules (e.g. Flare gun restrictions, emulator bans, substitution rules, scoring points).",
        badge: "Step 1",
      },
      {
        title: "One-Click Copy Rules",
        desc: "Tap 'Copy' to copy formatted tournament rules ready to post into WhatsApp groups or Discord rule channels.",
        badge: "Step 2",
      },
      {
        title: "Distribute Room ID & Password",
        desc: "Tap 'Room Info' on your tournament card. Enter the custom room credentials and slot lineup, then tap 'Copy' for a formatted announcement message.",
        badge: "Step 3",
      },
    ],
    tips: [
      "Setting up rules beforehand prevents disputes during official scrim matches.",
      "Room info is saved locally so you don't need to re-type details between match remakes.",
    ],
  },
];

const FAQS: FaqItem[] = [
  {
    category: "Wallet & Payments",
    q: "Do players need to sign in to view their payment link or book a slot?",
    a: "No! Each player has a unique, secure payment URL (/pay/[token]). They can view their full transaction ledger, copy your UPI ID, and submit slot booking requests without signing up or logging in.",
  },
  {
    category: "Wallet & Payments",
    q: "How does the 'Debit All' button work in Bookings?",
    a: "When you tap 'Debit All' in the Bookings modal, ScrimCalc automatically loops through all confirmed bookings for that tournament, deducts the entry fee amount from each player's linked wallet, and records a 'Tournament Entry Fee' transaction with an exact timestamp.",
  },
  {
    category: "Wallet & Payments",
    q: "Can I record payments received in cash or partial payments?",
    a: "Yes. Open the player's wallet, tap '+ Add Entry', select 'Paid', enter whatever amount they paid (even partial payments like ₹20 of ₹50), and the remaining balance will automatically update.",
  },
  {
    category: "Slot Lists & Posters",
    q: "Why do some slot posters start from Slot 2 instead of Slot 1?",
    a: "Many tournament organizers reserve Slot 1 for tournament hosts, casters, or spectators. In the Slots modal, you can customize 'Start Slot' to 1, 2, or any starting number. Team numbering will shift accordingly.",
  },
  {
    category: "Slot Lists & Posters",
    q: "Why did exported posters previously have white corners and how is it fixed?",
    a: "When saving transparent or curved elements as JPEG, canvas encoders render transparent corner pixels as white squares. ScrimCalc automatically eliminates this by applying clean dark background fills and temporarily smoothing card radius during export so your images are completely crisp on Discord and WhatsApp.",
  },
  {
    category: "Slot Lists & Posters",
    q: "How can I hide the total player count on slot posters?",
    a: "In the Slots modal, simply toggle 'Show Rosters' to OFF. When rosters are off, ScrimCalc automatically hides the player count badge, displaying only team names in a sleek, minimalist card layout.",
  },
  {
    category: "Scoring & Standings",
    q: "Can I view or export standings if no matches have been played yet?",
    a: "Yes! If you open the Standings modal before any match data is entered, ScrimCalc automatically lists all registered tournament teams with 0 points in their seed order, allowing you to export or preview a pre-match table.",
  },
  {
    category: "Scoring & Standings",
    q: "How are tie-breakers calculated when two teams have the same total points?",
    a: "ScrimCalc follows official competitive tie-breaking logic in this order: (1) Total WWCDs (Chicken Dinners), (2) Total Placement Points across all matches, (3) Total Kill Points, (4) Best single-match placement rank.",
  },
  {
    category: "Scoring & Standings",
    q: "Can I customize the points awarded for each placement rank?",
    a: "Yes. When creating or editing a tournament, open the Point System selector and choose 'Custom'. You can specify exact points for 1st place through 25th place and customize kill point multipliers (e.g. 1 pt, 2 pts per kill).",
  },
  {
    category: "Collaboration",
    q: "Can my co-caster edit scores on their phone at the same time?",
    a: "Yes. Click 'Share' on your tournament card to generate a 6-character code. Your co-caster can tap 'Import Code' on their phone to import the tournament. Both of you can view and edit scores with real-time cloud synchronization.",
  },
];

export default function HelpPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const categories = useMemo(() => {
    const set = new Set<string>();
    GUIDE_SECTIONS.forEach((s) => set.add(s.category));
    return ["All", ...Array.from(set), "FAQs"];
  }, []);

  const filteredSections = useMemo(() => {
    return GUIDE_SECTIONS.filter((s) => {
      const matchesCat =
        selectedCategory === "All" ||
        selectedCategory === s.category ||
        selectedCategory === s.title;
      if (!matchesCat && selectedCategory !== "All") return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const inTitle = s.title.toLowerCase().includes(q);
      const inDesc = s.description.toLowerCase().includes(q);
      const inSteps = s.steps.some(
        (st) =>
          st.title.toLowerCase().includes(q) ||
          st.desc.toLowerCase().includes(q)
      );
      return inTitle || inDesc || inSteps;
    });
  }, [selectedCategory, searchQuery]);

  const filteredFaqs = useMemo(() => {
    if (selectedCategory !== "All" && selectedCategory !== "FAQs") {
      return FAQS.filter((f) => {
        const matchesCategory =
          f.category.toLowerCase().includes(selectedCategory.toLowerCase()) ||
          (selectedCategory === "Finance & Dues" &&
            f.category.includes("Wallet")) ||
          (selectedCategory === "Graphics & Broadcast" &&
            f.category.includes("Posters")) ||
          (selectedCategory === "Scoring & Matches" &&
            f.category.includes("Standings"));
        if (!matchesCategory) return false;
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q)
        );
      });
    }

    if (!searchQuery.trim()) return FAQS;
    const q = searchQuery.toLowerCase();
    return FAQS.filter(
      (f) => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q)
    );
  }, [selectedCategory, searchQuery]);

  const copyCurrentUrl = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#0c0914] text-zinc-100 flex flex-col pb-20 selection:bg-purple-900 selection:text-white">
      {/* Top sticky app navigation bar */}
      <div
        className="sticky top-0 z-30 px-4 py-3 flex items-center justify-between"
        style={{
          background: "rgba(12, 9, 20, 0.88)",
          borderBottom: "1px solid rgba(124, 58, 237, 0.18)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="p-1.5 rounded-xl hover:bg-violet-900/30 text-violet-300 transition-colors active:scale-95"
            aria-label="Back to home"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-sm font-extrabold text-white flex items-center gap-1.5">
              <span>Help & Guide</span>
              <span
                className="text-[10px] px-1.5 py-0.2 rounded-md font-semibold"
                style={{
                  background: "rgba(124, 58, 237, 0.25)",
                  color: "#c4b5fd",
                  border: "1px solid rgba(124, 58, 237, 0.4)",
                }}
              >
                Docs
              </span>
            </h1>
            <p className="text-[11px]" style={{ color: "rgba(167, 139, 250, 0.6)" }}>
              Step-by-step walkthrough of all features
            </p>
          </div>
        </div>

        <button
          onClick={copyCurrentUrl}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95"
          style={{
            background: "rgba(124, 58, 237, 0.15)",
            border: "1px solid rgba(124, 58, 237, 0.3)",
            color: "#c4b5fd",
          }}
          title="Share Guide Link"
        >
          {copiedLink ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-emerald-400 text-[11px]">Copied</span>
            </>
          ) : (
            <>
              <Share2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline text-[11px]">Share</span>
            </>
          )}
        </button>
      </div>

      {/* Hero Header */}
      <div className="relative overflow-hidden px-4 pt-6 pb-6 text-center max-w-4xl mx-auto w-full">
        {/* Ambient background glow */}
        <div
          className="absolute -top-20 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full pointer-events-none opacity-25 blur-3xl"
          style={{ background: "radial-gradient(circle, #7c3aed 0%, transparent 70%)" }}
        />

        <div className="relative z-10 flex flex-col items-center">
          <div
            className="h-12 w-12 rounded-2xl flex items-center justify-center mb-3 shadow-lg"
            style={{
              background: "linear-gradient(135deg, #7c3aed, #9333ea)",
              boxShadow: "0 0 25px rgba(124, 58, 237, 0.4)",
            }}
          >
            <Sparkles className="h-6 w-6 text-white" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            ScrimCalc User Handbook
          </h2>
          <p
            className="text-xs sm:text-sm mt-2 max-w-lg leading-relaxed"
            style={{ color: "rgba(196, 181, 253, 0.7)" }}
          >
            Master all esports management tools: player wallets, entry fee bookings,
            slot lists, custom points scoring, and broadcast-ready graphics.
          </p>

          {/* Search bar */}
          <div className="mt-5 w-full max-w-md relative">
            <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
              <Search className="h-4 w-4" style={{ color: "rgba(167, 139, 250, 0.5)" }} />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search features (e.g. wallet, debit all, booking, slots, posters)..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none transition-all"
              style={{
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(124, 58, 237, 0.3)",
                boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-3 flex items-center text-xs text-zinc-400 hover:text-white"
              >
                Clear
              </button>
            )}
          </div>

          {/* Quick jump category pills */}
          <div className="mt-4 flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 no-scrollbar">
            {categories.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className="px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all active:scale-95 shrink-0"
                  style={{
                    background: active
                      ? "linear-gradient(135deg, #7c3aed, #9333ea)"
                      : "rgba(255, 255, 255, 0.04)",
                    color: active ? "#ffffff" : "rgba(196, 181, 253, 0.65)",
                    border: `1px solid ${
                      active ? "rgba(167, 139, 250, 0.6)" : "rgba(124, 58, 237, 0.15)"
                    }`,
                    boxShadow: active ? "0 0 12px rgba(124, 58, 237, 0.35)" : "none",
                  }}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content Body */}
      <div className="max-w-4xl mx-auto w-full px-4 space-y-6">
        {/* Sections list */}
        {selectedCategory !== "FAQs" && (
          <div className="space-y-6">
            {filteredSections.length === 0 ? (
              <div
                className="rounded-2xl p-8 text-center"
                style={{
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid rgba(124, 58, 237, 0.15)",
                }}
              >
                <HelpCircle className="h-8 w-8 mx-auto mb-2 text-violet-400/50" />
                <p className="text-sm font-semibold text-white">No guide sections found</p>
                <p className="text-xs text-zinc-400 mt-1">
                  Try searching for another term like &quot;wallet&quot;, &quot;booking&quot;, or &quot;slots&quot;.
                </p>
              </div>
            ) : (
              filteredSections.map((sec) => {
                const IconComponent = sec.icon;
                return (
                  <section
                    key={sec.id}
                    id={sec.id}
                    className="rounded-3xl p-5 sm:p-6 transition-all"
                    style={{
                      background: "linear-gradient(135deg, #140d25 0%, #0e091b 100%)",
                      border: "1px solid rgba(124, 58, 237, 0.22)",
                      boxShadow: "0 10px 30px rgba(0, 0, 0, 0.4)",
                    }}
                  >
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-violet-900/30">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-10 w-10 rounded-2xl flex items-center justify-center shrink-0"
                          style={{
                            background: `linear-gradient(135deg, ${sec.accent}33, ${sec.accent}11)`,
                            border: `1px solid ${sec.accent}44`,
                            color: sec.accent,
                          }}
                        >
                          <IconComponent className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                              style={{
                                background: `${sec.accent}1a`,
                                color: sec.accent,
                                border: `1px solid ${sec.accent}33`,
                              }}
                            >
                              {sec.category}
                            </span>
                          </div>
                          <h3 className="text-base sm:text-lg font-bold text-white mt-1">
                            {sec.title}
                          </h3>
                        </div>
                      </div>

                      {sec.routeHref && (
                        <Link
                          href={sec.routeHref}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold self-start sm:self-auto transition-all active:scale-95"
                          style={{
                            background: "rgba(124, 58, 237, 0.2)",
                            border: "1px solid rgba(124, 58, 237, 0.35)",
                            color: "#c4b5fd",
                          }}
                        >
                          <span>{sec.routeLabel ?? "Open Feature"}</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      )}
                    </div>

                    {/* Section description */}
                    <p
                      className="text-xs sm:text-sm mt-3 leading-relaxed"
                      style={{ color: "rgba(196, 181, 253, 0.75)" }}
                    >
                      {sec.description}
                    </p>

                    {/* Step-by-step workflow */}
                    <div className="mt-5 space-y-3">
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-violet-300/60">
                        Step-by-Step Instructions
                      </h4>
                      <div className="grid grid-cols-1 gap-2.5">
                        {sec.steps.map((st, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-3 p-3 sm:p-3.5 rounded-2xl"
                            style={{
                              background: "rgba(255, 255, 255, 0.03)",
                              border: "1px solid rgba(255, 255, 255, 0.05)",
                            }}
                          >
                            <div
                              className="h-6 w-6 rounded-lg flex items-center justify-center shrink-0 text-xs font-black"
                              style={{
                                background: `${sec.accent}26`,
                                color: sec.accent,
                                border: `1px solid ${sec.accent}40`,
                              }}
                            >
                              {idx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                                <span>{st.title}</span>
                                {st.badge && (
                                  <span
                                    className="text-[9px] font-semibold px-1.5 py-0.2 rounded"
                                    style={{
                                      background: "rgba(124, 58, 237, 0.2)",
                                      color: "#c4b5fd",
                                    }}
                                  >
                                    {st.badge}
                                  </span>
                                )}
                              </p>
                              <p
                                className="text-[11px] sm:text-xs mt-1 leading-relaxed"
                                style={{ color: "rgba(226, 232, 240, 0.7)" }}
                              >
                                {st.desc}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Pro Tips */}
                    {sec.tips && sec.tips.length > 0 && (
                      <div
                        className="mt-4 p-3.5 rounded-2xl flex items-start gap-2.5"
                        style={{
                          background: "rgba(124, 58, 237, 0.08)",
                          border: "1px solid rgba(124, 58, 237, 0.2)",
                        }}
                      >
                        <Flame className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                        <div className="space-y-1">
                          <p className="text-[11px] font-bold text-amber-300">
                            Pro Tips & Notes
                          </p>
                          <ul className="text-[11px] text-zinc-300 space-y-1 list-disc list-inside">
                            {sec.tips.map((tip, i) => (
                              <li key={i}>{tip}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </section>
                );
              })
            )}
          </div>
        )}

        {/* FAQ Section */}
        <section
          id="faq"
          className="rounded-3xl p-5 sm:p-6"
          style={{
            background: "linear-gradient(135deg, #140d25 0%, #0e091b 100%)",
            border: "1px solid rgba(124, 58, 237, 0.25)",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.4)",
          }}
        >
          <div className="flex items-center gap-3 pb-4 border-b border-violet-900/30">
            <div
              className="h-10 w-10 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                background: "linear-gradient(135deg, rgba(234, 179, 8, 0.2), rgba(234, 179, 8, 0.05))",
                border: "1px solid rgba(234, 179, 8, 0.3)",
                color: "#facc15",
              }}
            >
              <HelpCircle className="h-5 w-5" />
            </div>
            <div>
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{
                  background: "rgba(234, 179, 8, 0.15)",
                  color: "#facc15",
                  border: "1px solid rgba(234, 179, 8, 0.3)",
                }}
              >
                Knowledge Base
              </span>
              <h3 className="text-base sm:text-lg font-bold text-white mt-1">
                Frequently Asked Questions (FAQs)
              </h3>
            </div>
          </div>

          <div className="mt-4 space-y-2.5">
            {filteredFaqs.length === 0 ? (
              <p className="text-xs text-zinc-400 py-4 text-center">
                No matching FAQs found for &quot;{searchQuery}&quot;.
              </p>
            ) : (
              filteredFaqs.map((faq, idx) => {
                const isOpen = expandedFaq === idx;
                return (
                  <div
                    key={idx}
                    className="rounded-2xl transition-all overflow-hidden"
                    style={{
                      background: isOpen
                        ? "rgba(124, 58, 237, 0.12)"
                        : "rgba(255, 255, 255, 0.03)",
                      border: `1px solid ${
                        isOpen ? "rgba(124, 58, 237, 0.3)" : "rgba(255, 255, 255, 0.05)"
                      }`,
                    }}
                  >
                    <button
                      onClick={() => setExpandedFaq(isOpen ? null : idx)}
                      className="w-full flex items-center justify-between gap-3 p-3.5 text-left transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <CheckCircle2
                          className="h-4 w-4 shrink-0"
                          style={{ color: isOpen ? "#c4b5fd" : "rgba(167, 139, 250, 0.4)" }}
                        />
                        <span className="text-xs sm:text-sm font-semibold text-white">
                          {faq.q}
                        </span>
                      </div>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
                          isOpen ? "rotate-180 text-violet-400" : "text-zinc-500"
                        }`}
                      />
                    </button>

                    {isOpen && (
                      <div
                        className="px-4 pb-4 pt-1 text-xs sm:text-sm leading-relaxed border-t"
                        style={{
                          color: "rgba(226, 232, 240, 0.8)",
                          borderColor: "rgba(124, 58, 237, 0.15)",
                        }}
                      >
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Quick action footer */}
        <div
          className="rounded-3xl p-6 text-center space-y-3"
          style={{
            background: "linear-gradient(135deg, rgba(124, 58, 237, 0.15), rgba(147, 51, 234, 0.05))",
            border: "1px solid rgba(124, 58, 237, 0.25)",
          }}
        >
          <Trophy className="h-7 w-7 mx-auto text-violet-400" />
          <h4 className="text-base font-bold text-white">Ready to Host Your Tournament?</h4>
          <p className="text-xs text-violet-200/70 max-w-md mx-auto">
            Create scrim events, track entry fees, register teams, and export professional
            standings posters in seconds.
          </p>
          <div className="pt-2 flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all active:scale-95 shadow-lg"
              style={{
                background: "linear-gradient(135deg, #7c3aed, #9333ea)",
                boxShadow: "0 0 20px rgba(124, 58, 237, 0.4)",
              }}
            >
              <span>Dashboard</span>
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              href="/wallet"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95"
              style={{
                background: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                color: "#e2e8f0",
              }}
            >
              <Wallet className="h-3.5 w-3.5 text-violet-400" />
              <span>Open Wallet</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
