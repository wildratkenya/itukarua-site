import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { Briefcase, FileText, CreditCard, User, Star, MapPin, Clock, TrendingUp, Users, Building2, Settings, Bell, Loader2, Camera, AlertCircle, RefreshCw, Megaphone, Upload, X, Plus, Eye, MousePointerClick } from 'lucide-react';
import { getJobs, getBidsByUser, getServiceAds, getPayments, getWorkers, getAllProfiles, getPlatformStats, updateProfile, getNotifications, getUnreadNotificationCount, markNotificationRead, getPlatformSettings, updatePlatformSetting, checkSubscriptionActive, getSubscriptionDaysRemaining, getNewsletterSubscribers, getProfileViewHistory, getSiteTraffic, getProfileRanking, getMyAds, createAdForUser, updateMyAd, deleteMyAd, getAdAnalytics, type DbJob, type DbBid, type DbServiceAd, type DbPayment, type DbProfile, type PlatformStats, type DbNotification, type DbAdvertisement } from '@/lib/database';
import { supabase, optimizeImageUrl, proxyImageUrl } from '@/lib/supabase';
import { IMAGES, KENYA_COUNTIES } from '@/data/siteData';
import { compressImage } from '@/lib/imageUtils';
import type { Page } from './Header';
import type { UserState } from '../AppLayout';
import MpesaModal from './MpesaModal';
import ProfileViewsChart from './ProfileViewsChart';
import SiteTrafficChart from './SiteTrafficChart';
import UserRanking from './UserRanking';
import AdvertiserAnalyticsChart from './AdvertiserAnalyticsChart';
import type { AdAnalyticsPoint } from '@/lib/database';

interface DashboardPageProps {
  user: UserState;
  onNavigate: (page: Page) => void;
  onViewJob: (jobId: string) => void;
  onOpenMpesa: (amount: number, description: string, accountRef: string) => void;
}

const DashboardPage: React.FC<DashboardPageProps> = ({ user, onNavigate, onViewJob, onOpenMpesa }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<DbJob[]>([]);
  const [bids, setBids] = useState<(DbBid & { job?: DbJob })[]>([]);
  const [ads, setAds] = useState<DbServiceAd[]>([]);
  const [myAds, setMyAds] = useState<DbAdvertisement[]>([]);
  const [payments, setPayments] = useState<DbPayment[]>([]);
  const [profiles, setProfiles] = useState<DbProfile[]>([]);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [profileForm, setProfileForm] = useState({ full_name: user.name, email: user.email, phone: '', location: '', county: '', subcounty: '', skills: '', resume: '', qualifications: '', experience: '', profile_image: '' });
  const [saving, setSaving] = useState(false);
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [certFiles, setCertFiles] = useState<File[]>([]);
  const [ratingsEnabled, setRatingsEnabled] = useState(user.profile?.ratings_enabled || false);
  const [notifications, setNotifications] = useState<DbNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [subscriptionDays, setSubscriptionDays] = useState(0);
  const [subscriptionActive, setSubscriptionActive] = useState(false);
  const [platformFees, setPlatformFees] = useState<Record<string, number>>({});
  const [feeInputs, setFeeInputs] = useState<Record<string, number>>({});
  const [feeSaving, setFeeSaving] = useState(false);
  const [feeMessage, setFeeMessage] = useState('');
  const [newsletterSubs, setNewsletterSubs] = useState<{ email: string; created_at: string }[]>([]);
  const [profileViewHistory, setProfileViewHistory] = useState<{ view_date: string; view_count: number }[]>([]);
  const [siteTraffic, setSiteTraffic] = useState<{ date: string; visitors: number; page_views: number }[]>([]);
  const [userRanking, setUserRanking] = useState<{ rank: number; total: number; reviews_count: number; rating: number } | null>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const [showAdForm, setShowAdForm] = useState(false);
  const [adForm, setAdForm] = useState<{ id?: string; title: string; image_url: string; images: string[]; destination_url: string; description: string; cta_text: string; whatsapp_number: string; is_affiliate: boolean }>({ title: '', image_url: '', images: [], destination_url: '', description: '', cta_text: 'Learn More', whatsapp_number: '', is_affiliate: false });
  const [advImageFiles, setAdvImageFiles] = useState<(File | null)[]>([]);
  const [advUrlInput, setAdvUrlInput] = useState('');
  const [advSaving, setAdvSaving] = useState(false);
  const [advError, setAdvError] = useState('');
  const [adAnalytics, setAdAnalytics] = useState<AdAnalyticsPoint[]>([]);
  const [showPaymentPrompt, setShowPaymentPrompt] = useState(false);
  const [lastCreatedAdId, setLastCreatedAdId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMessage, setPwMessage] = useState('');

  const isAdmin = user.role === 'admin' || user.role === 'super_admin';
  const isJobseeker = user.role === 'jobseeker';
  const isAdvertiser = user.role === 'advertiser';

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const promises: Promise<any>[] = [
          getPayments(isAdmin ? undefined : user.id),
          getNotifications(user.id),
        ];
        if (isAdmin) {
          promises.push(getJobs({}), getServiceAds({}), getAllProfiles(), getPlatformStats(), getPlatformSettings());
        } else if (isJobseeker) {
          promises.push(getBidsByUser(user.id), checkSubscriptionActive(user.id), getSubscriptionDaysRemaining(user.id));
        } else if (isAdvertiser) {
          promises.push(getMyAds(user.id), checkSubscriptionActive(user.id), getSubscriptionDaysRemaining(user.id));
        } else {
          promises.push(getJobs({ postedBy: user.id }));
        }

        const results = await Promise.all(promises);
        setPayments(results[0] || []);
        setNotifications(results[1] || []);
        setUnreadCount(results[1]?.filter((n: DbNotification) => !n.is_read).length || 0);

        const offset = 2;
        if (isAdmin) {
          setJobs(results[offset] || []);
          setAds(results[offset + 1] || []);
          setProfiles(results[offset + 2] || []);
          setStats(results[offset + 3] || null);
          const fees = results[offset + 4] || {};
          setPlatformFees(fees);
          setFeeInputs({ jobseeker_registration_fee: fees.jobseeker_registration_fee || 100, contact_access_fee: fees.contact_access_fee || 100 });
          const subs = await getNewsletterSubscribers();
          setNewsletterSubs(subs);
        } else if (isJobseeker) {
          setBids(results[offset] || []);
          setSubscriptionActive(results[offset + 1] || false);
          setSubscriptionDays(results[offset + 2] || 0);
        } else if (isAdvertiser) {
          setMyAds(results[offset] || []);
          setSubscriptionActive(results[offset + 1] || false);
          setSubscriptionDays(results[offset + 2] || 0);
          getAdAnalytics(user.id, 30).then(setAdAnalytics);
        } else {
          setJobs(results[offset] || []);
        }

        if (user.profile) {
          setProfileForm({
            full_name: user.profile.full_name || user.name,
            email: user.profile.email || user.email,
            phone: user.profile.phone || '',
            location: user.profile.location || '',
            county: user.profile.county || '',
            subcounty: user.profile.subcounty || '',
            skills: Array.isArray(user.profile.skills) ? user.profile.skills.join(', ') : (user.profile.skills || ''),
            resume: user.profile.resume || '',
            qualifications: user.profile.qualifications || '',
            experience: user.profile.experience || '',
            profile_image: user.profile.profile_image || '',
          });
          setRatingsEnabled(user.profile.ratings_enabled || false);
        }

        // Fetch analytics
        if (user.id) {
          const [history, ranking, traffic] = await Promise.all([
            getProfileViewHistory(user.id, 30),
            getProfileRanking(user.id),
            getSiteTraffic(30),
          ]);
          setProfileViewHistory(history || []);
          setUserRanking(ranking);
          setSiteTraffic(traffic || []);
          console.log('[Dashboard] Analytics data:', { history, ranking, traffic });
        }
      } catch (err) { console.error('Dashboard load error:', err); }
      finally { setLoading(false); }
    };
    load();
  }, [user.id, user.role, isAdmin, isJobseeker, isAdvertiser]);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      let profileImageUrl = profileForm.profile_image;
      if (profilePhotoFile) {
        const compressed = await compressImage(profilePhotoFile);
        const fileName = `${user.id}/avatar.${compressed.name.split('.').pop() || 'jpg'}`;
        const { error: photoError } = await supabase.storage.from('adverts').upload(fileName, compressed, { upsert: true });
        if (!photoError) {
          profileImageUrl = supabase.storage.from('adverts').getPublicUrl(fileName).data.publicUrl;
        }
      }
      let certUrls: string[] = [];
      if (certFiles.length > 0) {
        for (const file of certFiles) {
          const compressed = file.type.startsWith('image/') ? await compressImage(file) : file;
          const ext = compressed.name.split('.').pop() || 'jpg';
          const fileName = `${user.id}/certs/${Date.now()}_${crypto.randomUUID()}.${ext}`;
          const { error: upErr } = await supabase.storage.from('adverts').upload(fileName, compressed);
          if (!upErr) {
            certUrls.push(supabase.storage.from('adverts').getPublicUrl(fileName).data.publicUrl);
          }
        }
      }
      const existingCerts = user.profile?.certificates || [];
      await updateProfile(user.id, {
        full_name: profileForm.full_name,
        phone: profileForm.phone,
        location: profileForm.location,
        county: profileForm.county || null,
        subcounty: profileForm.subcounty || null,
        skills: profileForm.skills,
        resume: profileForm.resume,
        qualifications: profileForm.qualifications,
        experience: profileForm.experience,
        profile_image: profileImageUrl,
        ratings_enabled: ratingsEnabled,
        certificates: [...existingCerts, ...certUrls],
      });
      setCertFiles([]);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      setPwMessage('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMessage('Passwords do not match.');
      return;
    }
    setPwSaving(true);
    setPwMessage('');
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPwMessage('Password updated successfully.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPwMessage(err.message || 'Failed to update password.');
    } finally {
      setPwSaving(false);
    }
  };

  const tabs = isAdmin
    ? [{ id: 'overview', label: 'Overview', icon: TrendingUp }, { id: 'users', label: 'Users', icon: Users }, { id: 'jobs', label: 'Jobs', icon: Briefcase }, { id: 'payments', label: 'Payments', icon: CreditCard }, { id: 'adverts', label: 'Adverts', icon: Building2 }, { id: 'settings', label: 'Settings', icon: Settings }]
    : isJobseeker
    ? [{ id: 'overview', label: 'Overview', icon: TrendingUp }, { id: 'bids', label: 'My Bids', icon: FileText }, { id: 'payments', label: 'Payments', icon: CreditCard }, { id: 'profile', label: 'Profile', icon: User }]
    : isAdvertiser
    ? [{ id: 'overview', label: 'Overview', icon: TrendingUp }, { id: 'adverts', label: 'My Adverts', icon: Megaphone }, { id: 'payments', label: 'Payments', icon: CreditCard }, { id: 'profile', label: 'Profile', icon: User }]
    : [{ id: 'overview', label: 'Overview', icon: TrendingUp }, { id: 'jobs', label: 'My Jobs', icon: Briefcase }, { id: 'payments', label: 'Payments', icon: CreditCard }, { id: 'profile', label: 'Profile', icon: User }];

  // Close notification dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    if (showNotifications) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showNotifications]);

  const handleSaveFees = async () => {
    setFeeSaving(true);
    setFeeMessage('');
    try {
      for (const [key, value] of Object.entries(feeInputs)) {
        await updatePlatformSetting(key, value);
      }
      setPlatformFees(feeInputs);
      setFeeMessage('Fees saved successfully.');
    } catch (err) {
      setFeeMessage('Error saving fees.');
      console.error(err);
    } finally {
      setFeeSaving(false);
    }
  };

  const reloadMyAds = async () => {
    const data = await getMyAds(user.id);
    setMyAds(data || []);
    const analytics = await getAdAnalytics(user.id, 30);
    setAdAnalytics(analytics);
  };

  const addAdvFiles = (list: FileList | null) => {
    if (!list) return;
    const files = Array.from(list).filter(f => f.type.startsWith('image/'));
    const added = files.slice(0, Math.max(0, 3 - advImageFiles.length));
    if (added.length === 0) return;
    const urls = added.map(f => URL.createObjectURL(f));
    setAdvImageFiles(prev => [...prev, ...added]);
    setAdForm(prev => {
      const images = [...prev.images, ...urls];
      return { ...prev, images, image_url: images[0] || prev.image_url };
    });
  };

  const addAdvUrl = () => {
    const url = advUrlInput.trim();
    if (!url) return;
    setAdvUrlInput('');
    setAdForm(prev => {
      const images = prev.images.length >= 3 ? prev.images : [...prev.images, url];
      return { ...prev, images, image_url: images[0] || prev.image_url };
    });
    setAdvImageFiles(prev => (prev.length >= 3 ? prev : [...prev, null]));
  };

  const removeAdvImage = (idx: number) => {
    setAdForm(prev => {
      const images = prev.images.filter((_, i) => i !== idx);
      return { ...prev, images, image_url: images[0] || '' };
    });
    setAdvImageFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSaveAdForm = async () => {
    if (!adForm.title.trim() || adForm.images.length === 0) {
      setAdvError('Title and at least one banner image are required.');
      return;
    }
    setAdvSaving(true);
    setAdvError('');
    try {
      const finalImages: string[] = [];
      for (let i = 0; i < adForm.images.length; i++) {
        const img = adForm.images[i];
        const file = advImageFiles[i];
        if (img.startsWith('blob:') && file) {
          const compressed = await compressImage(file);
          const safeName = compressed.name.replace(/[^a-zA-Z0-9._-]/g, '');
          const fileName = `${user.id}/banner/${Date.now()}_${i}_${safeName}`;
          const { error: upErr } = await supabase.storage.from('adverts').upload(fileName, compressed);
          if (upErr) throw upErr;
          finalImages.push(supabase.storage.from('adverts').getPublicUrl(fileName).data.publicUrl);
        } else if (img && !img.startsWith('blob:')) {
          finalImages.push(img);
        }
      }
      if (finalImages.length === 0) throw new Error('At least one banner image is required.');
      const payload = {
        title: adForm.title,
        image_url: finalImages[0],
        images: finalImages,
        destination_url: adForm.destination_url || null,
        description: adForm.description,
        cta_text: adForm.cta_text,
        whatsapp_number: adForm.whatsapp_number,
        is_affiliate: adForm.is_affiliate,
      };
      if (adForm.id) {
        await updateMyAd(adForm.id, user.id, payload);
      } else {
        const created = await createAdForUser(user.id, payload);
        setLastCreatedAdId(created.id);
        setShowPaymentPrompt(true);
      }
      setShowAdForm(false);
      setAdvImageFiles([]);
      setAdvUrlInput('');
      setAdForm({ title: '', image_url: '', images: [], destination_url: '', description: '', cta_text: 'Learn More', whatsapp_number: '', is_affiliate: false });
      await reloadMyAds();
    } catch (err: any) {
      setAdvError(err.message || 'Failed to save advert. Please try again.');
    } finally {
      setAdvSaving(false);
    }
  };

  const handleToggleAdActive = async (ad: DbAdvertisement) => {
    try {
      await updateMyAd(ad.id, user.id, { active: !ad.active });
      await reloadMyAds();
    } catch (err: any) {
      alert(err.message || 'Failed to update advert.');
    }
  };

  const handleDeleteAd = async (ad: DbAdvertisement) => {
    if (!window.confirm(`Delete advert "${ad.title}"?`)) return;
    try {
      await deleteMyAd(ad.id, user.id);
      await reloadMyAds();
    } catch (err: any) {
      alert(err.message || 'Failed to delete advert.');
    }
  };

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Helmet>
        <title>Dashboard - Itukarua</title>
        <meta name="description" content="Manage your account, job listings, and service listings on Itukarua." />
        <link rel="canonical" href="https://www.itukarua.co.ke/dashboard" />
        <meta property="og:title" content="Dashboard - Itukarua" />
        <meta property="og:description" content="Manage your account, job listings, and service listings on Itukarua." />
        <meta property="og:site_name" content="Itukarua" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Dashboard - Itukarua" />
        <meta name="twitter:description" content="Manage your account, job listings, and service listings on Itukarua." />
        <meta name="twitter:image" content="https://www.itukarua.co.ke/og.jpg" />
      </Helmet>
      <div className="bg-gradient-to-r from-green-700 to-green-800 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center"><User className="w-7 h-7 text-white" /></div>
              <div>
                <h1 className="text-xl lg:text-2xl font-bold text-white">{isAdmin ? 'Admin Dashboard' : `Welcome, ${user.name}`}</h1>
                <p className="text-green-200 text-sm capitalize">{user.role} Account</p>
              </div>
            </div>
            <div className="relative" ref={notifRef}>
              <button onClick={() => setShowNotifications(!showNotifications)} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors relative">
                <Bell className="w-5 h-5 text-white" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {showNotifications && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 z-50 max-h-96 overflow-y-auto">
                  <div className="p-3 border-b border-gray-100">
                    <h4 className="font-semibold text-gray-900 text-sm">Notifications</h4>
                  </div>
                  {notifications.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">No notifications yet</p>
                  ) : (
                    notifications.slice(0, 20).map(n => (
                      <div key={n.id} className={`p-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${!n.is_read ? 'bg-green-50/50' : ''}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm ${n.is_read ? 'text-gray-700' : 'font-semibold text-gray-900'}`}>{n.title}</p>
                            {n.body && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>}
                            <p className="text-[10px] text-gray-400 mt-1">{new Date(n.created_at).toLocaleDateString()}</p>
                          </div>
                          {!n.is_read && (
                            <button onClick={() => handleMarkRead(n.id)} className="text-[10px] text-green-600 hover:text-green-700 whitespace-nowrap">Mark read</button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-1 overflow-x-auto pb-2 mb-6 border-b border-gray-200">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-sm font-medium whitespace-nowrap transition-colors ${activeTab === tab.id ? 'bg-white text-green-700 border border-gray-200 border-b-white -mb-px' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}>
              <tab.icon className="w-4 h-4" /> {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {(isAdmin ? [
                { label: 'Total Users', value: profiles.length.toString(), icon: Users, color: 'bg-blue-100 text-blue-600' },
                { label: 'Active Jobs', value: (stats?.active_jobs || 0).toString(), icon: Briefcase, color: 'bg-green-100 text-green-600' },
                { label: 'Revenue', value: `KES ${((stats?.total_payments || 0) / 1000).toFixed(0)}K`, icon: CreditCard, color: 'bg-amber-100 text-amber-600' },
                { label: 'Active Adverts', value: (stats?.active_businesses || 0).toString(), icon: Building2, color: 'bg-purple-100 text-purple-600' },
              ] : isJobseeker ? [
                { label: 'Active Bids', value: bids.filter(b => b.status === 'pending').length.toString(), icon: FileText, color: 'bg-blue-100 text-blue-600' },
                { label: 'Total Bids', value: bids.length.toString(), icon: Briefcase, color: 'bg-green-100 text-green-600' },
                { label: 'Payments', value: payments.length.toString(), icon: CreditCard, color: 'bg-amber-100 text-amber-600' },
                { label: 'Rating', value: user.profile?.rating?.toString() || '0', icon: Star, color: 'bg-purple-100 text-purple-600' },
                { label: 'Profile Views', value: (user.profile?.profile_views || 0).toString(), icon: Users, color: 'bg-indigo-100 text-indigo-600' },
              ] : isAdvertiser ? [
                { label: 'Total Adverts', value: myAds.length.toString(), icon: Megaphone, color: 'bg-blue-100 text-blue-600' },
                { label: 'Displays', value: myAds.reduce((sum, a) => sum + (a.displays || 0), 0).toString(), icon: Eye, color: 'bg-green-100 text-green-600' },
                { label: 'Clicks', value: myAds.reduce((sum, a) => sum + (a.clicks || 0), 0).toString(), icon: MousePointerClick, color: 'bg-amber-100 text-amber-600' },
                { label: 'Payments', value: payments.length.toString(), icon: CreditCard, color: 'bg-purple-100 text-purple-600' },
              ] : [
                { label: 'Posted Jobs', value: jobs.length.toString(), icon: Briefcase, color: 'bg-blue-100 text-blue-600' },
                { label: 'Total Bids', value: jobs.reduce((sum, j) => sum + j.bids_count, 0).toString(), icon: FileText, color: 'bg-green-100 text-green-600' },
                { label: 'Payments', value: payments.length.toString(), icon: CreditCard, color: 'bg-amber-100 text-amber-600' },
                { label: 'Profile Views', value: (user.profile?.profile_views || 0).toString(), icon: Users, color: 'bg-indigo-100 text-indigo-600' },
              ]).map((stat, i) => (
                <div key={i} className="bg-white rounded-xl p-5 border border-gray-100">
                  <div className={`w-10 h-10 ${stat.color} rounded-lg flex items-center justify-center mb-3`}><stat.icon className="w-5 h-5" /></div>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                </div>
              ))}
            </div>

            {isJobseeker && (
              <div className={`rounded-xl p-5 border ${subscriptionActive && subscriptionDays <= 7 ? 'border-amber-200 bg-amber-50' : subscriptionActive ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {subscriptionActive ? (
                      subscriptionDays <= 7 ? <AlertCircle className="w-6 h-6 text-amber-600" /> : <RefreshCw className="w-6 h-6 text-green-600" />
                    ) : (
                      <AlertCircle className="w-6 h-6 text-red-600" />
                    )}
                    <div>
                      <p className="font-semibold text-gray-900">
                        {subscriptionActive
                          ? `Subscription active — ${subscriptionDays} day${subscriptionDays === 1 ? '' : 's'} remaining`
                          : 'Subscription expired'}
                      </p>
                      <p className="text-sm text-gray-600">
                        {subscriptionActive
                          ? subscriptionDays <= 7 ? 'Your subscription is expiring soon. Renew to continue bidding.' : 'Your 30-day subscription is active.'
                          : 'Renew your subscription to start bidding on jobs.'}
                      </p>
                    </div>
                  </div>
                  {(!subscriptionActive || subscriptionDays <= 7) && (
                    <button onClick={() => onOpenMpesa(100, 'Jobseeker subscription renewal', user.id)} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap">
                      Renew KES 100
                    </button>
                  )}
                </div>
              </div>
            )}

            {isAdvertiser && (
              <div className={`rounded-xl p-5 border ${subscriptionActive && subscriptionDays <= 7 ? 'border-amber-200 bg-amber-50' : subscriptionActive ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {subscriptionActive ? (
                      subscriptionDays <= 7 ? <AlertCircle className="w-6 h-6 text-amber-600" /> : <RefreshCw className="w-6 h-6 text-green-600" />
                    ) : (
                      <AlertCircle className="w-6 h-6 text-red-600" />
                    )}
                    <div>
                      <p className="font-semibold text-gray-900">
                        {subscriptionActive
                          ? `Subscription active — ${subscriptionDays} day${subscriptionDays === 1 ? '' : 's'} remaining`
                          : 'No active subscription'}
                      </p>
                      <p className="text-sm text-gray-600">
                        {subscriptionActive
                          ? subscriptionDays <= 7 ? 'Your subscription is expiring soon. Renew to keep your adverts live.' : 'Your 30-day subscription is active.'
                          : 'Subscribe to publish and run banner adverts on the homepage.'}
                      </p>
                    </div>
                  </div>
                  {(!subscriptionActive || subscriptionDays <= 7) && (
                    <button onClick={() => onOpenMpesa(100, 'Advertiser subscription renewal', user.id)} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap">
                      {subscriptionActive ? 'Renew KES 100' : 'Subscribe KES 100'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Analytics Section */}
            <div className="space-y-4">
              {isAdvertiser && adAnalytics.length > 0 && (
                <AdvertiserAnalyticsChart
                  data={adAnalytics}
                  totalClicks={myAds.reduce((sum, a) => sum + (a.clicks || 0), 0)}
                  totalImpressions={myAds.reduce((sum, a) => sum + (a.displays || 0), 0)}
                />
              )}
              {profileViewHistory.length > 0 && (
                <ProfileViewsChart data={profileViewHistory} total={user.profile?.profile_views || 0} />
              )}
              {siteTraffic.length > 0 && <SiteTrafficChart data={siteTraffic} />}
              {userRanking && (
                <UserRanking rank={userRanking.rank} total={userRanking.total} reviewsCount={userRanking.reviews_count} rating={userRanking.rating} />
              )}
            </div>
          </div>
        )}

        {activeTab === 'jobs' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">{isAdmin ? 'All Jobs' : 'My Posted Jobs'}</h3>
              <button onClick={() => onNavigate('post-job')} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors">Post New Job</button>
            </div>
            {jobs.length > 0 ? jobs.map(job => (
              <div key={job.id} onClick={() => onViewJob(job.id)} className="bg-white rounded-xl p-4 border border-gray-100 hover:border-green-200 cursor-pointer transition-all flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">{job.title}</h4>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {job.location}</span>
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {job.bids_count} bids</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-green-700 text-sm">KES {job.budget_min.toLocaleString()} - {job.budget_max.toLocaleString()}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${job.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{job.status}</span>
                </div>
              </div>
            )) : <p className="text-gray-500 text-sm py-8 text-center">No jobs yet. Post your first job!</p>}
          </div>
        )}

        {activeTab === 'bids' && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">My Bids</h3>
            {bids.length > 0 ? bids.map(bid => (
              <div key={bid.id} className="bg-white rounded-xl p-4 border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900">{(bid as any).job?.title || 'Job'}</h4>
                  <span className="text-sm font-bold text-green-700">KES {bid.price.toLocaleString()}</span>
                </div>
                <p className="text-sm text-gray-500 line-clamp-1">{bid.proposal}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                  <span>Submitted: {new Date(bid.created_at).toLocaleDateString()}</span>
                  <span className={`px-2 py-0.5 rounded-full ${bid.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : bid.status === 'accepted' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{bid.status}</span>
                </div>
              </div>
            )) : <p className="text-gray-500 text-sm py-8 text-center">No bids yet. Browse jobs and start bidding!</p>}
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Payment History</h3>
            {payments.length > 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Type</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Amount</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Date</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Reference</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map(p => (
                        <tr key={p.id} className="border-t border-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900 capitalize">{p.payment_type.replace('_', ' ')}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-900">KES {p.amount.toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{new Date(p.created_at).toLocaleDateString()}</td>
                          <td className="px-4 py-3 text-sm text-gray-500 font-mono">{p.mpesa_ref || '-'}</td>
                          <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${p.status === 'completed' ? 'bg-green-100 text-green-700' : p.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{p.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : <p className="text-gray-500 text-sm py-8 text-center">No payment history yet.</p>}
          </div>
        )}

        {activeTab === 'adverts' && isAdvertiser && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">My Adverts</h3>
              <button onClick={() => { setAdvError(''); setAdForm({ title: '', image_url: '', images: [], destination_url: '', description: '', cta_text: 'Learn More', whatsapp_number: '', is_affiliate: false }); setAdvImageFiles([]); setAdvUrlInput(''); setShowAdForm(!showAdForm); }} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
                <Plus className="w-4 h-4" /> {showAdForm ? 'Close Form' : 'New Advert'}
              </button>
            </div>

            {showAdForm && (
              <div className="bg-white rounded-xl p-6 border border-gray-100 space-y-4">
                <h4 className="font-semibold text-gray-900">{adForm.id ? 'Edit Advert' : 'Create Banner Advert'}</h4>
                <p className="text-xs text-gray-500">Your advert appears in the banner carousel on the homepage. New adverts start unpublished — click "Publish" when ready.</p>
                {advError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{advError}</div>}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <input type="text" value={adForm.title} onChange={e => setAdForm({ ...adForm, title: e.target.value })} placeholder="e.g. Kamau Hardware Mega Sale" className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Banner Images * <span className="text-gray-400 font-normal">(up to 3)</span></label>
                  <p className="text-xs text-gray-500 mb-2">The first image is the main banner. All images appear in the homepage popup. Each is compressed automatically on save.</p>
                  <div className="flex flex-wrap gap-3">
                    {adForm.images.length === 0 && (
                      <div className="w-24 h-16 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400"><Plus className="w-5 h-5" /></div>
                    )}
                    {adForm.images.map((img, i) => (
                      <div key={i} className="relative w-24 h-16 rounded-lg overflow-hidden border border-gray-200 bg-gray-100 flex-shrink-0">
                        <img src={proxyImageUrl(img)} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        {i === 0 && <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] text-center py-0.5">Main</span>}
                        <button onClick={() => removeAdvImage(i)} className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80 transition-colors"><X className="w-3 h-3" /></button>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <label className={`px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${adForm.images.length >= 3 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}>
                      <Upload className="w-4 h-4 inline mr-1" /> Upload
                      <input type="file" accept="image/*" multiple className="hidden" disabled={adForm.images.length >= 3} onChange={e => { addAdvFiles(e.target.files); e.target.value = ''; }} />
                    </label>
                    <input type="url" value={advUrlInput} onChange={e => setAdvUrlInput(e.target.value)} placeholder="...or paste image URL" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                    <button onClick={addAdvUrl} disabled={adForm.images.length >= 3 || !advUrlInput.trim()} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50">Add</button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Destination URL</label>
                    <input type="url" value={adForm.destination_url} onChange={e => setAdForm({ ...adForm, destination_url: e.target.value })} placeholder="https://..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp Number</label>
                    <input type="tel" value={adForm.whatsapp_number} onChange={e => setAdForm({ ...adForm, whatsapp_number: e.target.value })} placeholder="e.g. 254712345678" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Short Description</label>
                  <input type="text" value={adForm.description} onChange={e => setAdForm({ ...adForm, description: e.target.value })} placeholder="Optional one-liner" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Button Text</label>
                    <input type="text" value={adForm.cta_text} onChange={e => setAdForm({ ...adForm, cta_text: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={adForm.is_affiliate} onChange={e => setAdForm({ ...adForm, is_affiliate: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500" />
                      Affiliate link
                    </label>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={handleSaveAdForm} disabled={advSaving} className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
                    {advSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : adForm.id ? 'Save Changes' : 'Create Advert'}
                  </button>
                  <button onClick={() => { setShowAdForm(false); setAdvImageFiles([]); setAdvUrlInput(''); }} className="px-6 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
                </div>
              </div>
            )}

            {showPaymentPrompt && lastCreatedAdId && (
              <div className="bg-green-50 rounded-xl p-5 border border-green-200 space-y-3">
                <h4 className="font-semibold text-gray-900">Advert Created Successfully!</h4>
                <p className="text-sm text-gray-600">Your advert has been saved but is not yet published. To go live, complete the M-Pesa payment of <strong>KES 100</strong> (7-day banner ad).</p>
                <div className="flex gap-3">
                  <button onClick={() => { setShowPaymentPrompt(false); onOpenMpesa(100, 'Banner advert — 7 days', `ADV-${lastCreatedAdId.slice(0, 8).toUpperCase()}`); }} className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors">
                    Pay Now — KES 100
                  </button>
                  <button onClick={() => setShowPaymentPrompt(false)} className="px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
                    Pay Later
                  </button>
                </div>
              </div>
            )}

            {myAds.length > 0 ? myAds.map(ad => (
              <div key={ad.id} className="bg-white rounded-xl p-4 border border-gray-100 flex items-center gap-4">
                <div className="w-20 h-14 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                  <img src={proxyImageUrl(ad.image_url)} alt={ad.title} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-900 truncate">{ad.title}</h4>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {ad.displays || 0}</span>
                    <span className="flex items-center gap-1"><MousePointerClick className="w-3 h-3" /> {ad.clicks || 0}</span>
                    <span className="text-gray-400">{new Date(ad.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${ad.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{ad.active ? 'Published' : 'Unpublished'}</span>
                  <div className="flex gap-2">
                    <button onClick={() => { setAdvError(''); setAdForm({ id: ad.id, title: ad.title, image_url: ad.image_url, images: ad.images?.length ? ad.images : [ad.image_url], destination_url: ad.destination_url || '', description: ad.description || '', cta_text: ad.cta_text || 'Learn More', whatsapp_number: ad.whatsapp_number || '', is_affiliate: ad.is_affiliate }); setAdvImageFiles((ad.images?.length ? ad.images : [ad.image_url]).map(() => null)); setAdvUrlInput(''); setShowAdForm(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="text-xs text-green-600 hover:text-green-700">Edit</button>
                    <button onClick={() => handleToggleAdActive(ad)} className="text-xs text-blue-600 hover:text-blue-700">{ad.active ? 'Unpublish' : 'Publish'}</button>
                    <button onClick={() => handleDeleteAd(ad)} className="text-xs text-red-600 hover:text-red-700">Delete</button>
                  </div>
                </div>
              </div>
            )) : <p className="text-gray-500 text-sm py-8 text-center">No adverts yet. Create your first banner advert!</p>}
          </div>
        )}

        {activeTab === 'adverts' && !isAdvertiser && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">{isAdmin ? 'All Adverts' : 'My Adverts'}</h3>
              <button onClick={() => onNavigate('post-advert')} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors">Post New Advert</button>
            </div>
            {ads.length > 0 ? ads.map(ad => (
              <div key={ad.id} className="bg-white rounded-xl p-4 border border-gray-100 flex items-center gap-4">
                <img src={optimizeImageUrl(ad.image || IMAGES.services[0], 100, 100)} alt={ad.business_name} className="w-16 h-16 rounded-lg object-cover" />
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{ad.business_name}</h4>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span>{ad.category}</span><span>{ad.location}</span><span>{ad.plan}</span>
                  </div>
                </div>
                <div className="text-right">
                  {ad.featured && <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">Featured</span>}
                  <p className="text-xs text-gray-400 mt-1">Expires: {ad.expiry_date}</p>
                </div>
              </div>
            )) : <p className="text-gray-500 text-sm py-8 text-center">No adverts yet.</p>}
          </div>
        )}

        {activeTab === 'users' && isAdmin && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Registered Users ({profiles.length})</h3>
            {profiles.map((p, idx) => (
              <div key={p.id} className="bg-white rounded-xl p-4 border border-gray-100 flex items-center gap-4">
                <img src={p.profile_image || IMAGES.workers[idx % IMAGES.workers.length]} alt={p.full_name} className="w-12 h-12 rounded-full object-cover" />
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{p.full_name || p.email}</h4>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span className="capitalize">{p.role}</span>
                    <span>{p.location || 'No location'}</span>
                    <span>{p.email}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {p.verified && <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Verified</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="max-w-2xl">
            <div className="bg-white rounded-xl p-6 border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-6">Profile Settings</h3>
              <div className="space-y-4">
                {isAdvertiser ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                      <input type="text" value={profileForm.full_name} onChange={e => setProfileForm({ ...profileForm, full_name: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input type="email" value={profileForm.email} disabled className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                      <input type="tel" value={profileForm.phone} onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 outline-none" />
                    </div>
                    <button onClick={handleSaveProfile} disabled={saving} className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
                    </button>
                    <div className="pt-4 mt-4 border-t border-gray-200">
                      <h4 className="font-semibold text-gray-900 mb-4">Update Password</h4>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                          <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min 6 characters" className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 outline-none" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                          <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter password" className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 outline-none" />
                        </div>
                        {pwMessage && <p className={`text-sm ${pwMessage.includes('success') ? 'text-green-600' : 'text-red-600'}`}>{pwMessage}</p>}
                        <button onClick={handleChangePassword} disabled={pwSaving || !newPassword || !confirmPassword} className="px-6 py-2.5 bg-gray-800 hover:bg-gray-900 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
                          {pwSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update Password'}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Profile Photo</label>
                      <div className="flex items-center gap-3">
                        {profilePhotoFile ? (
                          <img src={URL.createObjectURL(profilePhotoFile)} alt="Preview" className="w-16 h-16 rounded-full object-cover border-2 border-green-200" />
                        ) : profileForm.profile_image ? (
                          <img src={profileForm.profile_image} alt="Profile" className="w-16 h-16 rounded-full object-cover border-2 border-green-200" />
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center">
                            <Camera className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                        <input type="file" accept="image/*" onChange={e => { if (e.target.files?.[0]) setProfilePhotoFile(e.target.files[0]); }} className="flex-1 text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                      <input type="text" value={profileForm.full_name} onChange={e => setProfileForm({ ...profileForm, full_name: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input type="email" value={profileForm.email} disabled className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                      <input type="tel" value={profileForm.phone} onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                      <input type="text" value={profileForm.location} onChange={e => setProfileForm({ ...profileForm, location: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">County</label>
                      <select value={profileForm.county} onChange={e => setProfileForm({ ...profileForm, county: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 outline-none">
                        <option value="">Select county</option>
                        {KENYA_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Subcounty</label>
                      <input type="text" value={profileForm.subcounty} onChange={e => setProfileForm({ ...profileForm, subcounty: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 outline-none" placeholder="e.g. Kikuyu" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Skills (comma separated)</label>
                      <input type="text" value={profileForm.skills} onChange={e => setProfileForm({ ...profileForm, skills: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 outline-none" placeholder="e.g. Painting, Plumbing, Carpentry" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Qualifications</label>
                      <input type="text" value={profileForm.qualifications} onChange={e => setProfileForm({ ...profileForm, qualifications: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 outline-none" placeholder="e.g. Diploma in Electrical Engineering" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Experience</label>
                      <input type="text" value={profileForm.experience} onChange={e => setProfileForm({ ...profileForm, experience: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 outline-none" placeholder="e.g. 5 years in construction" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Professional Resume</label>
                      <textarea value={profileForm.resume} onChange={e => setProfileForm({ ...profileForm, resume: e.target.value })} rows={4} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 outline-none resize-none text-sm" placeholder="Paste your resume here..." />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Certificates / Referral Letters</label>
                      <input type="file" multiple accept=".pdf,image/png,image/jpeg" onChange={e => { if (e.target.files) setCertFiles(Array.from(e.target.files)); }} className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100" />
                      {certFiles.length > 0 && <p className="text-xs text-green-600 mt-1">{certFiles.length} file(s) selected</p>}
                      {(user.profile?.certificates?.length || 0) > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {user.profile?.certificates?.slice(0, 3).map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline hover:text-blue-800">Certificate {i + 1}</a>
                          ))}
                          {(user.profile?.certificates?.length || 0) > 3 && <span className="text-xs text-gray-400">+{(user.profile?.certificates?.length || 0) - 3} more</span>}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <input type="checkbox" id="ratings_enabled" checked={ratingsEnabled} onChange={e => setRatingsEnabled(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500" />
                      <label htmlFor="ratings_enabled" className="text-sm text-gray-700">Enable ratings & reviews on my profile</label>
                    </div>
                    <button onClick={handleSaveProfile} disabled={saving} className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && isAdmin && (
          <div className="max-w-2xl space-y-6">
            <div className="bg-white rounded-xl p-6 border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-4">Platform Fees</h3>
              <div className="space-y-4">
                {[
                  { key: 'jobseeker_registration_fee', label: 'Jobseeker Registration', desc: 'Monthly subscription fee', val: 100 },
                  { key: 'contact_access_fee', label: 'Contact Access Fee', desc: 'Per contact unlock', val: 100 },
                ].map((fee) => (
                  <div key={fee.key} className="flex items-center justify-between">
                    <div><p className="font-medium text-gray-900">{fee.label}</p><p className="text-xs text-gray-500">{fee.desc}</p></div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">KES</span>
                      <input type="number" value={feeInputs[fee.key] ?? fee.val} onChange={e => setFeeInputs({ ...feeInputs, [fee.key]: Number(e.target.value) })} className="w-24 px-3 py-2 rounded-lg border border-gray-300 text-right focus:ring-2 focus:ring-green-500 outline-none" />
                    </div>
                  </div>
                ))}
                {feeMessage && <p className={`text-sm ${feeMessage.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>{feeMessage}</p>}
                <button onClick={handleSaveFees} disabled={feeSaving} className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
                  {feeSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Settings'}
                </button>
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-4">Newsletter Subscribers ({newsletterSubs.length})</h3>
              {newsletterSubs.length > 0 ? (
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {newsletterSubs.map((s, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                      <span className="text-sm text-gray-700">{s.email}</span>
                      <span className="text-xs text-gray-400">{new Date(s.created_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-gray-400">No subscribers yet.</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;

