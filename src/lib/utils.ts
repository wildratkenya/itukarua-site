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
