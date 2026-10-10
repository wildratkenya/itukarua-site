import { supabase, proxyRequest, proxyTable, proxyRpc, supabaseUrl, supabaseKey, ensureValidToken } from './supabase';
import { isCorporateOnlySlot, type SavedCorporateFeatures } from '@/data/siteData';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DbProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: 'super_admin' | 'admin' | 'advertiser' | 'jobseeker' | 'employer' | 'corporate';
  location: string;
  county?: string;
  subcounty?: string;
  skills: string[];
  qualifications: string;
  experience: string;
  profile_image: string;
  rating: number;
  reviews_count: number;
  jobs_completed: number;
  verified: boolean;
  registration_paid: boolean;
  email_confirmed?: boolean;
  created_at: string;
  updated_at: string;
  resume?: string;
  certificates?: string[];
  ratings_enabled?: boolean;
  subscription_expires_at?: string;
  profile_views?: number;
  is_featured?: boolean;
  whatsapp_number?: string;
  likes_count?: number;
  dislikes_count?: number;
  allow_contact_display?: boolean;
}

export interface DbJob {
  id: string;
  title: string;
  description: string;
  location: string;
  county?: string;
  subcounty?: string;
  budget_min: number;
  budget_max: number;
  deadline: string;
  category: string;
  posted_by: string;
  posted_by_name: string;
  urgent: boolean;
  status: 'open' | 'in-progress' | 'completed' | 'cancelled';
  bids_count: number;
  views?: number;
  featured?: boolean;
  boost_until?: string | null;
  valid_until?: string | null;
  retired_at?: string | null;
  retired_by?: 'employer' | 'system' | null;
  awarded_bidder_id?: string | null;
  images?: string[];
  created_at: string;
  updated_at: string;
  // from view
  poster_name?: string;
  poster_image?: string;
  corporate_account_id?: string | null;
  corporate_tier?: string | null;
  // corporate account name (resolved for display)
  corporate_company_name?: string | null;
  company?: string | null;
  type?: string | null;
}

export interface DbBid {
  id: string;
  job_id: string;
  bidder_id: string;
  price: number;
  proposal: string;
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
  created_at: string;
  updated_at: string;
  // from view
  bidder_name?: string;
  bidder_image?: string;
  bidder_rating?: number;
  bidder_reviews?: number;
  bidder_qualifications?: string;
  bidder_experience?: string;
  bidder_skills?: string[];
  bidder_phone?: string;
  bidder_location?: string;
  bidder_county?: string;
  bidder_subcounty?: string;
  bidder_email?: string | null;
}

export interface DbServiceAd {
  id: string;
  business_name: string;
  description: string;
  category: string;
  image: string;
  images: string[];
  location: string;
  county?: string;
  subcounty?: string;
  contact: string;
  plan: '10-day' | '20-day' | '30-day';
  /** NULL until the advert is paid for. See createServiceAd. */
  expiry_date: string | null;
  featured: boolean;
  boost_until?: string | null;
  views_count?: number;
  clicks_count?: number;
  social_links?: Record<string, string> | null;
  rating: number;
  reviews_count: number;
  owner_id: string;
  owner_email?: string | null;
  billing_cycle?: string | null;
  billing_start?: string | null;
  billing_end?: string | null;
  last_invoice_at?: string | null;
  /** Set when the expiry notice has been sent, so it is only ever sent once. */
  expired_notified_at?: string | null;
  payment_confirmed: boolean;
  created_at: string;
  updated_at: string;
  corporate_account_id?: string | null;
  corporate_tier?: string | null;
  // corporate account name (resolved for display)
  corporate_company_name?: string | null;
}

export interface DbPayment {
  id: string;
  user_id: string;
  payment_type: 'registration' | 'contact_access' | 'job_posting' | 'job_payment' | 'advert' | 'featured_boost' | 'single_job_post' | 'employer_day_token' | 'employer_day_access' | 'job_listing';
  amount: number;
  mpesa_ref: string;
  mpesa_phone: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  description: string;
  related_job_id: string | null;
  related_ad_id: string | null;
  related_bid_id: string | null;
  related_profile_id: string | null;
  token: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbMessage {
  id: string;
  sender_id: string | null;
  sender_name: string;
  sender_email: string;
  subject: string;
  message: string;
  type: 'support' | 'feedback' | 'complaint' | 'other' | 'chat_transcript' | 'chat_message';
  status: 'unread' | 'read' | 'replied' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  admin_response: string | null;
  responded_by: string | null;
  responded_at: string | null;
  conversation_id: string | null;
  role: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlatformStats {
  active_jobs: number;
  registered_workers: number;
  active_businesses: number;
  completed_jobs: number;
  total_payments: number;
  counties_served: number;
}

// ─── Profiles ───────────────────────────────────────────────────────────────

export async function getProfile(userId: string): Promise<DbProfile | null> {
  const { data, error } = await proxyRequest(
    `/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=*&limit=1`,
  );
  if (error) { console.error('getProfile error:', error); return null; }
  if (Array.isArray(data)) return data[0] || null;
  return data;
}

export async function updateProfile(userId: string, updates: Partial<DbProfile>) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data as DbProfile;
}

// Worker cards are readable by anyone, so they come from the directory view
// rather than profiles. The view omits phone, email, whatsapp_number and
// resume; contact is fetched through get_profile_contact once a payment window
// is active. See migration 20261003120000_lock_down_profile_reads.
const WORKER_DIRECTORY = 'public_worker_directory';

// Card-safe ratings opt-in lookup for non-owners. Reading a foreign profile row
// would be blocked by profiles_select_own, so this goes through the directory
// view that everyone authenticated may read.
export async function getProfileRatingsFlag(profileId: string): Promise<boolean> {
  const { data } = await supabase
    .from(WORKER_DIRECTORY)
    .select('ratings_enabled')
    .eq('id', profileId)
    .maybeSingle();
  return data?.ratings_enabled === true;
}

export async function getWorkers(limit = 20): Promise<DbProfile[]> {
  const { data, error } = await supabase
    .from(WORKER_DIRECTORY)
    .select('*')
    .eq('role', 'jobseeker')
    .eq('verified', true)
    .order('rating', { ascending: false })
    .limit(limit);
  if (error) { console.error('getWorkers error:', error); return []; }
  return data || [];
}

export async function getAllProfiles(): Promise<DbProfile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error('getAllProfiles error:', error); return []; }
  return data || [];
}

export async function getProfiles(filters?: {
  role?: string;
  location?: string;
  county?: string;
  search?: string;
  limit?: number;
  ratings_enabled?: boolean;
}): Promise<DbProfile[]> {
  let query = supabase
    .from(WORKER_DIRECTORY)
    .select(
      `id, full_name, profile_image, rating, reviews_count, qualifications, experience, skills, location, created_at, role, verified, registration_paid, updated_at, suspended, ratings_enabled, terms_accepted, data_sharing_consent, accepted_terms_at, subscription_expires_at, county, subcounty, profile_views, likes_count, dislikes_count, is_featured, allow_contact_display`
    );

  if (filters?.role) {
    query = query.eq('role', filters.role);
  }
  if (filters?.location) {
    query = query.ilike('location', `%${filters.location}%`);
  }
  if (filters?.county) {
    query = query.eq('county', filters.county);
  }
  if (filters?.search) {
    const terms = filters.search.split(/\s+/).filter(Boolean);
    if (terms.length > 1) {
      const conditions = terms.map(t => `full_name.ilike.%${t}%,skills.ilike.%${t}%`).join(',');
      query = query.or(conditions);
    } else {
      query = query.or(`full_name.ilike.%${filters.search}%,skills.ilike.%${filters.search}%`);
    }
  }
  if (filters?.ratings_enabled) {
    query = query.eq('ratings_enabled', true).order('rating', { ascending: false }).order('reviews_count', { ascending: false });
  } else {
    query = query.order('subscription_expires_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });
  }

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;
  if (error) { 
    if (error.message?.includes('AbortError')) return [];
    console.error('[getProfiles] error:', error); 
    return []; 
  }
  return (data as unknown) as DbProfile[];
}

// ─── Jobs ───────────────────────────────────────────────────────────────────

export async function getJobs(filters?: {
  category?: string;
  location?: string;
  county?: string;
  search?: string;
  status?: string;
  activeOnly?: boolean;
  featured?: boolean;
  limit?: number;
  from?: number;
  postedBy?: string;
}): Promise<DbJob[]> {
  let query = supabase.from('jobs').select('*');

  if (filters?.category && filters.category !== 'All Categories') {
    query = query.eq('category', filters.category);
  }
  if (filters?.location) {
    query = query.ilike('location', '%' + filters.location + '%');
  }
  if (filters?.county) {
    query = query.eq('county', filters.county);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.activeOnly) {
    query = query
      .in('status', ['open', 'in-progress'])
      .gte('valid_until', new Date().toISOString())
      .is('retired_at', null);
  }
  if (filters?.postedBy) {
    query = query.eq('posted_by', filters.postedBy);
  }
  if (filters?.featured) {
    query = query.eq('featured', true);
  }
  if (filters?.search) {
    const terms = filters.search.split(/\s+/).filter(Boolean);
    if (terms.length > 1) {
      const conditions = terms.map(t => `title.ilike.%${t}%,description.ilike.%${t}%,category.ilike.%${t}%`).join(',');
      query = query.or(conditions);
    } else {
      query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%,category.ilike.%${filters.search}%`);
    }
  }

  query = query.order('featured', { ascending: false }).order('created_at', { ascending: false });

  if (typeof filters?.from === 'number') {
    query = query.range(filters.from, filters.from + (filters.limit || 50) - 1);
  } else if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;
  if (error) { 
    if (error.message?.includes('AbortError')) return [];
    console.error('getJobs error:', error); 
    return []; 
  }
  // Auto-expire boosts: un-feature jobs whose boost_until has passed
  const now = new Date().toISOString();
  const results = data as DbJob[];
  const expired = results.filter(j => j.featured && j.boost_until && j.boost_until < now);
  if (expired.length > 0) {
    expired.forEach(j => {
      void supabase.from('jobs').update({ featured: false, boost_until: null }).eq('id', j.id);
    });
  }
  return results.filter(j => !j.boost_until || j.boost_until >= now || !j.featured);
}

export async function getJobById(jobId: string): Promise<DbJob | null> {
  try {
    const result = await proxyRequest(`/rest/v1/jobs?select=*&id=eq.${jobId}`);
    if (result.error || !result.data?.length) return null;
    return result.data[0];
  } catch (err) {
    console.error('getJobById exception:', err);
    return null;
  }
}

export async function createJob(job: {
  title: string;
  description: string;
  location: string;
  county?: string;
  subcounty?: string;
  budget_min: number;
  budget_max: number;
  deadline: string;
  category: string;
  posted_by: string;
  posted_by_name: string;
  urgent?: boolean;
  images?: string[];
}): Promise<DbJob> {
  const { data, error } = await supabase
    .from('jobs')
    .insert(job)
    .select('*')
    .single();
  if (error) throw error;
  return data as DbJob;
}

export async function updateJob(jobId: string, updates: Partial<DbJob>) {
  const locked = JOB_LOCKED_COLUMNS.filter(c => (updates as any)[c] !== undefined);
  if (locked.length > 0) {
    throw new Error(`Field${locked.length > 1 ? 's' : ''} ${locked.join(', ')} cannot be edited directly — use a sanctioned reactivation/publish flow.`);
  }
  const { data, error } = await supabase
    .from('jobs')
    .update(updates)
    .eq('id', jobId)
    .select('*')
    .single();
  if (error) throw error;
  return data as DbJob;
}

export async function deleteJob(jobId: string) {
  const { error } = await supabase.from('jobs').delete().eq('id', jobId);
  if (error) throw error;
}

// ─── Job listing lifecycle ──────────────────────────────────────────────────

export const JOB_LISTING_PLANS = [
  { id: '10-day', name: '10-Day Listing', days: 10, amount: 300, description: 'Job ad live for 10 days' },
  { id: '20-day', name: '20-Day Listing', days: 20, amount: 500, description: 'Job ad live for 20 days' },
  { id: '30-day', name: '30-Day Listing', days: 30, amount: 800, description: 'Job ad live for 30 days' },
] as const;

// Columns a job owner/admin may never write directly from the client — the
// serving window and boost state only move through sanctioned flows. Editing
// an "expiry date" can therefore never silently re-activate a post. Retirement
// (retired_at/by) stays writable because it only ever hides a job.
const JOB_LOCKED_COLUMNS = ['valid_until', 'featured', 'boost_until', 'posted_by', 'published_at'] as const;

// Reactivate a job under an active Employer Access subscription. The RPC
// enforces ownership + coverage and caps the window at the subscription end.
export async function employerReactivateJob(jobId: string): Promise<{ id: string; valid_until: string; status: string; granted_days: number }> {
  const { data, error } = await supabase.rpc('employer_reactivate_job', { p_job: jobId });
  if (error) throw new Error(error.message);
  return data as { id: string; valid_until: string; status: string; granted_days: number };
}

// Retire an ad: hidden from the frontend, reversible through reactivation
// (subscription-covered RPC / paid listing).
export async function retireJob(jobId: string, by: 'employer' | 'system' = 'employer'): Promise<DbJob> {
  return updateJob(jobId, {
    retired_at: new Date().toISOString(),
    retired_by: by,
  } as Partial<DbJob>);
}

// ─── Bids ───────────────────────────────────────────────────────────────────

export async function getBidsForJob(jobId: string): Promise<DbBid[]> {
  const { data, error } = await supabase
    .from('bids_with_bidder')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false });
  if (error) { console.error('getBidsForJob error:', error); return []; }
  return data || [];
}

export async function getBidsByUser(userId: string): Promise<(DbBid & { job?: DbJob })[]> {
  const { data, error } = await supabase
    .from('bids_with_bidder')
    .select('*')
    .eq('bidder_id', userId)
    .order('created_at', { ascending: false });
  if (error) { console.error('getBidsByUser error:', error); return []; }
  if (!data?.length) return [];
  const jobIds = [...new Set(data.map(b => b.job_id))];
  const { data: jobs } = await supabase.from('jobs').select('*').in('id', jobIds);
  const jobMap = new Map((jobs || []).map(j => [j.id, j]));
  return data.map(b => ({ ...b, job: jobMap.get(b.job_id) }));
}

export async function getBidsReceivedOnMyJobs(employerId: string): Promise<(DbBid & { job?: DbJob })[]> {
  const { data: myJobs } = await supabase
    .from('jobs')
    .select('id')
    .eq('posted_by', employerId);
  if (!myJobs?.length) return [];
  const jobIds = myJobs.map(j => j.id);
  const { data, error } = await supabase
    .from('bids_with_bidder')
    .select('*')
    .in('job_id', jobIds)
    .order('created_at', { ascending: false });
  if (error) { console.error('getBidsReceivedOnMyJobs error:', error); return []; }
  if (!data?.length) return [];
  const { data: jobs } = await supabase.from('jobs').select('*').in('id', jobIds);
  const jobMap = new Map((jobs || []).map(j => [j.id, j]));
  return data.map(b => ({ ...b, job: jobMap.get(b.job_id) }));
}

export async function createBid(bid: {
  job_id: string;
  bidder_id: string;
  price: number;
  proposal: string;
}): Promise<DbBid> {
  const { data, error } = await supabase
    .from('bids')
    .insert(bid)
    .select()
    .single();
  if (error) throw error;
  return data as DbBid;
}

export async function updateBid(bidId: string, updates: Partial<DbBid>) {
  const { data, error } = await supabase
    .from('bids')
    .update(updates)
    .eq('id', bidId)
    .select()
    .single();
  if (error) throw error;
  return data as DbBid;
}

// ─── Service Ads ────────────────────────────────────────────────────────────

export async function getServiceAds(filters?: {
  category?: string;
  location?: string;
  county?: string;
  subcounty?: string;
  search?: string;
  ownerId?: string;
  activeOnly?: boolean;
  featured?: boolean;
  limit?: number;
  from?: number;
}): Promise<DbServiceAd[]> {
  let query = supabase.from('service_ads').select('*');

  if (filters?.category && filters.category !== 'All Services') {
    query = query.eq('category', filters.category);
  }
  if (filters?.location) {
    query = query.ilike('location', '%' + filters.location + '%');
  }
  if (filters?.county) {
    query = query.eq('county', filters.county);
  }
  if (filters?.subcounty) {
    query = query.eq('subcounty', filters.subcounty);
  }
  if (filters?.ownerId) {
    query = query.eq('owner_id', filters.ownerId);
  }
  if (filters?.activeOnly) {
    query = query.gte('expiry_date', new Date().toISOString().split('T')[0]);
    // An unpaid advert has no expiry_date, so the window check above already
    // excludes it. Keep the explicit payment gate so the rule survives a future
    // change to how an unpaid row is dated.
    query = query.eq('payment_confirmed', true);
  }
  if (filters?.featured) {
    query = query.eq('featured', true);
  }
  if (filters?.search) {
    const terms = filters.search.split(/\s+/).filter(Boolean);
    if (terms.length > 1) {
      const conditions = terms.map(t => `business_name.ilike.%${t}%,description.ilike.%${t}%,category.ilike.%${t}%`).join(',');
      query = query.or(conditions);
    } else {
      query = query.or(`business_name.ilike.%${filters.search}%,description.ilike.%${filters.search}%,category.ilike.%${filters.search}%`);
    }
  }

  query = query.order('featured', { ascending: false }).order('created_at', { ascending: false });

  if (typeof filters?.from === 'number') {
    query = query.range(filters.from, filters.from + (filters.limit || 50) - 1);
  } else if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;
  if (error) { 
    if (error.message?.includes('AbortError')) return [];
    console.error('getServiceAds error:', error); 
    return []; 
  }
  // Auto-expire boosts: un-feature ads whose boost_until has passed
  const now = new Date().toISOString();
  const results = (data || []) as DbServiceAd[];
  const expired = results.filter(ad => ad.featured && ad.boost_until && ad.boost_until < now);
  if (expired.length > 0) {
    expired.forEach(ad => {
      void supabase.from('service_ads').update({ featured: false, boost_until: null }).eq('id', ad.id);
    });
  }
  return results.filter(ad => !ad.boost_until || ad.boost_until >= now || !ad.featured);
}

export async function getServiceAdById(id: string): Promise<DbServiceAd | null> {
  const { data, error } = await supabase.from('service_ads').select('*').eq('id', id).single();
  if (error) { console.error('[getServiceAdById]', error); return null; }
  return data as DbServiceAd;
}

export async function createServiceAd(ad: {
  business_name: string;
  description: string;
  category: string;
  image?: string;
  images?: string[];
  location: string;
  county?: string;
  subcounty?: string;
  contact: string;
  plan: '10-day' | '20-day' | '30-day';
  owner_id: string;
  featured?: boolean;
  social_links?: Record<string, string> | null;
  destination_url?: string | null;
}): Promise<DbServiceAd> {
  const billingCycle = ad.plan === '10-day' ? '10 days' : ad.plan === '20-day' ? '20 days' : '30 days';
  const { social_links, ...rest } = ad;

  // Deliberately grants no billing window. An advert is created unpaid and stays
  // off air until the M-Pesa callback fulfils it, so an abandoned checkout can
  // never leave a free listing running. See supabase/functions/_shared/
  // paymentEffects.ts fulfilServiceAd, which opens the window from the plan.
  const { data, error } = await supabase
    .from('service_ads')
    .insert({
      ...rest,
      featured: false,
      social_links: social_links || null,
      boost_until: null,
      payment_confirmed: false,
      expiry_date: null,
      billing_cycle: billingCycle,
      billing_start: null,
      billing_end: null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as DbServiceAd;
}

export async function updateServiceAd(adId: string, updates: Partial<DbServiceAd>) {
  const { data, error } = await supabase
    .from('service_ads')
    .update(updates)
    .eq('id', adId)
    .select()
    .single();
  if (error) throw error;
  return data as DbServiceAd;
}

export async function getMyServiceAds(userId: string): Promise<DbServiceAd[]> {
  const { data, error } = await supabase
    .from('service_ads')
    .select('*')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });
  if (error) { console.error('getMyServiceAds error:', error); return []; }
  return data || [];
}

/**
 * Admin/manual extension of a self-serve advert's window.
 *
 * Not the customer renewal path: that runs server-side in
 * supabase/functions/_shared/paymentEffects.ts once the M-Pesa payment lands, so
 * it survives the customer closing the tab. This stays for admin overrides and
 * comps, and extends from the later of now and the current expiry so paid days
 * are never lost.
 */
export async function renewServiceAd(adId: string, plan: '10-day' | '20-day' | '30-day'): Promise<DbServiceAd> {
  const days = plan === '10-day' ? 10 : plan === '20-day' ? 20 : 30;
  const now = new Date();
  const { data: current } = await supabase
    .from('service_ads')
    .select('billing_end')
    .eq('id', adId)
    .maybeSingle();
  const currentEnd = current?.billing_end ? new Date(current.billing_end) : null;
  const base = currentEnd && currentEnd.getTime() > now.getTime() ? currentEnd : now;
  base.setDate(base.getDate() + days);
  const expiryDateStr = base.toISOString().split('T')[0];
  const endIso = new Date(`${expiryDateStr}T00:00:00`).toISOString();
  // A purchased Featured Boost is a separate product with its own expiry, so a
  // plan renewal must not cancel it.
  const liveBoost = await hasLiveAdBoost(adId);

  const patch: Partial<DbServiceAd> = {
    plan,
    payment_confirmed: true,
    expiry_date: expiryDateStr,
    billing_cycle: plan === '10-day' ? '10 days' : plan === '20-day' ? '20 days' : '30 days',
    billing_start: now.toISOString(),
    billing_end: endIso,
    expired_notified_at: null,
  };
  if (!liveBoost) {
    patch.featured = plan === '30-day';
    patch.boost_until = plan === '30-day' ? endIso : null;
  }

  return updateServiceAd(adId, patch);
}

async function hasLiveAdBoost(adId: string): Promise<boolean> {
  const { data } = await supabase.from('service_ads').select('boost_until').eq('id', adId).maybeSingle();
  return !!(data?.boost_until && new Date(data.boost_until).getTime() > Date.now());
}

// ─── Payments ───────────────────────────────────────────────────────────────

export async function getPayments(filters?: {
  userId?: string;
  status?: string;
  paymentType?: string;
  limit?: number;
}): Promise<DbPayment[]> {
  let query = supabase.from('payments').select('*');
  if (filters?.userId) {
    query = query.eq('user_id', filters.userId);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.paymentType) {
    query = query.eq('payment_type', filters.paymentType);
  }
  query = query.order('created_at', { ascending: false });
  if (filters?.limit) {
    query = query.limit(filters.limit);
  }
  const { data, error } = await query;
  if (error) { console.error('getPayments error:', error); return []; }
  return data || [];
}

export async function createPayment(payment: {
  user_id: string;
  payment_type: DbPayment['payment_type'];
  amount: number;
  mpesa_ref?: string;
  mpesa_phone?: string;
  description?: string;
  related_job_id?: string;
  related_ad_id?: string;
  related_bid_id?: string;
  related_profile_id?: string;
}): Promise<DbPayment> {
  const { data, error } = await supabase
    .from('payments')
    .insert({ ...payment, status: 'pending' })
    .select()
    .single();
  if (error) throw error;
  return data as DbPayment;
}

export async function updatePaymentStatus(paymentId: string, status: DbPayment['status'], mpesaRef?: string) {
  const updates: any = { status };
  if (mpesaRef) updates.mpesa_ref = mpesaRef;
  const { data, error } = await supabase
    .from('payments')
    .update(updates)
    .eq('id', paymentId)
    .select()
    .single();
  if (error) throw error;
  return data as DbPayment;
}

// ─── Messages ───────────────────────────────────────────────────────────────

export async function getMessages(filters?: {
  senderId?: string;
  status?: string;
  type?: string;
  limit?: number;
}): Promise<DbMessage[]> {
  let query = supabase.from('messages').select('*');

  if (filters?.senderId) {
    query = query.eq('sender_id', filters.senderId);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.type) {
    query = query.eq('type', filters.type);
  }

  query = query.order('created_at', { ascending: false });

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;
  if (error) { console.error('getMessages error:', error); return []; }
  return data || [];
}

export async function createMessage(msg: {
  sender_name: string;
  sender_email: string;
  subject: string;
  message: string;
  type?: string;
}): Promise<DbMessage> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      sender_name: msg.sender_name,
      sender_email: msg.sender_email,
      subject: msg.subject,
      message: msg.message,
      type: msg.type || 'support',
      status: 'unread',
    })
    .select()
    .single();
  if (error) throw error;
  return data as DbMessage;
}

export async function updateMessageStatus(messageId: string, status: DbMessage['status'], adminResponse?: string, respondedBy?: string) {
  const updates: any = { status, updated_at: new Date().toISOString() };
  if (adminResponse) updates.admin_response = adminResponse;
  if (respondedBy) {
    updates.responded_by = respondedBy;
    updates.responded_at = new Date().toISOString();
  }
  const { data, error } = await supabase
    .from('messages')
    .update(updates)
    .eq('id', messageId)
    .select()
    .single();
  if (error) throw error;
  return data as DbMessage;
}

export async function createChatMessage(msg: {
  conversation_id: string;
  sender_name: string;
  sender_email: string;
  message: string;
  role: 'user' | 'admin';
}): Promise<DbMessage> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: msg.conversation_id,
      sender_name: msg.sender_name,
      sender_email: msg.sender_email,
      subject: 'Chat Message',
      message: msg.message,
      type: 'chat_message',
      role: msg.role,
      status: msg.role === 'admin' ? 'read' : 'unread',
    })
    .select()
    .single();
  if (error) throw error;
  return data as DbMessage;
}

export async function getChatConversation(conversationId: string): Promise<DbMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) { console.error('getChatConversation error:', error); return []; }
  return data || [];
}

export function getConversationId(): string {
  let id = sessionStorage.getItem('chat_conversation_id');
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem('chat_conversation_id', id);
  }
  return id;
}

// ─── Stats ──────────────────────────────────────────────────────────────────

export async function getPlatformStats(): Promise<PlatformStats> {
  const { data, error } = await supabase
    .from('platform_stats')
    .select('*')
    .single();
  if (error) {
    if (error.message?.includes('AbortError')) return { active_jobs: 0, registered_workers: 0, active_businesses: 0, completed_jobs: 0, total_payments: 0, counties_served: 0 };
    console.error('getPlatformStats error:', error);
    return { active_jobs: 0, registered_workers: 0, active_businesses: 0, completed_jobs: 0, total_payments: 0, counties_served: 0 };
  }
  console.log('Fetched Platform Stats:', data);
  return data;
}


// ─── Ratings ────────────────────────────────────────────────────────────────

export interface DbRating {
  id: string;
  job_id: string;
  bidder_id: string;
  poster_id: string;
  rating: number;
  comment: string;
  created_at: string;
}

export async function createRating(rating: {
  job_id: string;
  bidder_id: string;
  poster_id: string;
  rating: number;
  comment: string;
}): Promise<DbRating> {
  const { data, error } = await supabase
    .from('ratings')
    .insert(rating)
    .select()
    .single();
  if (error) throw error;
  return data as DbRating;
}

export async function getRatingsForBidder(bidderId: string): Promise<DbRating[]> {
  const { data, error } = await supabase
    .from('ratings')
    .select('*')
    .eq('bidder_id', bidderId)
    .order('created_at', { ascending: false });
  if (error) { console.error('getRatingsForBidder error:', error); return []; }
  return data || [];
}

export async function getRatingsForJob(jobId: string): Promise<DbRating[]> {
  const { data, error } = await supabase
    .from('ratings')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false });
  if (error) { console.error('getRatingsForJob error:', error); return []; }
  return data || [];
}

export async function checkIfRated(jobId: string, bidderId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('ratings')
    .select('id')
    .eq('job_id', jobId)
    .eq('bidder_id', bidderId)
    .maybeSingle();
  if (error || !data) return false;
  return true;
}

// ─── Service Ratings ────────────────────────────────────────────────────────

export async function createServiceRating(serviceId: string, userId: string, rating: number): Promise<void> {
  const { error } = await supabase
    .from('service_ratings')
    .upsert({ service_id: serviceId, user_id: userId, rating }, { onConflict: 'service_id,user_id' });
  if (error) throw error;
}

export async function checkServiceRating(serviceId: string, userId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from('service_ratings')
    .select('rating')
    .eq('service_id', serviceId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return data.rating;
}

// ─── Profile Reviews ────────────────────────────────────────────────────────

export async function createProfileReview(
  reviewerId: string,
  profileId: string,
  rating: number,
  comment?: string,
  jobId?: string
): Promise<void> {
  const { error } = await supabase
    .from('profile_reviews')
    .upsert(
      { reviewer_id: reviewerId, profile_id: profileId, rating, comment: comment || '', job_id: jobId || null },
      { onConflict: 'reviewer_id,profile_id' }
    );
  if (error) throw error;
  await recomputeProfileRating(profileId);
}

export async function recomputeProfileRating(profileId: string): Promise<void> {
  const { data: reviews, error: reviewsError } = await supabase
    .from('profile_reviews')
    .select('rating')
    .eq('profile_id', profileId);
  if (reviewsError || !reviews || reviews.length === 0) {
    await supabase.from('profiles').update({ rating: 0, reviews_count: 0 }).eq('id', profileId);
    return;
  }
  const total = reviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0);
  const avg = total / reviews.length;
  await supabase.from('profiles').update({ rating: Math.round(avg * 10) / 10, reviews_count: reviews.length }).eq('id', profileId);
}

export async function getProfileReviews(profileId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('profile_reviews')
    .select('*, reviewer:reviewer_id(full_name, profile_image)')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false });
  if (error) { console.error('getProfileReviews error:', error); return []; }
  return data || [];
}

export async function checkProfileReview(profileId: string, userId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from('profile_reviews')
    .select('rating, comment')
    .eq('profile_id', profileId)
    .eq('reviewer_id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return data.rating;
}

// ─── Contact Access ─────────────────────────────────────────────────────────

export async function getMyProfileVote(voterId: string, profileId: string): Promise<'up' | 'down' | null> {
  const { data } = await supabase
    .from('profile_votes')
    .select('vote_type')
    .eq('voter_id', voterId)
    .eq('profile_id', profileId)
    .maybeSingle();
  return data?.vote_type ?? null;
}

export async function setProfileVote(voterId: string, profileId: string, voteType: 'up' | 'down'): Promise<void> {
  const { error } = await supabase
    .from('profile_votes')
    .upsert({ voter_id: voterId, profile_id: profileId, vote_type: voteType }, { onConflict: 'voter_id,profile_id' });
  if (error) throw error;
}

export async function clearProfileVote(voterId: string, profileId: string): Promise<void> {
  await supabase
    .from('profile_votes')
    .delete()
    .eq('voter_id', voterId)
    .eq('profile_id', profileId);
}

export async function checkContactAccess(userId: string, profileId: string): Promise<boolean> {
  const { data } = await supabase
    .from('payments')
    .select('id')
    .eq('user_id', userId)
    .eq('payment_type', 'contact_access')
    .eq('related_profile_id', profileId)
    .eq('status', 'completed')
    .gte('access_expires_at', new Date().toISOString())
    .maybeSingle();
  return !!data;
}

export async function checkSingleJobAccess(userId: string, jobId: string): Promise<boolean> {
  const { data } = await supabase
    .from('payments')
    .select('id')
    .eq('user_id', userId)
    .eq('payment_type', 'single_job_post')
    .eq('related_job_id', jobId)
    .eq('status', 'completed')
    .maybeSingle();
  return !!data;
}

export async function checkSingleJobDayToken(userId: string, jobId: string): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('payments')
    .select('id')
    .eq('user_id', userId)
    .eq('payment_type', 'employer_day_token')
    .eq('related_job_id', jobId)
    .eq('status', 'completed')
    .gte('created_at', since)
    .maybeSingle();
  return !!data;
}

export async function countRecentSingleJobs(userId: string): Promise<number> {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const { count, error } = await supabase
    .from('payments')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('payment_type', 'employer_day_token')
    .eq('status', 'completed')
    .gte('created_at', since.toISOString());
  if (error) return 0;
  return count || 0;
}

export async function redeemToken(token: string): Promise<{ profileId: string; expiresAt: string | null } | null> {
  const { data, error } = await supabase.rpc('redeem_contact_token', { p_token: token.trim().toUpperCase() });
  if (error || !data?.allowed) return null;
  return { profileId: data.profile_id as string, expiresAt: data.expires_at as string | null };
}

export interface ProfileContactResult {
  allowed: boolean;
  reason?: 'opted_out' | 'locked' | 'expired' | 'missing';
  expiresAt?: string | null;
  contact?: {
    phone?: string | null;
    email?: string | null;
    whatsapp?: string | null;
    location?: string | null;
    county?: string | null;
    subcounty?: string | null;
  } | null;
  certificates?: string[] | null;
  resume?: string | null;
}

export async function getProfileContact(profileId: string): Promise<ProfileContactResult | null> {
  const { data, error } = await supabase.rpc('get_profile_contact', { p_profile_id: profileId });
  if (error) {
    console.error('[getProfileContact] error:', error);
    return null;
  }
  if (!data) return null;
  return {
    allowed: !!data.allowed,
    reason: data.reason as ProfileContactResult['reason'],
    expiresAt: data.expires_at as string | null,
    contact: data.contact || null,
    certificates: data.certificates,
    resume: data.resume,
  };
}

export const CONTACT_ACCESS_FEE_DEFAULT = 100;
export const CONTACT_ACCESS_WINDOW_HOURS_DEFAULT = 24;

export interface ContactAccessConfig {
  fee: number;
  windowHours: number;
}

export async function getContactAccessConfig(): Promise<ContactAccessConfig> {
  const settings = await getPlatformSettings();
  const fee = settings.contact_access_fee || CONTACT_ACCESS_FEE_DEFAULT;
  const windowHours = settings.contact_access_window_hours || CONTACT_ACCESS_WINDOW_HOURS_DEFAULT;
  return { fee, windowHours };
}

// ─── Terms & Conditions ─────────────────────────────────────────────────────

export async function acceptTerms(userId: string, dataSharingConsent: boolean, allowContactDisplay?: boolean): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({
      terms_accepted: true,
      data_sharing_consent: dataSharingConsent,
      accepted_terms_at: new Date().toISOString(),
      ...(allowContactDisplay !== undefined ? { allow_contact_display: allowContactDisplay } : {}),
    })
    .eq('id', userId);
  if (error) throw error;
}

export async function checkTermsAccepted(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('profiles')
    .select('terms_accepted')
    .eq('id', userId)
    .maybeSingle();
  return !!data?.terms_accepted;
}

// ─── Conversations & Direct Messages ────────────────────────────────────────

export interface DbConversation {
  id: string;
  job_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbDirectMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender_name?: string;
  sender_image?: string;
}

export interface DbConversationWithParticipant {
  id: string;
  job_id: string | null;
  created_at: string;
  updated_at: string;
  other_user_id: string;
  other_user_name: string;
  other_user_image: string;
  last_message: string;
  last_message_at: string;
  last_sender_id: string;
  unread_count: number;
}

export async function findOrCreateConversation(userId1: string, userId2: string, jobId?: string): Promise<string> {
  const { data: existing } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', userId1);

  if (existing && existing.length > 0) {
    const convIds = existing.map(c => c.conversation_id);
    const { data: match } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', userId2)
      .in('conversation_id', convIds)
      .maybeSingle();
    if (match) return match.conversation_id;
  }

  const { data: conv, error: convError } = await supabase
    .from('conversations')
    .insert({ job_id: jobId || null })
    .select()
    .single();
  if (convError) throw convError;

  const { error: partError } = await supabase
    .from('conversation_participants')
    .insert([
      { conversation_id: conv.id, user_id: userId1 },
      { conversation_id: conv.id, user_id: userId2 },
    ]);
  if (partError) throw partError;

  return conv.id;
}

export async function getConversations(userId: string): Promise<DbConversationWithParticipant[]> {
  const { data: participations } = await supabase
    .from('conversation_participants')
    .select('conversation_id, last_read_at')
    .eq('user_id', userId)
    .order('conversation_id', { ascending: false });

  if (!participations || participations.length === 0) return [];

  const convIds = participations.map(p => p.conversation_id);

  const { data: conversations } = await supabase
    .from('conversations')
    .select('*')
    .in('id', convIds)
    .order('updated_at', { ascending: false });

  if (!conversations) return [];

  const results: DbConversationWithParticipant[] = [];

  for (const conv of conversations) {
    const { data: participants } = await supabase
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', conv.id);

    const otherUserId = participants?.find(p => p.user_id !== userId)?.user_id;
    if (!otherUserId) continue;

    // Another participant's row, so it must come from the directory view rather
    // than profiles, which is now readable only by the owner and admins.
    const { data: otherProfile } = await supabase
      .from(WORKER_DIRECTORY)
      .select('full_name, profile_image')
      .eq('id', otherUserId)
      .maybeSingle();

    const { data: lastMsg } = await supabase
      .from('direct_messages')
      .select('*')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const participation = participations.find(p => p.conversation_id === conv.id);
    const { count } = await supabase
      .from('direct_messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conv.id)
      .gt('created_at', participation?.last_read_at || '1970-01-01');

    results.push({
      id: conv.id,
      job_id: conv.job_id,
      created_at: conv.created_at,
      updated_at: conv.updated_at,
      other_user_id: otherUserId,
      other_user_name: otherProfile?.full_name || 'Unknown',
      other_user_image: otherProfile?.profile_image || '',
      last_message: lastMsg?.content || '',
      last_message_at: lastMsg?.created_at || conv.created_at,
      last_sender_id: lastMsg?.sender_id || '',
      unread_count: count || 0,
    });
  }

  return results.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
}

export async function getConversationMessages(conversationId: string): Promise<DbDirectMessage[]> {
  const { data, error } = await supabase
    .from('direct_messages')
    .select('*, sender:sender_id(full_name, profile_image)')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) { console.error('getConversationMessages error:', error); return []; }
  return (data || []).map((m: any) => ({
    ...m,
    sender_name: m.sender?.full_name,
    sender_image: m.sender?.profile_image,
  }));
}

export async function sendMessage(conversationId: string, senderId: string, content: string): Promise<void> {
  const { error } = await supabase
    .from('direct_messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, content });
  if (error) throw error;

  await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId);
}

export async function markConversationRead(conversationId: string, userId: string): Promise<void> {
  await supabase
    .from('conversation_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId);
}

// ─── Notifications ──────────────────────────────────────────────────────────

export interface DbNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  related_link: string | null;
  is_read: boolean;
  created_at: string;
}

export async function getNotifications(userId: string, limit = 20): Promise<DbNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) { console.error('getNotifications error:', error); return []; }
  return data || [];
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  if (error) return 0;
  return count || 0;
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);
}

// ─── Subscription ───────────────────────────────────────────────────────────

export async function checkSubscriptionActive(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('profiles')
    .select('subscription_expires_at')
    .eq('id', userId)
    .maybeSingle();
  if (!data?.subscription_expires_at) return false;
  return new Date(data.subscription_expires_at).getTime() > Date.now();
}

export async function getSubscriptionDaysRemaining(userId: string): Promise<number> {
  const { data } = await supabase
    .from('profiles')
    .select('subscription_expires_at')
    .eq('id', userId)
    .maybeSingle();
  if (!data?.subscription_expires_at) return 0;
  const diff = new Date(data.subscription_expires_at).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export async function extendSubscription(userId: string, days: number): Promise<void> {
  const { data } = await supabase
    .from('profiles')
    .select('subscription_expires_at')
    .eq('id', userId)
    .maybeSingle();
  const base = data?.subscription_expires_at ? new Date(data.subscription_expires_at) : new Date();
  if (base.getTime() < Date.now()) base.setTime(Date.now());
  base.setDate(base.getDate() + days);
  // registration_paid must be true for the login gate / lock to accept the account.
  const { error } = await supabase
    .from('profiles')
    .update({ subscription_expires_at: base.toISOString(), registration_paid: true })
    .eq('id', userId);
  if (error) throw error;
}

// ─── Role Entitlements ──────────────────────────────────────────────────────
// One account holds each paid role (jobseeker premium / employer / advertiser)
// independently in profile_roles. A service is only reachable for roles the
// user actually holds with a valid (paid, unexpired) entitlement.

export type EntitlementRole = 'jobseeker' | 'employer' | 'advertiser';
export type ProfileRoleEntitlement = {
  role: EntitlementRole;
  paid: boolean;
  expires_at: string | null;
  token_days: number;
  created_at: string;
};

export async function getRoleEntitlements(userId: string): Promise<ProfileRoleEntitlement[]> {
  const { data, error } = await supabase
    .from('profile_roles')
    .select('role, paid, expires_at, token_days, created_at')
    .eq('user_id', userId);
  if (error) {
    console.error('[entitlements] get failed:', error);
    return [];
  }
  return (data as ProfileRoleEntitlement[]) || [];
}

export async function hasEntitlement(userId: string, role: EntitlementRole): Promise<boolean> {
  const { data } = await supabase
    .from('profile_roles')
    .select('paid, expires_at')
    .eq('user_id', userId)
    .eq('role', role)
    .maybeSingle();
  if (!data) return false;
  if (!data.paid) return false;
  if (data.expires_at) {
    return new Date(data.expires_at).getTime() > Date.now();
  }
  return true;
}

export type SetEntitlementInput = {
  paid?: boolean;
  expires_at?: string | null;
  token_days?: number;
};

export async function setRoleEntitlement(
  userId: string,
  role: EntitlementRole,
  input: SetEntitlementInput
): Promise<void> {
  const { error } = await supabase
    .from('profile_roles')
    .upsert(
      {
        user_id: userId,
        role,
        paid: input.paid ?? true,
        expires_at: input.expires_at ?? null,
        token_days: input.token_days ?? 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,role' }
    );
  if (error) throw error;
}

export async function extendRoleSubscription(
  userId: string,
  role: EntitlementRole,
  days: number
): Promise<void> {
  const { data } = await supabase
    .from('profile_roles')
    .select('paid, expires_at, token_days')
    .eq('user_id', userId)
    .eq('role', role)
    .maybeSingle();
  const base = data?.expires_at && new Date(data.expires_at).getTime() > Date.now()
    ? new Date(data.expires_at)
    : new Date();
  base.setDate(base.getDate() + days);
  const { error } = await supabase
    .from('profile_roles')
    .upsert(
      {
        user_id: userId,
        role,
        paid: true,
        expires_at: base.toISOString(),
        token_days: data?.token_days ?? 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,role' }
    );
  if (error) throw error;
}

// ─── Legacy jobseeker free entry ────────────────────────────────────────────
// A jobseeker who has never paid still holds a (free, unpaid) entitlement so
// they can use free features; premium features separately require a paid premium.

export async function ensureJobseekerEntitlement(userId: string): Promise<void> {
  const { data } = await supabase
    .from('profile_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'jobseeker')
    .maybeSingle();
  if (!data) {
    await supabase
      .from('profile_roles')
      .insert({ user_id: userId, role: 'jobseeker', paid: false })
      .select();
  }
}

// Advertiser access itself carries no fee — the advert package is paid once
// when the advert is submitted. The upsert also clears a legacy expiry (the
// retired KES 100 flow), turning an old time-boxed grant into permanent access.
export async function ensureAdvertiserEntitlement(userId: string): Promise<void> {
  await setRoleEntitlement(userId, 'advertiser', { paid: true, expires_at: null, token_days: 0 });
}

export async function hasActiveAdvertiserSubscription(userId?: string): Promise<boolean> {
  if (!userId) return false;
  return hasEntitlement(userId, 'advertiser');
}

export type ActiveAdvertiserTier = {
  hasActive: boolean;
  tierKey: '10-day' | '20-day' | '30-day' | null; // plan key
  tierName: string | null;                        // e.g. '10-Day Advert'
  days: number | null;
  inferredFrom: 'entitlement+payment' | 'entitlement+ad' | 'entitlement' | null;
};

function tierKeyToName(k: '10-day' | '20-day' | '30-day' | null): string | null {
  if (k === '10-day') return '10-Day Advert';
  if (k === '20-day') return '20-Day Advert';
  if (k === '30-day') return '30-Day Advert';
  return null;
}

function tierKeyToDays(k: '10-day' | '20-day' | '30-day' | null): number | null {
  if (k === '10-day') return 10;
  if (k === '20-day') return 20;
  if (k === '30-day') return 30;
  return null;
}

export async function getActiveAdvertiserTier(userId?: string): Promise<ActiveAdvertiserTier> {
  if (!userId) return { hasActive: false, tierKey: null, tierName: null, days: null, inferredFrom: null };
  const active = await hasEntitlement(userId, 'advertiser');
  if (!active) return { hasActive: false, tierKey: null, tierName: null, days: null, inferredFrom: null };
  // 1) latest successful advertiser payment
  const { data: pays } = await supabase
    .from('payments')
    .select('id, created_at, payment_type, status, description, related_ad_id')
    .eq('user_id', userId)
    .eq('payment_type', 'advert')
    .order('created_at', { ascending: false })
    .limit(10);
  const success = (pays || []).find((p: any) =>
    ['completed', 'success', 'successful', 'paid', 'confirmed'].includes(String(p.status || '').toLowerCase())
  );
  if (success) {
    // try related ad first
    if (success.related_ad_id) {
      const { data: ad } = await supabase.from('advertisements').select('plan').eq('id', success.related_ad_id).maybeSingle();
      if (ad?.plan && ['10-day', '20-day', '30-day'].includes(ad.plan)) {
        const k = ad.plan as '10-day' | '20-day' | '30-day';
        return { hasActive: true, tierKey: k, tierName: tierKeyToName(k), days: tierKeyToDays(k), inferredFrom: 'entitlement+payment' };
      }
    }
    // try description
    const d = String(success.description || '');
    if (d.includes('30-Day Advert')) {
      const k = '30-day' as const;
      return { hasActive: true, tierKey: k, tierName: tierKeyToName(k), days: tierKeyToDays(k), inferredFrom: 'entitlement+payment' };
    }
    if (d.includes('20-Day Advert')) {
      const k = '20-day' as const;
      return { hasActive: true, tierKey: k, tierName: tierKeyToName(k), days: tierKeyToDays(k), inferredFrom: 'entitlement+payment' };
    }
    if (d.includes('10-Day Advert')) {
      const k = '10-day' as const;
      return { hasActive: true, tierKey: k, tierName: tierKeyToName(k), days: tierKeyToDays(k), inferredFrom: 'entitlement+payment' };
    }
  }
  // 2) latest paid ad
  const { data: ads } = await supabase
    .from('advertisements')
    .select('plan, created_at')
    .eq('owner_id', userId)
    .eq('payment_confirmed', true)
    .order('created_at', { ascending: false })
    .limit(1);
  if (ads && ads[0]?.plan && ['10-day', '20-day', '30-day'].includes(ads[0].plan)) {
    const k = ads[0].plan as '10-day' | '20-day' | '30-day';
    return { hasActive: true, tierKey: k, tierName: tierKeyToName(k), days: tierKeyToDays(k), inferredFrom: 'entitlement+ad' };
  }
  return { hasActive: true, tierKey: null, tierName: null, days: null, inferredFrom: 'entitlement' };
}

// ─── Weekly Bid Counter ─────────────────────────────────────────────────────

export async function getWeeklyBidCount(userId: string): Promise<number> {
  const startOfWeek = new Date();
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const { count, error } = await supabase
    .from('bids')
    .select('id', { count: 'exact', head: true })
    .eq('bidder_id', userId)
    .gte('created_at', startOfWeek.toISOString());
  if (error) return 0;
  return count || 0;
}

export async function getMonthlyBidCount(userId: string): Promise<number> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const { count, error } = await supabase
    .from('bids')
    .select('id', { count: 'exact', head: true })
    .eq('bidder_id', userId)
    .gte('created_at', startOfMonth.toISOString());
  if (error) return 0;
  return count || 0;
}

export const FREE_BID_LIMIT = 10;

// ─── Notify Jobseekers of New Job ──────────────────────────────────────────

export async function notifyJobseekersOfNewJob(jobId: string): Promise<void> {
  const { data: job } = await supabase.from('jobs').select('id, title, category, county').eq('id', jobId).maybeSingle();
  if (!job) return;

  const { data: jobseekers } = await supabase
    .from(WORKER_DIRECTORY)
    .select('id, skills, county')
    .eq('role', 'jobseeker');

  if (!jobseekers?.length) return;

  const notifications: { user_id: string; type: string; title: string; body: string; related_link: string }[] = [];

  for (const seeker of jobseekers) {
    let matchReason = '';
    const skills = (seeker.skills || []).join(',').toLowerCase();
    if (job.category && skills.includes(job.category.toLowerCase())) {
      matchReason = 'category';
    }
    if (seeker.county && job.county && seeker.county === job.county) {
      matchReason += matchReason ? ' & location' : 'location';
    }
    if (matchReason) {
      notifications.push({
        user_id: seeker.id,
        type: 'new_job',
        title: 'New Job Match',
        body: `A new ${matchReason} match job has been posted: ${job.title}`,
        related_link: `/jobs/${job.id}`,
      });
    }
  }

  if (notifications.length > 0) {
    await supabase.from('notifications').insert(notifications);
  }
}

// ─── Platform Settings ──────────────────────────────────────────────────────

export async function getPlatformSettings(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('platform_settings')
    .select('key, value');
  if (error) { console.error('getPlatformSettings error:', error); return {}; }
  const settings: Record<string, number> = {};
  (data || []).forEach((s: any) => { settings[s.key] = s.value; });
  return settings;
}

export async function updatePlatformSetting(key: string, value: number): Promise<void> {
  const { error } = await supabase
    .from('platform_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export interface AdBannerSettings {
  horizontalLoopSeconds: number;
  horizontalDirection: 'left' | 'right';
  verticalLoopSeconds: number;
  verticalDirection: 'up' | 'down';
}

export const DEFAULT_AD_BANNER_SETTINGS: AdBannerSettings = {
  horizontalLoopSeconds: 30,
  horizontalDirection: 'left',
  verticalLoopSeconds: 30,
  verticalDirection: 'up',
};

export async function getAdBannerSettings(): Promise<AdBannerSettings> {
  const fallback = { ...DEFAULT_AD_BANNER_SETTINGS };
  const { data, error } = await supabase
    .from('ad_carousel_settings')
    .select('key, value');
  if (error && error.name !== 'AbortError') { console.error('getAdBannerSettings error:', error); return fallback; }
  const map: Record<string, string> = {};
  (data || []).forEach((s: any) => { map[s.key] = s.value; });
  const num = (raw: string | undefined, dflt: number) => {
    const n = parseFloat(raw ?? '');
    return Number.isFinite(n) && n > 0 ? n : dflt;
  };
  return {
    horizontalLoopSeconds: num(map['horizontal_loop_seconds'], fallback.horizontalLoopSeconds),
    horizontalDirection: map['horizontal_direction'] === 'right' ? 'right' : 'left',
    verticalLoopSeconds: num(map['vertical_loop_seconds'], fallback.verticalLoopSeconds),
    verticalDirection: map['vertical_direction'] === 'down' ? 'down' : 'up',
  };
}

export async function updateAdBannerSetting(key: string, value: string): Promise<void> {
  const { error } = await supabase
    .from('ad_carousel_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// ─── Site social links ───────────────────────────────────────────────────────
// Stored as text rows in ad_carousel_settings (the public-read key/value
// store), one key per platform: social_<platform>. Absent or empty = hidden.

export const SOCIAL_PLATFORMS = [
  { key: 'facebook', label: 'Facebook' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'x', label: 'X (Twitter)' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'telegram', label: 'Telegram' },
  { key: 'mastodon', label: 'Mastodon' },
] as const;

export type SocialPlatformKey = (typeof SOCIAL_PLATFORMS)[number]['key'];
export type SocialLinks = Partial<Record<SocialPlatformKey, string>>;

export async function getSocialLinks(): Promise<SocialLinks> {
  const { data, error } = await supabase
    .from('ad_carousel_settings')
    .select('key, value')
    .like('key', 'social\\_%');
  if (error) { console.error('getSocialLinks error:', error); return {}; }
  const links: SocialLinks = {};
  (data || []).forEach((row: any) => {
    const platform = String(row.key || '').slice('social_'.length) as SocialPlatformKey;
    const url = String(row.value || '').trim();
    if (url) links[platform] = url;
  });
  return links;
}

export async function setSocialLink(platform: string, url: string): Promise<void> {
  let value = url.trim();
  if (value && !/^https?:\/\//i.test(value)) value = `https://${value}`;
  const key = `social_${platform}`;
  if (!value) {
    const { error } = await supabase.from('ad_carousel_settings').delete().eq('key', key);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from('ad_carousel_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// ─── Profile Views ─────────────────────────────────────────────────────────

export async function incrementProfileViews(profileId: string): Promise<void> {
  await supabase.rpc('increment_profile_views', { p_profile_id: profileId });
}

export async function trackProfileView(profileId: string, viewerId?: string): Promise<void> {
  await supabase.from('profile_views_log').insert({ profile_id: profileId, viewer_id: viewerId || null });
}

export async function getProfileViewHistory(profileId: string, days = 30): Promise<{ view_date: string; view_count: number }[]> {
  const from = new Date();
  from.setDate(from.getDate() - days);
  const { data, error } = await supabase
    .from('profile_views_log')
    .select('created_at')
    .eq('profile_id', profileId)
    .gte('created_at', from.toISOString())
    .order('created_at', { ascending: true });
  if (error || !data) { console.error('[getProfileViewHistory]', error); return []; }
  const grouped: Record<string, number> = {};
  for (const row of data) {
    const d = row.created_at?.slice(0, 10);
    if (d) grouped[d] = (grouped[d] || 0) + 1;
  }
  return Object.entries(grouped).map(([view_date, view_count]) => ({ view_date, view_count }));
}

// ─── Job Views ────────────────────────────────────────────────────────────

export async function trackJobView(jobId: string): Promise<void> {
  await supabase.rpc('increment_job_views', { p_job_id: jobId });
  await supabase.from('job_views_log').insert({ job_id: jobId });
}

export async function getJobViewHistory(employerId: string, days = 30): Promise<{ view_date: string; view_count: number }[]> {
  const { data, error } = await supabase.rpc('get_job_view_history', { p_profile_id: employerId, p_days: days });
  if (error || !data) { console.error('[getJobViewHistory]', error); return []; }
  return data.map((r: any) => ({ view_date: r.view_date, view_count: Number(r.view_count) }));
}

export async function getTotalJobViews(employerId: string): Promise<number> {
  const { data, error } = await supabase.rpc('get_total_job_views', { p_profile_id: employerId });
  if (error || data == null) { console.error('[getTotalJobViews]', error); return 0; }
  return Number(data);
}

export async function getSiteTraffic(days = 30): Promise<{ date: string; visitors: number; page_views: number }[]> {
  const from = new Date();
  from.setDate(from.getDate() - days);
  const { data, error } = await supabase
    .from('site_visits_log')
    .select('created_at, user_id')
    .gte('created_at', from.toISOString())
    .order('created_at', { ascending: true });
  if (error || !data) { console.error('[getSiteTraffic]', error); return []; }
  const grouped: Record<string, { visitors: Set<string | null>; page_views: number }> = {};
  for (const row of data) {
    const d = row.created_at?.slice(0, 10);
    if (!d) continue;
    if (!grouped[d]) grouped[d] = { visitors: new Set(), page_views: 0 };
    grouped[d].visitors.add(row.user_id);
    grouped[d].page_views++;
  }
  return Object.entries(grouped).map(([date, g]) => ({
    date,
    visitors: g.visitors.size,
    page_views: g.page_views,
  }));
}

export async function getProfileRanking(profileId: string): Promise<{ rank: number; total: number; reviews_count: number; rating: number } | null> {
  const { data, error } = await supabase
    .from(WORKER_DIRECTORY)
    .select('id, rating, reviews_count')
    .eq('role', 'jobseeker')
    .order('rating', { ascending: false, nullsFirst: false })
    .order('reviews_count', { ascending: false, nullsFirst: false });
  if (error || !data) { console.error('[getProfileRanking]', error); return null; }
  const idx = data.findIndex(p => p.id === profileId);
  if (idx === -1) return null;
  return {
    rank: idx + 1,
    total: data.length,
    reviews_count: data[idx].reviews_count || 0,
    rating: data[idx].rating || 0,
  };
}

// ─── Newsletter ────────────────────────────────────────────────────────────

export async function subscribeNewsletter(email: string, name?: string): Promise<{ error?: string }> {
  const { data: result, error } = await supabase
    .rpc('newsletter_subscribe', { p_email: email, p_name: name || '' });
  if (error) {
    // Until the hardened function is deployed, fall back to the legacy RPC.
    const isMissing = error.code === 'PGRST202' || error.code === '42883' || /does not exist|Could not find the function|not found/i.test(error.message || '');
    if (isMissing) {
      const { error: legacyError } = await supabase
        .rpc('admin_newsletter', { action: 'add', p_email: email, p_name: name || '' });
      if (legacyError) {
        if (legacyError.code === '23505' || legacyError.message?.includes('23505') || legacyError.message?.includes('duplicate'))
          return { error: 'This email is already subscribed.' };
        return { error: 'Subscription failed. Please try again.' };
      }
      return {};
    }
    if (error.code === '23505' || error.message?.includes('23505') || error.message?.includes('duplicate'))
      return { error: 'This email is already subscribed.' };
    return { error: 'Subscription failed. Please try again.' };
  }
  if (typeof result === 'string' && result) return { error: result };
  return {};
}

export async function getNewsletterSubscribers(): Promise<{ email: string; name: string; created_at: string }[]> {
  const { data, error } = await supabase
    .rpc('admin_newsletter', { action: 'list' });
  if (error && error.name !== 'AbortError') { console.error('getNewsletterSubscribers error:', error); return []; }
  return (data || []) as { email: string; name: string; created_at: string }[];
}

export async function getNewsletterSubscriberCount(): Promise<number> {
  const { data, error } = await supabase.rpc('get_newsletter_subscriber_count');
  if (error && error.name !== 'AbortError' && error.code !== 'PGRST202' && !(error as any).status) { console.error('getNewsletterSubscriberCount error:', error); return 0; }
  return typeof data === 'number' ? data : 0;
}

export async function deleteNewsletterSubscriber(email: string): Promise<{ error?: string }> {
  const { error } = await supabase
    .rpc('admin_newsletter', { action: 'delete', p_email: email });
  if (error) return { error: 'Failed to delete subscriber.' };
  return {};
}

// ─── Custom Categories ──────────────────────────────────────────────────────

export async function getCustomCategories(type?: 'job' | 'service'): Promise<string[]> {
  let query = supabase.from('custom_categories').select('name, type').order('name');
  if (type) query = query.eq('type', type);
  const { data } = await query;
  return (data || []).map(c => c.name);
}

export async function addCustomCategory(name: string, type: 'job' | 'service'): Promise<{ error?: string }> {
  const { error } = await supabase.from('custom_categories').insert({ name, type });
  if (error) {
    if (error.code === '23505') return { error: 'Category already exists.' };
    return { error: error.message };
  }
  return {};
}

export async function deleteCustomCategory(name: string, type: 'job' | 'service'): Promise<{ error?: string }> {
  const { error } = await supabase.from('custom_categories').delete().eq('name', name).eq('type', type);
  if (error) return { error: error.message };
  return {};
}

// ─── Advertisements ──────────────────────────────────────────────────────────

export async function getActiveAds(featured?: boolean) {
  let query = supabase
    .from('advertisements')
    .select('*')
    .eq('active', true);
  if (typeof featured === 'boolean') {
    query = query.eq('featured', featured);
  }
  const { data, error } = await query.order('featured', { ascending: false }).order('sort_order');
  if (error) throw error;
  // Auto-expire boosts: un-feature ads whose boost_until has passed
  const now = new Date().toISOString();
  const expired = (data || []).filter(ad => ad.featured && ad.boost_until && ad.boost_until < now);
  if (expired.length > 0) {
    expired.forEach(ad => {
      void supabase.from('advertisements').update({ featured: false, boost_until: null }).eq('id', ad.id);
    });
  }
  return (data || []).filter(ad => !ad.boost_until || ad.boost_until >= now || !ad.featured);
}

export async function getRailAds(slot: string): Promise<DbAdvertisement[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('advertisements')
    .select('*')
    .eq('active', true)
    .eq('slot', slot)
    .or(`billing_start.is.null,billing_start.lte.${now},billing_end.is.null,billing_end.gte.${now}`)
    .order('featured', { ascending: false })
    .order('sort_order');
  if (error) throw error;
  // Only the reserved branded strips are corporate-only. The homepage carousel
  // also feeds the Jobs/Services rail, where an ordinary paid banner belongs —
  // filtering unconditionally here is what kept plain banners off the site.
  if (!isCorporateOnlySlot(slot)) return data || [];
  return (data || []).filter((a: DbAdvertisement) => a.corporate_account_id || a.corporate_tier);
}

export async function incrementAdClick(adId: string) {
  const { error } = await supabase.rpc('increment_ad_click', { ad_id: adId });
  if (error) console.error('[Ad] click increment failed:', error);
  await logAdEvent(adId, 'click');
}

export async function incrementAdDisplay(adId: string) {
  const { error } = await supabase.rpc('increment_ad_display', { ad_id: adId });
  if (error) console.error('[Ad] display increment failed:', error);
  await logAdEvent(adId, 'impression');
}

export async function incrementServiceAdViews(serviceAdId: string) {
  const { error } = await supabase.rpc('increment_service_ad_views', { p_ad_id: serviceAdId });
  if (error) console.error('[ServiceAd] view increment failed:', error);
}

export async function incrementServiceAdClicks(serviceAdId: string) {
  const { error } = await supabase.rpc('increment_service_ad_clicks', { p_ad_id: serviceAdId });
  if (error) console.error('[ServiceAd] click increment failed:', error);
}

// ─── Advert Analytics ──────────────────────────────────────────────────────

export async function logAdEvent(adId: string, eventType: 'click' | 'impression') {
  const { error } = await supabase.from('advert_analytics').insert({ ad_id: adId, event_type: eventType });
  if (error) console.error('[Ad] analytics log failed:', error);
}

export interface AdAnalyticsPoint {
  date: string;
  clicks: number;
  impressions: number;
}

export interface AdAnalyticsByAd {
  adId: string;
  title: string;
  active: boolean;
  created_at: string;
  data: AdAnalyticsPoint[];
  totalClicks: number;
  totalImpressions: number;
}

export interface DbAdvertisement {
  id: string;
  title: string;
  image_url: string;
  images?: string[];
  destination_url: string | null;
  description?: string | null;
  cta_text?: string | null;
  whatsapp_number?: string | null;
  is_affiliate: boolean;
  active: boolean;
  featured: boolean;
  boost_until?: string | null;
  sort_order: number;
  owner_id?: string | null;
  owner_email?: string | null;
  billing_cycle?: string | null;
  billing_start?: string | null;
  billing_end?: string | null;
  last_invoice_at?: string | null;
  clicks?: number;
  displays?: number;
  slot?: string;
  target_county?: string | null;
  target_subcounty?: string | null;
  expected_impressions?: number;
  corporate_tier?: string | null;
  corporate_account_id?: string | null;
  created_at: string;
}

export async function boostAd(table: 'advertisements' | 'service_ads' | 'jobs', adId: string) {
  // Boosts stack: a new boost adds 7 days onto the current boost_until when one
  // is still active, otherwise it starts a fresh 7-day window.
  const now = new Date();
  const { data: row } = await supabase
    .from(table)
    .select('boost_until')
    .eq('id', adId)
    .maybeSingle();
  const base = row?.boost_until && new Date(row.boost_until) > now
    ? new Date(row.boost_until).getTime()
    : now.getTime();
  const boostUntil = new Date(base + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from(table)
    .update({ featured: true, boost_until: boostUntil })
    .eq('id', adId);
  if (error) throw error;
}

// ─── Billing ─────────────────────────────────────────────────────────────────

export interface BillingItem {
  id: string;
  item_type: 'advert' | 'service_ad';
  title: string;
  business_name: string;
  owner_id: string | null;
  owner_email: string | null;
  billing_cycle: string;
  amount: number;
  billing_start: string | null;
  billing_end: string | null;
  last_invoice_at: string | null;
  featured: boolean;
  active: boolean;
  status: 'due' | 'expired' | 'ok';
}

const SERVICE_PLAN_PRICE: Record<string, number> = { '10-day': 300, '20-day': 500, '30-day': 800 };
// Banner cycle gate pricing (10/20/30 days). '7 days' kept only for legacy rows.
const ADVERT_CYCLE_PRICE: Record<string, number> = { '10 days': 300, '20 days': 500, '30 days': 800, '7 days': 200 };
const advertAmount = (ad: any): number => {
  return ADVERT_CYCLE_PRICE[ad?.billing_cycle ?? '10 days'] ?? 300;
};
const DUE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // alert within 7 days of expiry

export async function getBillingItems(): Promise<BillingItem[]> {
  const [advRes, adRes, profilesRes] = await Promise.all([
    supabase.from('advertisements').select('*').order('created_at', { ascending: false }),
    supabase.from('service_ads').select('*').order('created_at', { ascending: false }),
    supabase.from('profiles').select('id,email'),
  ]);
  if (advRes.error) console.error('getBillingItems advertisements error:', advRes.error);
  if (adRes.error) console.error('getBillingItems service_ads error:', adRes.error);
  if (profilesRes.error) console.error('getBillingItems profiles error:', profilesRes.error);

  const emailByOwner = new Map<string, string | null>();
  (profilesRes.data || []).forEach((p: any) => emailByOwner.set(p.id, p.email || null));

  const now = Date.now();
  const todayStr = new Date().toISOString().split('T')[0];
  const statusOf = (endMs: number | null): BillingItem['status'] => {
    if (endMs == null) return 'ok';
    if (endMs < now) return 'expired';
    if (endMs - now <= DUE_WINDOW_MS) return 'due';
    return 'ok';
  };

  const items: BillingItem[] = [];

  (advRes.data || []).forEach((ad: any) => {
    if (ad.is_affiliate) return; // partnership banners are not billed
    const end = ad.billing_end ? new Date(ad.billing_end).getTime() : null;
    const ownerEmail = (ad.owner_email || (ad.owner_id ? emailByOwner.get(ad.owner_id) : null) || null) as string | null;
    items.push({
      id: ad.id,
      item_type: 'advert',
      title: ad.title || 'Advert',
      business_name: ad.title || 'Advert',
      owner_id: ad.owner_id || null,
      owner_email: ownerEmail,
      billing_cycle: ad.billing_cycle || '7 days',
      amount: advertAmount(ad),
      billing_start: ad.billing_start || null,
      billing_end: ad.billing_end || null,
      last_invoice_at: ad.last_invoice_at || null,
      featured: !!ad.featured,
      active: !!ad.active,
      status: statusOf(end),
    });
  });

  (adRes.data || []).forEach((ad: any) => {
    const end = ad.billing_end
      ? new Date(ad.billing_end).getTime()
      : ad.expiry_date ? new Date(`${ad.expiry_date}T00:00:00`).getTime() : null;
    const ownerEmail = (ad.owner_email || (ad.owner_id ? emailByOwner.get(ad.owner_id) : null) || null) as string | null;
    items.push({
      id: ad.id,
      item_type: 'service_ad',
      title: ad.business_name || ad.title || 'Business Advert',
      business_name: ad.business_name || ad.title || 'Business Advert',
      owner_id: ad.owner_id || null,
      owner_email: ownerEmail,
      billing_cycle: ad.billing_cycle || (ad.plan === '10-day' ? '10 days' : ad.plan === '20-day' ? '20 days' : '30 days'),
      amount: SERVICE_PLAN_PRICE[ad.plan] || 800,
      billing_start: ad.billing_start || null,
      billing_end: ad.billing_end || null,
      last_invoice_at: ad.last_invoice_at || null,
      featured: !!ad.featured,
      active: !!ad.expiry_date && ad.expiry_date >= todayStr,
      status: statusOf(end),
    });
  });

  return items.sort((a, b) => {
    const aMs = a.billing_end ? new Date(a.billing_end).getTime() : 0;
    const bMs = b.billing_end ? new Date(b.billing_end).getTime() : 0;
    return aMs - bMs;
  });
}

export interface BillingNotification {
  id: string;
  item_type: string;
  item_id: string;
  business_name: string | null;
  recipient_email: string;
  subject: string | null;
  amount: number | null;
  due_date: string | null;
  status: string;
  error: string | null;
  created_at: string;
}

export async function getBillingNotifications(limit = 100): Promise<BillingNotification[]> {
  const { data, error } = await supabase
    .from('billing_notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) { console.error('getBillingNotifications error:', error); return []; }
  return (data || []) as BillingNotification[];
}

export async function adminResetPassword(userId: string, newPassword: string): Promise<{ error?: string }> {
  const { error } = await supabase.rpc('admin_reset_password', { p_user_id: userId, p_new_password: newPassword });
  if (error) return { error: error.message };
  return {};
}

// ─── Email Providers ────────────────────────────────────────────────────────

export interface DbEmailProvider {
  id: string;
  name: string;
  username: string;
  password?: string;
  imap_host: string;
  imap_port: number;
  smtp_host: string;
  smtp_port: number;
  from_name?: string;
  from_email?: string;
  is_active: boolean;
  created_at: string;
}

export async function getEmailProviders(): Promise<DbEmailProvider[]> {
  const { data, error } = await supabase
    .from('email_providers')
    .select('id, name, username, imap_host, imap_port, smtp_host, smtp_port, from_name, from_email, is_active, created_at')
    .order('created_at', { ascending: false });
  if (error) { console.error('getEmailProviders error:', error); return []; }
  return (data || []).map(p => ({ ...p, password: '' })) as DbEmailProvider[];
}

export async function saveEmailProvider(provider: Partial<DbEmailProvider>): Promise<{ error?: string }> {
  if (provider.is_active) {
    // Only one provider may be active at a time.
    let query = supabase.from('email_providers').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000');
    if (provider.id) {
      query = query.neq('id', provider.id);
    }
    const { error: resetError } = await query;
    if (resetError) return { error: resetError.message };
  }
  const { id, password, ...rest } = provider;
  if (id) {
    const { error } = await supabase
      .from('email_providers')
      .update({ ...rest, ...(password ? { password } : {}), updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from('email_providers').insert({ ...rest, password: password || '' });
    if (error) return { error: error.message };
  }
  return {};
}

export async function deleteEmailProvider(id: string): Promise<{ error?: string }> {
  const { error } = await supabase.from('email_providers').delete().eq('id', id);
  if (error) return { error: error.message };
  return {};
}

// ─── Corporate Accounts ─────────────────────────────────────────────────────

export interface DbCorporateAccount {
  id: string;
  company_name: string;
  tier: 'bronze' | 'silver' | 'gold' | 'custom';
  is_active: boolean;
  contact_person?: string;
  contact_phone?: string;
  contact_email?: string;
  billing_email?: string;
  notes?: string;
  features?: SavedCorporateFeatures | null;
  monthly_price?: number | null;
  custom_amount?: number | null;
  next_billing_date?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbCorporateInvoice {
  id: string;
  account_id: string;
  period_start: string;
  period_end: string;
  amount: number;
  status: 'draft' | 'issued' | 'paid' | 'overdue' | 'void';
  payment_type: string | null;
  due_date: string | null;
  issued_at: string | null;
  created_at: string;
  updated_at: string;
  company_name?: string;
}

export interface DbCorporateMember {
  id: string;
  account_id: string;
  profile_id: string;
  member_role: 'owner' | 'member';
  created_at: string;
  full_name?: string;
  email?: string;
}

export async function getCorporateAccounts(): Promise<DbCorporateAccount[]> {
  const { data, error } = await proxyRequest('/rest/v1/corporate_accounts?select=*&order=company_name');
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as DbCorporateAccount[];
}

export async function getMyCorporateAccount(userId: string): Promise<DbCorporateAccount | null> {
  const { data: membership } = await proxyRequest(`/rest/v1/corporate_members?profile_id=eq.${userId}&select=account_id`);
  const arr = Array.isArray(membership) ? membership : [];
  if (arr.length === 0) return null;
  const accountId = arr[0].account_id;
  const { data } = await proxyRequest(`/rest/v1/corporate_accounts?id=eq.${accountId}`);
  const accounts = Array.isArray(data) ? data : [];
  return (accounts[0] as DbCorporateAccount) || null;
}

export async function getCorporateMembers(accountId: string): Promise<DbCorporateMember[]> {
  const { data, error } = await proxyRequest(`/rest/v1/corporate_members?account_id=eq.${accountId}&select=*,profiles(full_name,email)`, 'GET', undefined, { Prefer: 'return=representation' });
  if (error) throw error;
  const rows = Array.isArray(data) ? data : [];
  return rows.map((r: any) => ({ ...r, full_name: r.profiles?.full_name, email: r.profiles?.email })) as DbCorporateMember[];
}

export async function getCorporateAccountAds(accountId: string) {
  const { data, error } = await supabase
    .from('advertisements')
    .select('*')
    .eq('corporate_account_id', accountId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data || [];
}

// ─── Corporate-linked jobs & services ────────────────────────────────────────

export async function getAccountLinkedJobs(accountId: string): Promise<DbJob[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('corporate_account_id', accountId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as DbJob[];
}

export async function getAccountLinkedServiceAds(accountId: string): Promise<DbServiceAd[]> {
  const { data, error } = await supabase
    .from('service_ads')
    .select('*')
    .eq('corporate_account_id', accountId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as DbServiceAd[];
}

export async function getCorporateMemberContent(
  accountId: string,
  memberProfileIds: string[]
): Promise<{ jobs: DbJob[]; services: DbServiceAd[] }> {
  const jobs: DbJob[] = [];
  const services: DbServiceAd[] = [];
  if (memberProfileIds.length === 0) return { jobs, services };
  await Promise.all([
    (async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .in('posted_by', memberProfileIds)
        .order('created_at', { ascending: false });
      if (!error) jobs.push(...(data || []));
    })(),
    (async () => {
      const { data, error } = await supabase
        .from('service_ads')
        .select('*')
        .in('owner_id', memberProfileIds)
        .order('created_at', { ascending: false });
      if (!error) services.push(...(data || []));
    })(),
  ]);
  return { jobs, services };
}

export async function setCorporateLink(
  table: 'jobs' | 'service_ads',
  id: string,
  accountId: string | null,
  tier: string | null
) {
  const patch: Record<string, string | null> = { corporate_account_id: accountId, corporate_tier: accountId ? tier : null };
  const { error } = await supabase.from(table).update(patch).eq('id', id);
  if (error) throw error;
}

const corporateCompanyNameCache = new Map<string, string | null>();

export async function getCorporateCompanyName(accountId?: string | null): Promise<string | null> {
  if (!accountId) return null;
  if (corporateCompanyNameCache.has(accountId)) return corporateCompanyNameCache.get(accountId)!;
  const { data, error } = await supabase
    .from('corporate_accounts')
    .select('company_name')
    .eq('id', accountId)
    .single();
  const name = error || !data ? null : (data.company_name as string) || null;
  corporateCompanyNameCache.set(accountId, name);
  return name;
}

export async function getCorporateAdAnalytics(accountId: string, days = 30): Promise<AdAnalyticsByAd[]> {
  const ads = await getCorporateAccountAds(accountId);
  if (ads.length === 0) return [];
  const adIds = ads.map(a => a.id);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data: rows } = await supabase
    .from('advert_analytics')
    .select('ad_id, event_type, created_at')
    .in('ad_id', adIds)
    .gte('created_at', since);
  const analytics = rows || [];
  return ads.map(ad => {
    const adAnalytics = analytics.filter(a => a.ad_id === ad.id);
    const byDate: Record<string, { clicks: number; impressions: number }> = {};
    let totalClicks = 0;
    let totalImpressions = 0;
    for (const row of adAnalytics) {
      const d = new Date(row.created_at).toISOString().slice(0, 10);
      if (!byDate[d]) byDate[d] = { clicks: 0, impressions: 0 };
      if (row.event_type === 'click') { byDate[d].clicks++; totalClicks++; }
      else if (row.event_type === 'impression') { byDate[d].impressions++; totalImpressions++; }
    }
    return {
      adId: ad.id,
      title: ad.title,
      active: ad.active,
      created_at: ad.created_at,
      data: Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v })),
      totalClicks,
      totalImpressions,
    };
  });
}

export async function getCorporateInvoices(accountId: string): Promise<DbCorporateInvoice[]> {
  const { data, error } = await proxyRequest(
    `/rest/v1/corporate_invoices?account_id=eq.${accountId}&select=*&order=period_start.desc`,
    'GET'
  );
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as DbCorporateInvoice[];
}

export async function getAllCorporateInvoices(): Promise<(DbCorporateInvoice & { company_name?: string })[]> {
  const { data, error } = await proxyRequest(
    '/rest/v1/corporate_invoices?select=*,corporate_accounts(company_name)&order=created_at.desc',
    'GET',
    undefined,
    { Prefer: 'return=representation' }
  );
  if (error) throw error;
  const rows = Array.isArray(data) ? data : [];
  return rows.map((r: any) => ({
    ...r,
    company_name: r.corporate_accounts?.company_name,
  })) as any[];
}

export async function getCorporateAccountsWithStatus(): Promise<DbCorporateAccount[]> {
  const { data, error } = await proxyRequest(
    '/rest/v1/corporate_accounts?select=*&order=company_name',
    'GET'
  );
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as DbCorporateAccount[];
}

interface EdgeCallOptions {
  action?: string;
  accountId?: string;
  periodStart?: string;
  invoiceId?: string;
}

async function callCorporateEdge(fn: string, body: EdgeCallOptions) {
  const token = await ensureValidToken();
  const res = await fetch(`${supabaseUrl}/functions/v1/${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: supabaseKey, Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || `Edge function ${fn} failed`);
  return result;
}

/** Admin: preview/send an invoice for a corporate account period. */
export async function issueCorporateInvoice(opts: { accountId: string; periodStart?: string; send?: boolean }): Promise<any> {
  return callCorporateEdge('issue-corporate-invoice', {
    action: opts.send ? 'send' : 'preview',
    accountId: opts.accountId,
    periodStart: opts.periodStart,
  });
}

/** Admin: manually mark a corporate invoice as paid. */
export async function markCorporateInvoicePaid(invoiceId: string): Promise<any> {
  return callCorporateEdge('issue-corporate-invoice', { action: 'mark_paid', invoiceId });
}

/** Admin: manually run the monthly invoicing cycle (auto-invoice + digest). */
export async function runMonthlyCorporateBilling(): Promise<any> {
  return callCorporateEdge('corporate-monthly-billing', {});
}
export async function toggleProfileContactDisplay(userId: string, enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ allow_contact_display: enabled })
    .eq('id', userId);
  if (error) throw error;
}