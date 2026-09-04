import { supabase } from './supabase';
import type { DbAdvertisement } from './database';

// ============================================================
// Visitor ID management (anonymous, localStorage-based)
// ============================================================

const VISITOR_ID_KEY = 'itukarua_visitor_id';

export function getVisitorId(): string {
  if (typeof window === 'undefined') return 'ssr';
  let id = localStorage.getItem(VISITOR_ID_KEY);
  if (!id) {
    id = crypto.randomUUID?.() || ('v_' + Math.random().toString(36).slice(2) + Date.now().toString(36));
    localStorage.setItem(VISITOR_ID_KEY, id);
  }
  return id;
}

// ============================================================
// Frequency capping config
// ============================================================

export const FREQ_CAP = {
  daily: 3,    // max impressions per ad per visitor per day
  weekly: 10,  // max impressions per ad per visitor per rolling 7 days
};

// ============================================================
// Types
// ============================================================

export interface AdImpressionRecord {
  ad_id: string;
  visitor_id: string;
  county?: string | null;
  subcounty?: string | null;
}

export interface DeliveryPace {
  adId: string;
  pace: number;         // ratio: 1.0 = on track, <1 = under-delivering, >1 = over
  delivered: number;    // actual impressions so far
  expected: number;     // expected impressions for elapsed time
  daysLeft: number;     // remaining campaign days
  totalDays: number;    // total campaign duration
}

// ============================================================
// Frequency cap check
// ============================================================

export async function getVisitorImpressionCount(adId: string, visitorId: string): Promise<{ daily: number; weekly: number }> {
  const [daily, weekly] = await Promise.all([
    supabase.rpc('count_visitor_impressions', { p_ad_id: adId, p_visitor_id: visitorId, p_days: 1 }),
    supabase.rpc('count_visitor_impressions', { p_ad_id: adId, p_visitor_id: visitorId, p_days: 7 }),
  ]);
  return {
    daily: daily.data || 0,
    weekly: weekly.data || 0,
  };
}

export function isCapped(daily: number, weekly: number): boolean {
  return daily >= FREQ_CAP.daily || weekly >= FREQ_CAP.weekly;
}

// ============================================================
// Impression logging
// ============================================================

export async function logImpression(adId: string, county?: string | null, subcounty?: string | null) {
  const visitorId = getVisitorId();
  const { error } = await supabase.from('ad_impressions').insert({
    ad_id: adId,
    visitor_id: visitorId,
    county: county || null,
    subcounty: subcounty || null,
  });
  if (error) console.error('[AdDelivery] impression log failed:', error);
}

// ============================================================
// Delivery pace calculation
// ============================================================

export function calculatePace(ad: DbAdvertisement): DeliveryPace {
  const now = Date.now();
  const start = new Date(ad.billing_start || ad.created_at).getTime();
  const end = new Date(ad.billing_end || start + 7 * 86400000).getTime();
  const totalMs = Math.max(end - start, 1);
  const elapsedMs = Math.max(now - start, 0);
  const fractionElapsed = Math.min(elapsedMs / totalMs, 1);
  const totalDays = totalMs / 86400000;
  const daysLeft = Math.max((end - now) / 86400000, 0);
  const expectedTotal = ad.expected_impressions || 1000;
  const expectedForElapsed = Math.round(fractionElapsed * expectedTotal);
  const delivered = ad.displays || 0;
  const pace = expectedForElapsed > 0 ? delivered / expectedForElapsed : 1;

  return { adId: ad.id, pace, delivered, expected: expectedForElapsed, daysLeft, totalDays };
}

// ============================================================
// Geo-match priority
// ============================================================

function geoPriority(ad: DbAdvertisement, county?: string, subcounty?: string): number {
  if (subcounty && ad.target_subcounty && ad.target_subcounty === subcounty) return 3;
  if (county && ad.target_county && ad.target_county === county) return 2;
  if (!ad.target_county && !ad.target_subcounty) return 1;
  return 0;
}

// ============================================================
// Fair rotation: weighted selection
// ============================================================

interface ScoredAd {
  ad: DbAdvertisement;
  score: number;
  geoPriority: number;
}

export function selectAdsForDelivery(
  ads: DbAdvertisement[],
  county?: string,
  subcounty?: string,
  maxAds: number = 5
): DbAdvertisement[] {
  if (ads.length === 0) return [];

  const now = Date.now();
  const scored: ScoredAd[] = ads.map(ad => {
    const geo = geoPriority(ad, county, subcounty);
    const pace = calculatePace(ad);
    const start = new Date(ad.billing_start || ad.created_at).getTime();
    const end = new Date(ad.billing_end || start + 7 * 86400000).getTime();
    const daysLeft = Math.max((end - now) / 86400000, 0);
    const totalDays = Math.max((end - start) / 86400000, 1);

    // Urgency boost: ads nearing expiry get priority to ensure delivery
    const urgencyBoost = daysLeft < 1 ? 2.0 : daysLeft < 2 ? 1.5 : daysLeft < 3 ? 1.2 : 1.0;

    // Pacing correction: under-delivering ads get boosted
    const paceBoost = pace < 0.8 ? 1.5 : pace > 1.2 ? 0.7 : 1.0;

    // Score = geo priority * urgency * pace correction
    const score = (geo + 1) * urgencyBoost * paceBoost;

    // Featured / boost priority: paid premium ads win the homepge carousel
    const featuredBoostScore = (ad.featured && (!ad.boost_until || new Date(ad.boost_until).getTime() > now)) ? 3.0 : ad.featured ? 2.0 : 1.0;
    const finalScore = score * featuredBoostScore;
    return { ad, score: finalScore, geoPriority: geo };
  });

  // Sort by score descending (highest priority first)
  scored.sort((a, b) => b.score - a.score);

  // Weighted random selection from top candidates
  const candidates = scored.slice(0, Math.min(scored.length, maxAds * 2));
  return weightedRandomSelect(candidates, maxAds);
}

function weightedRandomSelect(candidates: ScoredAd[], count: number): DbAdvertisement[] {
  if (candidates.length <= count) return candidates.map(c => c.ad);

  const totalScore = candidates.reduce((sum, c) => sum + c.score, 0);
  const selected: DbAdvertisement[] = [];
  const remaining = [...candidates];

  while (selected.length < count && remaining.length > 0) {
    const rand = Math.random() * remaining.reduce((sum, c) => sum + c.score, 0);
    let cumulative = 0;
    for (let i = 0; i < remaining.length; i++) {
      cumulative += remaining[i].score;
      if (cumulative >= rand) {
        selected.push(remaining[i].ad);
        remaining.splice(i, 1);
        break;
      }
    }
  }

  return selected;
}

// ============================================================
// Main delivery function: fetch + filter + rotate
// ============================================================

export async function getAdsForDelivery(
  slot: string,
  county?: string,
  subcounty?: string,
  limit: number = 5,
  featuredOnly: boolean = false
): Promise<DbAdvertisement[]> {
  const visitorId = getVisitorId();
  const now = new Date().toISOString();

  // Fetch all active ads in this slot that are within their billing period
  const { data: ads, error } = await supabase
    .from('advertisements')
    .select('*')
    .eq('active', true)
    .eq('slot', slot)
    .lte('billing_start', now)
    .gte('billing_end', now);

  if (error || !ads || ads.length === 0) return [];

  // Fetch frequency cap counts for this visitor (batch)
  const capPromises = ads.map(async ad => {
    const counts = await getVisitorImpressionCount(ad.id, visitorId);
    return { adId: ad.id, capped: isCapped(counts.daily, counts.weekly), daily: counts.daily, weekly: counts.weekly };
  });
  const caps = await Promise.all(capPromises);

  // Filter out capped ads
  const eligible = ads.filter(ad => {
    const cap = caps.find(c => c.adId === ad.id);
    return cap && !cap.capped;
  });

  if (eligible.length === 0) {
    // All capped — return the uncapped ones sorted by least-seen
    return ads
      .sort((a, b) => {
        const ca = caps.find(c => c.adId === a.id);
        const cb = caps.find(c => c.adId === b.id);
        return (ca?.daily || 0) - (cb?.daily || 0);
      })
      .slice(0, limit);
  }

  // When featuredOnly, only paid premium (featured) ads are eligible for delivery
  const deliverable = featuredOnly ? eligible.filter(a => a.featured) : eligible;

  if (deliverable.length === 0) {
    // Fall back to featured-only among the raw fetched ads (billing/per-cap relaxed)
    const featuredFallback = (ads || []).filter(a => a.featured && (!a.boost_until || new Date(a.boost_until).getTime() > Date.now()));
    return featuredFallback.slice(0, limit);
  }

  // Select ads with fair rotation (featured boosted in scoring)
  return selectAdsForDelivery(deliverable, county, subcounty, limit);
}

// ============================================================
// Advertiser dashboard: pacing data
// ============================================================

export async function getAdPacingData(adId: string): Promise<DeliveryPace> {
  const { data: ad } = await supabase.from('advertisements').select('*').eq('id', adId).single();
  if (!ad) return { adId, pace: 0, delivered: 0, expected: 0, daysLeft: 0, totalDays: 0 };
  return calculatePace(ad);
}

export async function getImpressionsByCounty(adId: string, days: number = 30): Promise<Array<{ county: string; impressions: number }>> {
  const { data, error } = await supabase.rpc('get_impressions_by_county', { p_ad_id: adId, p_days: days });
  if (error) { console.error('[AdDelivery] county impressions failed:', error); return []; }
  return data || [];
}
