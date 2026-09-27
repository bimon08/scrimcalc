"use client";
import { useSession } from "next-auth/react";
import { useCallback, useState } from "react";

export interface SubscriptionInfo {
  /** Whether the user's trial/subscription is still active */
  isActive: boolean;
  /** Whether the user is admin (always active) */
  isAdmin: boolean;
  /** Whether the user is signed in */
  isLoggedIn: boolean;
  /** Days remaining (-ve if expired) */
  daysLeft: number | null;
  /** Pending plan days (admin-assigned, waiting for user to activate) */
  pendingPlanDays: number | null;
  /** Show the subscription nudge modal */
  showNudge: boolean;
  setShowNudge: (v: boolean) => void;
  /** Show the pending plan activation modal */
  showActivation: boolean;
  setShowActivation: (v: boolean) => void;
  /**
   * Wraps any action callback. If subscription is expired, shows the nudge
   * instead of running the callback. Admin always passes through.
   */
  guard: <T extends unknown[]>(fn: (...args: T) => void) => (...args: T) => void;
}

export function useSubscription(): SubscriptionInfo {
  const { data: session } = useSession();
  const [showNudge, setShowNudge] = useState(false);
  const [showActivation, setShowActivation] = useState(false);

  const isLoggedIn = !!session?.user;
  const role = session?.user?.role ?? "USER";
  const subEnd = session?.user?.subscriptionEnd;
  const pendingPlanDays = session?.user?.pendingPlanDays ?? null;
  const isAdmin = role === "ADMIN";

  let isActive = true;
  let daysLeft: number | null = null;

  if (!isAdmin && subEnd) {
    const end = new Date(subEnd);
    const now = new Date();
    daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    isActive = daysLeft > 0;
  } else if (!isAdmin && !subEnd) {
    // No subscription end set and not admin = expired (edge case)
    // But if they have a pending plan, show activation instead
    isActive = false;
    daysLeft = 0;
  }

  // Admin always active
  if (isAdmin) {
    isActive = true;
    daysLeft = null;
  }

  const guard = useCallback(<T extends unknown[]>(fn: (...args: T) => void) => {
    return (...args: T) => {
      if (isAdmin || isActive) {
        fn(...args);
      } else {
        setShowNudge(true);
      }
    };
  }, [isAdmin, isActive]);

  return {
    isActive, isAdmin, isLoggedIn, daysLeft,
    pendingPlanDays,
    showNudge, setShowNudge,
    showActivation, setShowActivation,
    guard,
  };
}
