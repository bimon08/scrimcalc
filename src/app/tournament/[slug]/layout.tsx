import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tournament Registration",
  description: "Register for the tournament. Secure your squad's spot now!",
};

export default function TournamentLayout({ children }: { children: React.ReactNode }) {
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
