import { supabase, proxyRequest, proxyTable, proxyRpc } from './supabase';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DbProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: 'super_admin' | 'admin' | 'advertiser' | 'jobseeker' | 'employer';
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
  images?: string[];
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
  bidder_county?: string;
  bidder_subcounty?: string;
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
  expiry_date: string;
  featured: boolean;
  boost_until?: string | null;
  rating: number;
  reviews_count: number;
  owner_id: string;
  owner_email?: string | null;
  billing_cycle?: string | null;
  billing_start?: string | null;
  billing_end?: string | null;
  last_invoice_at?: string | null;
  payment_confirmed: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbPayment {
  id: string;
  user_id: string;
  payment_type: 'registration' | 'contact_access' | 'job_posting' | 'job_payment' | 'advert' | 'featured_boost' | 'single_job_post';
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

export async function getProfiles(filters?: {
  role?: string;
  location?: string;
  county?: string;
  search?: string;
  limit?: number;
  ratings_enabled?: boolean;
}): Promise<DbProfile[]> {
  let query = supabase.from('profiles').select('*');

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
  return data as DbProfile[];
}

// ─── Jobs ───────────────────────────────────────────────────────────────────

export async function getJobs(filters?: {
  category?: string;
  location?: string;
  county?: string;
  search?: string;
  status?: string;
  activeOnly?: boolean;
  limit?: number;
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
    query = query.eq('status', 'open');
  }
  if (filters?.postedBy) {
    query = query.eq('posted_by', filters.postedBy);
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

  query = query.order('created_at', { ascending: false });

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;
  if (error) { 
    if (error.message?.includes('AbortError')) return [];
    console.error('getJobs error:', error); 
    return []; 
  }
  return data as DbJob[];
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
  search?: string;
  ownerId?: string;
  activeOnly?: boolean;
  limit?: number;
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
  if (filters?.ownerId) {
    query = query.eq('owner_id', filters.ownerId);
  }
  if (filters?.activeOnly) {
    query = query.gte('expiry_date', new Date().toISOString().split('T')[0]);
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

  if (filters?.limit) {
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
      supabase.from('service_ads').update({ featured: false, boost_until: null }).eq('id', ad.id).then(() => {}).catch(() => {});
    });
  }
  return results.filter(ad => !ad.boost_until || ad.boost_until >= now || !ad.featured);
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
}): Promise<DbServiceAd> {
  const days = ad.plan === '10-day' ? 10 : ad.plan === '20-day' ? 20 : 30;
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + days);
  const billingCycle = ad.plan === '10-day' ? '10 days' : ad.plan === '20-day' ? '20 days' : '30 days';

  const { data, error } = await supabase
    .from('service_ads')
    .insert({
      ...ad,
      expiry_date: expiryDate.toISOString().split('T')[0],
      billing_cycle: billingCycle,
      billing_start: new Date().toISOString(),
      billing_end: expiryDate.toISOString(),
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

export async function checkContactAccess(userId: string, profileId: string): Promise<boolean> {
  const { data } = await supabase
    .from('payments')
    .select('id')
    .eq('user_id', userId)
    .eq('payment_type', 'contact_access')
    .eq('related_profile_id', profileId)
    .eq('status', 'completed')
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

export async function countRecentSingleJobs(userId: string): Promise<number> {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const { count, error } = await supabase
    .from('payments')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('payment_type', 'single_job_post')
    .eq('status', 'completed')
    .gte('created_at', since.toISOString());
  if (error) return 0;
  return count || 0;
}

export async function redeemToken(token: string): Promise<{ profileId: string } | null> {
  const { data } = await supabase
    .from('payments')
    .select('related_profile_id')
    .eq('token', token)
    .eq('payment_type', 'contact_access')
    .eq('status', 'completed')
    .maybeSingle();
  if (!data?.related_profile_id) return null;
  return { profileId: data.related_profile_id };
}

// ─── Terms & Conditions ─────────────────────────────────────────────────────

export async function acceptTerms(userId: string, dataSharingConsent: boolean): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({
      terms_accepted: true,
      data_sharing_consent: dataSharingConsent,
      accepted_terms_at: new Date().toISOString()
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

    const { data: otherProfile } = await supabase
      .from('profiles')
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
  await supabase.from('profiles').update({ subscription_expires_at: base.toISOString() }).eq('id', userId);
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
    .from('profiles')
    .select('id, skills, county')
    .eq('role', 'jobseeker')
    .not('subscription_expires_at', 'is', null);

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

export interface AdCarouselSettings {
  scrollIntervalSeconds: number;
  transitionDurationSeconds: number;
  effect: 'slide' | 'fade';
}

export async function getAdCarouselSettings(): Promise<AdCarouselSettings> {
  const { data, error } = await supabase
    .from('ad_carousel_settings')
    .select('key, value');
  if (error && error.name !== 'AbortError') { console.error('getAdCarouselSettings error:', error); return { scrollIntervalSeconds: 5, transitionDurationSeconds: 0.8, effect: 'slide' }; }
  const map: Record<string, string> = {};
  (data || []).forEach((s: any) => { map[s.key] = s.value; });
  return {
    scrollIntervalSeconds: parseFloat(map['scroll_interval_seconds']) || 5,
    transitionDurationSeconds: parseFloat(map['transition_duration_seconds']) || 0.8,
    effect: map['effect'] === 'fade' ? 'fade' : 'slide',
  };
}

export async function updateAdCarouselSetting(key: string, value: string): Promise<void> {
  const { error } = await supabase
    .from('ad_carousel_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// ─── Website Carousel Settings ──────────────────────────────────────────────

export interface WebsitesCarouselSettings {
  scrollIntervalSeconds: number;
  transitionDurationSeconds: number;
  effect: 'slide' | 'fade' | 'zoom';
}

export async function getWebsitesCarouselSettings(): Promise<WebsitesCarouselSettings> {
  const { data, error } = await supabase
    .from('ad_carousel_settings')
    .select('key, value');
  if (error && error.name !== 'AbortError') { console.error('getWebsitesCarouselSettings error:', error); return { scrollIntervalSeconds: 5, transitionDurationSeconds: 0.8, effect: 'slide' }; }
  const map: Record<string, string> = {};
  (data || []).forEach((s: any) => { map[s.key] = s.value; });
  const effect = map['web_effect'];
  return {
    scrollIntervalSeconds: parseFloat(map['web_scroll_interval_seconds']) || 5,
    transitionDurationSeconds: parseFloat(map['web_transition_duration_seconds']) || 0.8,
    effect: (effect === 'fade' || effect === 'zoom') ? effect : 'slide',
  };
}

export async function updateWebsitesCarouselSetting(key: 'web_scroll_interval_seconds' | 'web_transition_duration_seconds' | 'web_effect', value: string): Promise<void> {
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
    .from('profiles')
    .select('id, rating, reviews_count')
    .eq('role', 'jobseeker')
    .order('rating', { ascending: false, nullsLast: true })
    .order('reviews_count', { ascending: false, nullsLast: true });
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
  const { error } = await supabase
    .rpc('admin_newsletter', { action: 'add', p_email: email, p_name: name || '' });
  if (error) {
    if (error.code === '23505' || error.message?.includes('23505') || error.message?.includes('duplicate'))
      return { error: 'This email is already subscribed.' };
    return { error: 'Subscription failed. Please try again.' };
  }
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
      supabase.from('advertisements').update({ featured: false, boost_until: null }).eq('id', ad.id).then(() => {}).catch(() => {});
    });
  }
  return (data || []).filter(ad => !ad.boost_until || ad.boost_until >= now || !ad.featured);
}

export async function getAllAds() {
  const { data, error } = await supabase
    .from('advertisements')
    .select('*')
    .order('sort_order');
  if (error) throw error;
  return data || [];
}

export async function createAd(ad: { title: string; image_url: string; images?: string[]; destination_url: string; is_affiliate?: boolean; sort_order?: number; featured?: boolean }) {
  const nowIso = new Date().toISOString();
  const billingEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('advertisements')
    .insert({
      ...ad,
      billing_cycle: '7 days',
      billing_start: nowIso,
      billing_end: billingEnd,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data;
}

export async function updateAd(id: string, updates: Partial<{ title: string; image_url: string; images: string[]; destination_url: string; is_affiliate: boolean; active: boolean; sort_order: number; featured: boolean }>) {
  const { error } = await supabase
    .from('advertisements')
    .update(updates)
    .eq('id', id);
  if (error) throw error;
}

export async function deleteAd(id: string) {
  const { error } = await supabase
    .from('advertisements')
    .delete()
    .eq('id', id);
  if (error) throw error;
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

export async function getAdAnalyticsByAd(userId: string, days: number = 30): Promise<AdAnalyticsByAd[]> {
  const ads = await getMyAds(userId);
  if (ads.length === 0) return [];
  const adIds = ads.map(a => a.id);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('advert_analytics')
    .select('ad_id, event_type, created_at')
    .in('ad_id', adIds)
    .gte('created_at', since)
    .order('created_at', { ascending: true });

  if (error) { console.error('getAdAnalyticsByAd error:', error); return []; }

  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const dateKeys: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    dateKeys.push(d.toISOString().slice(0, 10));
  }

  const byAd: Record<string, Record<string, { clicks: number; impressions: number }>> = {};
  for (const ad of ads) {
    byAd[ad.id] = {};
    for (const key of dateKeys) byAd[ad.id][key] = { clicks: 0, impressions: 0 };
  }

  for (const row of data || []) {
    const key = row.created_at.slice(0, 10);
    if (!byAd[row.ad_id]) byAd[row.ad_id] = {};
    if (!byAd[row.ad_id][key]) byAd[row.ad_id][key] = { clicks: 0, impressions: 0 };
    if (row.event_type === 'click') byAd[row.ad_id][key].clicks++;
    else byAd[row.ad_id][key].impressions++;
  }

  return ads.map(ad => {
    const byDate = byAd[ad.id] || {};
    const analyticsData = Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v }));
    const totalClicks = analyticsData.reduce((s, p) => s + p.clicks, 0);
    const totalImpressions = analyticsData.reduce((s, p) => s + p.impressions, 0);
    return { adId: ad.id, title: ad.title, active: ad.active, created_at: ad.created_at, data: analyticsData, totalClicks, totalImpressions };
  });
}

export async function getAdAnalytics(userId: string, days: number = 30): Promise<AdAnalyticsPoint[]> {
  const ads = await getMyAds(userId);
  if (ads.length === 0) return [];
  const adIds = ads.map(a => a.id);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('advert_analytics')
    .select('event_type, created_at')
    .in('ad_id', adIds)
    .gte('created_at', since)
    .order('created_at', { ascending: true });

  if (error) { console.error('getAdAnalytics error:', error); return []; }

  const byDate: Record<string, { clicks: number; impressions: number }> = {};
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    byDate[key] = { clicks: 0, impressions: 0 };
  }

  for (const row of data || []) {
    const key = row.created_at.slice(0, 10);
    if (!byDate[key]) byDate[key] = { clicks: 0, impressions: 0 };
    if (row.event_type === 'click') byDate[key].clicks++;
    else byDate[key].impressions++;
  }

  return Object.entries(byDate).map(([date, v]) => ({ date, ...v }));
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
  created_at: string;
}

export async function getMyAds(userId: string): Promise<DbAdvertisement[]> {
  const { data, error } = await supabase
    .from('advertisements')
    .select('*')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });
  if (error) { console.error('getMyAds error:', error); return []; }
  return data || [];
}

export async function getActiveAdsBySlot(slot: string): Promise<DbAdvertisement[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('advertisements')
    .select('*')
    .eq('active', true)
    .eq('slot', slot)
    .lte('billing_start', now)
    .gte('billing_end', now)
    .order('created_at', { ascending: false });
  if (error) { console.error('[getActiveAdsBySlot]', error); return []; }
  return data || [];
}

export async function createAdForUser(userId: string, ad: { title: string; image_url: string; images?: string[]; destination_url?: string | null; description?: string; cta_text?: string; whatsapp_number?: string; is_affiliate?: boolean; slot?: string }) {
  const nowIso = new Date().toISOString();
  const billingEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('advertisements')
    .insert({ ...ad, owner_id: userId, active: false, destination_url: ad.destination_url || null, billing_cycle: '7 days', billing_start: nowIso, billing_end: billingEnd, slot: ad.slot || 'homepage_banner' })
    .select('id')
    .single();
  if (error) throw error;
  return data;
}

export async function updateMyAd(id: string, userId: string, updates: Partial<{ title: string; image_url: string; images: string[]; destination_url: string | null; description: string; cta_text: string; whatsapp_number: string; is_affiliate: boolean; active: boolean }>) {
  const { error } = await supabase
    .from('advertisements')
    .update({ ...updates, destination_url: updates.destination_url ?? null })
    .eq('id', id)
    .eq('owner_id', userId);
  if (error) throw error;
}

export async function deleteMyAd(id: string, userId: string) {
  const { error } = await supabase
    .from('advertisements')
    .delete()
    .eq('id', id)
    .eq('owner_id', userId);
  if (error) throw error;
}

export async function boostAd(table: 'advertisements' | 'service_ads', adId: string) {
  const boostUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
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
      amount: ad.billing_cycle === '30 days' ? 800 : ad.billing_cycle === '20 days' ? 500 : ad.billing_cycle === '10 days' ? 300 : ad.featured ? 500 : 100,
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

// ─── Testimonials ────────────────────────────────────────────────────────────

export interface DbTestimonial {
  id: string;
  client_name: string;
  company?: string;
  comment: string;
  rating: number;
  created_at: string;
}

export async function getTestimonials(): Promise<DbTestimonial[]> {
  const { data, error } = await supabase
    .from('testimonials')
    .select('id, client_name, company, comment, rating, created_at')
    .order('created_at', { ascending: false });
  if (error) { console.error('getTestimonials error:', error); return []; }
  return (data || []) as DbTestimonial[];
}

export async function addTestimonial(input: { client_name: string; company?: string; comment: string; rating: number }): Promise<{ error?: string }> {
  const { error } = await supabase.from('testimonials').insert({
    client_name: input.client_name,
    company: input.company || null,
    comment: input.comment,
    rating: Math.min(5, Math.max(1, Math.round(input.rating) || 5)),
  });
  if (error) return { error: error.message };
  return {};
}

export async function deleteTestimonial(id: string): Promise<{ error?: string }> {
  const { error } = await supabase.from('testimonials').delete().eq('id', id);
  if (error) return { error: error.message };
  return {};
}

// ─── Portfolio Sites ─────────────────────────────────────────────────────────

export interface DbPortfolioSite {
  id: string;
  title: string;
  description?: string;
  url?: string;
  image_url?: string;
  sort_order: number;
  created_at: string;
}

export async function getPortfolioSites(): Promise<DbPortfolioSite[]> {
  const { data, error } = await supabase
    .from('portfolio_sites')
    .select('id, title, description, url, image_url, sort_order, created_at')
    .order('sort_order', { ascending: true });
  if (error) { console.error('getPortfolioSites error:', error); return []; }
  return (data || []) as DbPortfolioSite[];
}

export async function savePortfolioSite(input: Partial<DbPortfolioSite> & { title: string }): Promise<{ error?: string }> {
  const { id, ...rest } = input;
  if (id) {
    const { error } = await supabase.from('portfolio_sites').update(rest).eq('id', id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from('portfolio_sites').insert(rest);
    if (error) return { error: error.message };
  }
  return {};
}

export async function deletePortfolioSite(id: string): Promise<{ error?: string }> {
  const { error } = await supabase.from('portfolio_sites').delete().eq('id', id);
  if (error) return { error: error.message };
  return {};
}
