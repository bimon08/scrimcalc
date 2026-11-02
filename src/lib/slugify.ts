import { prisma } from "./prisma";

/**
 * Convert a tournament name to a URL-safe slug.
 * E.g. "BGMI Winter Showdown" → "bgmi-winter-showdown"
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")   // remove non-word chars
    .replace(/[\s_]+/g, "-")    // spaces/underscores → hyphens
    .replace(/-+/g, "-")        // collapse multiple hyphens
    .replace(/^-|-$/g, "")      // trim leading/trailing hyphens
    || "tournament";
}

/**
 * Generate a unique slug for a tournament page.
 * If the base slug already exists, appends a 4-char random suffix.
 */
export async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name);

  // Check if slug is available
  const existing = await prisma.tournamentPage.findUnique({ where: { slug: base } });
  if (!existing) return base;

  // Collision — append a short random suffix
  const suffix = Math.random().toString(36).slice(2, 6); // 4 chars
  return `${base}-${suffix}`;
}
