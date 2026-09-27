import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

const ADMIN_EMAIL = "bimonlangnongsiej@gmail.com";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: string;
      subscriptionEnd: string | null;
      pendingPlanDays: number | null;
    };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      const isAdmin = user.email === ADMIN_EMAIL;

      // Check if user already exists
      const existing = await prisma.user.findUnique({ where: { email: user.email } });

      if (existing) {
        // Backfill: give existing users a 7-day trial if they never had one
        const needsTrial = !isAdmin && !existing.subscriptionEnd;
        const trialEnd = needsTrial ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : undefined;

        // Update name/image, promote to admin if needed, backfill trial
        await prisma.user.update({
          where: { email: user.email },
          data: {
            name: user.name ?? null,
            image: user.image ?? null,
            ...(isAdmin ? { role: "ADMIN" } : {}),
            ...(trialEnd ? { subscriptionEnd: trialEnd } : {}),
          },
        });
      } else {
        // New user — 1 week free trial (admin gets no expiry)
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + 7);

        await prisma.user.create({
          data: {
            email: user.email,
            name: user.name ?? null,
            image: user.image ?? null,
            role: isAdmin ? "ADMIN" : "USER",
            subscriptionEnd: isAdmin ? null : trialEnd,
          },
        });
      }
      return true;
    },
    async jwt({ token }) {
      if (token.email) {
        const dbUser = await prisma.user.findUnique({ where: { email: token.email } });
        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
          token.subscriptionEnd = dbUser.subscriptionEnd?.toISOString() ?? null;
          token.pendingPlanDays = dbUser.pendingPlanDays ?? null;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.role = (token.role as string) ?? "USER";
        session.user.subscriptionEnd = (token.subscriptionEnd as string) ?? null;
        session.user.pendingPlanDays = (token.pendingPlanDays as number) ?? null;
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
});
