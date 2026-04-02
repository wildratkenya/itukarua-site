import { supabase } from './supabase';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DbProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: 'admin' | 'jobseeker' | 'employer';
  location: string;
  skills: string[];
  qualifications: string;
  experience: string;
  profile_image: string;
  rating: number;
  reviews_count: number;
  jobs_completed: number;
  verified: boolean;
  registration_paid: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbJob {
  id: string;
  title: string;
  description: string;
  location: string;
  budget_min: number;
  budget_max: number;
  deadline: string;
  category: string;
  posted_by: string;
  posted_by_name: string;
  urgent: boolean;
  status: 'open' | 'in-progress' | 'completed' | 'cancelled';
  bids_count: number;
  created_at: string;
  updated_at: string;
  // from view
  poster_name?: string;
  poster_image?: string;
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
}

export interface DbServiceAd {
  id: string;
  business_name: string;
  description: string;
  category: string;
  image: string;
  location: string;
  contact: string;
  plan: '10-day' | '20-day' | '30-day';
  expiry_date: string;
  featured: boolean;
  rating: number;
  reviews_count: number;
  owner_id: string;
  payment_confirmed: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbPayment {
  id: string;
  user_id: string;
  payment_type: 'registration' | 'contact_access' | 'job_posting' | 'job_payment' | 'advert' | 'featured_boost';
  amount: number;
  mpesa_ref: string;
  mpesa_phone: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  description: string;
  related_job_id: string | null;
  related_ad_id: string | null;
  related_bid_id: string | null;
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
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) { console.error('getProfile error:', error); return null; }
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

export async function getWorkers(limit = 20): Promise<DbProfile[]> {
  const { data, error } = await supabase
    .from('profiles')
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

// ─── Jobs ───────────────────────────────────────────────────────────────────

export async function getJobs(filters?: {
  category?: string;
  location?: string;
  search?: string;
  status?: string;
  limit?: number;
  postedBy?: string;
}): Promise<DbJob[]> {
  let query = supabase.from('jobs').select('*');

  if (filters?.category && filters.category !== 'All Categories') {
    query = query.eq('category', filters.category);
  }
  if (filters?.location && filters.location !== 'All Locations') {
    query = query.eq('location', filters.location);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.postedBy) {
    query = query.eq('posted_by', filters.postedBy);
  }
  if (filters?.search) {
    query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%,category.ilike.%${filters.search}%`);
  }

  query = query.order('created_at', { ascending: false });

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;
  if (error) { console.error('getJobs error:', error); return []; }
  return data || [];
}

export async function getJobById(jobId: string): Promise<DbJob | null> {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .single();
  if (error) { console.error('getJobById error:', error); return null; }
  return data;
}

export async function createJob(job: {
  title: string;
  description: string;
  location: string;
  budget_min: number;
  budget_max: number;
  deadline: string;
  category: string;
  posted_by: string;
  posted_by_name: string;
  urgent?: boolean;
}): Promise<DbJob> {
  const { data, error } = await supabase
    .from('jobs')
    .insert(job)
    .select()
    .single();
  if (error) throw error;
  return data as DbJob;
}

export async function updateJob(jobId: string, updates: Partial<DbJob>) {
  const { data, error } = await supabase
    .from('jobs')
    .update(updates)
    .eq('id', jobId)
    .select()
    .single();
  if (error) throw error;
  return data as DbJob;
}

export async function deleteJob(jobId: string) {
  const { error } = await supabase.from('jobs').delete().eq('id', jobId);
  if (error) throw error;
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
    .from('bids')
    .select('*, jobs(*)')
    .eq('bidder_id', userId)
    .order('created_at', { ascending: false });
  if (error) { console.error('getBidsByUser error:', error); return []; }
  return (data || []).map((b: any) => ({ ...b, job: b.jobs }));
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
  search?: string;
  ownerId?: string;
  activeOnly?: boolean;
  limit?: number;
}): Promise<DbServiceAd[]> {
  let query = supabase.from('service_ads').select('*');

  if (filters?.category && filters.category !== 'All Services') {
    query = query.eq('category', filters.category);
  }
  if (filters?.location && filters.location !== 'All Locations') {
    query = query.eq('location', filters.location);
  }
  if (filters?.ownerId) {
    query = query.eq('owner_id', filters.ownerId);
  }
  if (filters?.activeOnly) {
    query = query.gte('expiry_date', new Date().toISOString().split('T')[0]);
  }
  if (filters?.search) {
    query = query.or(`business_name.ilike.%${filters.search}%,description.ilike.%${filters.search}%,category.ilike.%${filters.search}%`);
  }

  query = query.order('featured', { ascending: false }).order('created_at', { ascending: false });

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;
  if (error) { console.error('getServiceAds error:', error); return []; }
  return data || [];
}

export async function createServiceAd(ad: {
  business_name: string;
  description: string;
  category: string;
  image?: string;
  location: string;
  contact: string;
  plan: '10-day' | '20-day' | '30-day';
  owner_id: string;
  featured?: boolean;
}): Promise<DbServiceAd> {
  const days = ad.plan === '10-day' ? 10 : ad.plan === '20-day' ? 20 : 30;
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + days);

  const { data, error } = await supabase
    .from('service_ads')
    .insert({
      ...ad,
      expiry_date: expiryDate.toISOString().split('T')[0],
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

// ─── Payments ───────────────────────────────────────────────────────────────

export async function getPayments(userId?: string): Promise<DbPayment[]> {
  let query = supabase.from('payments').select('*');
  if (userId) {
    query = query.eq('user_id', userId);
  }
  query = query.order('created_at', { ascending: false });
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

// ─── Stats ──────────────────────────────────────────────────────────────────

export async function getPlatformStats(): Promise<PlatformStats> {
  const { data, error } = await supabase
    .from('platform_stats')
    .select('*')
    .single();
  if (error) {
    console.error('getPlatformStats error:', error);
    return { active_jobs: 0, registered_workers: 0, active_businesses: 0, completed_jobs: 0, total_payments: 0, counties_served: 0 };
  }
  return data;
}
