"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Legacy route — redirects to the new dynamic tournament page.
 * The Cherry Blossom Festival Cup should be created as a tournament
 * in the admin panel with slug "festival-cup".
 */
export default function FestivalCupRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/tournament/festival-cup");
  }, [router]);

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: "100dvh", color: "#9ca3af", fontSize: 13,
    }}>
      Redirecting…
    </div>
  );
}
