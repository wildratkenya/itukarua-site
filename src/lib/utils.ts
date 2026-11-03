import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface FeaturedCandidate {
  is_featured?: boolean | null;
  subscription_expires_at?: string | null;
}

// A profile shows the Featured badge if an admin manually featured it, or the
// owner holds a live Premium subscription (auto-features while it is active).
export function isPremiumOrFeatured(p?: FeaturedCandidate | null): boolean {
  if (!p) return false;
  if (p.is_featured) return true;
  if (!p.subscription_expires_at) return false;
  return new Date(p.subscription_expires_at).getTime() > Date.now();
}

export interface RatedCandidate {
  rating?: number | string | null;
  reviews_count?: number | null;
  likes_count?: number | null;
}

// Estimated number of positive reviews: review volume scaled by how far above
// the 1-star floor the average rating sits. A lone 5-star review scores 1,
// while 60 reviews averaging 4.9 scores ~59, so review volume - not a single
// perfect score or thumbs-up clicks - decides who is "top rated".
export function positiveReviewScore(p?: RatedCandidate | null): number {
  if (!p) return 0;
  const rating = Number(p.rating) || 0;
  const reviews = Number(p.reviews_count) || 0;
  if (reviews <= 0) return 0;
  return reviews * Math.max((rating - 1) / 4, 0);
}

// Sorts best-reviewed first: positive-review score, then rating, then review
// count, then thumbs-up. Unrated workers keep their incoming order (callers
// pass premium/subscription order), so Array.prototype.sort's stability keeps
// premium placement among unrated workers.
export function compareByPositiveReviews(a?: RatedCandidate | null, b?: RatedCandidate | null): number {
  const s = positiveReviewScore(b) - positiveReviewScore(a);
  if (s !== 0) return s;
  const r = (Number(b?.rating) || 0) - (Number(a?.rating) || 0);
  if (r !== 0) return r;
  const c = (Number(b?.reviews_count) || 0) - (Number(a?.reviews_count) || 0);
  if (c !== 0) return c;
  return (Number(b?.likes_count) || 0) - (Number(a?.likes_count) || 0);
}
