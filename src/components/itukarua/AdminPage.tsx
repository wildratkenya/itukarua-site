import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getProfile } from '@/lib/database';
import { seedSampleData } from '@/lib/seedData';
import { JOB_CATEGORIES, SERVICE_CATEGORIES } from '@/data/siteData';
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
import { toast } from '@/hooks/use-toast';

interface Profile {
  id: string;
  full_name: string;
  email?: string;
  role: string;
  verified: boolean;
  registration_paid: boolean;
  suspended?: boolean;
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
  const [newCategory, setNewCategory] = useState('');
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
        supabase.from('messages').select('*').order('created_at', { ascending: false }).then(({data}) => setMessages(data || []))
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
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ verified: !currentVerified })
        .eq('id', userId);

      if (error) throw error;

      setUsers(users.map(user =>
        user.id === userId ? { ...user, verified: !currentVerified } : user
      ));

      toast({
        title: 'Success',
        description: 'User verification status updated',
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
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const fullName = formData.get('full_name') as string;
    const phone = formData.get('phone') as string;
    const role = formData.get('role') as string;
    const location = formData.get('location') as string;

    try {
      // Skip Edge Function for now - not deployed
      console.log('Creating user via signup:', email);
      
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: { full_name: fullName, role, phone, location }
        }
      });
      console.log('Signup result:', { authData, authError });

      if (authError) {
        if (authError.message.includes('rate limit') || authError.message.includes('Too Many Requests')) {
          toast({ title: 'Rate Limited', description: 'Too many attempts. Wait 5 minutes and try again, or deploy Edge Function.', variant: 'destructive' });
          return;
        }
        if (authError.message.includes('already been registered')) {
          toast({ title: 'Error', description: 'Email already exists', variant: 'destructive' });
          return;
        }
        throw authError;
      }

      if (authData?.user) {
        // Upload certificates if jobseeker
        let certUrls: string[] = [];
        if (certFiles.length > 0 && role === 'jobseeker') {
          try {
            for (const file of certFiles) {
              const fileExt = file.name.split('.').pop();
              const fileName = `${authData.user.id}/certs/${Math.random()}.${fileExt}`;
              const { error: certError } = await supabase.storage.from('adverts').upload(fileName, file);
              if (!certError) {
                certUrls.push(supabase.storage.from('adverts').getPublicUrl(fileName).data.publicUrl);
              }
            }
          } catch (certErr) {
            console.error('Cert upload failed:', certErr);
          }
        }

        // Create profile
        const { error: profileError } = await supabase.from('profiles').insert({
          id: authData.user.id,
          full_name: fullName,
          email,
          phone,
          role,
          location,
          skills: role === 'jobseeker' ? formData.get('skills') as string : null,
          resume: role === 'jobseeker' ? formData.get('resume') as string : null,
          certificates: certUrls.length > 0 ? certUrls : null,
          verified: true,
          registration_paid: true,
        });

        if (profileError) {
          console.error('Profile error:', profileError);
          toast({ title: 'Partial success', description: 'User created but profile failed to save', variant: 'destructive' });
        } else {
          toast({ title: 'Success', description: `User ${fullName} created! Confirm email to login.` });
        }

        await loadData();
        setIsCreateUserModalOpen(false);
        setCertFiles([]);
      } else {
        toast({ title: 'Check email', description: 'Confirmation sent. Verify to login.' });
      }
    } catch (error: any) {
      console.error('Create user error:', error);
      toast({ title: 'Error', description: error.message || 'Failed', variant: 'destructive' });
    } finally {
      setCreatingUser(false);
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

  const addCategory = () => {
    if (!newCategory.trim()) return;
    if (categories.includes(newCategory.trim())) {
      toast({
        title: 'Error',
        description: 'Category already exists',
        variant: 'destructive',
      });
      return;
    }
    setCategories([...categories, newCategory.trim()]);
    setNewCategory('');
    toast({
      title: 'Success',
      description: 'Category added locally. Add it to a job or service to persist.',
    });
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
          const fileName = `${Math.random()}.${fileExt}`;
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
        const oversized = adFiles.filter(f => f.size > 1024 * 1024);
        if (oversized.length > 0) {
          toast({ title: 'File Too Large', description: `${oversized[0].name} exceeds 1MB limit. Please compress and try again.`, variant: 'destructive' });
          setAdUploading(false);
          return;
        }
        console.log('Uploading images:', adFiles.length);
        const newImages: string[] = [];
        
        for (const file of adFiles) {
          if (newImages.length >= 3) break;
          console.log('Uploading file:', file.name);
          const fileExt = file.name.split('.').pop();
          const fileName = `${Math.random()}.${fileExt}`;
          
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
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="jobs">Jobs</TabsTrigger>
            <TabsTrigger value="ads">Ads</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="messages">Messages</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>User Management</CardTitle>
                <Button onClick={() => { setCertFiles([]); setIsCreateUserModalOpen(true); }}>
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
                      <TableHead>Status</TableHead>
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
                          <Badge variant={user.suspended ? 'destructive' : 'default'}>
                            {user.suspended ? 'Suspended' : 'Active'}
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
                            variant={user.suspended ? 'default' : 'destructive'}
                            size="sm"
                            onClick={() => toggleUserSuspension(user.id, !!user.suspended)}
                          >
                            {user.suspended ? 'Unsuspend' : 'Suspend'}
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
                            className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                            onClick={() => {
                              setSelectedUser(user);
                              setIsUserModalOpen(true);
                            }}
                          >
                            View Bio
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
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="New category name"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                    />
                    <Button onClick={addCategory}>Add Category</Button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {categories.map((category) => (
                      <Badge key={category} variant="outline" className="justify-center">
                        {category}
                      </Badge>
                    ))}
                  </div>
                </div>
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
                    {categories.length > 0 ? categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>) : JOB_CATEGORIES.filter(c => c !== 'All Categories').map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <input type="hidden" id="job_category_hidden" name="category" defaultValue={editingJob?.category || (categories.length > 0 ? categories[0] : JOB_CATEGORIES[1])} />
              </div>
              <div>
                <Label>Location</Label>
                <Input name="location" defaultValue={editingJob?.location} required />
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
                    {categories.length > 0 ? categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>) : SERVICE_CATEGORIES.filter(c => c !== 'All Services').map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <input type="hidden" id="ad_category_hidden" name="category" defaultValue={editingAd?.category || (categories.length > 0 ? categories[0] : SERVICE_CATEGORIES[1])} />
              </div>
              <div>
                <Label>Location</Label>
                <Input name="location" defaultValue={editingAd?.location} required />
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
                accept="image/png, image/jpeg" 
                onChange={(e) => {
                  const files = e.target.files;
                  if (files) {
                    const validFiles = Array.from(files).filter(f => {
                      if (f.size > 1024 * 1024) {
                        alert(`${f.name} exceeds 1MB limit. Please compress or choose a smaller image.`);
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
          <form onSubmit={createUser} className="grid grid-cols-2 gap-4 overflow-y-auto max-h-[calc(90vh-100px)]">
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
            <div className="col-span-2 flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateUserModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creatingUser}>
                {creatingUser ? 'Creating...' : 'Create User'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPage;


