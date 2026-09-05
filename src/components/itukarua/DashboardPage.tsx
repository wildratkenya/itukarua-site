import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Briefcase, FileText, CreditCard, User, Star, MapPin, Clock, TrendingUp, Users, Building2, Settings, Bell, Loader2, Camera, AlertCircle, RefreshCw, Megaphone, Upload, X, Plus, Eye, MousePointerClick, Zap, Flame, ChevronDown, ChevronUp, CheckCircle, Check, Lock, Crown } from 'lucide-react';
import { getJobs, getBidsByUser, getBidsReceivedOnMyJobs, getServiceAds, getPayments, getWorkers, getAllProfiles, getPlatformStats, updateProfile, getNotifications, getUnreadNotificationCount, markNotificationRead, getPlatformSettings, updatePlatformSetting, checkSubscriptionActive, getSubscriptionDaysRemaining, getNewsletterSubscribers, getProfileViewHistory, getSiteTraffic, getProfileRanking, getMyAds, createAdForUser, updateMyAd, deleteMyAd, getAdAnalyticsByAd, boostAd, updateBid, updateJob, extendSubscription, getWeeklyBidCount, getMonthlyBidCount, FREE_BID_LIMIT, getCustomCategories, getJobViewHistory, getTotalJobViews, type DbJob, type DbBid, type DbServiceAd, type DbPayment, type DbProfile, type PlatformStats, type DbNotification, type DbAdvertisement, type AdAnalyticsByAd } from '@/lib/database';
import { supabase, optimizeImageUrl, proxyImageUrl } from '@/lib/supabase';
import { IMAGES, KENYA_COUNTIES, PRICING_PLANS } from '@/data/siteData';
import { getSubcounties } from '@/data/kenyaLocations';
import { compressImage } from '@/lib/imageUtils';
import type { Page } from './Header';
import type { UserState } from '../AppLayout';
import MpesaModal from './MpesaModal';
import AdSpecsModal, { validateAdImage } from './AdSpecsModal';
import ProfileViewsChart from './ProfileViewsChart';
import JobViewsChart from './JobViewsChart';
import SiteTrafficChart from './SiteTrafficChart';
import UserRanking from './UserRanking';
import AdvertiserAnalyticsChart from './AdvertiserAnalyticsChart';

interface DashboardPageProps {
  user: UserState;
  onNavigate: (page: Page) => void;
  onViewJob: (jobId: string) => void;
  onOpenMpesa: (amount: number, description: string, accountRef: string, paymentType?: string, relatedAdId?: string, relatedJobId?: string, relatedProfileId?: string, onComplete?: () => void) => void;
}

const DashboardPage: React.FC<DashboardPageProps> = ({ user, onNavigate, onViewJob, onOpenMpesa }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<DbJob[]>([]);
  const [bids, setBids] = useState<(DbBid & { job?: DbJob })[]>([]);
  const [receivedBids, setReceivedBids] = useState<(DbBid & { job?: DbJob })[]>([]);
  const [expandedReceivedBid, setExpandedReceivedBid] = useState<string | null>(null);
  const [acceptingBidId, setAcceptingBidId] = useState<string | null>(null);
  const [ads, setAds] = useState<DbServiceAd[]>([]);
  const [myAds, setMyAds] = useState<DbAdvertisement[]>([]);
  const [payments, setPayments] = useState<DbPayment[]>([]);
  const [profiles, setProfiles] = useState<DbProfile[]>([]);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [profileForm, setProfileForm] = useState({ full_name: user.name, email: user.email, phone: '', location: '', county: '', subcounty: '', skills: '', resume: '', qualifications: '', experience: '', profile_image: '', whatsapp_number: '' });
  const [saving, setSaving] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);
  const [profileSaveNotice, setProfileSaveNotice] = useState<string | null>(null);
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [certFiles, setCertFiles] = useState<File[]>([]);
  const [ratingsEnabled, setRatingsEnabled] = useState(user.profile?.ratings_enabled || false);
  const [notifications, setNotifications] = useState<DbNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [subscriptionDays, setSubscriptionDays] = useState(0);
  const [subscriptionActive, setSubscriptionActive] = useState(false);
  const [weeklyBidCount, setWeeklyBidCount] = useState(0);
  const [monthlyBidCount, setMonthlyBidCount] = useState(0);
  const [platformFees, setPlatformFees] = useState<Record<string, number>>({});
  const [feeInputs, setFeeInputs] = useState<Record<string, number>>({});
  const [feeSaving, setFeeSaving] = useState(false);
  const [feeMessage, setFeeMessage] = useState('');
  const [newsletterSubs, setNewsletterSubs] = useState<{ email: string; created_at: string }[]>([]);
  const [profileViewHistory, setProfileViewHistory] = useState<{ view_date: string; view_count: number }[]>([]);
  const [jobViewHistory, setJobViewHistory] = useState<{ view_date: string; view_count: number }[]>([]);
  const [totalJobViews, setTotalJobViews] = useState(0);
  const [siteTraffic, setSiteTraffic] = useState<{ date: string; visitors: number; page_views: number }[]>([]);
  const [userRanking, setUserRanking] = useState<{ rank: number; total: number; reviews_count: number; rating: number } | null>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const [showAdForm, setShowAdForm] = useState(false);
  const [showAdSpecs, setShowAdSpecs] = useState(false);
  const [adForm, setAdForm] = useState<{ id?: string; title: string; image_url: string; images: string[]; destination_url: string; description: string; cta_text: string; whatsapp_number: string; is_affiliate: boolean; slot: string }>({ title: '', image_url: '', images: [], destination_url: '', description: '', cta_text: 'Learn More', whatsapp_number: '', is_affiliate: false, slot: 'homepage_banner', plan: '30-day', target_scope: 'national', target_county: '', target_subcounty: '' });
  const [advImageFiles, setAdvImageFiles] = useState<(File | null)[]>([]);
  const [advUrlInput, setAdvUrlInput] = useState('');
  const [advSaving, setAdvSaving] = useState(false);
  const [advError, setAdvError] = useState('');
  const [adAnalyticsByAd, setAdAnalyticsByAd] = useState<AdAnalyticsByAd[]>([]);
  const [showPaymentPrompt, setShowPaymentPrompt] = useState(false);
  const [lastCreatedAdId, setLastCreatedAdId] = useState<string | null>(null);
  const [boostInfoAdId, setBoostInfoAdId] = useState<string | null>(null);
  const [boostingAdId, setBoostingAdId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMessage, setPwMessage] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [dbJobCategories, setDbJobCategories] = useState<string[]>([]);
  const [matchingJobs, setMatchingJobs] = useState<DbJob[]>([]);
  const [categoryFormSaved, setCategoryFormSaved] = useState(false);

  const isAdmin = user.role === 'admin' || user.role === 'super_admin';
  const isJobseeker = user.role === 'jobseeker';
  const isAdvertiser = user.role === 'advertiser';

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const promises: Promise<any>[] = [
          getPayments(isAdmin ? undefined : { userId: user.id }),
          getNotifications(user.id),
        ];
        if (isAdmin) {
          promises.push(getJobs({}), getServiceAds({}), getAllProfiles(), getPlatformStats(), getPlatformSettings());
        } else if (isJobseeker) {
          promises.push(getBidsByUser(user.id), checkSubscriptionActive(user.id), getSubscriptionDaysRemaining(user.id), getWeeklyBidCount(user.id), getMonthlyBidCount(user.id));
        } else if (isAdvertiser) {
          promises.push(getMyAds(user.id), checkSubscriptionActive(user.id), getSubscriptionDaysRemaining(user.id));
        } else {
          promises.push(getJobs({ postedBy: user.id }), getBidsReceivedOnMyJobs(user.id));
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
          setWeeklyBidCount(results[offset + 3] || 0);
          setMonthlyBidCount(results[offset + 4] || 0);
        } else if (isAdvertiser) {
          setMyAds(results[offset] || []);
          setSubscriptionActive(results[offset + 1] || false);
          setSubscriptionDays(results[offset + 2] || 0);
          getAdAnalyticsByAd(user.id, 30).then(setAdAnalyticsByAd);
        } else {
          setJobs(results[offset] || []);
          setReceivedBids(results[offset + 1] || []);
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
            whatsapp_number: user.profile.whatsapp_number || '',
          });
          setRatingsEnabled(user.profile.ratings_enabled || false);
        }

        // For jobseekers: load selected categories from user metadata + fetch matching jobs
        if (isJobseeker) {
          const [userData, dbCats] = await Promise.all([
            supabase.auth.getUser(),
            getCustomCategories('job'),
          ]);
          setDbJobCategories(dbCats);
          const cats = (userData?.data?.user?.user_metadata?.selected_categories as string[]) || [];
          setSelectedCategories(cats);
          if (cats.length > 0) {
            const allOpenJobs = await getJobs({ activeOnly: true });
            const matched = allOpenJobs.filter(j => cats.includes(j.category));
            setMatchingJobs(matched);
          } else {
            const allOpenJobs = await getJobs({ activeOnly: true, limit: 10 });
            setMatchingJobs(allOpenJobs);
          }
        } else if (isAdvertiser || user.role === 'employer') {
          const dbCats = await getCustomCategories('job');
          setDbJobCategories(dbCats);
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
          if (!isAdmin && !isJobseeker && !isAdvertiser) {
            const [jvh, tjv] = await Promise.all([
              getJobViewHistory(user.id, 30),
              getTotalJobViews(user.id),
            ]);
            setJobViewHistory(jvh || []);
            setTotalJobViews(tjv || 0);
          }
          console.log('[Dashboard] Analytics data:', { history, ranking, traffic });
        }
      } catch (err) { console.error('Dashboard load error:', err); }
      finally { setLoading(false); }
    };
    load();
  }, [user.id, user.role, isAdmin, isJobseeker, isAdvertiser]);

  const handleSaveProfile = async () => {
    setSaving(true);
    setProfileSaveError(null);
    setProfileSaveNotice(null);
    const withTimeout = <T,>(p: Promise<T>, ms: number, label: string) =>
      Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms))]);
    try {
      let profileImageUrl = profileForm.profile_image;
      if (profilePhotoFile) {
        const compressed = await compressImage(profilePhotoFile);
        const fileName = `${user.id}/avatar.${compressed.name.split('.').pop() || 'jpg'}`;
        console.log('[ProfileSave] uploading photo...');
        const { error: photoError } = await withTimeout(supabase.storage.from('adverts').upload(fileName, compressed, { upsert: true }), 20000, 'Photo upload');
        if (photoError) console.warn('[ProfileSave] photo upload failed:', photoError);
        else profileImageUrl = supabase.storage.from('adverts').getPublicUrl(fileName).data.publicUrl;
      }
      let certUrls: string[] = [];
      const certUploadErrors: string[] = [];
      if (certFiles.length > 0) {
        console.log(`[ProfileSave] uploading ${certFiles.length} certificate(s)...`);
        for (const file of certFiles) {
          const compressed = file.type.startsWith('image/') ? await compressImage(file) : file;
          const ext = compressed.name.split('.').pop() || 'jpg';
          const fileName = `${user.id}/certs/${Date.now()}_${crypto.randomUUID()}.${ext}`;
          const { error: upErr } = await withTimeout(supabase.storage.from('adverts').upload(fileName, compressed), 20000, 'Certificate upload');
          if (upErr) {
            console.warn(`[ProfileSave] cert upload failed (${file.name}):`, upErr);
            certUploadErrors.push(`${file.name}: ${upErr.message || (upErr.error ?? 'upload failed')}`);
          } else {
            certUrls.push(supabase.storage.from('adverts').getPublicUrl(fileName).data.publicUrl);
          }
        }
      }
      const existingCerts = user.profile?.certificates || [];
      console.log('[ProfileSave] updating profiles row...');
      await withTimeout(updateProfile(user.id, {
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
        whatsapp_number: profileForm.whatsapp_number || null,
      }), 25000, 'Profile save');
      // Persist selected categories to user metadata (best-effort, must never block the confirmation)
      console.log('[ProfileSave] updating auth metadata...');
      try {
        await withTimeout(supabase.auth.updateUser({ data: { selected_categories: selectedCategories } }), 15000, 'Categories metadata');
      } catch (metaErr: any) {
        console.warn('[ProfileSave] categories metadata update failed (non-fatal):', metaErr);
      }
      setCertFiles([]);
      setCategoryFormSaved(true);
      setTimeout(() => setCategoryFormSaved(false), 2000);
      if (certUploadErrors.length > 0) {
        setProfileSaveNotice(`Profile saved, but ${certUploadErrors.length} certificate file(s) were not uploaded (${certUploadErrors.join('; ')}).`);
      }
      console.log('[ProfileSave] done');
    } catch (err: any) {
      console.error('[ProfileSave] error:', err);
      setProfileSaveError((err && (err.message || err.error_description)) || 'Failed to save profile. Please try again.');
    }
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
    : [{ id: 'overview', label: 'Overview', icon: TrendingUp }, { id: 'received-bids', label: 'Received Bids', icon: FileText }, { id: 'jobs', label: 'My Jobs', icon: Briefcase }, { id: 'payments', label: 'Payments', icon: CreditCard }, { id: 'profile', label: 'Profile', icon: User }];

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

  const recentPayments = useMemo(() => {
    const filtered = isAdmin ? payments : payments.filter(p => p.payment_type === 'job_posting' || p.payment_type === 'registration' || p.payment_type === 'job_payment');
    return [...filtered].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);
  }, [payments, isAdmin]);

  const handleAcceptReceivedBid = async (bid: DbBid & { job?: DbJob }) => {
    if (!bid.job) return;
    try {
      setAcceptingBidId(bid.id);
      await updateJob(bid.job.id, { status: 'in-progress' });
      await updateBid(bid.id, { status: 'accepted' });
      const siblings = receivedBids.filter(b => b.job_id === bid.job_id && b.id !== bid.id && b.status === 'pending');
      await Promise.all(siblings.map(b => updateBid(b.id, { status: 'rejected' })));
      setReceivedBids(prev => prev.map(b => {
        if (b.id === bid.id) return { ...b, status: 'accepted' as const };
        if (b.job_id === bid.job_id && b.id !== bid.id) return { ...b, status: 'rejected' as const };
        return b;
      }));
      alert(`Bid accepted! Job is now in progress. All other bids for "${bid.job.title}" have been closed.`);
    } catch (err) {
      console.error('Error accepting bid:', err);
      alert('Failed to accept bid. Please try again.');
    } finally {
      setAcceptingBidId(null);
    }
  };

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
    const analytics = await getAdAnalyticsByAd(user.id, 30);
    setAdAnalyticsByAd(analytics);
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
      const images = prev.images.length >= 8 ? prev.images : [...prev.images, url];
      return { ...prev, images, image_url: images[0] || prev.image_url };
    });
    setAdvImageFiles(prev => (prev.length >= 8 ? prev : [...prev, null]));
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
        slot: adForm.slot,
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
      setAdForm({ title: '', image_url: '', images: [], destination_url: '', description: '', cta_text: 'Learn More', whatsapp_number: '', is_affiliate: false, slot: 'homepage_banner', plan: '30-day', target_scope: 'national', target_county: '', target_subcounty: '' });
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
                      <div key={n.id} className={`p-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${!n.is_read ? 'bg-green-50/50' : ''} ${n.related_link ? 'cursor-pointer' : ''}`} onClick={() => { if (n.related_link) { if (!n.is_read) handleMarkRead(n.id); if (n.related_link.startsWith('/jobs/')) { onViewJob(n.related_link.replace('/jobs/', '')); } } }}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm ${n.is_read ? 'text-gray-700' : 'font-semibold text-gray-900'}`}>{n.title}</p>
                            {n.body && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>}
                            <p className="text-[10px] text-gray-400 mt-1">{new Date(n.created_at).toLocaleDateString()}</p>
                          </div>
                          {!n.is_read && (
                            <button onClick={(e) => { e.stopPropagation(); handleMarkRead(n.id); }} className="text-[10px] text-green-600 hover:text-green-700 whitespace-nowrap">Mark read</button>
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
            {isJobseeker ? (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left column — Stats + Subscription + Bid Usage */}
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { label: 'Active Bids', value: bids.filter(b => b.status === 'pending').length.toString(), icon: FileText, color: 'bg-blue-100 text-blue-600', tab: 'bids' },
                        { label: 'Total Bids', value: bids.length.toString(), icon: Briefcase, color: 'bg-green-100 text-green-600', tab: 'bids' },
                        { label: 'Payments', value: payments.length.toString(), icon: CreditCard, color: 'bg-amber-100 text-amber-600', tab: 'payments' },
                        { label: 'Rating', value: user.profile?.rating?.toString() || '0', icon: Star, color: 'bg-purple-100 text-purple-600', tab: 'profile' },
                        { label: 'Profile Views', value: (user.profile?.profile_views || 0).toString(), icon: Users, color: 'bg-indigo-100 text-indigo-600', tab: 'profile' },
                      ].map((stat, i) => (
                        <div key={i} onClick={() => setActiveTab(stat.tab)} className="bg-white rounded-xl p-4 border border-gray-100 cursor-pointer hover:border-green-200 hover:shadow-sm transition-all">
                          <div className={`w-9 h-9 ${stat.color} rounded-lg flex items-center justify-center mb-2`}><stat.icon className="w-4 h-4" /></div>
                          <p className="text-xl font-bold text-gray-900">{stat.value}</p>
                          <p className="text-[11px] text-gray-500">{stat.label}</p>
                        </div>
                      ))}
                    </div>

                    <div className={`rounded-xl p-5 border ${subscriptionActive && subscriptionDays <= 7 ? 'border-amber-200 bg-amber-50' : subscriptionActive ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {subscriptionActive ? (
                            subscriptionDays <= 7 ? <AlertCircle className="w-6 h-6 text-amber-600" /> : <RefreshCw className="w-6 h-6 text-green-600" />
                          ) : (
                            <User className="w-6 h-6 text-gray-500" />
                          )}
                          <div>
                            <p className="font-semibold text-gray-900">
                              {subscriptionActive
                                ? `Subscription active — ${subscriptionDays} day${subscriptionDays === 1 ? '' : 's'} remaining`
                                : 'Free Plan'}
                            </p>
                            <p className="text-sm text-gray-600">
                              {subscriptionActive
                                ? subscriptionDays <= 7 ? 'Your subscription is expiring soon. Renew to continue bidding.' : 'Your premium subscription is active.'
                                : `You have ${FREE_BID_LIMIT - weeklyBidCount} of ${FREE_BID_LIMIT} free bids this week. Upgrade for unlimited bids.`}
                            </p>
                          </div>
                        </div>
                        {(!subscriptionActive || subscriptionDays <= 7) && (
                          <div className="flex gap-2 flex-wrap">
                            {!subscriptionActive && (
                              <>
                                <button onClick={() => onNavigate('search-jobs')} disabled={weeklyBidCount >= FREE_BID_LIMIT} className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap flex items-center gap-2 ${weeklyBidCount >= FREE_BID_LIMIT ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
                                  <Briefcase className="w-4 h-4" /> Bid on Jobs
                                </button>
                                <button onClick={() => onOpenMpesa(100, 'Jobseeker Premium Subscription', 'PREM-NEW', 'registration', undefined, undefined, undefined, () => extendSubscription(user.id, 30))} disabled={weeklyBidCount < FREE_BID_LIMIT} className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${weeklyBidCount < FREE_BID_LIMIT ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 text-white'}`}>
                                  Upgrade — KES 100/mo
                                </button>
                              </>
                            )}
                            {subscriptionActive && subscriptionDays <= 7 && PRICING_PLANS.subscriptionPackages.map(pkg => (
                              <button key={pkg.id} onClick={() => onOpenMpesa(pkg.price, `Subscription renewal — ${pkg.name} (${pkg.days} days)`, user.id, 'registration', undefined, undefined, undefined, () => extendSubscription(user.id, pkg.days))} className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${pkg.popular ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-white border border-green-200 text-green-700 hover:bg-green-50'}`}>
                                {pkg.name} — KES {pkg.price}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right column — Jobs in Your Interests */}
                  <div>
                    {matchingJobs.length > 0 ? (
                      <div className="bg-white rounded-xl p-5 border border-gray-100">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h3 className="font-semibold text-gray-900">Jobs in Your Interests</h3>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {selectedCategories.length > 0
                                ? `Showing jobs in ${selectedCategories.length} categor${selectedCategories.length === 1 ? 'y' : 'ies'} you selected`
                                : 'Browse open jobs matching your skills'}
                            </p>
                          </div>
                          <button onClick={() => onNavigate('search-jobs')} className="text-xs font-semibold text-green-700 hover:text-green-800">View All</button>
                        </div>
                        <div className="space-y-2">
                          {matchingJobs.slice(0, 8).map(job => (
                            <div key={job.id} onClick={() => onViewJob(job.id)} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors border border-gray-50">
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-medium text-gray-900 truncate">{job.title}</h4>
                                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {job.location}</span>
                                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(job.created_at).toLocaleDateString()}</span>
                                  <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-medium">{job.category}</span>
                                </div>
                              </div>
                              <div className="text-right ml-3">
                                <p className="text-sm font-semibold text-green-700">KES {job.budget_min.toLocaleString()} - {job.budget_max.toLocaleString()}</p>
                                <span className="text-[10px] text-gray-400">{job.bids_count || 0} bids</span>
                              </div>
                            </div>
                          ))}
                        </div>
                        {matchingJobs.length > 8 && (
                          <button onClick={() => onNavigate('search-jobs')} className="w-full mt-3 py-2 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors">
                            View {matchingJobs.length - 8} more jobs
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="bg-white rounded-xl p-8 border border-gray-100 text-center">
                        <Briefcase className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm font-medium text-gray-600">No matching jobs yet</p>
                        <p className="text-xs text-gray-400 mt-1">Jobs in your selected categories will appear here</p>
                        <button onClick={() => onNavigate('search-jobs')} className="mt-3 px-4 py-2 text-sm font-semibold text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors">
                          Browse All Jobs
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white rounded-xl p-5 border border-gray-100">
                    {subscriptionActive ? (
                      <>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold text-gray-900">Monthly Bid Usage</h3>
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                            Unlimited
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-3">
                          <div className="h-2.5 rounded-full transition-all bg-blue-500" style={{ width: '100%' }} />
                        </div>
                        <p className="text-xs text-gray-500 mb-3">
                          You've placed {monthlyBidCount} bid{monthlyBidCount === 1 ? '' : 's'} this month. Premium gives you unlimited bids.
                        </p>
                        {bids.length > 0 && (
                          <div className="mt-4 pt-3 border-t border-gray-100">
                            <p className="text-xs font-medium text-gray-700 mb-2">Recent Bids This Month</p>
                            <div className="space-y-1.5 max-h-32 overflow-y-auto">
                              {bids.filter(b => {
                                const d = new Date(b.created_at);
                                const now = new Date();
                                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                                return d >= startOfMonth;
                              }).slice(0, 5).map(bid => (
                                <div key={bid.id} className="flex items-center justify-between text-xs">
                                  <span className="text-gray-600 truncate max-w-[60%]">{(bid as any).job?.title || 'Job'}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-gray-400">{new Date(bid.created_at).toLocaleDateString()}</span>
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${bid.status === 'accepted' ? 'bg-green-100 text-green-700' : bid.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{bid.status}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold text-gray-900">Weekly Bid Usage</h3>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${weeklyBidCount >= FREE_BID_LIMIT ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                            {weeklyBidCount}/{FREE_BID_LIMIT} used
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-3">
                          <div className={`h-2.5 rounded-full transition-all ${weeklyBidCount >= FREE_BID_LIMIT ? 'bg-red-500' : weeklyBidCount >= 3 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${Math.min(100, (weeklyBidCount / FREE_BID_LIMIT) * 100)}%` }} />
                        </div>
                        <p className="text-xs text-gray-500 mb-3">
                          {weeklyBidCount >= FREE_BID_LIMIT
                            ? 'You\'ve used all free bids this week. Upgrade to Premium for unlimited bids.'
                            : `${FREE_BID_LIMIT - weeklyBidCount} free bid${FREE_BID_LIMIT - weeklyBidCount === 1 ? '' : 's'} remaining this week.`}
                        </p>
                        {weeklyBidCount >= FREE_BID_LIMIT && (
                          <button onClick={() => onOpenMpesa(100, 'Jobseeker Premium Subscription', 'PREM-NEW', 'registration', undefined, undefined, undefined, () => extendSubscription(user.id, 30))} className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors">
                            Upgrade to Premium — KES 100/mo
                          </button>
                        )}
                        {bids.length > 0 && (
                          <div className="mt-4 pt-3 border-t border-gray-100">
                            <p className="text-xs font-medium text-gray-700 mb-2">Recent Bids This Week</p>
                            <div className="space-y-1.5 max-h-32 overflow-y-auto">
                              {bids.filter(b => {
                                const d = new Date(b.created_at);
                                const now = new Date();
                                const startOfWeek = new Date(now);
                                startOfWeek.setDate(now.getDate() - now.getDay());
                                startOfWeek.setHours(0, 0, 0, 0);
                                return d >= startOfWeek;
                              }).slice(0, 5).map(bid => (
                                <div key={bid.id} className="flex items-center justify-between text-xs">
                                  <span className="text-gray-600 truncate max-w-[60%]">{(bid as any).job?.title || 'Job'}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-gray-400">{new Date(bid.created_at).toLocaleDateString()}</span>
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${bid.status === 'accepted' ? 'bg-green-100 text-green-700' : bid.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{bid.status}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  {userRanking && (
                    <div className="bg-white rounded-xl p-5 border border-gray-100">
                      <UserRanking rank={userRanking.rank} total={userRanking.total} reviewsCount={userRanking.reviews_count} rating={userRanking.rating} />
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                  {(isAdmin ? [
                    { label: 'Total Users', value: profiles.length.toString(), icon: Users, color: 'bg-blue-100 text-blue-600', tab: 'users' },
                    { label: 'Active Jobs', value: (stats?.active_jobs || 0).toString(), icon: Briefcase, color: 'bg-green-100 text-green-600', tab: 'jobs' },
                    { label: 'Revenue', value: `KES ${((stats?.total_payments || 0) / 1000).toFixed(0)}K`, icon: CreditCard, color: 'bg-amber-100 text-amber-600', tab: 'payments' },
                    { label: 'Active Adverts', value: (stats?.active_businesses || 0).toString(), icon: Building2, color: 'bg-purple-100 text-purple-600', tab: 'adverts' },
                  ] : isAdvertiser ? [
                { label: 'Total Adverts', value: myAds.length.toString(), icon: Megaphone, color: 'bg-blue-100 text-blue-600', tab: 'adverts' },
                { label: 'Displays', value: myAds.reduce((sum, a) => sum + (a.displays || 0), 0).toString(), icon: Eye, color: 'bg-green-100 text-green-600', tab: 'adverts' },
                { label: 'Clicks', value: myAds.reduce((sum, a) => sum + (a.clicks || 0), 0).toString(), icon: MousePointerClick, color: 'bg-amber-100 text-amber-600', tab: 'adverts' },
                { label: 'Payments', value: payments.length.toString(), icon: CreditCard, color: 'bg-purple-100 text-purple-600', tab: 'payments' },
              ] : [
                { label: 'Posted Jobs', value: jobs.length.toString(), icon: Briefcase, color: 'bg-blue-100 text-blue-600', tab: 'jobs' },
                { label: 'Job Views', value: totalJobViews.toString(), icon: Eye, color: 'bg-cyan-100 text-cyan-600', tab: 'overview' },
                { label: 'Total Bids', value: receivedBids.length.toString(), icon: FileText, color: 'bg-green-100 text-green-600', tab: 'received-bids' },
                { label: 'Payments', value: payments.length.toString(), icon: CreditCard, color: 'bg-amber-100 text-amber-600', tab: 'payments' },
                { label: 'Profile Views', value: (user.profile?.profile_views || 0).toString(), icon: Users, color: 'bg-indigo-100 text-indigo-600', tab: 'profile' },
              ]).map((stat, i) => (
                <div key={i} onClick={() => setActiveTab(stat.tab)} className="bg-white rounded-xl p-5 border border-gray-100 cursor-pointer hover:border-green-200 hover:shadow-sm transition-all">
                  <div className={`w-10 h-10 ${stat.color} rounded-lg flex items-center justify-center mb-3`}><stat.icon className="w-5 h-5" /></div>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                </div>
              ))}
            </div>

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
                          ? subscriptionDays <= 7 ? 'Your subscription is expiring soon. Renew to keep your adverts live.' : 'Your subscription is active.'
                          : 'Subscribe to publish and run banner adverts on the homepage.'}
                      </p>
                    </div>
                  </div>
                  {(!subscriptionActive || subscriptionDays <= 7) && (
                    <button onClick={() => onOpenMpesa(100, 'Advertiser subscription renewal', user.id, 'advert')} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap">
                      {subscriptionActive ? 'Renew KES 100' : 'Subscribe KES 100'}
                    </button>
                  )}
                </div>
              </div>
            )}
              </>
            )}

            {/* Analytics Section */}
            <div className="space-y-4">
              {isAdvertiser && adAnalyticsByAd.length > 0 && (
                <AdvertiserAnalyticsChart
                  analyticsByAd={adAnalyticsByAd}
                        ads={myAds}
                />
              )}
              {!isAdmin && !isJobseeker && !isAdvertiser && jobViewHistory.length > 0 && (
                <JobViewsChart data={jobViewHistory} total={totalJobViews} />
              )}
              {profileViewHistory.length > 0 && (
                <ProfileViewsChart data={profileViewHistory} total={user.profile?.profile_views || 0} />
              )}
              {siteTraffic.length > 0 && <SiteTrafficChart data={siteTraffic} />}
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

        {activeTab === 'received-bids' && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Received Bids</h3>
            {receivedBids.length > 0 ? (() => {
              const grouped = new Map<string, (DbBid & { job?: DbJob })[]>();
              receivedBids.forEach(b => {
                const key = b.job_id;
                if (!grouped.has(key)) grouped.set(key, []);
                grouped.get(key)!.push(b);
              });
              return [...grouped.entries()].map(([jobId, jobBids]) => {
                const job = jobBids[0].job;
                const hasAccepted = jobBids.some(b => b.status === 'accepted');
                return (
                  <div key={jobId} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-gray-900">{job?.title || 'Job'}</h4>
                        <p className="text-xs text-gray-500">{jobBids.length} bid{jobBids.length !== 1 ? 's' : ''} &middot; Budget: KES {(job?.budget_min || 0).toLocaleString()} - {(job?.budget_max || 0).toLocaleString()}</p>
                      </div>
                      {hasAccepted && <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full font-medium">In Progress</span>}
                    </div>
                    <div className="divide-y divide-gray-50">
                      {jobBids.map(bid => (
                        <div key={bid.id} className={`p-4 transition-all ${expandedReceivedBid === bid.id ? 'bg-green-50/50' : 'hover:bg-gray-50'}`}>
                          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setExpandedReceivedBid(expandedReceivedBid === bid.id ? null : bid.id)}>
                            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                              <User className="w-5 h-5 text-green-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium text-gray-900">{bid.bidder_name || 'Anonymous'}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    {bid.bidder_rating ? (
                                      <span className="flex items-center gap-1 text-xs text-amber-600"><Star className="w-3 h-3 fill-amber-400" /> {Number(bid.bidder_rating).toFixed(1)} ({bid.bidder_reviews || 0})</span>
                                    ) : null}
                                    <span className="text-xs text-gray-400">{new Date(bid.created_at).toLocaleDateString()}</span>
                                  </div>
                                </div>
                                <div className="text-right flex items-center gap-3">
                                  <p className="font-bold text-green-700">KES {bid.price.toLocaleString()}</p>
                                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedReceivedBid === bid.id ? 'rotate-180' : ''}`} />
                                </div>
                              </div>
                            </div>
                          </div>

                          {expandedReceivedBid === bid.id && (
                            <div className="mt-3 ml-13 pl-13 border-t border-gray-100 pt-3">
                              <div className="space-y-2 text-sm">
                                {bid.bidder_qualifications && <p className="text-gray-600"><span className="font-medium text-gray-700">Qualifications:</span> {bid.bidder_qualifications}</p>}
                                {bid.bidder_experience && <p className="text-gray-600"><span className="font-medium text-gray-700">Experience:</span> {bid.bidder_experience}</p>}
                                {bid.bidder_location && <p className="text-gray-600"><span className="font-medium text-gray-700">Location:</span> {bid.bidder_location}</p>}
                              </div>
                              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                                <p className="text-xs font-medium text-gray-500 mb-1">Proposal</p>
                                <p className="text-sm text-gray-700">{bid.proposal}</p>
                              </div>
                              <div className="mt-3 flex gap-2">
                                {bid.status === 'accepted' ? (
                                  <span className="px-4 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4" /> Accepted
                                  </span>
                                ) : bid.status === 'rejected' ? (
                                  <span className="px-4 py-2 bg-gray-100 text-gray-500 rounded-lg text-sm font-medium">Rejected</span>
                                ) : !hasAccepted ? (
                                  <button onClick={() => handleAcceptReceivedBid(bid)} disabled={acceptingBidId === bid.id} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
                                    {acceptingBidId === bid.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} Accept Bid
                                  </button>
                                ) : (
                                  <span className="px-4 py-2 bg-gray-100 text-gray-400 rounded-lg text-sm font-medium cursor-not-allowed">Bid Closed</span>
                                )}
                              </div>
                </div>
                )}
              </div>
            ))}
            </div>
          </div>
                );
              });
            })() : <p className="text-gray-500 text-sm py-8 text-center">No bids received yet. Post a job to start receiving bids!</p>}
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="space-y-4">
            {isJobseeker ? (<>
              <div>
                <h3 className="font-semibold text-gray-900">Subscription & Registration</h3>
                <p className="text-sm text-gray-500 mt-1">Your registration fee and subscription payments. A valid subscription lets employers find and contact you.</p>
              </div>
              {payments.filter(p => p.payment_type === 'registration').length > 0 ? (
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Type</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Amount</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Date</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">M-Pesa Ref</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.filter(p => p.payment_type === 'registration').map(p => (
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
              ) : (
                <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
                  <CreditCard className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <h4 className="font-medium text-gray-900 mb-1">No subscription payments yet</h4>
                  <p className="text-sm text-gray-500 mb-4 max-w-md mx-auto">Complete your registration fee to activate your profile and start receiving job offers from employers.</p>
                  <button onClick={() => onOpenMpesa(100, 'Jobseeker registration fee', `REG-${user.id.slice(0, 8).toUpperCase()}`, 'registration')} className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors">
                    Pay Registration Fee
                  </button>
                </div>
              )}
            </>) : isAdvertiser ? (<>
              <div>
                <h3 className="font-semibold text-gray-900">Advert Payments</h3>
                <p className="text-sm text-gray-500 mt-1">Payment history for banner advert subscriptions and homepage boosts.</p>
              </div>
              {payments.filter(p => p.payment_type === 'advert' || p.payment_type === 'featured_boost').length > 0 ? (
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Type</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Description</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Amount</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Date</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">M-Pesa Ref</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.filter(p => p.payment_type === 'advert' || p.payment_type === 'featured_boost').map(p => (
                          <tr key={p.id} className="border-t border-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900 capitalize flex items-center gap-1.5">{p.payment_type === 'featured_boost' && <Zap className="w-3 h-3 text-amber-500" />}{p.payment_type.replace('_', ' ')}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">{p.description || '-'}</td>
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
              ) : (
                <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
                  <CreditCard className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <h4 className="font-medium text-gray-900 mb-1">No advert payments yet</h4>
                  <p className="text-sm text-gray-500 mb-4 max-w-md mx-auto">Your payment history for banner advert subscriptions and homepage boosts will appear here once you make a payment via M-Pesa.</p>
                  <button onClick={() => setActiveTab('adverts')} className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors">
                    Create Your First Advert
                  </button>
                </div>
              )}
            </>) : (<>
              <div>
                <h3 className="font-semibold text-gray-900">Recent M-Pesa Transactions</h3>
                <p className="text-sm text-gray-500 mt-1">{isAdmin ? 'Last 5 platform transactions.' : 'Last 5 payment transactions.'}</p>
              </div>
              {recentPayments.length > 0 ? (
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Type</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Description</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Amount</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Date</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">M-Pesa Ref</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentPayments.map(p => (
                          <tr key={p.id} className="border-t border-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900 capitalize">{p.payment_type.replace('_', ' ')}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">{p.description || '-'}</td>
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
              ) : (
                <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
                  <CreditCard className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <h4 className="font-medium text-gray-900 mb-1">No payments yet</h4>
                  <p className="text-sm text-gray-500 mb-4 max-w-md mx-auto">{isAdmin ? 'Platform payments will appear here.' : 'Payment history for job postings and contact unlocks will appear here once you make a payment via M-Pesa.'}</p>
                  {!isAdmin && <button onClick={() => onNavigate('jobs')} className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors">Browse Jobs</button>}
                </div>
              )}
            </>)}
          </div>
        )}

        {activeTab === 'adverts' && isAdvertiser && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">My Adverts</h3>
              <button onClick={() => { setAdvError(''); setAdForm({ title: '', image_url: '', images: [], destination_url: '', description: '', cta_text: 'Learn More', whatsapp_number: '', is_affiliate: false, slot: 'homepage_banner' }); setAdvImageFiles([]); setAdvUrlInput(''); setShowAdForm(!showAdForm); }} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
                <Plus className="w-4 h-4" /> {showAdForm ? 'Close Form' : 'New Advert'}
              </button>
            </div>

            {showAdForm && (
              <div className="bg-white rounded-xl p-6 border border-gray-100 space-y-4">
                <h4 className="font-semibold text-gray-900">{adForm.id ? 'Edit Advert' : 'Create Banner Advert'}</h4>
                <p className="text-xs text-gray-500">Your advert appears in the banner carousel on the homepage. New adverts start unpublished — click "Publish" when ready.</p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ad Placement *</label>
                  <select value={adForm.slot} onChange={e => setAdForm({ ...adForm, slot: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 outline-none text-sm">
                    <option value="homepage_banner">Homepage Carousel Banner — KES 500/week</option>
                    <option value="job_listings_top">Job Listings Top Banner — KES 500/week</option>
                  </select>
                  <p className="text-xs text-gray-400 mt-1">{adForm.slot === 'job_listings_top' ? 'Full-width banner above all job listings — premium slot, exclusive to one advertiser per week.' : 'Rotating carousel banner at the top of the homepage.'}</p>
                </div>
                {advError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{advError}</div>}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <input type="text" value={adForm.title} onChange={e => setAdForm({ ...adForm, title: e.target.value })} placeholder="e.g. Kamau Hardware Mega Sale" className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 outline-none" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Target Audience</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {['national', 'county', 'subcounty'].map(s => (
                      <button key={s} type="button" onClick={() => setAdForm({ ...adForm, target_scope: s, target_county: s === 'national' ? '' : adForm.target_county, target_subcounty: '' })}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${adForm.target_scope === s ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
                        {s === 'national' ? 'All of Kenya' : s === 'county' ? 'This County' : 'This Sub-County'}
                      </button>
                    ))}
                  </div>
                  {adForm.target_scope !== 'national' && (
                    <select value={adForm.target_county} onChange={e => setAdForm({ ...adForm, target_county: e.target.value, target_subcounty: '' })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-2">
                      <option value="">Select county</option>
                      {KENYA_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  )}
                  {adForm.target_scope === 'subcounty' && adForm.target_county && (
                    <select value={adForm.target_subcounty} onChange={e => setAdForm({ ...adForm, target_subcounty: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-2">
                      <option value="">Select sub-county</option>
                      {getSubcounties(adForm.target_county).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  )}
                  <p className="text-xs text-gray-400">
                    {adForm.target_scope === 'national' ? `Your ad reaches users across all 47 counties — KES 500/week.` :
                     adForm.target_scope === 'county' ? `Targeting ${adForm.target_county || 'your county'} — reaches users in this county for KES 300/week.` :
                     `Hyperlocal targeting: ${adForm.target_subcounty || 'your sub-county'} only — KES 150/week.`}
                  </p>
                  <label className="block text-sm font-medium text-gray-700 mb-1 mt-3">Banner Images * <span className="text-gray-400 font-normal">(up to 8)</span></label>
                  <p className="text-xs text-gray-500 mb-2">The first image is the main banner. All images appear in the popup. 10-day plan: 3 images, 20-day: 5, 30-day: 8. Each is compressed automatically on save.</p>
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
                    <label className={`px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${adForm.images.length >= (adForm.plan === '10-day' ? 3 : adForm.plan === '20-day' ? 5 : 8) ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}>
                      <Upload className="w-4 h-4 inline mr-1" /> Upload
                      <input type="file" accept="image/*" multiple className="hidden" disabled={adForm.images.length >= (adForm.plan === '10-day' ? 3 : adForm.plan === '20-day' ? 5 : 8)} onChange={e => { addAdvFiles(e.target.files); e.target.value = ''; }} />
                    </label>
                    <input type="url" value={advUrlInput} onChange={e => setAdvUrlInput(e.target.value)} placeholder="...or paste image URL" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                    <button onClick={addAdvUrl} disabled={adForm.images.length >= (adForm.plan === '10-day' ? 3 : adForm.plan === '20-day' ? 5 : 8) || !advUrlInput.trim()} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50">Add</button>
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
                <p className="text-sm text-gray-600">Your advert has been saved but is not yet published. To go live, complete the M-Pesa payment of <strong>KES {adForm.target_scope === 'subcounty' ? 150 : adForm.target_scope === 'county' ? 300 : 500}</strong> ({adForm.slot === 'job_listings_top' ? 'Job Listings Top Banner' : 'Homepage Banner'} — {adForm.target_scope === 'national' ? 'All of Kenya' : adForm.target_scope === 'county' ? adForm.target_county : adForm.target_subcounty}). Exclusive of ad design — user to provide.</p>
                <div className="flex gap-3">
                  <button onClick={() => { setShowPaymentPrompt(false); onOpenMpesa(adForm.target_scope === 'subcounty' ? 150 : adForm.target_scope === 'county' ? 300 : 500, `${adForm.slot === 'job_listings_top' ? 'Job Listings' : 'Homepage'} advert — ${adForm.plan.replace('-', ' ')}`, `ADV-${lastCreatedAdId.slice(0, 8).toUpperCase()}`, 'advert', lastCreatedAdId); }} className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors">
                    Pay Now — KES {adForm.target_scope === 'subcounty' ? 150 : adForm.target_scope === 'county' ? 300 : 500}
                  </button>
                  <button onClick={() => setShowPaymentPrompt(false)} className="px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
                    Pay Later
                  </button>
                </div>
              </div>
            )}

            {myAds.length > 0 ? myAds.map(ad => {
              const isBoosted = ad.featured && ad.boost_until && new Date(ad.boost_until) > new Date();
              const boostDaysLeft = isBoosted ? Math.ceil((new Date(ad.boost_until!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
              return (
              <div key={ad.id} className={`bg-white rounded-xl p-4 border flex items-center gap-4 transition-all ${isBoosted ? 'border-amber-300 shadow-md shadow-amber-100' : 'border-gray-100'}`}>
                <div className="w-20 h-14 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 relative">
                  <img src={proxyImageUrl(ad.image_url)} alt={ad.title} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  {isBoosted && <span className="absolute top-0 left-0 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[7px] font-bold px-1 py-0.5 rounded-br-md flex items-center gap-0.5"><Zap className="w-2 h-2" /> HOT</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-gray-900 truncate">{ad.title}</h4>
                    {isBoosted && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full whitespace-nowrap">⚡ {boostDaysLeft}d left</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {ad.displays || 0}</span>
                    <span className="flex items-center gap-1"><MousePointerClick className="w-3 h-3" /> {ad.clicks || 0}</span>
                    <span className="text-gray-400">{new Date(ad.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${ad.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{ad.active ? 'Published' : 'Unpublished'}</span>
                  <div className="flex gap-2 items-center">
                    {!ad.active && <button onClick={() => onOpenMpesa(ad.target_subcounty ? 150 : ad.target_county ? 300 : 500, 'Banner advert — 7 days', `ADV-${ad.id.slice(0, 8).toUpperCase()}`, 'advert', ad.id)} className="text-xs text-green-600 hover:text-green-700 font-semibold">Pay</button>}
                    {ad.active && !isBoosted && (
                      <button onClick={() => onOpenMpesa(500, 'Boost — 7 days homepage carousel', `BOOST-${ad.id.slice(0, 8).toUpperCase()}`, 'featured_boost', ad.id)} className="relative group text-xs font-bold text-white px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 bg-[length:200%_100%] hover:bg-right transition-all duration-300 shadow-md shadow-amber-200 hover:shadow-lg hover:shadow-amber-300 flex items-center gap-1">
                        <Zap className="w-3 h-3" /> Boost
                        <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">KES 500 — Homepage carousel for 7 days</span>
                      </button>
                    )}
                    {isBoosted && (
                      <div className="flex items-center gap-1">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                        </span>
                        <span className="text-[10px] text-amber-600 font-semibold">Live</span>
                      </div>
                    )}
                    <button onClick={() => { setAdvError(''); setAdForm({ id: ad.id, title: ad.title, image_url: ad.image_url, images: ad.images?.length ? ad.images : [ad.image_url], destination_url: ad.destination_url || '', description: ad.description || '', cta_text: ad.cta_text || 'Learn More', whatsapp_number: ad.whatsapp_number || '', is_affiliate: ad.is_affiliate, slot: ad.slot || 'homepage_banner' }); setAdvImageFiles((ad.images?.length ? ad.images : [ad.image_url]).map(() => null)); setAdvUrlInput(''); setShowAdForm(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="text-xs text-green-600 hover:text-green-700">Edit</button>
                    <button onClick={() => handleToggleAdActive(ad)} className="text-xs text-blue-600 hover:text-blue-700">{ad.active ? 'Unpublish' : 'Publish'}</button>
                    <button onClick={() => handleDeleteAd(ad)} className="text-xs text-red-600 hover:text-red-700">Delete</button>
                  </div>
                </div>
              </div>
              );
            }) : <p className="text-gray-500 text-sm py-8 text-center">No adverts yet. Create your first banner advert!</p>}
          </div>
        )}

        {activeTab === 'adverts' && !isAdvertiser && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">{isAdmin ? 'All Adverts' : 'My Adverts'}</h3>
              <button onClick={() => onNavigate('post-advert')} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors">Post New Advert</button>
            </div>
            {ads.length > 0 ? ads.map(ad => {
              const isBoosted = ad.featured && ad.boost_until && new Date(ad.boost_until) > new Date();
              const boostDaysLeft = isBoosted ? Math.ceil((new Date(ad.boost_until!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
              return (
              <div key={ad.id} className={`bg-white rounded-xl p-4 border flex items-center gap-4 transition-all ${isBoosted ? 'border-amber-300 shadow-md shadow-amber-100' : 'border-gray-100'}`}>
                <div className="relative">
                  <img src={optimizeImageUrl(ad.image || IMAGES.services[0], 100, 100)} alt={ad.business_name} className="w-16 h-16 rounded-lg object-cover" />
                  {isBoosted && <span className="absolute -top-1 -left-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[7px] font-bold px-1 py-0.5 rounded-md flex items-center gap-0.5"><Zap className="w-2 h-2" /> HOT</span>}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-gray-900">{ad.business_name}</h4>
                    {isBoosted && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">⚡ {boostDaysLeft}d left</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span>{ad.category}</span><span>{ad.location}</span><span>{ad.plan}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {isBoosted && (
                    <div className="flex items-center gap-1">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                      </span>
                      <span className="text-[10px] text-amber-600 font-semibold">Live</span>
                    </div>
                  )}
                  {!isBoosted && (
                    <button onClick={() => onOpenMpesa(500, `Boost — ${ad.business_name} — 7 days`, `BOOST-${ad.id.slice(0, 8).toUpperCase()}`, 'featured_boost', ad.id)} className="relative group text-xs font-bold text-white px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 bg-[length:200%_100%] hover:bg-right transition-all duration-300 shadow-md shadow-amber-200 hover:shadow-lg hover:shadow-amber-300 flex items-center gap-1">
                      <Zap className="w-3 h-3" /> Boost
                      <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">KES 500 — Homepage + search top</span>
                    </button>
                  )}
                  <p className="text-xs text-gray-400">Expires: {ad.expiry_date}</p>
                </div>
              </div>
              );
            }) : <p className="text-gray-500 text-sm py-8 text-center">No adverts yet.</p>}
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
            {isJobseeker && (
              <div className="mb-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className={`rounded-2xl border-2 flex flex-col overflow-hidden ${!subscriptionActive ? 'border-green-300 shadow-md' : 'border-gray-200 bg-white'}`}>
                    <div className="p-5 flex-1 flex flex-col">
                      <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center mb-3">
                        <Check className="w-5 h-5 text-green-600" />
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 mb-1">Free</h3>
                      <p className="text-xs text-gray-500 mb-4">Your current plan</p>
                      <ul className="space-y-2 mb-5 flex-1">
                        {PRICING_PLANS.jobseekerFree.features.map((f, j) => (
                          <li key={j} className="flex items-start gap-2 text-sm text-gray-700">
                            <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                            {f}
                          </li>
                        ))}
                      </ul>
                      {!subscriptionActive && <div className="py-2 text-center text-xs font-semibold text-green-700 bg-green-50 rounded-lg">Current Plan</div>}
                    </div>
                  </div>

                  <div className="relative bg-gradient-to-br from-green-600 via-emerald-600 to-teal-700 rounded-2xl shadow-lg flex flex-col overflow-hidden">
                    {subscriptionActive && (
                      <div className="absolute top-0 right-0 bg-white/20 backdrop-blur text-white text-[10px] font-bold px-3 py-1.5 rounded-bl-xl tracking-wide">
                        ACTIVE
                      </div>
                    )}
                    <div className="p-5 flex-1 flex flex-col">
                      <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-3">
                        <Zap className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="text-lg font-bold text-white mb-1">Premium</h3>
                      <p className="text-xs text-green-100 mb-4">KES 100/month — Unlimited bids, messaging, analytics & more</p>
                      <ul className="space-y-2 mb-5 flex-1">
                        {PRICING_PLANS.jobseekerPremium.features.map((f, j) => (
                          <li key={j} className="flex items-start gap-2 text-sm text-white/95">
                            <Check className="w-3.5 h-3.5 text-green-300 flex-shrink-0 mt-0.5" />
                            {f}
                          </li>
                        ))}
                      </ul>
                      {!subscriptionActive ? (
                        <button onClick={() => onOpenMpesa(100, 'Jobseeker Premium Subscription', 'PREM-NEW', 'registration', undefined, undefined, undefined, () => extendSubscription(user.id, 30))} className="w-full py-2.5 bg-white hover:bg-green-50 text-green-700 font-bold rounded-lg text-sm transition-colors">
                          Upgrade Now
                        </button>
                      ) : (
                        <div className="py-2 text-center text-xs font-semibold text-white bg-white/20 rounded-lg">Active — {subscriptionDays}d left</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
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
                    {profileSaveError && <p className="text-xs text-red-600 mt-2">{profileSaveError}</p>}
                    {profileSaveNotice && <p className="text-xs text-amber-600 mt-2">{profileSaveNotice}</p>}
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
                        <input type="file" accept="image/png, image/jpeg" onChange={async (e) => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            const err = await validateAdImage(f, 'profile');
                            if (err) { setAdvError(err); return; }
                            setProfilePhotoFile(f);
                          }} className="flex-1 text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100" />
                          <button type="button" onClick={() => setShowAdSpecs(true)} className="text-xs text-blue-500 hover:underline whitespace-nowrap">Photo specs</button>
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        WhatsApp Number <span className="text-gray-400 text-xs">(optional)</span>
                        {!subscriptionActive && <span className="ml-1 text-xs text-amber-600 font-normal">— Premium only</span>}
                      </label>
                      <input type="tel" value={subscriptionActive ? profileForm.whatsapp_number : ''} onChange={e => setProfileForm({ ...profileForm, whatsapp_number: e.target.value })} disabled={!subscriptionActive} className={`w-full px-4 py-2.5 rounded-lg border outline-none ${subscriptionActive ? 'border-gray-300 focus:ring-2 focus:ring-green-500' : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'}`} placeholder="e.g. 0712345678" />
                      <p className="text-xs text-gray-400 mt-1">{subscriptionActive ? 'Employers will see a "Chat on WhatsApp" button' : 'Upgrade to Premium to let employers contact you via WhatsApp'}</p>
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">Categories of Interest</label>
                      <p className="text-xs text-gray-500 mb-2">Select the job categories you're interested in. Jobs in these categories will appear on your dashboard.</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {dbJobCategories.map(cat => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setSelectedCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])}
                            className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all ${selectedCategories.includes(cat) ? 'border-green-500 bg-green-50 text-green-700 ring-1 ring-green-200' : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'}`}
                          >
                            {selectedCategories.includes(cat) && <span className="mr-1">&#10003;</span>}
                            {cat}
                          </button>
                        ))}
                      </div>
                      {selectedCategories.length > 0 && (
                        <p className="text-[10px] text-green-600 mt-1.5">{selectedCategories.length} {selectedCategories.length === 1 ? 'category' : 'categories'} selected</p>
                      )}
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
                    <div className={`flex items-center gap-3 ${!subscriptionActive ? 'opacity-50' : ''}`}>
                      <input type="checkbox" id="ratings_enabled" checked={ratingsEnabled} onChange={e => setRatingsEnabled(e.target.checked)} disabled={!subscriptionActive} className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500" />
                      <label htmlFor="ratings_enabled" className="text-sm text-gray-700">
                        Enable ratings & reviews on my profile
                        {!subscriptionActive && <span className="ml-1 text-xs text-amber-600 font-normal">— Premium only</span>}
                      </label>
                    </div>
                    <button onClick={handleSaveProfile} disabled={saving} className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
                    </button>
                    {profileSaveError && <p className="text-xs text-red-600 mt-2">{profileSaveError}</p>}
                    {profileSaveNotice && <p className="text-xs text-amber-600 mt-2">{profileSaveNotice}</p>}
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

