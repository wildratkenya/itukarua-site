import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { getJobs, getServiceAds, getProfiles, getPayments, getMessages, type DbJob, type DbServiceAd, type DbProfile, type DbPayment, type DbMessage } from '@/lib/database';

// ─── Jobs ───────────────────────────────────────────────────────────────────

export function useJobs(filters?: {
  category?: string;
  location?: string;
  search?: string;
  status?: string;
  limit?: number;
  postedBy?: string;
}) {
  return useQuery({
    queryKey: ['jobs', filters],
    queryFn: () => getJobs({ ...filters, limit: filters?.limit || 50 }), // Default limit of 50
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useJob(jobId: string) {
  return useQuery({
    queryKey: ['job', jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!jobId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

// ─── Service Ads ────────────────────────────────────────────────────────────

export function useServiceAds(filters?: {
  category?: string;
  location?: string;
  search?: string;
  featured?: boolean;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['serviceAds', filters],
    queryFn: () => getServiceAds({ ...filters, limit: filters?.limit || 50 }), // Default limit of 50
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useServiceAd(adId: string) {
  return useQuery({
    queryKey: ['serviceAd', adId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_ads')
        .select('*')
        .eq('id', adId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!adId,
    staleTime: 0,
  });
}

// ─── Profiles ───────────────────────────────────────────────────────────────

export function useProfiles(filters?: {
  role?: string;
  location?: string;
  search?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['profiles', filters],
    queryFn: () => getProfiles({ ...filters, limit: filters?.limit || 50 }), // Default limit of 50
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useProfile(userId: string) {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    staleTime: 0,
  });
}

// ─── Payments ───────────────────────────────────────────────────────────────

export function usePayments(filters?: {
  userId?: string;
  status?: string;
  paymentType?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['payments', filters],
    queryFn: () => getPayments(filters),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000,
  });
}

// ─── Messages ───────────────────────────────────────────────────────────────

export function useMessages(filters?: {
  senderId?: string;
  receiverId?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['messages', filters],
    queryFn: () => getMessages(filters),
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000,
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

export function useCreateJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (jobData: Partial<DbJob>) => {
      const { data, error } = await supabase
        .from('jobs')
        .insert(jobData)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useUpdateJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<DbJob> }) => {
      const { data, error } = await supabase
        .from('jobs')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job'] });
    },
  });
}

export function useDeleteJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('jobs')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useCreateServiceAd() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (adData: Partial<DbServiceAd>) => {
      const { data, error } = await supabase
        .from('service_ads')
        .insert(adData)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceAds'] });
    },
  });
}

export function useUpdateServiceAd() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<DbServiceAd> }) => {
      const { data, error } = await supabase
        .from('service_ads')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceAds'] });
      queryClient.invalidateQueries({ queryKey: ['serviceAd'] });
    },
  });
}

export function useDeleteServiceAd() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('service_ads')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceAds'] });
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<DbProfile> }) => {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

export function useDeleteProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    },
  });
}