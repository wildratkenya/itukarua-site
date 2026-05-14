import { supabase } from './supabase';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DbProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: 'super_admin' | 'admin' | 'jobseeker' | 'employer';
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
  email_confirmed?: boolean;
  created_at: string;
  updated_at: string;
  resume?: string;
  certificates?: string[];
  ratings_enabled?: boolean;
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
}

export interface DbServiceAd {
  id: string;
  business_name: string;
  description: string;
  category: string;
  image: string;
  images: string[];
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

export interface DbMessage {
  id: string;
  sender_id: string | null;
  sender_name: string;
  sender_email: string;
  subject: string;
  message: string;
  type: 'support' | 'feedback' | 'complaint' | 'other';
  status: 'unread' | 'read' | 'replied' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  admin_response: string | null;
  responded_by: string | null;
  responded_at: string | null;
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
    .maybeSingle();
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

export async function getProfiles(filters?: {
  role?: string;
  location?: string;
  search?: string;
  limit?: number;
  ratings_enabled?: boolean;
}): Promise<DbProfile[]> {
  let query = supabase.from('profiles').select('*');

  if (filters?.role) {
    query = query.eq('role', filters.role);
  }
  if (filters?.location) {
    query = query.eq('location', filters.location);
  }
  if (filters?.search) {
    query = query.or(`full_name.ilike.%${filters.search}%,skills.ilike.%${filters.search}%`);
  }
  if (filters?.ratings_enabled) {
    query = query.eq('ratings_enabled', true).order('rating', { ascending: false }).order('reviews_count', { ascending: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;
  if (error) { 
    if (error.message?.includes('AbortError')) return [];
    console.error('getProfiles error:', error); 
    return []; 
  }
  return data as DbProfile[];
}

// ─── Jobs ───────────────────────────────────────────────────────────────────

export async function getJobs(filters?: {
  category?: string;
  location?: string;
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
  if (filters?.location && filters.location !== 'All Locations') {
    query = query.eq('location', filters.location);
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
    query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%,category.ilike.%${filters.search}%`);
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

  console.log('📡 getServiceAds: Fetching service ads with filters:', filters);
  const { data, error } = await query;
  console.log('📡 getServiceAds result:', JSON.stringify({ count: data?.length, error: error ? { message: error.message, status: error.status, code: error.code } : null }, null, 2));
  if (error) { 
    if (error.message?.includes('AbortError')) return [];
    console.error('getServiceAds error:', error); 
    return []; 
  }
  return data as DbServiceAd[];
}

export async function createServiceAd(ad: {
  business_name: string;
  description: string;
  category: string;
  image?: string;
  images?: string[];
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
