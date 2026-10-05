import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Festival Cup — Cherry Blossom x Divine Esports | BGMI Tournament",
  description:
    "Register for the Cherry Blossom Festival Cup BGMI Tournament. ₹10,000 Prize Pool + 4 Cherry Blossom Festival Passes. Northeast Region Exclusive.",
};

export default function FestivalCupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        /* Override the global body padding from the app shell */
        marginTop: "calc(-1 * var(--top-bar-h, 48px))",
        marginBottom: "calc(-1 * var(--bottom-nav-h, 64px))",
        minHeight: "100dvh",
      }}
    >
      {children}
    </div>
  );
}
