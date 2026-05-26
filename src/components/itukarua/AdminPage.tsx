import React, { useState, useEffect } from 'react';
import { supabase, supabaseUrl, supabaseKey } from '@/lib/supabase';
import { getProfile, subscribeNewsletter, getNewsletterSubscribers, deleteNewsletterSubscriber, getCustomCategories, addCustomCategory, deleteCustomCategory } from '@/lib/database';
import { seedSampleData } from '@/lib/seedData';
import { JOB_CATEGORIES, SERVICE_CATEGORIES, KENYA_COUNTIES } from '@/data/siteData';
import { compressImage } from '@/lib/imageUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { TERMS_AND_CONDITIONS } from '@/data/termsContent';

interface Profile {
  id: string;
  full_name: string;
  email?: string;
  phone?: string;
  location?: string;
  skills?: string[];
  profile_image?: string;
  role: string;
  verified: boolean;
  registration_paid: boolean;
  suspended?: boolean;
  ratings_enabled?: boolean;
  created_at: string;
  resume?: string;
  certificates?: string[];
}

interface Job {
  id: string;
  title: string;
  status: string;
  category: string;
  budget: number;
  posted_by_name: string;
  created_at: string;
}

interface Ad {
  id: string;
  title: string;
  business_name: string;
  description: string;
  category: string;
  location: string;
  contact_person: string;
  contact: string;
  expiry_date: string;
  featured: boolean;
  payment_confirmed: boolean;
  images: string[];
  image: string;
  owner_id: string;
}

interface Payment {
  id: string;
  amount: number;
  status: string;
  payment_type: string;
  mpesa_ref?: string;
  description?: string;
  created_at: string;
}

interface Message {
  id: string;
  sender_name: string;
  sender_email: string;
  subject: string;
  message: string;
  type: string;
  status: string;
  priority: string;
  admin_response?: string;
  created_at: string;
}

const AdminPage: React.FC = () => {
  const [users, setUsers] = useState<Profile[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [customJobCats, setCustomJobCats] = useState<string[]>([]);
  const [customServiceCats, setCustomServiceCats] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [newCategoryType, setNewCategoryType] = useState<'job' | 'service'>('job');
  const [loading, setLoading] = useState(true);

  // Modal states for Jobs
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<any>(null);
  const [jobImages, setJobImages] = useState<File[]>([]);
  const [jobUploading, setJobUploading] = useState(false);

  // Modal states for Ads
  const [isAdModalOpen, setIsAdModalOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<any>(null);
  const [adFiles, setAdFiles] = useState<File[]>([]);
  const [adUploading, setAdUploading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [certFiles, setCertFiles] = useState<File[]>([]);
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [ratingsEnabled, setRatingsEnabled] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [dataSharingConsent, setDataSharingConsent] = useState(false);
  const [subscribeToNewsletter, setSubscribeToNewsletter] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [editProfileImageFile, setEditProfileImageFile] = useState<File | null>(null);
  const [deletingUser, setDeletingUser] = useState<Profile | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [subscribers, setSubscribers] = useState<{ email: string; name: string; created_at: string }[]>([]);
  const [newSubscriberName, setNewSubscriberName] = useState('');
  const [newSubscriberEmail, setNewSubscriberEmail] = useState('');
  const [subscriberMsg, setSubscriberMsg] = useState('');
  const [sendingNewsletter, setSendingNewsletter] = useState(false);
  const [selectedSubs, setSelectedSubs] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, []);

  const loadAds = async () => {
    const { data } = await supabase.from('service_ads').select('*').order('created_at', { ascending: false });
    setAds(data || []);
  };

  const loadJobs = async () => {
    const { data } = await supabase.from('jobs').select('*').order('created_at', { ascending: false });
    setJobs(data || []);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      // Load everything initially
      await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }).then(({data}) => setUsers(data || [])),
        loadJobs(),
        loadAds(),
        supabase.from('payments').select('*').order('created_at', { ascending: false }).then(({data}) => setPayments(data || [])),
        supabase.from('messages').select('*').order('created_at', { ascending: false }).then(({data}) => setMessages(data || [])),
        getNewsletterSubscribers().then(setSubscribers),
        getCustomCategories('job').then(setCustomJobCats),
        getCustomCategories('service').then(setCustomServiceCats),
      ]);

      // Use individual category lists for modals
      const jobCats = JOB_CATEGORIES.filter(c => c !== 'All Categories');
      const serviceCats = SERVICE_CATEGORIES.filter(c => c !== 'All Services');
      setCategories([...new Set([...jobCats, ...serviceCats])]);

    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load admin data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;

      setUsers(users.map(user =>
        user.id === userId ? { ...user, role: newRole } : user
      ));

      toast({
        title: 'Success',
        description: 'User role updated successfully',
      });
    } catch (error) {
      console.error('Error updating user role:', error);
      toast({
        title: 'Error',
        description: 'Failed to update user role',
        variant: 'destructive',
      });
    }
  };

  const toggleUserVerification = async (userId: string, currentVerified: boolean) => {
    const newVerified = !currentVerified;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ verified: newVerified, suspended: !newVerified })
        .eq('id', userId);

      if (error) throw error;

      setUsers(users.map(user =>
        user.id === userId ? { ...user, verified: newVerified, suspended: !newVerified } : user
      ));

      toast({
        title: 'Success',
        description: `User ${newVerified ? 'verified' : 'unverified'}. ${newVerified ? 'They can now log in.' : 'Login access revoked.'}`,
      });
    } catch (error) {
      console.error('Error updating verification:', error);
      toast({
        title: 'Error',
        description: 'Failed to update verification status',
        variant: 'destructive',
      });
    }
  };

  const toggleUserSuspension = async (userId: string, currentSuspended: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ suspended: !currentSuspended })
        .eq('id', userId);

      if (error) throw error;

      setUsers(users.map(user =>
        user.id === userId ? { ...user, suspended: !currentSuspended } : user
      ));

      toast({
        title: 'Success',
        description: `User account ${!currentSuspended ? 'suspended' : 'reactivated'}.`,
      });
    } catch (error) {
      console.error('Error updating suspension:', error);
      toast({
        title: 'Error',
        description: 'Failed to update user suspension status',
        variant: 'destructive',
      });
    }
  };

  const triggerPasswordReset = async (email?: string) => {
    if (!email) {
      toast({ title: 'Error', description: 'User does not have an email recorded in profiles', variant: 'destructive' });
      return;
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      toast({ title: 'Success', description: `Password reset email pushed to ${email}` });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to send reset email', variant: 'destructive' });
    }
  };

  const createUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!termsAccepted || !dataSharingConsent) return;
    console.log('[createUser] form submitted');
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const fullName = formData.get('full_name') as string;
    const phone = formData.get('phone') as string;
    const role = formData.get('role') as string;
    const location = formData.get('location') as string;
    const county = formData.get('county') as string;
    const subcounty = formData.get('subcounty') as string;
    const skills = formData.get('skills') as string;
    const resume = formData.get('resume') as string;

    setCreatingUser(true);

    const functionUrl = `${supabaseUrl}/functions/v1/create-user`;
    console.log('[createUser] functionUrl:', functionUrl);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
      console.log('[createUser] calling fetch...');
      const response = await fetch(functionUrl, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
        },
        body: JSON.stringify({
          email, password, full_name: fullName, phone, role, location, county: county || undefined, subcounty: subcounty || undefined, skills, resume,
          ratings_enabled: ratingsEnabled,
          terms_accepted: termsAccepted,
          data_sharing_consent: dataSharingConsent,
        })
      });
      console.log('[createUser] got response:', response.status);

      const responseText = await response.text();
      clearTimeout(timeout);
      const result = JSON.parse(responseText);

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create user');
      }

      // Upload profile photo
      let profileImageUrl = '';
      if (profileImageFile) {
        const compressed = await compressImage(profileImageFile);
        const fileName = `${result.user_id}/avatar.${compressed.name.split('.').pop() || 'jpg'}`;
        const { error: uploadError } = await supabase.storage.from('adverts').upload(fileName, compressed, { upsert: true });
        if (!uploadError) {
          profileImageUrl = supabase.storage.from('adverts').getPublicUrl(fileName).data.publicUrl;
        } else {
          console.error('[createUser] photo upload error:', uploadError);
        }
      }

      // Update profile with photo URL
      if (profileImageUrl) {
        await supabase.from('profiles').update({ profile_image: profileImageUrl }).eq('id', result.user_id);
      }

      // Upload certificates if jobseeker
      let certUrls: string[] = [];
      if (certFiles.length > 0 && role === 'jobseeker') {
        try {
          for (const file of certFiles) {
            const compressed = file.type.startsWith('image/') ? await compressImage(file) : file;
            const fileName = `${result.user_id}/certs/img_${Date.now()}_${compressed.name.replace(/[^a-zA-Z0-9._-]/g, '' )}`;
            const { error: certError } = await supabase.storage.from('adverts').upload(fileName, compressed);
            if (!certError) {
              certUrls.push(supabase.storage.from('adverts').getPublicUrl(fileName).data.publicUrl);
            }
          }
        } catch (certErr) {
          console.error('Cert upload failed:', certErr);
        }
      }

      // Update profile with certificates if uploaded
      if (certUrls.length > 0) {
        await supabase.from('profiles').update({ certificates: certUrls }).eq('id', result.user_id);
      }

      if (subscribeToNewsletter) {
        await subscribeNewsletter(email, fullName);
      }
      toast({ title: 'Success', description: `User ${fullName} created successfully!` });
      setCreatingUser(false);
      await loadData();
      setIsCreateUserModalOpen(false);
      setCertFiles([]);
    } catch (error: any) {
      console.error('[createUser] error caught:', error);
      if (error.name === 'AbortError') {
        toast({ title: 'Error', description: 'Request timed out after 15s', variant: 'destructive' });
      } else {
        toast({ title: 'Error', description: error.message || 'Failed', variant: 'destructive' });
      }
      setCreatingUser(false);
    }
  };

  const deleteUser = async () => {
    if (!deletingUser) return;
    try {
      const functionUrl = `${supabaseUrl}/functions/v1/delete-user`;
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': supabaseKey },
        body: JSON.stringify({ user_id: deletingUser.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to delete user');
      toast({ title: 'Success', description: `User deleted successfully` });
      setIsDeleteDialogOpen(false);
      setDeletingUser(null);
      await loadData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed', variant: 'destructive' });
    }
  };

  const editProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingUser) return;
    const formData = new FormData(e.currentTarget);
    const fullName = formData.get('full_name') as string;
    const email = formData.get('email') as string;
    const phone = formData.get('phone') as string;
    const location = formData.get('location') as string;
    const county = formData.get('county') as string;
    const subcounty = formData.get('subcounty') as string;
    const role = formData.get('role') as string;
    const skills = formData.get('skills') as string;
    const resume = formData.get('resume') as string;

    try {
      // Upload new photo if selected
      let profileImageUrl: string | null = null;
      if (editProfileImageFile) {
        const compressed = await compressImage(editProfileImageFile);
        const fileName = `${editingUser.id}/avatar.${compressed.name.split('.').pop() || 'jpg'}`;
        const { error: uploadError } = await supabase.storage.from('adverts').upload(fileName, compressed, { upsert: true });
        if (!uploadError) {
          profileImageUrl = supabase.storage.from('adverts').getPublicUrl(fileName).data.publicUrl;
        }
      }

      const { error: rpcError } = await supabase.rpc('create_user_profile', {
        p_id: editingUser.id,
        p_full_name: fullName,
        p_email: email,
        p_phone: phone || '',
        p_role: role,
        p_location: location || '',
        p_county: county || null,
        p_subcounty: subcounty || null,
        p_skills: role === 'jobseeker' ? (skills || '') : '',
        p_resume: role === 'jobseeker' ? (resume || '') : '',
        p_profile_image: profileImageUrl,
        p_ratings_enabled: ratingsEnabled || null,
      });
      if (rpcError) throw rpcError;

      toast({ title: 'Success', description: `User ${fullName} updated` });
      setIsEditUserModalOpen(false);
      setEditingUser(null);
      setEditProfileImageFile(null);
      await loadData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed', variant: 'destructive' });
    }
  };

  const updateJobStatus = async (jobId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ status: newStatus })
        .eq('id', jobId);

      if (error) throw error;

      setJobs(jobs.map(job =>
        job.id === jobId ? { ...job, status: newStatus } : job
      ));

      toast({
        title: 'Success',
        description: 'Job status updated successfully',
      });
    } catch (error) {
      console.error('Error updating job status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update job status',
        variant: 'destructive',
      });
    }
  };

  const updateAdStatus = async (adId: string, featured: boolean) => {
    try {
      const { error } = await supabase
        .from('service_ads')
        .update({ featured })
        .eq('id', adId);

      if (error) throw error;

      setAds(ads.map(ad =>
        ad.id === adId ? { ...ad, featured } : ad
      ));

      toast({
        title: 'Success',
        description: 'Ad status updated successfully',
      });
    } catch (error) {
      console.error('Error updating ad status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update ad status',
        variant: 'destructive',
      });
    }
  };

  const addCategory = async () => {
    if (!newCategory.trim()) return;
    const result = await addCustomCategory(newCategory.trim(), newCategoryType);
    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
      return;
    }
    setNewCategory('');
    const updated = await getCustomCategories(newCategoryType);
    if (newCategoryType === 'job') {
      setCustomJobCats(updated);
      setCategories([...new Set([...JOB_CATEGORIES.filter(c => c !== 'All Categories'), ...updated, ...customServiceCats])]);
    } else {
      setCustomServiceCats(updated);
      setCategories([...new Set([...SERVICE_CATEGORIES.filter(c => c !== 'All Services'), ...customJobCats, ...updated])]);
    }
    toast({ title: 'Success', description: 'Category added.' });
  };

  const deleteJob = async (jobId: string) => {
    if (!window.confirm('Are you sure you want to delete this job?')) return;
    try {
      const { error } = await supabase.from('jobs').delete().eq('id', jobId);
      if (error) throw error;
      setJobs(jobs.filter(job => job.id !== jobId));
      toast({ title: 'Success', description: 'Job deleted successfully' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete job', variant: 'destructive' });
    }
  };

  const handleSaveJob = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setJobUploading(true);
    
    const formData = new FormData(e.currentTarget);
    const deadlineVal = formData.get('deadline');
    const jobData: any = {
      title: formData.get('title'),
      category: formData.get('category'),
      description: formData.get('description') || '',
      location: formData.get('location'),
      county: formData.get('county') || null,
      subcounty: formData.get('subcounty') || null,
      budget_min: Number(formData.get('budget_min')) || 0,
      budget_max: Number(formData.get('budget_max')) || 0,
      posted_by: formData.get('posted_by') || null,
      posted_by_name: users.find(u => u.id === formData.get('posted_by'))?.full_name || 'Admin',
      status: formData.get('status') || 'open',
      deadline: deadlineVal ? new Date(deadlineVal as string).toISOString() : null,
    };
    jobData.budget = jobData.budget_max; // Legacy field

    try {
      // Handle image uploads (Append mode)
      let currentImages = editingJob?.images || [];
      if (jobImages.length > 0) {
        const imageUrls: string[] = [];
        for (const file of jobImages) {
          const fileExt = file.name.split('.').pop();
          const fileName = `img_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '' )}`;
          const filePath = `${jobData.posted_by || 'admin'}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('jobs')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          const { data } = supabase.storage.from('jobs').getPublicUrl(filePath);
          imageUrls.push(data.publicUrl);
        }
        
        // Append new images and limit to 3
        currentImages = [...currentImages, ...imageUrls].slice(0, 3);
      }
      jobData.images = currentImages;

      if (editingJob?.id) {
        const { error } = await supabase.from('jobs').update(jobData).eq('id', editingJob.id);
        if (error) throw error;
        toast({ title: 'Success', description: 'Job updated successfully' });
      } else {
        const { error } = await supabase.from('jobs').insert(jobData);
        if (error) throw error;
        toast({ title: 'Success', description: 'Job created successfully' });
      }
      setIsJobModalOpen(false);
      setJobImages([]);
      await loadJobs(); // Only reload jobs!
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to save job', variant: 'destructive' });
    } finally {
      setJobUploading(false);
    }
  };

  const deleteAd = async (adId: string) => {
    if (!window.confirm('Are you sure you want to delete this ad?')) return;
    try {
      const { error } = await supabase.from('service_ads').delete().eq('id', adId);
      if (error) throw error;
      setAds(ads.filter(ad => ad.id !== adId));
      toast({ title: 'Success', description: 'Ad deleted successfully' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete ad', variant: 'destructive' });
    }
  };

  const handleSaveAd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAdUploading(true);
    console.log('Starting ad save...');
    
    const formData = new FormData(e.currentTarget);
    const adData: any = {
      title: formData.get('title') || formData.get('business_name') || editingAd?.title,
      business_name: formData.get('business_name') || editingAd?.business_name,
      description: formData.get('description') || editingAd?.description || '',
      category: formData.get('category') || editingAd?.category,
      location: formData.get('location') || editingAd?.location,
      county: formData.get('county') || editingAd?.county || null,
      subcounty: formData.get('subcounty') || editingAd?.subcounty || null,
      contact_person: formData.get('contact_person') || editingAd?.contact_person || '',
      contact: formData.get('contact') || editingAd?.contact,
      owner_id: formData.get('owner_id') || editingAd?.owner_id || null,
      plan: formData.get('plan') || editingAd?.plan || '30-day',
      featured: formData.get('featured') === 'true',
      payment_confirmed: formData.get('payment_confirmed') === 'true',
      expiry_date: formData.get('expiry_date') || editingAd?.expiry_date,
    };

    try {
      let currentImages = [...(editingAd?.images || [])];

      // Handle multiple image uploads
      if (adFiles.length > 0) {
        const oversized = adFiles.filter(f => f.size > 5 * 1024 * 1024);
        if (oversized.length > 0) {
          toast({ title: 'File Too Large', description: `${oversized[0].name} exceeds 5MB limit. Please compress and try again.`, variant: 'destructive' });
          setAdUploading(false);
          return;
        }
        console.log('Uploading images:', adFiles.length);
        const newImages: string[] = [];
        
        for (const file of adFiles) {
          if (newImages.length >= 3) break;
          console.log('Uploading file:', file.name);
          const fileExt = file.name.split('.').pop();
          const fileName = `img_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '' )}`;
          
          const uploadPromise = supabase.storage
            .from('adverts')
            .upload(`admin/${fileName}`, file);
          
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Upload timeout after 60s')), 60000)
          );
          
          const { data, error: uploadError } = await Promise.race([uploadPromise, timeoutPromise]) as any;
          
          if (uploadError) {
            console.error('Upload error:', uploadError);
            throw uploadError;
          }
          
          const publicUrl = supabase.storage.from('adverts').getPublicUrl(`admin/${fileName}`).data.publicUrl;
          newImages.push(publicUrl);
          console.log('Uploaded:', publicUrl);
        }
        
        currentImages = [...currentImages, ...newImages];
        console.log('All images uploaded:', currentImages);
      }

      adData.images = currentImages;
      if (currentImages.length > 0) {
        adData.image = currentImages[0];
      } else if (editingAd?.image) {
        adData.image = editingAd.image;
      }

      if (editingAd?.id) {
        console.log('ðŸ“ Updating existing ad:', editingAd.id, adData);
        const { error } = await supabase.from('service_ads').update(adData).eq('id', editingAd.id);
        if (error) throw error;
        toast({ title: 'Success', description: 'Ad updated successfully' });
      } else {
        // For new ads, calculate expiry if not present
        const days = adData.plan === '10-day' ? 10 : adData.plan === '20-day' ? 20 : 30;
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + days);
        adData.expiry_date = expiryDate.toISOString().split('T')[0];
        
        const { error } = await supabase.from('service_ads').insert(adData);
        if (error) throw error;
        toast({ title: 'Success', description: 'Ad created successfully' });
      }

      setIsAdModalOpen(false);
      setAdFiles([]);
      await loadAds(); // Only reload ads!
    } catch (error: any) {
      console.error('Error saving ad:', error);
      toast({ title: 'Error', description: error.message || 'Failed to save ad', variant: 'destructive' });
    } finally {
      setAdUploading(false);
    }
  };

  const updateAdPaymentStatus = async (adId: string, payment_confirmed: boolean) => {
    try {
      const { error } = await supabase.from('service_ads').update({ payment_confirmed }).eq('id', adId);
      if (error) throw error;
      setAds(ads.map(ad => ad.id === adId ? { ...ad, payment_confirmed } : ad));
      toast({ title: 'Success', description: 'Ad payment status updated' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update ad payment status', variant: 'destructive' });
    }
  };

  const updatePaymentStatus = async (paymentId: string, status: string) => {
    try {
      const { error } = await supabase.from('payments').update({ status }).eq('id', paymentId);
      if (error) throw error;
      setPayments(payments.map(p => p.id === paymentId ? { ...p, status } : p));
      toast({ title: 'Success', description: 'Payment status updated' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update payment status', variant: 'destructive' });
    }
  };

  const setupAdminUser = async () => {
    try {
      // This is a temporary function to set up the admin user
      const adminEmail = 'admin@itukarua.co.ke';
      
      // First, get the user by email from auth.users (this requires admin privileges)
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
      if (authError) {
        console.error('Error listing users:', authError);
        toast({
          title: 'Error',
          description: 'Cannot list users - admin privileges required',
          variant: 'destructive',
        });
        return;
      }

      const adminUser = authUsers.users.find(user => user.email === adminEmail);
      if (!adminUser) {
        toast({
          title: 'Error',
          description: 'Admin user not found in auth',
          variant: 'destructive',
        });
        return;
      }

      // Check if profile exists
      const existingProfile = await getProfile(adminUser.id);
      
      if (existingProfile) {
        // Update existing profile
        const { error } = await supabase
          .from('profiles')
          .update({ role: 'super_admin' })
          .eq('id', adminUser.id);
        
        if (error) throw error;
        
        toast({
          title: 'Success',
          description: 'Admin user role updated to super_admin',
        });
      } else {
        // Create new profile
        const { error } = await supabase
          .from('profiles')
          .insert({
            id: adminUser.id,
            full_name: 'Super Admin',
            role: 'super_admin',
            verified: true,
            registration_paid: true,
          });
        
        if (error) throw error;
        
        toast({
          title: 'Success',
          description: 'Admin user profile created with super_admin role',
        });
      }
    } catch (error) {
      console.error('Error setting up admin user:', error);
      toast({
        title: 'Error',
        description: 'Failed to set up admin user',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading admin panel...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Admin Dashboard</h1>

        {/* Seed Data Button */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-blue-900">Database Setup</h3>
              <p className="text-sm text-blue-700">Add sample jobs, services, and profiles to test the platform</p>
            </div>
            <Button
              onClick={async () => {
                try {
                  setLoading(true);
                  await seedSampleData();
                  toast({
                    title: "Success",
                    description: "Sample data has been added to the database",
                  });
                  // Refresh data without reloading the page
                  await loadData();
                } catch (error) {
                  toast({
                    title: "Error",
                    description: "Failed to seed sample data",
                    variant: "destructive",
                  });
                } finally {
                  setLoading(false);
                }
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Seed Sample Data
            </Button>
          </div>
        </div>

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="jobs">Jobs</TabsTrigger>
            <TabsTrigger value="ads">Ads</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="messages">Messages</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="subscribers">Subscribers</TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>User Management</CardTitle>
                <Button onClick={() => { setCertFiles([]); setTermsAccepted(false); setDataSharingConsent(false); setIsCreateUserModalOpen(true); }}>
                  + Add New User
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Verified</TableHead>
                      <TableHead>Registration</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          {user.full_name}
                          <div className="text-xs text-gray-500">{user.email}</div>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={user.role}
                            onValueChange={(value) => updateUserRole(user.id, value)}
                          >
                            <SelectTrigger className="w-32 h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="jobseeker">Jobseeker</SelectItem>
                              <SelectItem value="employer">Employer</SelectItem>
                              <SelectItem value="super_admin">Super Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.verified ? 'default' : 'secondary'}>
                            {user.verified ? 'Verified' : 'Unverified'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.registration_paid ? 'default' : 'destructive'}>
                            {user.registration_paid ? 'Paid' : 'Unpaid'}
                          </Badge>
                        </TableCell>
                        <TableCell className="flex gap-2 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleUserVerification(user.id, user.verified)}
                          >
                            {user.verified ? 'Unverify' : 'Verify'}
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => triggerPasswordReset(user.email)}
                            disabled={!user.email}
                          >
                            Reset PW
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingUser(user);
                              setRatingsEnabled(!!user.ratings_enabled);
                              setIsEditUserModalOpen(true);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              setDeletingUser(user);
                              setIsDeleteDialogOpen(true);
                            }}
                          >
                            Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="jobs">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Job Management</CardTitle>
                <Button onClick={() => { setEditingJob(null); setIsJobModalOpen(true); }}>Add Job</Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Budget</TableHead>
                      <TableHead>Posted By</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell>{job.title}</TableCell>
                        <TableCell>{job.category}</TableCell>
                        <TableCell>
                          <Badge variant={
                            job.status === 'open' ? 'default' :
                            job.status === 'completed' ? 'secondary' : 'destructive'
                          }>
                            {job.status}
                          </Badge>
                        </TableCell>
                        <TableCell>KSh {job.budget}</TableCell>
                        <TableCell>{job.posted_by_name}</TableCell>
                        <TableCell className="flex gap-2 items-center">
                          <Select
                            value={job.status}
                            onValueChange={(value) => updateJobStatus(job.id, value)}
                          >
                            <SelectTrigger className="w-32 h-9">
                               <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="open">Open</SelectItem>
                              <SelectItem value="in-progress">In Progress</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { setEditingJob(job); setIsJobModalOpen(true); }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteJob(job.id)}
                          >
                            Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ads">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Advertisement Management</CardTitle>
                <Button onClick={() => { setEditingAd(null); setAdFiles([]); setIsAdModalOpen(true); }}>Add Ad</Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Image</TableHead>
                      <TableHead>Business</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Contact Person</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Expiry</TableHead>
                      <TableHead>Featured</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ads.map((ad) => (
                      <TableRow key={ad.id}>
                        <TableCell>
                          <img src={ad.image || (ad.images?.[0]) || '/images/services.png'} alt="" className="w-12 h-12 object-cover rounded" />
                        </TableCell>
                        <TableCell>
                          <div>{ad.business_name}</div>
                          <div className="text-xs text-gray-500">{ad.title}</div>
                        </TableCell>
                        <TableCell>{ad.category}</TableCell>
                        <TableCell>{ad.contact_person || '-'}</TableCell>
                        <TableCell>{ad.contact || '-'}</TableCell>
                        <TableCell>{ad.expiry_date}</TableCell>
                        <TableCell>
                          <Badge variant={ad.featured ? 'default' : 'secondary'}>
                            {ad.featured ? 'Featured' : 'Regular'}
                          </Badge>
                        </TableCell>
                        <TableCell className="flex gap-2 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateAdStatus(ad.id, !ad.featured)}
                          >
                            {ad.featured ? 'Unfeature' : 'Feature'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateAdPaymentStatus(ad.id, !ad.payment_confirmed)}
                          >
                            {ad.payment_confirmed ? 'Unconfirm' : 'Confirm'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { setEditingAd(ad); setIsAdModalOpen(true); }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteAd(ad.id)}
                          >
                            Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments">
            <Card>
              <CardHeader>
                <CardTitle>Payment Management (M-Pesa)</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Amount</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>M-Pesa Ref</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>KSh {payment.amount}</TableCell>
                        <TableCell>{payment.payment_type}</TableCell>
                        <TableCell>
                          <Badge variant={
                            payment.status === 'completed' ? 'default' :
                            payment.status === 'pending' ? 'secondary' : 'destructive'
                          }>
                            {payment.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{payment.mpesa_ref || 'N/A'}</TableCell>
                        <TableCell>{payment.description}</TableCell>
                        <TableCell>{new Date(payment.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Select
                            value={payment.status}
                            onValueChange={(value) => updatePaymentStatus(payment.id, value)}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                              <SelectItem value="failed">Failed</SelectItem>
                              <SelectItem value="refunded">Refunded</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="messages">
            <Card>
              <CardHeader>
                <CardTitle>Message Management</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sender</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {messages.map((msg) => (
                      <TableRow key={msg.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{msg.sender_name}</p>
                            <p className="text-sm text-gray-500">{msg.sender_email}</p>
                          </div>
                        </TableCell>
                        <TableCell>{msg.subject}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{msg.type}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            msg.priority === 'urgent' ? 'destructive' :
                            msg.priority === 'high' ? 'default' : 'secondary'
                          }>
                            {msg.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            msg.status === 'unread' ? 'destructive' :
                            msg.status === 'read' ? 'default' :
                            msg.status === 'replied' ? 'secondary' : 'outline'
                          }>
                            {msg.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(msg.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm">
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="categories">
            <Card>
              <CardHeader>
                <CardTitle>Category Management</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Category Name</label>
                      <Input
                        placeholder="New category name"
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                      <select value={newCategoryType} onChange={e => setNewCategoryType(e.target.value as 'job' | 'service')} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none">
                        <option value="job">Job</option>
                        <option value="service">Service</option>
                      </select>
                    </div>
                    <Button onClick={addCategory} className="mb-0.5">Add</Button>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Job Categories</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {[...JOB_CATEGORIES.filter(c => c !== 'All Categories'), ...customJobCats].map((category) => {
                        const isCustom = customJobCats.includes(category);
                        return (
                          <div key={'job-'+category} className="flex items-center gap-1">
                            <Badge variant={isCustom ? 'default' : 'outline'} className="flex-1 justify-center">{category}</Badge>
                            {isCustom && (
                              <button onClick={async () => {
                                await deleteCustomCategory(category, 'job');
                                const updated = await getCustomCategories('job');
                                setCustomJobCats(updated);
                                setCategories([...new Set([...JOB_CATEGORIES.filter(c => c !== 'All Categories'), ...updated, ...customServiceCats])]);
                              }} className="text-red-500 hover:text-red-700 text-xs font-bold px-1">&times;</button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Service Categories</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {[...SERVICE_CATEGORIES.filter(c => c !== 'All Services'), ...customServiceCats].map((category) => {
                        const isCustom = customServiceCats.includes(category);
                        return (
                          <div key={'svc-'+category} className="flex items-center gap-1">
                            <Badge variant={isCustom ? 'default' : 'outline'} className="flex-1 justify-center">{category}</Badge>
                            {isCustom && (
                              <button onClick={async () => {
                                await deleteCustomCategory(category, 'service');
                                const updated = await getCustomCategories('service');
                                setCustomServiceCats(updated);
                                setCategories([...new Set([...SERVICE_CATEGORIES.filter(c => c !== 'All Services'), ...customJobCats, ...updated])]);
                              }} className="text-red-500 hover:text-red-700 text-xs font-bold px-1">&times;</button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="subscribers">
            <Card>
              <CardHeader>
                <CardTitle>Newsletter Subscribers ({subscribers.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-4">
                  <input type="text" value={newSubscriberName} onChange={e => setNewSubscriberName(e.target.value)} placeholder="Full name" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                  <input type="email" value={newSubscriberEmail} onChange={e => setNewSubscriberEmail(e.target.value)} placeholder="Email address" className="flex-[2] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                  <input type="text" name="_website" value="" onChange={() => {}} tabIndex={-1} autoComplete="off" className="absolute left-[-9999px] h-0 w-0 opacity-0" aria-hidden="true" />
                  <button onClick={async () => {
                    const hp = document.querySelector('input[name="_website"]') as HTMLInputElement;
                    if (hp?.value) { setSubscriberMsg('Spam detected'); return; }
                    if (!newSubscriberName.trim()) { setSubscriberMsg('Name is required'); return; }
                    if (!newSubscriberEmail.trim() || !/\S+@\S+\.\S+/.test(newSubscriberEmail)) { setSubscriberMsg('Invalid email'); return; }
                    const result = await subscribeNewsletter(newSubscriberEmail.trim(), newSubscriberName.trim());
                    if (result.error) { setSubscriberMsg(result.error); } else { setSubscriberMsg('Added!'); setNewSubscriberName(''); setNewSubscriberEmail(''); setSubscribers(await getNewsletterSubscribers()); }
                  }} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors">Add</button>
                </div>
                {subscriberMsg && <p className={`text-sm mb-3 ${subscriberMsg === 'Invalid email' || subscriberMsg.includes('already') ? 'text-amber-600' : 'text-green-600'}`}>{subscriberMsg}</p>}
                <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-200">
                  <button onClick={async () => {
                    if (subscribers.length === 0) { setSubscriberMsg('No subscribers to send to.'); return; }
                    setSendingNewsletter(true);
                    setSubscriberMsg('');
                    try {
                      const res = await fetch(`${supabaseUrl}/functions/v1/send-weekly-newsletter`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'apikey': supabaseKey },
                      });
                      const data = await res.json();
                      if (data.error) throw new Error(data.error);
                      setSubscriberMsg(`Newsletter sent to ${data.sent} subscribers${data.failed > 0 ? ` (${data.failed} failed)` : ''}! Check Ethereal inbox.`);
                    } catch (err: any) {
                      setSubscriberMsg(`Error: ${err.message}`);
                    } finally {
                      setSendingNewsletter(false);
                    }
                  }} disabled={sendingNewsletter || subscribers.length === 0} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
                    {sendingNewsletter ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {sendingNewsletter ? 'Sending...' : 'Send Newsletter Now'}
                  </button>
                  <span className="text-xs text-gray-400">Sends to {subscribers.length} subscriber(s) via Ethereal test SMTP</span>
                </div>
                {subscribers.length === 0 ? (
                  <p className="text-sm text-gray-400">No subscribers yet.</p>
                ) : (
                  <div>
                    {selectedSubs.size > 0 && (
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm text-gray-600">{selectedSubs.size} selected</span>
                        <button onClick={async () => {
                          if (!confirm(`Delete ${selectedSubs.size} subscriber(s)?`)) return;
                          await Promise.all([...selectedSubs].map(email => deleteNewsletterSubscriber(email)));
                          setSelectedSubs(new Set());
                          setSubscribers(await getNewsletterSubscribers());
                          setSubscriberMsg(`Deleted ${selectedSubs.size} subscriber(s).`);
                        }} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors">Delete Selected</button>
                        <button onClick={() => setSelectedSubs(new Set())} className="px-3 py-1.5 border border-gray-300 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-50 transition-colors">Clear</button>
                      </div>
                    )}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="py-2 px-3 w-10">
                              <input type="checkbox" checked={selectedSubs.size === subscribers.length} onChange={() => {
                                if (selectedSubs.size === subscribers.length) setSelectedSubs(new Set());
                                else setSelectedSubs(new Set(subscribers.map(s => s.email)));
                              }} className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500" />
                            </th>
                            <th className="text-left py-2 px-3 font-medium text-gray-600">Name</th>
                            <th className="text-left py-2 px-3 font-medium text-gray-600">Email</th>
                            <th className="text-left py-2 px-3 font-medium text-gray-600">Subscribed</th>
                            <th className="text-right py-2 px-3 font-medium text-gray-600">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {subscribers.map(s => {
                            const checked = selectedSubs.has(s.email);
                            return (
                              <tr key={s.email} className={`border-b border-gray-50 hover:bg-gray-50 ${checked ? 'bg-green-50' : ''}`}>
                                <td className="py-2 px-3">
                                  <input type="checkbox" checked={checked} onChange={() => {
                                    const next = new Set(selectedSubs);
                                    if (checked) next.delete(s.email); else next.add(s.email);
                                    setSelectedSubs(next);
                                  }} className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500" />
                                </td>
                                <td className="py-2 px-3 text-gray-800 font-medium">{s.name || '—'}</td>
                                <td className="py-2 px-3 text-gray-800">{s.email}</td>
                                <td className="py-2 px-3 text-gray-500">{new Date(s.created_at).toLocaleDateString()}</td>
                                <td className="py-2 px-3 text-right">
                                  <button onClick={async () => {
                                    if (!confirm(`Remove ${s.email}?`)) return;
                                    await deleteNewsletterSubscriber(s.email);
                                    setSelectedSubs(new Set([...selectedSubs].filter(e => e !== s.email)));
                                    setSubscribers(await getNewsletterSubscribers());
                                  }} className="text-xs text-red-600 hover:text-red-800 font-medium">Delete</button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Job Modal */}
      <Dialog open={isJobModalOpen} onOpenChange={setIsJobModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingJob ? 'Edit Job' : 'Add New Job'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveJob} className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input name="title" defaultValue={editingJob?.title} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <Select 
                  name="category_select" 
                  defaultValue={editingJob?.category || (categories.length > 0 ? categories[0] : JOB_CATEGORIES[1])}
                  onValueChange={(val) => {
                    const el = document.getElementById('job_category_hidden') as HTMLInputElement;
                    if (el) el.value = val;
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                  <SelectContent>
                    {[...JOB_CATEGORIES.filter(c => c !== 'All Categories'), ...customJobCats].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <input type="hidden" id="job_category_hidden" name="category" defaultValue={editingJob?.category || (categories.length > 0 ? categories[0] : JOB_CATEGORIES[1])} />
              </div>
              <div>
                <Label>Location</Label>
                <Input name="location" defaultValue={editingJob?.location} required />
              </div>
              <div>
                <Label>County</Label>
                <select name="county" defaultValue={editingJob?.county || ''} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 outline-none">
                  <option value="">Select county</option>
                  {KENYA_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <Label>Subcounty</Label>
                <Input name="subcounty" defaultValue={editingJob?.subcounty || ''} placeholder="e.g. Kikuyu" />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea name="description" defaultValue={editingJob?.description} rows={4} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Budget Min (KSh)</Label>
                <Input name="budget_min" type="number" defaultValue={editingJob?.budget_min} required />
              </div>
              <div>
                <Label>Budget Max (KSh)</Label>
                <Input name="budget_max" type="number" defaultValue={editingJob?.budget_max} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Deadline</Label>
                <Input name="deadline" type="date" defaultValue={editingJob?.deadline ? new Date(editingJob.deadline).toISOString().split('T')[0] : ''} required />
              </div>
              <div>
                <Label>Status</Label>
                <Select 
                  name="status_select" 
                  defaultValue={editingJob?.status || 'open'}
                  onValueChange={(val) => {
                    const el = document.getElementById('job_status_hidden') as HTMLInputElement;
                    if (el) el.value = val;
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                <input type="hidden" id="job_status_hidden" name="status" defaultValue={editingJob?.status || 'open'} />
              </div>
            </div>
            <div>
              <Label>Posted By (User)</Label>
              <Select 
                name="posted_by_select" 
                defaultValue={editingJob?.posted_by}
                onValueChange={(val) => {
                  const el = document.getElementById('job_posted_by_hidden') as HTMLInputElement;
                  if (el) el.value = val;
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select User" /></SelectTrigger>
                <SelectContent>
                  {users.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name} ({u.role})</SelectItem>)}
                </SelectContent>
              </Select>
              <input type="hidden" id="job_posted_by_hidden" name="posted_by" defaultValue={editingJob?.posted_by} />
            </div>
            
            {/* Image Upload for Jobs */}
            <div>
              <Label>Job Images (Max 3, Min size: 300x300px)</Label>
              {editingJob?.images && editingJob.images.length > 0 && (
                <div className="flex gap-2 mb-2">
                  {editingJob.images.map((img: string, i: number) => (
                    <div key={i} className="relative w-20 h-20 rounded border border-gray-200 overflow-hidden group">
                      <img src={img} alt="" className="w-full h-full object-cover" />
                      <button 
                        type="button"
                        onClick={() => {
                          const newImages = editingJob.images?.filter((_, idx) => idx !== i);
                          setEditingJob({...editingJob, images: newImages});
                        }}
                        className="absolute top-0 right-0 bg-red-500 text-white w-5 h-5 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        X
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <Input 
                type="file" 
                accept="image/png, image/jpeg" 
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length > 3) {
                    toast({ title: 'Error', description: 'Maximum 3 images allowed', variant: 'destructive' });
                    e.target.value = '';
                    return;
                  }
                  setJobImages(files);
                }} 
              />
              <p className="text-xs text-gray-500 mt-1">Upload up to 3 images to show what needs to be done. (Max 5MB each)</p>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsJobModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={jobUploading}>{jobUploading ? 'Saving...' : 'Save Job'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Ad Modal */}
      <Dialog open={isAdModalOpen} onOpenChange={setIsAdModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAd ? 'Edit Ad' : 'Add New Ad'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveAd} className="space-y-4">
            <div>
              <Label>Business Name</Label>
              <Input name="business_name" defaultValue={editingAd?.business_name} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <Select 
                  name="ad_category_select" 
                  defaultValue={editingAd?.category || (categories.length > 0 ? categories[0] : SERVICE_CATEGORIES[1])}
                  onValueChange={(val) => {
                    const el = document.getElementById('ad_category_hidden') as HTMLInputElement;
                    if (el) el.value = val;
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                  <SelectContent>
                    {[...SERVICE_CATEGORIES.filter(c => c !== 'All Services'), ...customServiceCats].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <input type="hidden" id="ad_category_hidden" name="category" defaultValue={editingAd?.category || (categories.length > 0 ? categories[0] : SERVICE_CATEGORIES[1])} />
              </div>
              <div>
                <Label>Location</Label>
                <Input name="location" defaultValue={editingAd?.location} required />
              </div>
              <div>
                <Label>County</Label>
                <select name="county" defaultValue={editingAd?.county || ''} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 outline-none">
                  <option value="">Select county</option>
                  {KENYA_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <Label>Subcounty</Label>
                <Input name="subcounty" defaultValue={editingAd?.subcounty || ''} placeholder="e.g. Kikuyu" />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea name="description" defaultValue={editingAd?.description} rows={3} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Contact Person</Label>
                <Input name="contact_person" defaultValue={editingAd?.contact_person} placeholder="e.g. John Kamau" />
              </div>
              <div>
                <Label>Phone Number</Label>
                <Input name="contact" defaultValue={editingAd?.contact} placeholder="+254 7XX XXX XXX" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Plan</Label>
                <Select 
                  name="ad_plan_select" 
                  defaultValue={editingAd?.plan || '30-day'}
                  onValueChange={(val) => {
                    const el = document.getElementById('ad_plan_hidden') as HTMLInputElement;
                    if (el) el.value = val;
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Plan" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10-day">10 Day</SelectItem>
                    <SelectItem value="20-day">20 Day</SelectItem>
                    <SelectItem value="30-day">30 Day</SelectItem>
                  </SelectContent>
                </Select>
                <input type="hidden" id="ad_plan_hidden" name="plan" defaultValue={editingAd?.plan || '30-day'} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Expiry Date</Label>
                <Input name="expiry_date" type="date" defaultValue={editingAd?.expiry_date ? new Date(editingAd.expiry_date).toISOString().split('T')[0] : ''} required />
              </div>
              <div>
                <Label>Owner (User)</Label>
                <Select 
                  name="ad_owner_select" 
                  defaultValue={editingAd?.owner_id}
                  onValueChange={(val) => {
                    const el = document.getElementById('ad_owner_hidden') as HTMLInputElement;
                    if (el) el.value = val;
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Select Owner" /></SelectTrigger>
                  <SelectContent>
                    {users.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name} ({u.role})</SelectItem>)}
                  </SelectContent>
                </Select>
                <input type="hidden" id="ad_owner_hidden" name="owner_id" defaultValue={editingAd?.owner_id} />
              </div>
            </div>
            {/* Image Upload for Ads */}
            <div>
              <Label>Business Images (Max 3, Max 5MB each)</Label>
              
              {/* Combined thumbnail scroller - existing images + new uploads */}
              {(editingAd?.images?.length > 0 || adFiles.length > 0) && (
                <div className="flex gap-2 mb-3 overflow-x-auto py-1">
                  {/* Existing images */}
                  {editingAd?.images?.map((img: string, i: number) => (
                    <div key={`existing-${i}`} className="relative flex-shrink-0 w-20 h-20 rounded-lg border-2 border-green-500 overflow-hidden group">
                      <img src={img} alt="" className="w-full h-full object-cover" />
                      <button 
                        type="button"
                        onClick={() => {
                          const newImages = editingAd.images?.filter((_: any, idx: number) => idx !== i);
                          setEditingAd({...editingAd, images: newImages});
                        }}
                        className="absolute top-0 right-0 bg-red-500 text-white w-5 h-5 flex items-center justify-center text-[10px]"
                      >
                        X
                      </button>
                    </div>
                  ))}
                  {/* New uploads */}
                  {adFiles.map((file, i) => (
                    <div key={`new-${i}`} className="relative flex-shrink-0 w-20 h-20 rounded-lg border-2 border-blue-500 overflow-hidden">
                      <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                      <button 
                        type="button"
                        onClick={() => setAdFiles(adFiles.filter((_, idx) => idx !== i))}
                        className="absolute top-0 right-0 bg-red-500 text-white w-5 h-5 flex items-center justify-center text-[10px]"
                      >
                        X
                      </button>
                      <div className="absolute bottom-0 left-0 bg-blue-500 text-white text-[8px] px-1">New</div>
                    </div>
                  ))}
                </div>
              )}
              <Input 
                type="file" 
                multiple
                accept="image/png, image/jpeg, image/webp" 
                onChange={(e) => {
                  const files = e.target.files;
                  if (files) {
                    const validFiles = Array.from(files).filter(f => {
                      if (f.size > 5 * 1024 * 1024) {
                        alert(`${f.name} exceeds 5MB limit. Please compress or choose a smaller image.`);
                        return false;
                      }
                      return true;
                    });
                    const currentTotal = (editingAd?.images?.length || 0) + adFiles.length;
                    const newFiles = validFiles.slice(0, 3 - currentTotal);
                    const combined = [...adFiles, ...newFiles];
                    setAdFiles(combined);
                  }
                }} 
              />
              <p className="text-xs text-gray-500 mt-1">
                Upload up to 3 images. Currently: {(editingAd?.images?.length || 0) + adFiles.length}/3
              </p>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="featured" name="featured" value="true" defaultChecked={editingAd?.featured} className="w-4 h-4 rounded border-gray-300" />
                <Label htmlFor="featured">Featured Ad</Label>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="payment_confirmed" name="payment_confirmed" value="true" defaultChecked={editingAd?.payment_confirmed} className="w-4 h-4 rounded border-gray-300" />
                <Label htmlFor="payment_confirmed">Payment Confirmed</Label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsAdModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={adUploading}>{adUploading ? 'Saving...' : 'Save Ad'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* User Details Modal */}
      <Dialog open={isUserModalOpen} onOpenChange={setIsUserModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>User Profile: {selectedUser?.full_name}</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-6 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-500">Email</Label>
                  <p className="text-sm font-medium">{selectedUser.email}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Role</Label>
                  <p className="text-sm font-medium capitalize">{selectedUser.role}</p>
                </div>
              </div>

              {selectedUser.role === 'jobseeker' && (
                <>
                  <div className="border-t pt-4">
                    <Label className="text-gray-900 font-bold mb-2 block">Professional Resume</Label>
                    <div className="bg-gray-50 p-4 rounded-lg border text-sm text-gray-700 whitespace-pre-wrap min-h-[100px]">
                      {selectedUser.resume || 'No resume provided.'}
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <Label className="text-gray-900 font-bold mb-2 block">Certificates</Label>
                    {selectedUser.certificates && selectedUser.certificates.length > 0 ? (
                      <div className="grid grid-cols-3 gap-3">
                        {selectedUser.certificates.map((cert, i) => (
                          <a 
                            key={i} 
                            href={cert} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="group relative h-24 rounded-lg overflow-hidden border border-gray-200 hover:border-green-500 transition-all"
                          >
                            {cert.toLowerCase().endsWith('.pdf') ? (
                              <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100 text-gray-500">
                                <span className="text-[10px] font-bold">PDF</span>
                                <span className="text-[8px] mt-1 truncate px-1">Cert {i + 1}</span>
                              </div>
                            ) : (
                              <img src={cert} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                            )}
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="text-white text-[10px] font-bold">View Full</span>
                            </div>
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 italic">No certificates uploaded.</p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create User Modal */}
      <Dialog open={isCreateUserModalOpen} onOpenChange={setIsCreateUserModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
          </DialogHeader>
          {creatingUser && (
            <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-lg">
              <div className="w-64 space-y-4">
                <div className="h-2 bg-green-100 rounded-full overflow-hidden">
                  <div className="h-full bg-green-600 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                </div>
                <p className="text-sm text-gray-600 text-center font-medium">Creating user account...</p>
              </div>
            </div>
          )}
          <form onSubmit={createUser} className="grid grid-cols-2 gap-4 relative">
            <div>
              <Label>Full Name</Label>
              <Input name="full_name" required placeholder="John Kamau" />
            </div>
            <div>
              <Label>Email</Label>
              <Input name="email" type="email" required placeholder="john@example.com" />
            </div>
            <div>
              <Label>Password</Label>
              <Input name="password" type="password" required placeholder="Min 6 characters" minLength={6} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input name="phone" type="tel" required placeholder="+254 7XX XXX XXX" />
            </div>
            <div>
              <Label>Location</Label>
              <Input name="location" placeholder="Kenyatta Road, Itukarua" />
            </div>
            <div>
              <Label>County</Label>
              <select name="county" className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 outline-none">
                <option value="">Select county</option>
                {KENYA_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <Label>Subcounty</Label>
              <Input name="subcounty" placeholder="e.g. Kikuyu" />
            </div>
            <div>
              <Label>Role</Label>
              <Select name="role" defaultValue="employer" onValueChange={(val) => {
                setTimeout(() => {
                  const fields = document.querySelectorAll('.jobseeker-fields');
                  fields.forEach(f => (f as HTMLElement).style.display = val === 'jobseeker' ? 'block' : 'none');
                }, 0);
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="jobseeker">Jobseeker</SelectItem>
                  <SelectItem value="employer">Employer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Profile Photo</Label>
              {profileImageFile && (
                <div className="relative w-16 h-16 mb-2 rounded-full overflow-hidden border-2 border-green-200">
                  <img src={URL.createObjectURL(profileImageFile)} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => setProfileImageFile(null)} className="absolute top-0 right-0 bg-red-500 text-white w-4 h-4 flex items-center justify-center text-[10px] rounded-full">X</button>
                </div>
              )}
              <input type="file" accept="image/png,image/jpeg,image/webp"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                onChange={(e) => setProfileImageFile(e.target.files?.[0] || null)} />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch id="ratings_enabled" checked={ratingsEnabled} onCheckedChange={setRatingsEnabled} />
              <Label htmlFor="ratings_enabled">Enable ratings for this user</Label>
            </div>
            <div className="jobseeker-fields" style={{ display: 'none' }}>
              <Label>Skills (comma separated)</Label>
              <Input name="skills" placeholder="e.g. Painting, Plumbing, Carpentry" />
            </div>
            <div className="jobseeker-fields" style={{ display: 'none' }}>
              <Label>Professional Resume (Max 500 words)</Label>
              <Textarea name="resume" placeholder="Paste resume here..." rows={3} />
            </div>
            <div className="jobseeker-fields col-span-2" style={{ display: 'none' }}>
              <Label>Certificates / Recommendation Letters (Max 3, Optional)</Label>
              {certFiles.length > 0 && (
                <div className="flex gap-2 mb-2 flex-wrap">
                  {certFiles.map((file, i) => (
                    <div key={i} className="relative flex-shrink-0 w-16 h-16 rounded border border-blue-500 overflow-hidden">
                      <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => setCertFiles(certFiles.filter((_, idx) => idx !== i))} className="absolute top-0 right-0 bg-red-500 text-white w-4 h-4 flex items-center justify-center text-[10px]">X</button>
                    </div>
                  ))}
                </div>
              )}
              <input 
                type="file" 
                multiple 
                accept="image/png,image/jpeg,.pdf"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                onChange={(e) => {
                  const files = e.target.files;
                  if (files) setCertFiles([...certFiles, ...Array.from(files)].slice(0, 3));
                }} 
              />
            </div>
            <div className="col-span-2 border-t pt-4 mt-2 space-y-3">
              <p className="text-xs font-semibold text-gray-700">Terms & Conditions</p>
              <div className="max-h-32 overflow-y-auto bg-gray-50 rounded-lg p-3 text-[11px] text-gray-600 leading-relaxed border">
                {TERMS_AND_CONDITIONS}
              </div>
              <div className="flex items-start gap-2">
                <Checkbox id="terms" checked={termsAccepted} onCheckedChange={(c) => setTermsAccepted(c === true)} />
                <Label htmlFor="terms" className="text-xs leading-relaxed text-gray-700">
                  I accept the <strong>Terms & Conditions</strong>, <strong>Privacy Policy</strong>, <strong>GDPR rules</strong>, and <strong>Indemnity clause</strong>
                </Label>
              </div>
              <div className="flex items-start gap-2">
                <Checkbox id="data_sharing" checked={dataSharingConsent} onCheckedChange={(c) => setDataSharingConsent(c === true)} />
                <Label htmlFor="data_sharing" className="text-xs leading-relaxed text-gray-700">
                  I consent to my information being shared with paid users on the platform
                </Label>
              </div>
              <div className="flex items-start gap-2">
                <Checkbox id="newsletter_admin" checked={subscribeToNewsletter} onCheckedChange={(c) => setSubscribeToNewsletter(c === true)} />
                <Label htmlFor="newsletter_admin" className="text-xs leading-relaxed text-gray-700">
                  Subscribe to newsletter for latest jobs, services, and community updates
                </Label>
              </div>
            </div>
            <div className="col-span-2 flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateUserModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creatingUser || !termsAccepted || !dataSharingConsent}>
                {creatingUser ? 'Creating...' : 'Create User'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Modal */}
      <Dialog open={isEditUserModalOpen} onOpenChange={(open) => { if (!open) { setEditingUser(null); setIsEditUserModalOpen(false); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <form onSubmit={editProfile} className="grid grid-cols-2 gap-4 overflow-y-auto max-h-[calc(90vh-100px)]">
              <div>
                <Label>Full Name</Label>
                <Input name="full_name" defaultValue={editingUser.full_name} required />
              </div>
              <div>
                <Label>Email</Label>
                <Input name="email" type="email" defaultValue={editingUser.email || ''} required />
              </div>
              <div>
                <Label>Phone</Label>
                <Input name="phone" type="tel" defaultValue={editingUser.phone || ''} />
              </div>
              <div>
                <Label>Location</Label>
                <Input name="location" defaultValue={editingUser.location || ''} />
              </div>
              <div>
                <Label>County</Label>
                <select name="county" defaultValue={editingUser.county || ''} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 outline-none">
                  <option value="">Select county</option>
                  {KENYA_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <Label>Subcounty</Label>
                <Input name="subcounty" defaultValue={editingUser.subcounty || ''} placeholder="e.g. Kikuyu" />
              </div>
              <div>
                <Label>Role</Label>
                <Select name="role" defaultValue={editingUser.role} onValueChange={(val) => {
                  setTimeout(() => {
                    const fields = document.querySelectorAll('.edit-jobseeker-fields');
                    fields.forEach(f => (f as HTMLElement).style.display = val === 'jobseeker' ? 'block' : 'none');
                  }, 0);
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="jobseeker">Jobseeker</SelectItem>
                    <SelectItem value="employer">Employer</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="edit-jobseeker-fields" style={{ display: editingUser.role === 'jobseeker' ? 'block' : 'none' }}>
                <Label>Skills (comma separated)</Label>
                <Input name="skills" defaultValue={typeof editingUser.skills === 'string' ? editingUser.skills : (editingUser.skills || []).join(', ')} />
              </div>
              <div className="edit-jobseeker-fields" style={{ display: editingUser.role === 'jobseeker' ? 'block' : 'none' }}>
                <Label>Professional Resume</Label>
                <Textarea name="resume" defaultValue={editingUser.resume || ''} rows={3} />
              </div>
              <div>
                <Label>Profile Photo</Label>
                {(editProfileImageFile || editingUser.profile_image) && (
                  <div className="relative w-16 h-16 mb-2 rounded-full overflow-hidden border-2 border-green-200">
                    <img src={editProfileImageFile ? URL.createObjectURL(editProfileImageFile) : editingUser.profile_image} alt="" className="w-full h-full object-cover" />
                    {editProfileImageFile && (
                      <button type="button" onClick={() => setEditProfileImageFile(null)} className="absolute top-0 right-0 bg-red-500 text-white w-4 h-4 flex items-center justify-center text-[10px] rounded-full">X</button>
                    )}
                  </div>
                )}
                <input type="file" accept="image/png,image/jpeg,image/webp"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                  onChange={(e) => setEditProfileImageFile(e.target.files?.[0] || null)} />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch id="edit_ratings_enabled" checked={ratingsEnabled} onCheckedChange={setRatingsEnabled} />
                <Label htmlFor="edit_ratings_enabled">Enable ratings</Label>
              </div>
              <div className="col-span-2 flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => { setEditingUser(null); setIsEditUserModalOpen(false); setEditProfileImageFile(null); }}>Cancel</Button>
                <Button type="submit">Update User</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={(open) => { if (!open) { setDeletingUser(null); setIsDeleteDialogOpen(false); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deletingUser?.full_name}</strong>? This will permanently remove their account and all profile data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDeletingUser(null); setIsDeleteDialogOpen(false); }}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteUser} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminPage;





