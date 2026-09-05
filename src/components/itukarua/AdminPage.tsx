import React, { useState, useEffect } from 'react';
import { Loader2, LayoutDashboard, Users, Briefcase, Newspaper, CreditCard, MessageSquare, Tags, Mail, MonitorPlay, Search, Upload, X, Plus, Send, Eye, EyeOff, Receipt, Key } from 'lucide-react';
import AdminDashboard from './admin/AdminDashboard';
import { supabase, supabaseUrl, supabaseKey, optimizeImageUrl, proxyImageUrl, proxyRequest, proxyTable, proxyRpc } from '@/lib/supabase';
import { getProfile, subscribeNewsletter, getNewsletterSubscribers, deleteNewsletterSubscriber, getCustomCategories, addCustomCategory, deleteCustomCategory, createChatMessage, getChatConversation, adminResetPassword, getAdCarouselSettings, updateAdCarouselSetting, type AdCarouselSettings, getActiveAds, getJobs, getServiceAds, getEmailProviders, saveEmailProvider, deleteEmailProvider, type DbEmailProvider, getTestimonials, addTestimonial, deleteTestimonial, type DbTestimonial, getWebsitesCarouselSettings, updateWebsitesCarouselSetting, type WebsitesCarouselSettings, getBillingItems, getBillingNotifications, type BillingItem, type BillingNotification, extendSubscription } from '@/lib/database';

import { KENYA_COUNTIES } from '@/data/siteData';
import { compressImage } from '@/lib/imageUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { TERMS_AND_CONDITIONS } from '@/data/termsContent';
import { buildNewsletterHtml, buildNewsletterText } from '@/lib/newsletter';
import { buildBillingInvoiceHtml, buildBillingInvoiceText, billingAccountRef, billingNote } from '@/lib/billing';

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out — check your connection and retry`)), ms);
    p.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

async function probeDb(): Promise<{ ok: boolean; blocked: boolean }> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${supabaseUrl}/rest/v1/advertisements?select=id&limit=1`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(t);
    return { ok: res.ok, blocked: false };
  } catch (err: any) {
    if (err?.name === 'AbortError') return { ok: false, blocked: false };
    return { ok: false, blocked: err?.name === 'TypeError' };
  }
}

function timeoutHint(blocked: boolean, probeOk: boolean): string {
  if (!probeOk) {
    return blocked
      ? ' Your ad blocker or a browser extension is blocking requests to the database. Whitelist this site (or disable the blocker) and retry.'
      : ' The database did not answer a test request either — check your internet connection, then retry.';
  }
  return ' The database answered a test request, but this write got stuck — usually caused by an extension/ad blocker or a stale network connection. Retry once, or test in an incognito window (extensions off) to confirm.';
}

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
  is_featured?: boolean;
  whatsapp_number?: string;
  subscription_expires_at?: string;
  created_at: string;
  deleted_at?: string;
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
  mpesa_phone?: string;
  description?: string;
  user_id?: string;
  token?: string;
  related_profile_id?: string;
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
  conversation_id?: string;
  role?: string;
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
  const [certPickError, setCertPickError] = useState<string | null>(null);
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
  const [resetPwUser, setResetPwUser] = useState<Profile | null>(null);
  const [resetPwPassword, setResetPwPassword] = useState('');
  const [isResetPwDialogOpen, setIsResetPwDialogOpen] = useState(false);
  const [resettingPw, setResettingPw] = useState(false);
  const [subscribers, setSubscribers] = useState<{ email: string; name: string; created_at: string }[]>([]);
  const [newSubscriberName, setNewSubscriberName] = useState('');
  const [newSubscriberEmail, setNewSubscriberEmail] = useState('');
  const [subscriberMsg, setSubscriberMsg] = useState('');
  const [sendingNewsletter, setSendingNewsletter] = useState(false);
  const [newsletterOpen, setNewsletterOpen] = useState(false);
  const [newsletterLoading, setNewsletterLoading] = useState(false);
  const [newsletterSubject, setNewsletterSubject] = useState('');
  const [newsletterIntro, setNewsletterIntro] = useState('');
  const [newsletterBanners, setNewsletterBanners] = useState<any[]>([]);
  const [newsletterJobs, setNewsletterJobs] = useState<any[]>([]);
  const [newsletterServices, setNewsletterServices] = useState<any[]>([]);
  const [selBanners, setSelBanners] = useState<Set<string>>(new Set());
  const [selJobs, setSelJobs] = useState<Set<string>>(new Set());
  const [selServices, setSelServices] = useState<Set<string>>(new Set());
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [selectedSubs, setSelectedSubs] = useState<Set<string>>(new Set());
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [trashedUsers, setTrashedUsers] = useState<Profile[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [conversationThread, setConversationThread] = useState<Message[]>([]);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [adverts, setAdverts] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchUsers, setSearchUsers] = useState('');
  const [searchJobs, setSearchJobs] = useState('');
  const [searchAds, setSearchAds] = useState('');
  const [searchPayments, setSearchPayments] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | 'pending' | 'completed' | 'failed' | 'refunded'>('all');
  const [searchMessages, setSearchMessages] = useState('');
  const [searchCategories, setSearchCategories] = useState('');
  const [searchSubscribers, setSearchSubscribers] = useState('');
  const [searchAdverts, setSearchAdverts] = useState('');
  const [showAdForm, setShowAdForm] = useState(false);
  const [adForm, setAdForm] = useState<{ id?: string; title: string; image_url: string; images: string[]; destination_url: string; description: string; cta_text: string; whatsapp_number: string; is_affiliate: boolean; featured: boolean; owner_email?: string; slot?: string; billing_cycle?: string }>({ title: '', image_url: '', images: [], destination_url: '', description: '', cta_text: 'Learn More', whatsapp_number: '', is_affiliate: false, featured: true, slot: 'homepage_banner', billing_cycle: '7 days' });
  const [advUploading, setAdvUploading] = useState(false);
  const [advUploadKey, setAdvUploadKey] = useState(0);
  const [advUrlInput, setAdvUrlInput] = useState('');
  const [billingItems, setBillingItems] = useState<BillingItem[]>([]);
  const [billingLogs, setBillingLogs] = useState<BillingNotification[]>([]);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingFilter, setBillingFilter] = useState<'due' | 'expired' | 'all'>('due');
  const [billingSendingId, setBillingSendingId] = useState<string | null>(null);
  const [billingMsg, setBillingMsg] = useState('');
  const [billingPreviewItem, setBillingPreviewItem] = useState<BillingItem | null>(null);
  const [billingPreviewHtml, setBillingPreviewHtml] = useState('');
  const [billingPreviewText, setBillingPreviewText] = useState('');
  const [carouselSettings, setCarouselSettings] = useState<AdCarouselSettings>({ scrollIntervalSeconds: 5, transitionDurationSeconds: 0.8, effect: 'slide' });
  const [carouselSaving, setCarouselSaving] = useState(false);
  const [emailProviders, setEmailProviders] = useState<DbEmailProvider[]>([]);
  const [emailForm, setEmailForm] = useState<Partial<DbEmailProvider>>({ name: '', username: '', password: '', imap_host: '', imap_port: 993, smtp_host: '', smtp_port: 465, from_name: 'Itukarua', from_email: '', is_active: false });
  const [showEmailPw, setShowEmailPw] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMsg, setEmailMsg] = useState('');
  const [emailMsgType, setEmailMsgType] = useState<'ok' | 'err'>('ok');
  const [testimonials, setTestimonials] = useState<DbTestimonial[]>([]);
  const [testimonialForm, setTestimonialForm] = useState<{ client_name: string; company: string; comment: string; rating: number }>({ client_name: '', company: '', comment: '', rating: 5 });
  const [testimonialMsg, setTestimonialMsg] = useState('');
  const [testimonialMsgType, setTestimonialMsgType] = useState<'ok' | 'err'>('ok');
  const [testimonialSaving, setTestimonialSaving] = useState(false);
  const [webCarouselSettings, setWebCarouselSettings] = useState<WebsitesCarouselSettings>({ scrollIntervalSeconds: 5, transitionDurationSeconds: 0.8, effect: 'slide' });
  const [webCarouselSaving, setWebCarouselSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadAds = async () => {
    const { data } = await supabase.from('service_ads').select('*').order('created_at', { ascending: false });
    setAds(data || []);
  };

  const loadAdverts = async () => {
    const { data } = await supabase.from('advertisements').select('*').order('sort_order');
    setAdverts(data || []);
  };

  const loadBilling = async () => {
    setBillingLoading(true);
    try {
      const [items, logs] = await Promise.all([getBillingItems(), getBillingNotifications()]);
      setBillingItems(items);
      setBillingLogs(logs);
    } catch (err: any) {
      setBillingMsg(`Failed to load billing: ${err.message}`);
    } finally {
      setBillingLoading(false);
    }
  };

  const openBillingPreview = (item: BillingItem) => {
    if (!item.owner_email) {
      toast({ title: 'No email', description: `${item.business_name} has no advertiser email on record. Add one to the ${item.item_type === 'advert' ? 'Adverts' : 'Ads'} tab first.`, variant: 'destructive' });
      return;
    }
    const opts = {
      business_name: item.business_name,
      item_type: item.item_type,
      billing_cycle: item.billing_cycle,
      billing_end: item.billing_end,
      amount: item.amount,
      accountRef: billingAccountRef(item.id),
      note: billingNote(item.billing_end),
    };
    setBillingPreviewItem(item);
    setBillingPreviewHtml(buildBillingInvoiceHtml(opts));
    setBillingPreviewText(buildBillingInvoiceText(opts));
  };

  const sendBillingInvoice = async (item: BillingItem) => {
    if (!item.owner_email) {
      toast({ title: 'No email', description: `${item.business_name} has no advertiser email on record. Add one to the ${item.item_type === 'advert' ? 'Adverts' : 'Ads'} tab first.`, variant: 'destructive' });
      return;
    }
    setBillingSendingId(`${item.item_type}:${item.id}`);
    setBillingMsg('');
    try {
      const html = billingPreviewItem?.id === item.id && billingPreviewItem?.item_type === item.item_type
        ? billingPreviewHtml
        : buildBillingInvoiceHtml({
            business_name: item.business_name,
            item_type: item.item_type,
            billing_cycle: item.billing_cycle,
            billing_end: item.billing_end,
            amount: item.amount,
            accountRef: billingAccountRef(item.id),
            note: billingNote(item.billing_end),
          });
      const text = billingPreviewItem?.id === item.id && billingPreviewItem?.item_type === item.item_type
        ? billingPreviewText
        : buildBillingInvoiceText({
            business_name: item.business_name,
            item_type: item.item_type,
            billing_cycle: item.billing_cycle,
            billing_end: item.billing_end,
            amount: item.amount,
            accountRef: billingAccountRef(item.id),
            note: billingNote(item.billing_end),
          });
      const res = await fetch(`${supabaseUrl}/functions/v1/send-billing-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
        body: JSON.stringify({
          item_type: item.item_type,
          item_id: item.id,
          recipient_email: item.owner_email,
          business_name: item.business_name,
          amount: item.amount,
          billing_cycle: item.billing_cycle,
          billing_end: item.billing_end,
          html,
          text,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast({ title: 'Invoice sent', description: `Billing alert & invoice emailed to ${item.owner_email}` });
      setBillingPreviewItem(null);
      loadBilling();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to send invoice', variant: 'destructive' });
    } finally {
      setBillingSendingId(null);
    }
  };

  const loadEmailProviders = async () => {
    const providers = await getEmailProviders();
    setEmailProviders(providers);
  };

  const loadTestimonials = async () => {
    const list = await getTestimonials();
    setTestimonials(list);
  };

  const saveWebCarouselSettings = async () => {
    setWebCarouselSaving(true);
    try {
      await updateWebsitesCarouselSetting('web_scroll_interval_seconds', String(webCarouselSettings.scrollIntervalSeconds));
      await updateWebsitesCarouselSetting('web_transition_duration_seconds', String(webCarouselSettings.transitionDurationSeconds));
      await updateWebsitesCarouselSetting('web_effect', webCarouselSettings.effect);
      setTestimonialMsg('Websites carousel settings updated.');
      setTestimonialMsgType('ok');
    } catch {
      setTestimonialMsg('Failed to save websites carousel settings.');
      setTestimonialMsgType('err');
    } finally { setWebCarouselSaving(false); }
  };

  const uploadAdImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileArr = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (adForm.images.length + fileArr.length > 3) {
      toast({ title: 'Too many images', description: 'A maximum of 3 images per advert', variant: 'destructive' });
      return;
    }
    setAdvUploading(true);
    try {
      const newUrls: string[] = [];
      for (const file of fileArr) {
        if (file.size > 20 * 1024 * 1024) {
          toast({ title: 'File too large', description: 'Image must be 20MB or less', variant: 'destructive' });
          continue;
        }
        const compressed = await compressImage(file, 1600, 400);
        const safeName = compressed.name.replace(/[^a-zA-Z0-9._-]/g, '').replace(/\.[^.]+$/, '') || 'image';
        const fileName = `${Date.now()}_${safeName}.jpg`;
        const { error: uploadError } = await withTimeout(supabase.storage.from('adverts').upload(fileName, compressed), 30000, 'Upload');
        if (uploadError) throw uploadError;
        newUrls.push(supabase.storage.from('adverts').getPublicUrl(fileName).data.publicUrl);
      }
      if (newUrls.length > 0) {
        setAdForm(f => {
          const images = [...f.images, ...newUrls];
          return { ...f, images, image_url: images[0] || f.image_url };
        });
        setAdvUploadKey(k => k + 1);
        toast({ title: 'Uploaded', description: `${newUrls.length} image(s) uploaded successfully` });
      }
    } catch (err: any) {
      toast({ title: 'Upload Error', description: (err instanceof Error ? err.message : 'Upload failed — please retry'), variant: 'destructive' });
    } finally { setAdvUploading(false); }
  };

  const addAdminAdUrl = () => {
    const url = advUrlInput.trim();
    if (!url) return;
    setAdvUrlInput('');
    setAdForm(f => {
      const images = f.images.length >= 8 ? f.images : [...f.images, url];
      return { ...f, images, image_url: images[0] || f.image_url };
    });
  };

  const removeAdminAdImage = (idx: number) => {
    setAdForm(f => {
      const images = f.images.filter((_, i) => i !== idx);
      return { ...f, images, image_url: images[0] || f.image_url };
    });
  };

  const saveCarouselSettings = async () => {
    setCarouselSaving(true);
    try {
      await Promise.all([
        updateAdCarouselSetting('scroll_interval_seconds', String(carouselSettings.scrollIntervalSeconds)),
        updateAdCarouselSetting('transition_duration_seconds', String(carouselSettings.transitionDurationSeconds)),
        updateAdCarouselSetting('effect', carouselSettings.effect),
      ]);
      toast({ title: 'Saved', description: 'Carousel settings updated' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setCarouselSaving(false); }
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
        supabase.from('profiles').select('*').order('created_at', { ascending: false }).then(({data}) => {
          const all = data || [];
          setUsers(all.filter(u => !u.deleted_at));
          setTrashedUsers(all.filter(u => u.deleted_at).sort((a, b) => (b.deleted_at || '').localeCompare(a.deleted_at || '')));
        }),
        loadJobs(),
        loadAds(),
        proxyRequest('/payments?select=*&order=created_at.desc', 'GET', undefined, { Prefer: 'return=representation' }).then(data => setPayments(Array.isArray(data) ? data : [])),
        proxyRequest('/messages?select=*&order=created_at.desc', 'GET', undefined, { Prefer: 'return=representation' }).then(data => setMessages(Array.isArray(data) ? data : [])),
        getNewsletterSubscribers().then(setSubscribers),
        loadAdverts(),
        getAdCarouselSettings().then(setCarouselSettings),
        getCustomCategories('job').then(setCustomJobCats),
        getCustomCategories('service').then(setCustomServiceCats),
        loadEmailProviders(),
        loadTestimonials(),
        getWebsitesCarouselSettings().then(setWebCarouselSettings),
        loadBilling(),
      ]);

      // Use individual category lists for modals
      const allJobCats = await getCustomCategories('job');
      const allServiceCats = await getCustomCategories('service');
      setCustomJobCats(allJobCats);
      setCustomServiceCats(allServiceCats);
      setCategories([...new Set([...allJobCats, ...allServiceCats])]);

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

  const monthLabel = () => new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const openNewsletterBuilder = async () => {
    setNewsletterOpen(true);
    setNewsletterLoading(true);
    setNewsletterSubject(`Itukarua Monthly Digest — ${monthLabel()}`);
    setNewsletterIntro(`Here are this month's updated Banners, Jobs and Businesses around you. Explore new opportunities and connect with local businesses.`);
    setSubscriberMsg('');
    try {
      const [banners, jobs, services] = await Promise.all([
        getActiveAds(),
        getJobs({ activeOnly: true, limit: 12 }),
        getServiceAds({ activeOnly: true, limit: 12 }),
      ]);
      setNewsletterBanners(banners || []);
      setNewsletterJobs(jobs || []);
      setNewsletterServices(services || []);
      setSelBanners(new Set((banners || []).map(b => b.id)));
      setSelJobs(new Set((jobs || []).map(j => j.id)));
      setSelServices(new Set((services || []).map(s => s.id)));
    } catch (err: any) {
      setSubscriberMsg(`Error loading content: ${err.message}`);
    } finally {
      setNewsletterLoading(false);
    }
  };

  const buildNewsletter = () => {
    const banners = newsletterBanners.filter(b => selBanners.has(b.id));
    const jobs = newsletterJobs.filter(j => selJobs.has(j.id));
    const services = newsletterServices.filter(s => selServices.has(s.id));
    const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const subject = newsletterSubject.trim() || `Itukarua Monthly Digest — ${monthLabel()}`;
    return {
      subject,
      html: buildNewsletterHtml({ banners, jobs, ads: services, dateStr, subject, intro: newsletterIntro }),
      text: buildNewsletterText({ subject, banners, jobs, ads: services }),
      counts: { banners: banners.length, jobs: jobs.length, services: services.length },
    };
  };

  const toggleSel = (set: Set<string>, id: string): Set<string> => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  };

  const sendComposedNewsletter = async () => {
    if (subscribers.length === 0) { setSubscriberMsg('No subscribers to send to.'); return; }
    const { subject, html, text, counts } = buildNewsletter();
    if (counts.banners + counts.jobs + counts.services === 0) {
      setSubscriberMsg('Select at least one banner, job, or service to include.');
      return;
    }
    setSendingNewsletter(true);
    setSubscriberMsg('');
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/send-weekly-newsletter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
        body: JSON.stringify({ subject, html, text }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSubscriberMsg(data.message || `Newsletter sent to ${data.sent} subscriber(s)${data.failed > 0 ? ` (${data.failed} failed)` : ''}! Check Ethereal inbox.`);
      setNewsletterOpen(false);
      setPreviewOpen(false);
    } catch (err: any) {
      setSubscriberMsg(`Error: ${err.message}`);
    } finally {
      setSendingNewsletter(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      const { error } = await proxyTable('profiles').update({ role: newRole }, 'id', userId);
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
      const { error } = await proxyTable('profiles').update({ verified: newVerified, suspended: !newVerified }, 'id', userId);

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

  const toggleUserFeatured = async (userId: string, currentFeatured: boolean) => {
    const newFeatured = !currentFeatured;
    try {
      const { error } = await proxyTable('profiles').update({ is_featured: newFeatured }, 'id', userId);
      if (error) throw error;
      setUsers(users.map(user =>
        user.id === userId ? { ...user, is_featured: newFeatured } : user
      ));
      toast({
        title: 'Success',
        description: `User ${newFeatured ? 'featured' : 'unfeatured'}.`,
      });
    } catch (error) {
      console.error('Error updating featured status:', error);
      toast({ title: 'Error', description: 'Failed to update featured status', variant: 'destructive' });
    }
  };

  const toggleUserSuspension = async (userId: string, currentSuspended: boolean) => {
    try {
      const { error } = await proxyTable('profiles').update({ suspended: !currentSuspended }, 'id', userId);

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

  const extendUserSubscription = async (userId: string, days: number, userName: string) => {
    try {
      await extendSubscription(userId, days);
      toast({ title: 'Success', description: `Extended ${userName}'s subscription by ${days} day${days !== 1 ? 's' : ''}.` });
    } catch (error) {
      console.error('Error extending subscription:', error);
      toast({ title: 'Error', description: 'Failed to extend subscription', variant: 'destructive' });
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

  const handleDirectPasswordReset = async () => {
    if (!resetPwUser || resetPwPassword.length < 6) {
      toast({ title: 'Error', description: 'Password must be at least 6 characters', variant: 'destructive' });
      return;
    }
    setResettingPw(true);
    try {
      const { error } = await adminResetPassword(resetPwUser.id, resetPwPassword);
      if (error) throw new Error(error);
      toast({ title: 'Success', description: `Password updated for ${resetPwUser.email}` });
      setIsResetPwDialogOpen(false);
      setResetPwPassword('');
      setResetPwUser(null);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to reset password', variant: 'destructive' });
    } finally {
      setResettingPw(false);
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
        await proxyTable('profiles').update({ profile_image: profileImageUrl }, 'id', result.user_id);
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
        await proxyTable('profiles').update({ certificates: certUrls }, 'id', result.user_id);
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

  const reloadUsers = async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    const all = data || [];
    setUsers(all.filter(u => !u.deleted_at));
    setTrashedUsers(all.filter(u => u.deleted_at).sort((a, b) => (b.deleted_at || '').localeCompare(a.deleted_at || '')));
  };

  const trashUser = async (userId: string) => {
    await proxyTable('profiles').update({ deleted_at: new Date().toISOString() }, 'id', userId);
    await reloadUsers();
    toast({ title: 'Success', description: 'User moved to trash' });
  };

  const restoreUser = async (userId: string) => {
    await proxyTable('profiles').update({ deleted_at: null }, 'id', userId);
    await reloadUsers();
    toast({ title: 'Success', description: 'User restored from trash' });
  };

  const deleteUser = async (userId?: string) => {
    const id = userId || deletingUser?.id;
    if (!id) return;
    try {
      const functionUrl = `${supabaseUrl}/functions/v1/delete-user`;
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': supabaseKey },
        body: JSON.stringify({ user_id: id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to delete user');
      toast({ title: 'Success', description: `User permanently deleted` });
      setIsDeleteDialogOpen(false);
      setDeletingUser(null);
      await loadData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed', variant: 'destructive' });
    }
  };

  const bulkTrashUsers = async () => {
    const ids = [...selectedUsers];
    if (ids.length === 0) return;
    if (!confirm(`Move ${ids.length} user(s) to trash?`)) return;
    for (const id of ids) {
      await proxyTable('profiles').update({ deleted_at: new Date().toISOString() }, 'id', id);
    }
    setSelectedUsers(new Set());
    await loadData();
    toast({ title: 'Success', description: `${ids.length} user(s) moved to trash` });
  };

  const bulkRestoreUsers = async () => {
    const ids = [...selectedUsers];
    if (ids.length === 0) return;
    if (!confirm(`Restore ${ids.length} user(s) from trash?`)) return;
    for (const id of ids) {
      await proxyTable('profiles').update({ deleted_at: null }, 'id', id);
    }
    setSelectedUsers(new Set());
    await loadData();
    toast({ title: 'Success', description: `${ids.length} user(s) restored` });
  };

  const bulkDeletePermanently = async () => {
    const ids = [...selectedUsers];
    if (ids.length === 0) return;
    if (!confirm(`Permanently delete ${ids.length} user(s)? This cannot be undone.`)) return;
    let failed = 0;
    for (const id of ids) {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/delete-user`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': supabaseKey },
          body: JSON.stringify({ user_id: id }),
        });
        if (!res.ok) failed++;
      } catch { failed++; }
    }
    setSelectedUsers(new Set());
    await loadData();
    if (failed === 0) toast({ title: 'Success', description: `${ids.length} user(s) permanently deleted` });
    else toast({ title: 'Partial success', description: `${ids.length - failed} deleted, ${failed} failed`, variant: 'destructive' });
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

      const { error: rpcError } = await proxyRpc('create_user_profile', {
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
      const { error } = await proxyTable('jobs').update({ status: newStatus }, 'id', jobId);

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
    } else {
      setCustomServiceCats(updated);
    }
    setCategories([...new Set([...(newCategoryType === 'job' ? updated : customJobCats), ...(newCategoryType === 'service' ? updated : customServiceCats)])]);
    toast({ title: 'Success', description: 'Category added.' });
  };

  const deleteJob = async (jobId: string) => {
    if (!window.confirm('Are you sure you want to delete this job?')) return;
    try {
      const { error } = await proxyTable('jobs').delete('id', jobId);
      if (error) throw error;
      setJobs(jobs.filter(job => job.id !== jobId));
      toast({ title: 'Success', description: 'Job deleted successfully' });
    } catch (error: any) {
      toast({ title: 'Error', description: `Failed to delete job: ${error?.message || error}`, variant: 'destructive' });
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
        const { error } = await proxyTable('jobs').update(jobData, 'id', editingJob.id);
        if (error) throw error;
        toast({ title: 'Success', description: 'Job updated successfully' });
      } else {
        const { error } = await proxyTable('jobs').insert(jobData);
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
      const { error } = await proxyTable('service_ads').delete('id', adId);
      if (error) throw error;
      setAds(ads.filter(ad => ad.id !== adId));
      toast({ title: 'Success', description: 'Ad deleted successfully' });
    } catch (error: any) {
      toast({ title: 'Error', description: `Failed to delete ad: ${error?.message || error}`, variant: 'destructive' });
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
      owner_email: formData.get('owner_email') || editingAd?.owner_email || null,
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

      adData.billing_cycle = adData.plan === '10-day' ? '10 days' : adData.plan === '20-day' ? '20 days' : '30 days';
      adData.billing_start = adData.billing_start || editingAd?.billing_start || new Date().toISOString();

      if (editingAd?.id) {
        console.log('ðŸ" Updating existing ad:', editingAd.id, adData);
        adData.billing_end = adData.expiry_date ? new Date(`${adData.expiry_date}T00:00:00`).toISOString() : editingAd?.billing_end;
        const { error } = await proxyTable('service_ads').update(adData, 'id', editingAd.id);
        if (error) throw error;
        toast({ title: 'Success', description: 'Ad updated successfully' });
      } else {
        // For new ads, calculate expiry if not present
        const days = adData.plan === '10-day' ? 10 : adData.plan === '20-day' ? 20 : 30;
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + days);
        adData.expiry_date = expiryDate.toISOString().split('T')[0];
        adData.billing_end = new Date(`${adData.expiry_date}T00:00:00`).toISOString();
        
        const { error } = await proxyTable('service_ads').insert(adData);
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
      const { error } = await proxyTable('service_ads').update({ payment_confirmed }, 'id', adId);
      if (error) throw error;
      setAds(ads.map(ad => ad.id === adId ? { ...ad, payment_confirmed } : ad));
      toast({ title: 'Success', description: 'Ad payment status updated' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update ad payment status', variant: 'destructive' });
    }
  };

  const updatePaymentStatus = async (paymentId: string, status: string) => {
    try {
      const payment = payments.find(p => p.id === paymentId);
      const { error } = await proxyTable('payments').update({ status }, 'id', paymentId);
      if (error) throw error;

      if (status === 'completed' && payment?.payment_type === 'registration' && payment?.user_id) {
        await extendSubscription(payment.user_id, 30);
      } else if (status === 'completed' && payment?.payment_type === 'advert' && payment?.related_ad_id) {
        await proxyTable('service_ads').update({ payment_confirmed: true }, 'id', payment.related_ad_id);
      }

      setPayments(payments.map(p => p.id === paymentId ? { ...p, status } : p));
      toast({ title: 'Success', description: status === 'completed' ? 'Payment confirmed — subscription extended' : 'Payment status updated' });
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


        <div className="flex gap-6 items-start">
          <div className="w-56 flex-shrink-0 sticky top-6">
            <nav className="bg-white rounded-xl border border-gray-200 p-2 space-y-1">
              {[
                { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
                { id: 'users', label: 'Users', icon: <Users className="w-4 h-4" /> },
                { id: 'jobs', label: 'Jobs', icon: <Briefcase className="w-4 h-4" /> },
                { id: 'ads', label: 'Ads', icon: <Newspaper className="w-4 h-4" /> },
                { id: 'payments', label: 'Payments', icon: <CreditCard className="w-4 h-4" /> },
                { id: 'guest-tokens', label: 'Guest Tokens', icon: <Key className="w-4 h-4" /> },
                { id: 'billing', label: 'Billing', icon: <Receipt className="w-4 h-4" /> },
                { id: 'messages', label: 'Messages', icon: <MessageSquare className="w-4 h-4" /> },
                { id: 'categories', label: 'Categories', icon: <Tags className="w-4 h-4" /> },
                { id: 'subscribers', label: 'Subscribers', icon: <Mail className="w-4 h-4" /> },
                { id: 'email', label: 'Email Providers', icon: <Send className="w-4 h-4" /> },
                { id: 'testimonials', label: 'Testimonials', icon: <MessageSquare className="w-4 h-4" /> },
                { id: 'adverts', label: 'Adverts', icon: <MonitorPlay className="w-4 h-4" /> },
              ].map(item => (
                <button key={item.id} onClick={() => setActiveTab(item.id)} className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === item.id ? 'bg-green-50 text-green-700' : 'text-gray-600 hover:bg-gray-50'}`}>
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex-1 min-w-0 space-y-6">
            {activeTab === 'dashboard' && <AdminDashboard onNavigatePayments={() => setActiveTab('payments')} />}

            {activeTab === 'users' && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle>{showTrash ? `Trash (${trashedUsers.length})` : `User Management (${users.length})`}</CardTitle>
                  <button onClick={() => { setShowTrash(!showTrash); setSelectedUsers(new Set()); }} className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${showTrash ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {showTrash ? 'Active Users' : `Trash (${trashedUsers.length})`}
                  </button>
                </div>
                {!showTrash && <Button onClick={() => { setCertFiles([]); setTermsAccepted(false); setDataSharingConsent(false); setIsCreateUserModalOpen(true); }}>
                  + Add New User
                </Button>}
              </CardHeader>
              <CardContent>
                {selectedUsers.size > 0 && (
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm text-gray-600">{selectedUsers.size} selected</span>
                    {showTrash ? (
                      <>
                        <button onClick={bulkRestoreUsers} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors">Restore Selected</button>
                        <button onClick={bulkDeletePermanently} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors">Delete Permanently</button>
                      </>
                    ) : (
                      <button onClick={bulkTrashUsers} className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-lg transition-colors">Trash Selected</button>
                    )}
                    <button onClick={() => setSelectedUsers(new Set())} className="px-3 py-1.5 border border-gray-300 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-50 transition-colors">Clear</button>
                  </div>
                )}
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" value={searchUsers} onChange={e => setSearchUsers(e.target.value)} placeholder="Search by name or email..." className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <input type="checkbox" checked={selectedUsers.size === (showTrash ? trashedUsers : users).length} onChange={() => {
                          const list = showTrash ? trashedUsers : users;
                          if (selectedUsers.size === list.length) setSelectedUsers(new Set());
                          else setSelectedUsers(new Set(list.map(u => u.id)));
                        }} className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500" />
                      </TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Verified</TableHead>
                      <TableHead>Subscription</TableHead>
                      <TableHead>Bids / Wk</TableHead>
                      {showTrash && <TableHead>Trashed</TableHead>}
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(showTrash ? trashedUsers : users).filter(u => !searchUsers || u.full_name?.toLowerCase().includes(searchUsers.toLowerCase()) || u.email?.toLowerCase().includes(searchUsers.toLowerCase())).map((user) => {
                      const uChecked = selectedUsers.has(user.id);
                      return (
                      <TableRow key={user.id} className={uChecked ? 'bg-green-50' : ''}>
                        <TableCell className="w-10">
                          <input type="checkbox" checked={uChecked} onChange={() => {
                            const next = new Set(selectedUsers);
                            if (uChecked) next.delete(user.id); else next.add(user.id);
                            setSelectedUsers(next);
                          }} className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500" />
                        </TableCell>
                        <TableCell>
                          {user.full_name}
                          <div className="text-xs text-gray-500">{user.email}</div>
                        </TableCell>
                        <TableCell>
                          {showTrash ? (
                            <Badge variant="outline">{user.role}</Badge>
                          ) : (
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
                                <SelectItem value="advertiser">Advertiser</SelectItem>
                                <SelectItem value="super_admin">Super Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.verified ? 'default' : 'secondary'}>
                            {user.verified ? 'Verified' : 'Unverified'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.subscription_expires_at && new Date(user.subscription_expires_at).getTime() > Date.now() ? (
                            <Badge variant="default" className="bg-green-600">
                              Premium · {Math.ceil((new Date(user.subscription_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))}d left
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-gray-100 text-gray-600">Free</Badge>
                          )}
                          {user.subscription_expires_at && new Date(user.subscription_expires_at).getTime() > Date.now() && (
                            <div className="text-[10px] text-gray-400 mt-0.5">Expires {new Date(user.subscription_expires_at).toLocaleDateString()}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          {user.role === 'jobseeker' ? (
                            user.subscription_expires_at && new Date(user.subscription_expires_at).getTime() > Date.now() ? (
                              <span className="text-xs text-green-600 font-medium">Unlimited</span>
                            ) : (
                              <span className="text-xs text-gray-500">—</span>
                            )
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </TableCell>
                        {showTrash && (
                          <TableCell className="text-xs text-gray-500">
                            {user.deleted_at ? new Date(user.deleted_at).toLocaleDateString() : '—'}
                          </TableCell>
                        )}
                        <TableCell className="flex gap-2 flex-wrap">
                          {showTrash ? (
                            <>
                              <Button variant="outline" size="sm" onClick={() => restoreUser(user.id)}>Restore</Button>
                              <Button variant="destructive" size="sm" onClick={() => {
                                setDeletingUser(user);
                                setIsDeleteDialogOpen(true);
                              }}>Delete Permanently</Button>
                            </>
                          ) : (
                            <>
                              <Button variant="outline" size="sm" onClick={() => toggleUserVerification(user.id, user.verified)}>
                                {user.verified ? 'Unverify' : 'Verify'}
                              </Button>
                              <Button variant={user.is_featured ? 'default' : 'outline'} size="sm" onClick={() => toggleUserFeatured(user.id, !!user.is_featured)} className={user.is_featured ? 'bg-amber-500 hover:bg-amber-600' : ''}>
                                {user.is_featured ? '★ Featured' : 'Feature'}
                              </Button>
                              <div className="flex gap-1">
                                <Button variant="secondary" size="sm" onClick={() => triggerPasswordReset(user.email)} disabled={!user.email} title="Send reset email">
                                  Send Email
                                </Button>
                                <Button variant="secondary" size="sm" onClick={() => { setResetPwUser(user); setResetPwPassword(''); setIsResetPwDialogOpen(true); }}>
                                  Set PW
                                </Button>
                              </div>
                              <Button variant="outline" size="sm" onClick={() => extendUserSubscription(user.id, 1, user.full_name || user.email)}>
                                +1 Day
                              </Button>
                              {user.role === 'jobseeker' && (!user.subscription_expires_at || new Date(user.subscription_expires_at).getTime() <= Date.now()) && (
                                <Button variant="default" size="sm" onClick={() => extendUserSubscription(user.id, 30, user.full_name || user.email)} className="bg-green-600 hover:bg-green-700">
                                  Upgrade 30d
                                </Button>
                              )}
                              <Button variant="outline" size="sm" onClick={() => {
                                setEditingUser(user);
                                setRatingsEnabled(!!user.ratings_enabled);
                                setIsEditUserModalOpen(true);
                              }}>
                                Edit
                              </Button>
                              <Button variant="destructive" size="sm" onClick={() => trashUser(user.id)}>
                                Trash
                              </Button>
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    )})}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {activeTab === 'jobs' && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Job Management</CardTitle>
                <Button onClick={() => { setEditingJob(null); setIsJobModalOpen(true); }}>Add Job</Button>
              </CardHeader>
              <CardContent>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" value={searchJobs} onChange={e => setSearchJobs(e.target.value)} placeholder="Search by title, category or poster..." className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                </div>
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
                    {jobs.filter(j => !searchJobs || j.title?.toLowerCase().includes(searchJobs.toLowerCase()) || j.posted_by_name?.toLowerCase().includes(searchJobs.toLowerCase()) || j.category?.toLowerCase().includes(searchJobs.toLowerCase())).map((job) => (
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
          )}

          {activeTab === 'ads' && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Advertisement Management</CardTitle>
                <Button onClick={() => { setEditingAd(null); setAdFiles([]); setIsAdModalOpen(true); }}>Add Ad</Button>
              </CardHeader>
              <CardContent>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" value={searchAds} onChange={e => setSearchAds(e.target.value)} placeholder="Search by business name, title or category..." className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                </div>
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
                    {ads.filter(a => !searchAds || a.business_name?.toLowerCase().includes(searchAds.toLowerCase()) || a.title?.toLowerCase().includes(searchAds.toLowerCase()) || a.category?.toLowerCase().includes(searchAds.toLowerCase()) || a.location?.toLowerCase().includes(searchAds.toLowerCase()) || a.contact_person?.toLowerCase().includes(searchAds.toLowerCase())).map((ad) => (
                      <TableRow key={ad.id}>
                        <TableCell>
                          <img src={optimizeImageUrl(ad.image || ad.images?.[0] || '/images/services.png', 100, 100)} alt="" className="w-12 h-12 object-cover rounded" />
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
          )}

          {activeTab === 'payments' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <CardTitle>Payment Management (M-Pesa)</CardTitle>
                    <p className="text-sm text-gray-500 mt-1">
                      {payments.filter(p => p.status === 'pending').length} pending &middot; {payments.filter(p => p.status === 'completed').length} completed &middot; {payments.filter(p => p.status === 'failed').length} failed
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {(['all', 'pending', 'completed', 'failed', 'refunded'] as const).map(f => (
                      <button key={f} onClick={() => setPaymentStatusFilter(f)} className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors capitalize ${paymentStatusFilter === f ? f === 'pending' ? 'bg-amber-100 text-amber-700' : f === 'completed' ? 'bg-green-100 text-green-700' : f === 'failed' ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                        {f === 'all' ? `All (${payments.length})` : f === 'pending' ? `Pending (${payments.filter(p => p.status === 'pending').length})` : f === 'completed' ? `Completed (${payments.filter(p => p.status === 'completed').length})` : f === 'failed' ? `Failed (${payments.filter(p => p.status === 'failed').length})` : `Refunded (${payments.filter(p => p.status === 'refunded').length})`}
                      </button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" value={searchPayments} onChange={e => setSearchPayments(e.target.value)} placeholder="Search by type, M-Pesa ref or description..." className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                </div>
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
                    {payments.filter(p => (paymentStatusFilter === 'all' || p.status === paymentStatusFilter) && (!searchPayments || p.payment_type?.toLowerCase().includes(searchPayments.toLowerCase()) || p.mpesa_ref?.toLowerCase().includes(searchPayments.toLowerCase()) || p.description?.toLowerCase().includes(searchPayments.toLowerCase()))).map((payment) => (
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
                {payments.filter(p => (paymentStatusFilter === 'all' || p.status === paymentStatusFilter) && (!searchPayments || p.payment_type?.toLowerCase().includes(searchPayments.toLowerCase()) || p.mpesa_ref?.toLowerCase().includes(searchPayments.toLowerCase()) || p.description?.toLowerCase().includes(searchPayments.toLowerCase()))).length === 0 && (
                  <p className="text-center text-gray-500 text-sm py-8">No payments match the current filter.</p>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === 'guest-tokens' && (
            <Card>
              <CardHeader>
                <CardTitle>Guest Contact Access Tokens</CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  Payments from unauthenticated users (anonymous). Each token grants access to one worker contact.
                </p>
              </CardHeader>
              <CardContent>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" value={searchPayments} onChange={e => setSearchPayments(e.target.value)} placeholder="Search by token, phone, or description..." className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Token</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Worker</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>M-Pesa Ref</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.filter(p => !p.user_id && p.payment_type === 'contact_access' && (!searchPayments || p.token?.toLowerCase().includes(searchPayments.toLowerCase()) || p.mpesa_phone?.includes(searchPayments) || p.description?.toLowerCase().includes(searchPayments.toLowerCase()))).map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>
                          <span className="font-mono text-sm font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded">{payment.token || 'N/A'}</span>
                        </TableCell>
                        <TableCell>KSh {payment.amount}</TableCell>
                        <TableCell className="text-xs">{payment.description?.replace('Unlock contact for ', '') || 'N/A'}</TableCell>
                        <TableCell className="text-xs">{payment.mpesa_phone || 'N/A'}</TableCell>
                        <TableCell>
                          <Badge variant={payment.status === 'completed' ? 'default' : payment.status === 'pending' ? 'secondary' : 'destructive'}>
                            {payment.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{payment.mpesa_ref || 'N/A'}</TableCell>
                        <TableCell className="text-xs">{new Date(payment.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {payments.filter(p => !p.user_id && p.payment_type === 'contact_access' && (!searchPayments || p.token?.toLowerCase().includes(searchPayments.toLowerCase()) || p.mpesa_phone?.includes(searchPayments) || p.description?.toLowerCase().includes(searchPayments.toLowerCase()))).length === 0 && (
                  <p className="text-center text-gray-500 text-sm py-8">No guest transactions found.</p>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === 'billing' && (
            <div className="space-y-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
                  <CardTitle>Billing — Due & Expired Adverts</CardTitle>
                  <div className="flex items-center gap-2">
                    {(['due', 'expired', 'all'] as const).map(f => (
                      <button key={f} onClick={() => setBillingFilter(f)} className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors capitalize ${billingFilter === f ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                        {f === 'due' ? 'Due Soon' : f === 'expired' ? 'Expired' : 'All'}
                      </button>
                    ))}
                    <Button variant="outline" size="sm" onClick={loadBilling} disabled={billingLoading}>Refresh</Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {billingMsg && <p className="text-sm text-amber-600 mb-3">{billingMsg}</p>}
                  {billingLoading ? (
                    <div className="flex items-center justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-green-600" /></div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Type</TableHead>
                            <TableHead>Business</TableHead>
                            <TableHead>Advertiser Email</TableHead>
                            <TableHead>Cycle</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Due / Expired</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Last Invoice</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {billingItems
                            .filter(it => billingFilter === 'all' || it.status === billingFilter)
                            .map((item) => (
                              <TableRow key={`${item.item_type}:${item.id}`}>
                                <TableCell>
                                  <Badge variant={item.item_type === 'advert' ? 'default' : 'secondary'}>
                                    {item.item_type === 'advert' ? 'Banner Advert' : 'Business Ad'}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <div>{item.business_name}</div>
                                  <div className="text-xs text-gray-500">{item.featured ? 'Featured' : 'Regular'}{!item.active ? ' • Inactive' : ''}</div>
                                </TableCell>
                                <TableCell>{item.owner_email || <span className="text-xs text-red-500">No email</span>}</TableCell>
                                <TableCell>{item.billing_cycle}</TableCell>
                                <TableCell>KES {item.amount}</TableCell>
                                <TableCell>{item.billing_end ? new Date(item.billing_end).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</TableCell>
                                <TableCell>
                                  <Badge variant={item.status === 'expired' ? 'destructive' : 'secondary'}>{item.status === 'expired' ? 'Expired' : 'Due'}</Badge>
                                </TableCell>
                                <TableCell>{item.last_invoice_at ? new Date(item.last_invoice_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Never'}</TableCell>
                                <TableCell>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openBillingPreview(item)}
                                  >
                                    <Eye className="w-4 h-4 mr-1" />
                                    Preview
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => sendBillingInvoice(item)}
                                    disabled={billingSendingId === `${item.item_type}:${item.id}`}
                                  >
                                    {billingSendingId === `${item.item_type}:${item.id}` ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
                                    Send Alert & Invoice
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          {billingItems.filter(it => billingFilter === 'all' || it.status === billingFilter).length === 0 && (
                            <TableRow><TableCell colSpan={9} className="text-center text-gray-400 py-8">No {billingFilter === 'all' ? 'billing items' : billingFilter === 'due' ? 'due-soon adverts' : 'expired adverts'} right now.</TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Billing Log ({billingLogs.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Business</TableHead>
                          <TableHead>Recipient</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {billingLogs.map(log => (
                          <TableRow key={log.id}>
                            <TableCell>{new Date(log.created_at).toLocaleString('en-KE', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</TableCell>
                            <TableCell>{log.item_type === 'advert' ? 'Banner Advert' : 'Business Ad'}</TableCell>
                            <TableCell>{log.business_name || '—'}</TableCell>
                            <TableCell>{log.recipient_email}</TableCell>
                            <TableCell>{log.amount != null ? `KES ${log.amount}` : '—'}</TableCell>
                            <TableCell>
                              <Badge variant={log.status === 'sent' ? 'default' : 'destructive'}>{log.status}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                        {billingLogs.length === 0 && (
                          <TableRow><TableCell colSpan={6} className="text-center text-gray-400 py-8">No invoices sent yet.</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'messages' && (<>
            <Card>
              <CardHeader>
                <CardTitle>Message Management</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" value={searchMessages} onChange={e => setSearchMessages(e.target.value)} placeholder="Search by sender, subject or message..." className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                </div>
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
                    {messages.filter(m => !searchMessages || m.sender_name?.toLowerCase().includes(searchMessages.toLowerCase()) || m.sender_email?.toLowerCase().includes(searchMessages.toLowerCase()) || m.subject?.toLowerCase().includes(searchMessages.toLowerCase()) || m.message?.toLowerCase().includes(searchMessages.toLowerCase())).map((msg) => (
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
                          <Button variant="outline" size="sm" onClick={async () => {
                            setSelectedMessage(msg);
                            setIsMessageModalOpen(true);
                            setReplyText('');
                            if (msg.conversation_id) {
                              const msgs = await getChatConversation(msg.conversation_id);
                              setConversationThread(msgs);
                            } else {
                              setConversationThread([]);
                            }
                          }}>
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Dialog open={isMessageModalOpen} onOpenChange={setIsMessageModalOpen}>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Message Details</DialogTitle>
                </DialogHeader>
                {selectedMessage && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-gray-500">From:</span> <span className="font-medium">{selectedMessage.sender_name}</span></div>
                      <div><span className="text-gray-500">Email:</span> <span>{selectedMessage.sender_email}</span></div>
                      <div><span className="text-gray-500">Subject:</span> <span>{selectedMessage.subject}</span></div>
                      <div><span className="text-gray-500">Type:</span> <Badge variant="outline">{selectedMessage.type}</Badge></div>
                      <div><span className="text-gray-500">Status:</span> <Badge variant={selectedMessage.status === 'unread' ? 'destructive' : 'default'}>{selectedMessage.status}</Badge></div>
                      <div><span className="text-gray-500">Date:</span> <span>{new Date(selectedMessage.created_at).toLocaleString()}</span></div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedMessage.message}</p>
                    </div>

                    {conversationThread.length > 1 && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Conversation Thread</h4>
                        <div className="space-y-2 max-h-60 overflow-y-auto bg-gray-50 rounded-lg p-3">
                          {conversationThread.map((m, i) => (
                            <div key={m.id || i} className={`flex ${m.role === 'admin' ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[75%] px-3 py-2 rounded-lg text-sm ${
                                m.role === 'admin'
                                  ? 'bg-green-600 text-white rounded-br-sm'
                                  : 'bg-white border border-gray-200 rounded-bl-sm'
                              }`}>
                                <div className="text-[10px] opacity-70 mb-0.5">{m.role === 'admin' ? 'You' : m.sender_name}</div>
                                {m.message}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="border-t pt-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Reply</h4>
                      <Textarea
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        placeholder="Type your reply..."
                        rows={3}
                      />
                      <div className="flex gap-2 mt-2">
                        <Button
                          onClick={async () => {
                            if (!replyText.trim() || sendingReply || !selectedMessage) return;
                            setSendingReply(true);
                            try {
                              const cid = selectedMessage.conversation_id || crypto.randomUUID();
                              if (!selectedMessage.conversation_id) {
                                await proxyTable('messages').update({ conversation_id: cid }, 'id', selectedMessage.id);
                              }
                              const { data: { user } } = await supabase.auth.getUser();
                              await createChatMessage({
                                conversation_id: cid,
                                sender_name: 'Admin',
                                sender_email: user?.email || 'admin@itukarua.co.ke',
                                message: replyText.trim(),
                                role: 'admin',
                              });
                              await proxyTable('messages').update({ status: 'replied' }, 'id', selectedMessage.id);
                              setMessages(prev => prev.map(m => m.id === selectedMessage.id ? { ...m, status: 'replied', conversation_id: cid } : m));
                              const updated = await getChatConversation(cid);
                              setConversationThread(updated);
                              setReplyText('');
                              toast({ title: 'Reply sent' });
                            } catch (e) {
                              toast({ title: 'Error sending reply', variant: 'destructive' });
                            } finally {
                              setSendingReply(false);
                            }
                          }}
                          disabled={!replyText.trim() || sendingReply}
                        >
                          {sendingReply ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                          Send Reply
                        </Button>
                        <Button variant="outline" onClick={async () => {
                          if (!selectedMessage) return;
                          await proxyTable('messages').update({ status: 'read' }, 'id', selectedMessage.id);
                          setMessages(prev => prev.map(m => m.id === selectedMessage.id ? { ...m, status: 'read' } : m));
                          setIsMessageModalOpen(false);
                        }}>Mark as Read</Button>
                      </div>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </>)}

          {activeTab === 'categories' && (
            <Card>
              <CardHeader>
                <CardTitle>Category Management</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" value={searchCategories} onChange={e => setSearchCategories(e.target.value)} placeholder="Search categories..." className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                </div>
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
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Job Categories ({customJobCats.length})</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {customJobCats.filter(c => !searchCategories || c.toLowerCase().includes(searchCategories.toLowerCase())).map((category) => (
                        <div key={'job-'+category} className="flex items-center gap-1">
                          <Badge variant="outline" className="flex-1 justify-center">{category}</Badge>
                          <button onClick={async () => {
                            await deleteCustomCategory(category, 'job');
                            const updated = await getCustomCategories('job');
                            setCustomJobCats(updated);
                            setCategories([...new Set([...updated, ...customServiceCats])]);
                          }} className="text-red-500 hover:text-red-700 text-xs font-bold px-1">&times;</button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Service Categories ({customServiceCats.length})</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {customServiceCats.filter(c => !searchCategories || c.toLowerCase().includes(searchCategories.toLowerCase())).map((category) => (
                        <div key={'svc-'+category} className="flex items-center gap-1">
                          <Badge variant="outline" className="flex-1 justify-center">{category}</Badge>
                          <button onClick={async () => {
                            await deleteCustomCategory(category, 'service');
                            const updated = await getCustomCategories('service');
                            setCustomServiceCats(updated);
                            setCategories([...new Set([...customJobCats, ...updated])]);
                          }} className="text-red-500 hover:text-red-700 text-xs font-bold px-1">&times;</button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'subscribers' && (
            <Card>
              <CardHeader>
                <CardTitle>Newsletter Subscribers ({subscribers.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" value={searchSubscribers} onChange={e => setSearchSubscribers(e.target.value)} placeholder="Search by name or email..." className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                </div>
                <div className="flex gap-2 mb-4">
                  <input type="text" value={newSubscriberName} onChange={e => setNewSubscriberName(e.target.value)} placeholder="Full name" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                  <input type="email" value={newSubscriberEmail} onChange={e => setNewSubscriberEmail(e.target.value)} placeholder="Email address" className="flex-[2] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                  <input type="text" name="_website" value="" onChange={() => {}} tabIndex={-1} autoComplete="off" className="absolute left-[-9999px] h-0 w-0 opacity-0" aria-hidden="true" />
                  <button onClick={async () => {
                    const hp = document.querySelector('input[name="_website"]') as HTMLInputElement;
                    if (hp?.value) { setSubscriberMsg('Spam detected'); return; }
                    if (!newSubscriberName.trim()) { setSubscriberMsg('Name is required'); return; }
                    if (!newSubscriberEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newSubscriberEmail)) { setSubscriberMsg('Invalid email'); return; }
                    const result = await subscribeNewsletter(newSubscriberEmail.trim(), newSubscriberName.trim());
                    if (result.error) { setSubscriberMsg(result.error); } else { setSubscriberMsg('Added!'); setNewSubscriberName(''); setNewSubscriberEmail(''); setSubscribers(await getNewsletterSubscribers()); }
                  }} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors">Add</button>
                </div>
                {subscriberMsg && <p className={`text-sm mb-3 ${subscriberMsg === 'Invalid email' || subscriberMsg.includes('already') ? 'text-amber-600' : 'text-green-600'}`}>{subscriberMsg}</p>}
                <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-200">
                  <button onClick={openNewsletterBuilder} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2">
                    <Newspaper className="w-4 h-4" />
                    Create Newsletter
                  </button>
                  <button onClick={async () => {
                    if (subscribers.length === 0) { setSubscriberMsg('No subscribers to send to.'); return; }
                    setSendingNewsletter(true);
                    setSubscriberMsg('');
                    try {
                      const res = await fetch(`${supabaseUrl}/functions/v1/send-weekly-newsletter`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
                      });
                      const data = await res.json();
                      if (data.error) throw new Error(data.error);
                      setSubscriberMsg(data.message || `Newsletter sent to ${data.sent} subscriber(s)${data.failed > 0 ? ` (${data.failed} failed)` : ''}! Check Ethereal inbox.`);
                    } catch (err: any) {
                      setSubscriberMsg(`Error: ${err.message}`);
                    } finally {
                      setSendingNewsletter(false);
                    }
                  }} disabled={sendingNewsletter || subscribers.length === 0} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
                    {sendingNewsletter ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {sendingNewsletter ? 'Sending...' : 'Send Newsletter Now'}
                  </button>
                  <span className="text-xs text-gray-400">Sends to {subscribers.length} subscriber(s) via the active email provider (configure it in Email Providers)</span>
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
                          {subscribers.filter(s => !searchSubscribers || s.name?.toLowerCase().includes(searchSubscribers.toLowerCase()) || s.email?.toLowerCase().includes(searchSubscribers.toLowerCase())).map(s => {
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
          )}

          {activeTab === 'email' && (
            <Card>
              <CardHeader>
                <CardTitle>Email Providers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4 p-3 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 text-sm">
                  The active provider below is used to send emails. Credentials can be set two ways — the saved provider here, or Supabase secrets (<code className="bg-white/60 px-1 rounded">SMTP_HOST</code>, <code className="bg-white/60 px-1 rounded">SMTP_USER</code>, <code className="bg-white/60 px-1 rounded">SMTP_PASS</code>), which take priority. The password is saved to the database but only super admins can read it; it is never returned to the browser after saving.
                </div>

                {emailMsg && (
                  <div className={`mb-4 p-3 rounded-lg text-sm ${emailMsgType === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {emailMsg}
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Provider form */}
                  <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                    <h3 className="font-semibold text-gray-900 mb-4">{emailForm.id ? 'Edit Provider' : 'Add Email Provider'}</h3>
                    <div className="space-y-4">
                      <div>
                        <Label>Provider Name</Label>
                        <Input value={emailForm.name || ''} onChange={e => setEmailForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Prefetch Systems" />
                      </div>
                      <div>
                        <Label>Username (email address)</Label>
                        <Input value={emailForm.username || ''} onChange={e => setEmailForm(f => ({ ...f, username: e.target.value }))} placeholder="you@yourdomain.co.ke" />
                      </div>
                      <div>
                        <Label>Password</Label>
                        <div className="relative">
                          <Input type={showEmailPw ? 'text' : 'password'} value={emailForm.password || ''} onChange={e => setEmailForm(f => ({ ...f, password: e.target.value }))} placeholder={emailForm.id ? 'Leave blank to keep current password' : 'SMTP / email password'} />
                          <button type="button" onClick={() => setShowEmailPw(!showEmailPw)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors">
                            {showEmailPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>IMAP Host</Label>
                          <Input value={emailForm.imap_host || ''} onChange={e => setEmailForm(f => ({ ...f, imap_host: e.target.value }))} placeholder="mail.yourdomain.co.ke" />
                        </div>
                        <div>
                          <Label>IMAP Port</Label>
                          <Input type="number" value={emailForm.imap_port || ''} onChange={e => setEmailForm(f => ({ ...f, imap_port: Number(e.target.value) }))} placeholder="993" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>SMTP Host (outgoing)</Label>
                          <Input value={emailForm.smtp_host || ''} onChange={e => setEmailForm(f => ({ ...f, smtp_host: e.target.value }))} placeholder="mail.yourdomain.co.ke" />
                        </div>
                        <div>
                          <Label>SMTP Port</Label>
                          <Input type="number" value={emailForm.smtp_port || ''} onChange={e => setEmailForm(f => ({ ...f, smtp_port: Number(e.target.value) }))} placeholder="465" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>From Name</Label>
                          <Input value={emailForm.from_name || ''} onChange={e => setEmailForm(f => ({ ...f, from_name: e.target.value }))} placeholder="Itukarua" />
                        </div>
                        <div>
                          <Label>From Email</Label>
                          <Input value={emailForm.from_email || ''} onChange={e => setEmailForm(f => ({ ...f, from_email: e.target.value }))} placeholder="noreply@yourdomain.co.ke" />
                        </div>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={!!emailForm.is_active} onChange={e => setEmailForm(f => ({ ...f, is_active: e.target.checked }))} className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500" />
                        <span className="text-sm text-gray-700 font-medium">Set as active provider</span>
                      </label>
                      <div className="flex gap-3">
                        <Button disabled={emailSaving || !emailForm.name || !emailForm.username || !emailForm.smtp_host} onClick={async () => {
                          setEmailSaving(true);
                          setEmailMsg('');
                          const result = await saveEmailProvider(emailForm);
                          if (result.error) {
                            setEmailMsg(result.error);
                            setEmailMsgType('err');
                          } else {
                            setEmailMsg(emailForm.id ? 'Provider updated.' : 'Provider added.');
                            setEmailMsgType('ok');
                            setEmailForm({ name: '', username: '', password: '', imap_host: '', imap_port: 993, smtp_host: '', smtp_port: 465, from_name: 'Itukarua', from_email: '', is_active: false });
                            loadEmailProviders();
                          }
                          setEmailSaving(false);
                        }} className="flex items-center gap-2">
                          {emailSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                          {emailForm.id ? 'Save Changes' : 'Add Provider'}
                        </Button>
                        {emailForm.id && (
                          <Button variant="outline" onClick={() => setEmailForm({ name: '', username: '', password: '', imap_host: '', imap_port: 993, smtp_host: '', smtp_port: 465, from_name: 'Itukarua', from_email: '', is_active: false })}>
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Provider list */}
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-4">Saved Providers ({emailProviders.length})</h3>
                    {emailProviders.length === 0 ? (
                      <p className="text-sm text-gray-400">No email providers configured yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {emailProviders.map(p => (
                          <div key={p.id} className={`rounded-xl border p-4 ${p.is_active ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold text-gray-900 truncate">{p.name}</p>
                                  {p.is_active && <Badge className="bg-green-600">Active</Badge>}
                                </div>
                                <p className="text-xs text-gray-500 mt-0.5">{p.username}</p>
                              </div>
                              <div className="flex gap-2 flex-shrink-0">
                                <button onClick={() => { setEmailForm({ ...p, password: '' }); setEmailMsg(''); }} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                                <button onClick={async () => {
                                  if (!confirm(`Delete provider "${p.name}"?`)) return;
                                  const result = await deleteEmailProvider(p.id);
                                  if (result.error) { setEmailMsg(result.error); setEmailMsgType('err'); }
                                  else loadEmailProviders();
                                }} className="text-xs text-red-600 hover:text-red-800 font-medium">Delete</button>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 text-xs text-gray-500">
                              <span>IMAP: <span className="font-medium text-gray-700">{p.imap_host || '—'}</span>{p.imap_port ? ` :${p.imap_port}` : ''}</span>
                              <span>SMTP: <span className="font-medium text-gray-700">{p.smtp_host || '—'}</span>{p.smtp_port ? ` :${p.smtp_port}` : ''}</span>
                              <span>From: <span className="font-medium text-gray-700">{p.from_email || p.username || '—'}</span></span>
                              <button
                                onClick={async () => {
                                  const result = await saveEmailProvider({ id: p.id, is_active: true });
                                  if (result.error) { setEmailMsg(result.error); setEmailMsgType('err'); }
                                  else { setEmailMsg(`"${p.name}" is now the active provider.`); setEmailMsgType('ok'); loadEmailProviders(); }
                                }}
                                className="text-left text-green-700 hover:text-green-900 font-medium"
                              >
                                {p.is_active ? '✓ Currently active' : 'Set as active'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'testimonials' && (
            <Card>
              <CardHeader>
                <CardTitle>Client Testimonials</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4 p-3 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 text-sm">
                  These appear in the "What Clients Say" section on the homepage, below the websites scroller.
                </div>

                <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50 p-5">
                  <h3 className="font-semibold text-gray-900 mb-4">Websites Carousel Settings</h3>
                  <p className="text-sm text-gray-500 mb-4">The homepage "Websites We Build" scroller shows up to 5 websites per slide. Choose how it transitions and how long each slide stays on screen.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    <div>
                      <Label>Effect / Style</Label>
                      <select value={webCarouselSettings.effect} onChange={e => setWebCarouselSettings(s => ({ ...s, effect: e.target.value as 'slide' | 'fade' | 'zoom' }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none">
                        <option value="slide">Slide (horizontal)</option>
                        <option value="fade">Fade</option>
                        <option value="zoom">Zoom (scale in)</option>
                      </select>
                    </div>
                    <div>
                      <Label>Oscillation Seconds</Label>
                      <Input type="number" min={1} max={60} step={1} value={webCarouselSettings.scrollIntervalSeconds} onChange={e => setWebCarouselSettings(s => ({ ...s, scrollIntervalSeconds: Math.max(1, Number(e.target.value) || 1) }))} />
                      <p className="text-xs text-gray-400 mt-1">Seconds per slide before rotating</p>
                    </div>
                    <div>
                      <Label>Transition Duration (s)</Label>
                      <Input type="number" min={0} max={5} step={0.1} value={webCarouselSettings.transitionDurationSeconds} onChange={e => setWebCarouselSettings(s => ({ ...s, transitionDurationSeconds: Math.max(0, Number(e.target.value) || 0) }))} />
                      <p className="text-xs text-gray-400 mt-1">Length of the transition animation</p>
                    </div>
                  </div>
                  <Button onClick={saveWebCarouselSettings} disabled={webCarouselSaving} className="bg-green-600 hover:bg-green-700">
                    {webCarouselSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Save Websites Carousel Settings
                  </Button>
                </div>

                {testimonialMsg && (
                  <div className={`mb-4 p-3 rounded-lg text-sm ${testimonialMsgType === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {testimonialMsg}
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Add testimonial */}
                  <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                    <h3 className="font-semibold text-gray-900 mb-4">Add Testimonial</h3>
                    <div className="space-y-4">
                      <div>
                        <Label>Client Name</Label>
                        <Input value={testimonialForm.client_name} onChange={e => setTestimonialForm(f => ({ ...f, client_name: e.target.value }))} placeholder="e.g. Jane Wanjiku" />
                      </div>
                      <div>
                        <Label>Company / Website (optional)</Label>
                        <Input value={testimonialForm.company} onChange={e => setTestimonialForm(f => ({ ...f, company: e.target.value }))} placeholder="e.g. Prefetch Systems" />
                      </div>
                      <div>
                        <Label>Comment</Label>
                        <Textarea value={testimonialForm.comment} onChange={e => setTestimonialForm(f => ({ ...f, comment: e.target.value }))} placeholder="What did the client say?" rows={4} />
                      </div>
                      <div>
                        <Label>Rating (1-5)</Label>
                        <div className="flex items-center gap-1">
                          {[1,2,3,4,5].map(star => (
                            <button key={star} type="button" onClick={() => setTestimonialForm(f => ({ ...f, rating: star }))} className={`text-2xl transition-colors ${star <= testimonialForm.rating ? 'text-amber-400' : 'text-gray-300 hover:text-amber-200'}`}>
                              ★
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <Button disabled={testimonialSaving || !testimonialForm.client_name.trim() || !testimonialForm.comment.trim()} onClick={async () => {
                          setTestimonialSaving(true);
                          setTestimonialMsg('');
                          const result = await addTestimonial(testimonialForm);
                          if (result.error) {
                            setTestimonialMsg(result.error);
                            setTestimonialMsgType('err');
                          } else {
                            setTestimonialMsg('Testimonial added.');
                            setTestimonialMsgType('ok');
                            setTestimonialForm({ client_name: '', company: '', comment: '', rating: 5 });
                            loadTestimonials();
                          }
                          setTestimonialSaving(false);
                        }} className="flex items-center gap-2">
                          {testimonialSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                          Add Testimonial
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Testimonial list */}
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-4">Saved Testimonials ({testimonials.length})</h3>
                    {testimonials.length === 0 ? (
                      <p className="text-sm text-gray-400">No testimonials yet. Add one on the left.</p>
                    ) : (
                      <div className="space-y-3">
                        {testimonials.map(t => (
                          <div key={t.id} className="rounded-xl border border-gray-200 bg-white p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold text-gray-900 truncate">{t.client_name}</p>
                                  <span className="flex items-center gap-0.5 text-amber-400 text-xs">
                                    {[1,2,3,4,5].map(s => <span key={s} className={s <= t.rating ? '' : 'text-gray-200'}>{'★'}</span>)}
                                  </span>
                                </div>
                                {t.company && <p className="text-xs text-gray-500 mt-0.5">{t.company}</p>}
                                <p className="text-sm text-gray-600 mt-2">{t.comment}</p>
                              </div>
                              <button onClick={async () => {
                                if (!confirm(`Delete testimonial from "${t.client_name}"?`)) return;
                                const result = await deleteTestimonial(t.id);
                                if (result.error) { setTestimonialMsg(result.error); setTestimonialMsgType('err'); }
                                else loadTestimonials();
                              }} className="text-xs text-red-600 hover:text-red-800 font-medium flex-shrink-0">Delete</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'adverts' && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Homepage Carousel Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500 mb-4">The homepage banner shows 5 ad photos at once and rotates to the next 5. These controls set the speed and transition.</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <Label>Scroll Speed (seconds)</Label>
                    <Input type="number" min={1} max={60} step={1} value={carouselSettings.scrollIntervalSeconds} onChange={e => setCarouselSettings(s => ({ ...s, scrollIntervalSeconds: Math.max(1, Number(e.target.value) || 1) }))} />
                    <p className="text-xs text-gray-400 mt-1">Time before it rotates to the next 5 ads</p>
                  </div>
                  <div>
                    <Label>Transition Duration (seconds)</Label>
                    <Input type="number" min={0} max={5} step={0.1} value={carouselSettings.transitionDurationSeconds} onChange={e => setCarouselSettings(s => ({ ...s, transitionDurationSeconds: Math.max(0, Number(e.target.value) || 0) }))} />
                    <p className="text-xs text-gray-400 mt-1">How fast the slide/fade happens</p>
                  </div>
                  <div>
                    <Label>Transition Effect</Label>
                    <select value={carouselSettings.effect} onChange={e => setCarouselSettings(s => ({ ...s, effect: e.target.value as 'slide' | 'fade' }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none">
                      <option value="slide">Slide</option>
                      <option value="fade">Fade</option>
                    </select>
                    <p className="text-xs text-gray-400 mt-1">Slide scrolls pages; Fade cross-fades them</p>
                  </div>
                </div>
                <Button onClick={saveCarouselSettings} disabled={carouselSaving} className="mt-4 bg-green-600 hover:bg-green-700">
                  {carouselSaving ? 'Saving...' : 'Save Carousel Settings'}
                </Button>
              </CardContent>
            </Card>
          )}

          {activeTab === 'adverts' && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Advertisements ({adverts.length})</CardTitle>
                <Button onClick={() => { setAdForm({ title: '', image_url: '', images: [], destination_url: '', description: '', cta_text: 'Learn More', whatsapp_number: '', is_affiliate: false, featured: true, owner_email: '', slot: 'homepage_banner', billing_cycle: '7 days' }); setAdvUrlInput(''); setShowAdForm(true); }}>+ Add Advert</Button>
              </CardHeader>
              <CardContent>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" value={searchAdverts} onChange={e => setSearchAdverts(e.target.value)} placeholder="Search by title..." className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                </div>
                {showAdForm && (
                  <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">{adForm.id ? 'Edit Advert' : 'New Advert'}</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Title <span className="text-red-500">*</span></label>
                        <input type="text" value={adForm.title} onChange={e => setAdForm({ ...adForm, title: e.target.value })} placeholder="Advert title" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                      </div>
                      <div className="col-span-full">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Banner Images <span className="text-red-500">*</span> <span className="text-gray-400 font-normal">(up to 8)</span></label>
                        <p className="text-[11px] text-amber-600 mb-2">First image is the main banner; all images show in the popup. 10-day: 3 images, 20-day: 5, 30-day: 8. Each photo is compressed automatically and opens full-size when clicked.</p>
                        <div key={advUploadKey} className="flex flex-wrap gap-2 mb-2">
                          {adForm.images.length === 0 && (
                            <div className="w-32 h-24 rounded border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400"><Plus className="w-5 h-5" /></div>
                          )}
                          {adForm.images.map((img, i) => (
                            <div key={i} className="relative w-32 h-24 rounded border border-gray-200 overflow-hidden bg-gray-100">
                              <img src={proxyImageUrl(img)} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                              {i === 0 && <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] text-center py-0.5">Main</span>}
                              <button onClick={() => removeAdminAdImage(i)} className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80 transition-colors"><X className="w-3 h-3" /></button>
                            </div>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <label className={`px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-colors ${advUploading ? 'bg-gray-300 text-gray-500' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}>
                            <Upload className="w-4 h-4 inline mr-1" />
                            {advUploading ? 'Uploading...' : 'Upload Images'}
                            <input type="file" accept="image/png, image/jpeg, image/webp" multiple hidden disabled={advUploading} onChange={e => { uploadAdImages(e.target.files); e.target.value = ''; }} />
                          </label>
                          <input type="url" value={advUrlInput} onChange={e => setAdvUrlInput(e.target.value)} placeholder="...or paste image URL" className="flex-1 min-w-[180px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                          <button onClick={addAdminAdUrl} disabled={adForm.images.length >= 8 || !advUrlInput.trim()} className="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-200 hover:bg-gray-300 text-gray-700 disabled:opacity-50 transition-colors">Add</button>
                        </div>
                      </div>
                      <input type="url" value={adForm.destination_url} onChange={e => setAdForm({ ...adForm, destination_url: e.target.value })} placeholder="Destination URL" className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                      <input type="text" value={adForm.description} onChange={e => setAdForm({ ...adForm, description: e.target.value })} placeholder="Short description (optional)" className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                      <input type="text" value={adForm.cta_text} onChange={e => setAdForm({ ...adForm, cta_text: e.target.value })} placeholder="CTA text (default: Learn More)" className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                      <input type="tel" value={adForm.whatsapp_number} onChange={e => setAdForm({ ...adForm, whatsapp_number: e.target.value })} placeholder="WhatsApp number (e.g. 254712345678)" className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                      <select value={adForm.slot || 'homepage_banner'} onChange={e => setAdForm({ ...adForm, slot: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none">
                        <option value="homepage_banner">Homepage Carousel Banner</option>
                        <option value="job_listings_top">Job Listings Top Banner</option>
                      </select>
                      <select value={adForm.billing_cycle || '7 days'} onChange={e => setAdForm({ ...adForm, billing_cycle: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none">
                        <option value="7 days">7 Days (KES 100)</option>
                        <option value="10 days">10 Days (KES 300)</option>
                        <option value="20 days">20 Days (KES 500)</option>
                        <option value="30 days">30 Days (KES 800)</option>
                      </select>
                      <input type="email" value={adForm.owner_email || ''} onChange={e => setAdForm({ ...adForm, owner_email: e.target.value })} placeholder="Advertiser email (for billing invoices)" className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                      <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg">
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                          <input type="checkbox" checked={adForm.is_affiliate} onChange={e => setAdForm({ ...adForm, is_affiliate: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500" />
                          Affiliate
                        </label>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg">
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                          <input type="checkbox" checked={adForm.featured} onChange={e => setAdForm({ ...adForm, featured: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500" />
                          Featured <span className="text-xs text-gray-400">(shows on homepage carousel and side rail)</span>
                        </label>
                      </div>
                      <p className="text-[11px] text-gray-400 col-span-full -mt-1">Billing: {adForm.billing_cycle || '7 days'} cycle — KES {adForm.billing_cycle === '30 days' ? '800' : adForm.billing_cycle === '20 days' ? '500' : adForm.billing_cycle === '10 days' ? '300' : adForm.featured ? '500' : '100'}/week. Renewal alerts & invoices are sent from the Billing tab.</p>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={async () => {
                        const primaryUrl = adForm.images[0] || adForm.image_url;
                        if (!adForm.title || !primaryUrl) {
                          toast({ title: 'Missing fields', description: 'Title and at least one banner image are required', variant: 'destructive' });
                          return;
                        }
                        const images = adForm.images.length ? adForm.images : [adForm.image_url];
                        const finishSaved = () => {
                          setShowAdForm(false);
                          loadAdverts();
                          toast({ title: 'Success', description: adForm.id ? 'Ad updated' : 'Ad created' });
                        };
                        const findRecent = async () => {
                          try {
                            if (adForm.id) {
                              const { data } = await withTimeout(supabase.from('advertisements').select('id,title').eq('id', adForm.id).limit(1), 15000, 'Verify');
                              return !!data && data.length > 0;
                            }
                            const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
                            const { data } = await withTimeout(supabase.from('advertisements').select('id').eq('image_url', primaryUrl).gte('created_at', cutoff).order('created_at', { ascending: false }).limit(1), 15000, 'Verify');
                            return !!data && data.length > 0;
                          } catch {
                            return false;
                          }
                        };
                        try {
                          const nowIso = new Date().toISOString();
                          const cycleDays = adForm.billing_cycle === '30 days' ? 30 : adForm.billing_cycle === '20 days' ? 20 : adForm.billing_cycle === '10 days' ? 10 : 7;
                          const cycleEndIso = new Date(Date.now() + cycleDays * 24 * 60 * 60 * 1000).toISOString();
                          if (adForm.id) {
                            const { id, image_url, images: _oldImages, ...updateData } = adForm;
                            const patch: any = { ...updateData, image_url: primaryUrl, images, destination_url: updateData.destination_url || null, slot: updateData.slot || 'homepage_banner' };
                            if (!adForm.is_affiliate) {
                              patch.billing_cycle = adForm.billing_cycle || '7 days';
                              if (!patch.billing_start) patch.billing_start = nowIso;
                              if (!patch.billing_end) patch.billing_end = cycleEndIso;
                            }
                            const { error } = await proxyTable('advertisements').update(patch, 'id', adForm.id);
                            if (error) throw error;
                          } else {
                            const { id, image_url, images: _oldImages, ...insertData } = adForm;
                            const alreadySaved = await findRecent();
                            if (alreadySaved) {
                              finishSaved();
                              return;
                            }
                            const insert: any = { ...insertData, image_url: primaryUrl, images, destination_url: insertData.destination_url || null, slot: insertData.slot || 'homepage_banner' };
                            if (!insertData.is_affiliate) {
                              insert.billing_cycle = insertData.billing_cycle || '7 days';
                              insert.billing_start = nowIso;
                              insert.billing_end = cycleEndIso;
                            }
                            const { error } = await proxyTable('advertisements').insert(insert);
                            if (error) throw error;
                          }
                          finishSaved();
                        } catch (err: any) {
                          console.error('[Advert Save] failed:', err);
                          const timedOut = /timed out/i.test(err?.message || '');
                          if (timedOut) {
                            const saved = await findRecent();
                            if (saved) {
                              finishSaved();
                              return;
                            }
                          }
                          const code = err?.code ? ` (${err.code})` : '';
                          const hint = timedOut ? await (async () => {
                            const probe = await probeDb();
                            return timeoutHint(probe.blocked, probe.ok);
                          })() : '';
                          toast({ title: 'Error', description: `${err?.message || 'Failed to save ad'}${code}${hint}`, variant: 'destructive' });
                        }
                      }} className="bg-green-600 hover:bg-green-700">{adForm.id ? 'Update' : 'Create'}</Button>
                      <Button variant="outline" onClick={() => setShowAdForm(false)}>Cancel</Button>
                    </div>
                  </div>
                )}
                {adverts.length === 0 ? (
                  <p className="text-sm text-gray-400">No advertisements yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 px-3 font-medium text-gray-600">Image</th>
                          <th className="text-left py-2 px-3 font-medium text-gray-600">Title</th>
                          <th className="text-left py-2 px-3 font-medium text-gray-600">Destination</th>
                          <th className="text-center py-2 px-3 font-medium text-gray-600">Type</th>
                          <th className="text-center py-2 px-3 font-medium text-gray-600">Featured</th>
                          <th className="text-center py-2 px-3 font-medium text-gray-600">Clicks</th>
                          <th className="text-center py-2 px-3 font-medium text-gray-600">Impr.</th>
                          <th className="text-center py-2 px-3 font-medium text-gray-600">Active</th>
                          <th className="text-right py-2 px-3 font-medium text-gray-600">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adverts.filter(a => !searchAdverts || a.title?.toLowerCase().includes(searchAdverts.toLowerCase())).map(ad => (
                          <tr key={ad.id} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-2 px-3">
                              <img src={proxyImageUrl(ad.image_url)} alt="" className="w-16 h-10 rounded object-cover" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            </td>
                            <td className="py-2 px-3 text-gray-800 font-medium">{ad.title}</td>
                            <td className="py-2 px-3 text-gray-500 truncate max-w-[140px]">{ad.destination_url}</td>
                            <td className="py-2 px-3 text-center">{ad.is_affiliate ? <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-semibold rounded">Affiliate</span> : <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-semibold rounded">Managed</span>}</td>
                            <td className="py-2 px-3 text-center">
                              <button onClick={async () => {
                                try {
                                  const { error } = await proxyTable('advertisements').update({ featured: !(ad.featured ?? false) }, 'id', ad.id);
                                  if (error) throw error;
                                  loadAdverts();
                                } catch (err: any) {
                                  toast({ title: 'Error', description: err.message, variant: 'destructive' });
                                }
                              }} title="Featured = homepage carousel AND side rail; not featured = side rail only" className={`w-8 h-5 rounded-full transition-colors relative ${ad.featured ? 'bg-green-500' : 'bg-gray-300'}`}>
                                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${ad.featured ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                              </button>
                            </td>
                            <td className="py-2 px-3 text-center text-gray-600 text-xs font-mono">{ad.clicks || 0}</td>
                            <td className="py-2 px-3 text-center text-gray-600 text-xs font-mono">{ad.display_count || 0}</td>
                            <td className="py-2 px-3 text-center">
                              <button onClick={async () => {
                                await proxyTable('advertisements').update({ active: !ad.active }, 'id', ad.id);
                                loadAdverts();
                              }} className={`w-8 h-5 rounded-full transition-colors relative ${ad.active ? 'bg-green-500' : 'bg-gray-300'}`}>
                                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${ad.active ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                              </button>
                            </td>
                            <td className="py-2 px-3 text-right">
                              <button onClick={() => { setAdForm({ id: ad.id, title: ad.title, image_url: ad.image_url, images: ad.images?.length ? ad.images : (ad.image_url ? [ad.image_url] : []), destination_url: ad.destination_url || '', description: ad.description || '', cta_text: ad.cta_text || 'Learn More', whatsapp_number: ad.whatsapp_number || '', is_affiliate: ad.is_affiliate, featured: ad.featured ?? true, owner_email: ad.owner_email || '', slot: ad.slot || 'homepage_banner', billing_cycle: ad.billing_cycle || '7 days' }); setAdvUrlInput(''); setShowAdForm(true); }} className="text-xs text-blue-600 hover:text-blue-800 font-medium mr-3">Edit</button>
                              <button onClick={async () => {
                                if (!window.confirm(`Delete "${ad.title}"?`)) return;
                                try {
                                  const { error } = await proxyTable('advertisements').delete('id', ad.id);
                                  if (error) throw error;
                                  setAdverts(prev => prev.filter(a => a.id !== ad.id));
                                  toast({ title: 'Deleted', description: `"${ad.title}" removed` });
                                } catch (err: any) {
                                  toast({ title: 'Delete Error', description: err.message, variant: 'destructive' });
                                }
                              }} className="text-xs text-red-600 hover:text-red-800 font-medium">Delete</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          </div>
        </div>
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
                  defaultValue={editingJob?.category || (customJobCats.length > 0 ? customJobCats[0] : '')}
                  onValueChange={(val) => {
                    const el = document.getElementById('job_category_hidden') as HTMLInputElement;
                    if (el) el.value = val;
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                  <SelectContent>
                    {[...customJobCats].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <input type="hidden" id="job_category_hidden" name="category" defaultValue={editingJob?.category || (customJobCats.length > 0 ? customJobCats[0] : '')} />
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
                      <img src={optimizeImageUrl(img, 100, 100)} alt="" className="w-full h-full object-cover" />
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
                  defaultValue={editingAd?.category || (customServiceCats.length > 0 ? customServiceCats[0] : '')}
                  onValueChange={(val) => {
                    const el = document.getElementById('ad_category_hidden') as HTMLInputElement;
                    if (el) el.value = val;
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                  <SelectContent>
                    {[...customServiceCats].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <input type="hidden" id="ad_category_hidden" name="category" defaultValue={editingAd?.category || (customServiceCats.length > 0 ? customServiceCats[0] : '')} />
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
            <div>
              <Label>Advertiser Email (for billing invoices)</Label>
              <Input name="owner_email" type="email" defaultValue={editingAd?.owner_email || ''} placeholder="e.g. advertiser@example.com" />
              <p className="text-[11px] text-gray-400 mt-1">Used to send renewal alerts & invoices. Billing cycle follows the plan ({editingAd?.plan === '10-day' ? 'KES 300' : editingAd?.plan === '20-day' ? 'KES 500' : 'KES 800'}).</p>
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
                      <img src={optimizeImageUrl(img, 100, 100)} alt="" className="w-full h-full object-cover" />
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
                              <img src={optimizeImageUrl(cert, 100, 100)} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
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
                  <SelectItem value="advertiser">Advertiser</SelectItem>
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
              <Label>Certificates / Recommendation Letters (Max 3, PDF only)</Label>
              {certFiles.length > 0 && (
                <div className="flex gap-2 mb-2 flex-wrap">
                  {certFiles.map((file, i) => (
                    <div key={i} className="relative flex-shrink-0 rounded border border-blue-500 overflow-hidden">
                      {file.type.startsWith('image/') ? (
                        <img src={URL.createObjectURL(file)} alt="" className="w-16 h-16 object-cover" />
                      ) : (
                        <div className="w-16 h-16 flex items-center justify-center text-[10px] text-blue-700 font-semibold bg-blue-50 p-1 break-all text-center">{file.name}</div>
                      )}
                      <button type="button" onClick={() => setCertFiles(certFiles.filter((_, idx) => idx !== i))} className="absolute top-0 right-0 bg-red-500 text-white w-4 h-4 flex items-center justify-center text-[10px]">X</button>
                    </div>
                  ))}
                </div>
              )}
              {certPickError && <p className="text-xs text-red-600 mb-1">{certPickError}</p>}
              <input 
                type="file" 
                multiple 
                accept=".pdf"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                onChange={(e) => {
                  const files = e.target.files ? Array.from(e.target.files) : [];
                  const pdfs = files.filter(f => f.type === 'application/pdf');
                  const rejected = files.filter(f => f.type !== 'application/pdf');
                  setCertPickError(rejected.length > 0 ? `Only PDF certificates are supported. Skipped: ${rejected.map(f => f.name).join(', ')}` : null);
                  if (pdfs.length > 0) setCertFiles([...certFiles, ...pdfs].slice(0, 3));
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
                    <SelectItem value="advertiser">Advertiser</SelectItem>
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
                    <img src={optimizeImageUrl(editProfileImageFile ? URL.createObjectURL(editProfileImageFile) : editingUser.profile_image, 200, 200)} alt="" className="w-full h-full object-cover" />
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

      {/* Delete User Permanently Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={(open) => { if (!open) { setDeletingUser(null); setIsDeleteDialogOpen(false); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User Permanently</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete <strong>{deletingUser?.full_name}</strong>? This will remove their account and all profile data from the platform. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDeletingUser(null); setIsDeleteDialogOpen(false); }}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteUser} className="bg-red-600 hover:bg-red-700">Delete Permanently</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Password Dialog */}
      <Dialog open={isResetPwDialogOpen} onOpenChange={(open) => { if (!open) { setResetPwUser(null); setResetPwPassword(''); setIsResetPwDialogOpen(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set New Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-600">
              Setting password for <strong>{resetPwUser?.email}</strong>
            </p>
            <Input
              type="password"
              placeholder="New password (min 6 characters)"
              value={resetPwPassword}
              onChange={e => setResetPwPassword(e.target.value)}
              minLength={6}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setResetPwUser(null); setResetPwPassword(''); setIsResetPwDialogOpen(false); }}>
                Cancel
              </Button>
              <Button onClick={handleDirectPasswordReset} disabled={resettingPw || resetPwPassword.length < 6}>
                {resettingPw ? 'Resetting...' : 'Set Password'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Newsletter Builder Dialog */}
      <Dialog open={newsletterOpen} onOpenChange={(open) => { if (!open) setNewsletterOpen(false); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Newsletter</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500 -mt-2">Auto-captures this month's active Banners, Jobs and Services. Toggle which items to include, then preview before sending.</p>

          <div className="space-y-4">
            <div>
              <Label>Subject</Label>
              <Input value={newsletterSubject} onChange={e => setNewsletterSubject(e.target.value)} placeholder="Itukarua Monthly Digest — August 2026" />
            </div>
            <div>
              <Label>Intro Message</Label>
              <Textarea value={newsletterIntro} onChange={e => setNewsletterIntro(e.target.value)} rows={2} placeholder="Welcome message for subscribers..." />
            </div>

            {newsletterLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                <span className="ml-2 text-sm text-gray-500">Capturing latest content...</span>
              </div>
            ) : (
              <div className="space-y-4">
                <NewsletterSection
                  title="Banners"
                  icon="🏷️"
                  items={newsletterBanners}
                  selected={selBanners}
                  getLabel={b => b.title || b.business_name || 'Untitled banner'}
                  getThumb={b => Array.isArray(b.images) && b.images[0] ? b.images[0] : b.image_url}
                  onToggle={(id) => setSelBanners(prev => toggleSel(prev, id))}
                  onSelectAll={(on) => setSelBanners(on ? new Set(newsletterBanners.map(b => b.id)) : new Set())}
                />
                <NewsletterSection
                  title="Jobs"
                  icon="⭐"
                  items={newsletterJobs}
                  selected={selJobs}
                  getLabel={j => j.title || 'Untitled job'}
                  getThumb={j => Array.isArray(j.images) && j.images[0] ? j.images[0] : undefined}
                  getSub={j => `${j.location || ''}${j.budget_min ? ` • KES ${j.budget_min.toLocaleString()}${j.budget_max ? ` - ${j.budget_max.toLocaleString()}` : ''}` : ''}`}
                  onToggle={(id) => setSelJobs(prev => toggleSel(prev, id))}
                  onSelectAll={(on) => setSelJobs(on ? new Set(newsletterJobs.map(j => j.id)) : new Set())}
                />
                <NewsletterSection
                  title="Services"
                  icon="🌟"
                  items={newsletterServices}
                  selected={selServices}
                  getLabel={s => s.business_name || 'Untitled service'}
                  getThumb={s => Array.isArray(s.images) && s.images[0] ? s.images[0] : s.image}
                  getSub={s => `${s.category || ''}${s.location ? ` • ${s.location}` : ''}`}
                  onToggle={(id) => setSelServices(prev => toggleSel(prev, id))}
                  onSelectAll={(on) => setSelServices(on ? new Set(newsletterServices.map(s => s.id)) : new Set())}
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
            <Button variant="outline" onClick={() => setNewsletterOpen(false)}>Cancel</Button>
            <Button variant="secondary" disabled={newsletterLoading} onClick={() => {
              setPreviewHtml(buildNewsletter().html);
              setPreviewOpen(true);
            }}>
              Preview
            </Button>
            <Button disabled={sendingNewsletter || newsletterLoading} onClick={sendComposedNewsletter} className="bg-purple-600 hover:bg-purple-700">
              {sendingNewsletter ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {sendingNewsletter ? 'Sending...' : `Send to ${subscribers.length} Subscriber${subscribers.length === 1 ? '' : 's'}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Newsletter Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={(open) => { if (!open) setPreviewOpen(false); }}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Newsletter Preview</DialogTitle>
          </DialogHeader>
          <iframe
            title="Newsletter preview"
            srcDoc={previewHtml}
            className="w-full h-[70vh] bg-white border border-gray-200 rounded-lg"
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Close</Button>
            <Button disabled={sendingNewsletter} onClick={sendComposedNewsletter} className="bg-purple-600 hover:bg-purple-700">
              {sendingNewsletter ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {sendingNewsletter ? 'Sending...' : 'Send to Subscribers'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Billing Invoice Preview Dialog */}
      <Dialog open={!!billingPreviewItem} onOpenChange={(open) => { if (!open) setBillingPreviewItem(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Alert & Invoice Preview</DialogTitle>
          </DialogHeader>
          {billingPreviewItem && (
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600 mb-3 px-1">
              <span>To: <strong className="text-gray-900">{billingPreviewItem.owner_email}</strong></span>
              <span>Business: <strong className="text-gray-900">{billingPreviewItem.business_name}</strong></span>
              <span>Amount: <strong className="text-gray-900">KES {billingPreviewItem.amount}</strong></span>
              <span>Cycle: <strong className="text-gray-900">{billingPreviewItem.billing_cycle}</strong></span>
              {billingPreviewItem.billing_end && <span>Due: <strong className="text-gray-900">{new Date(billingPreviewItem.billing_end).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}</strong></span>}
            </div>
          )}
          <iframe
            title="Billing invoice preview"
            srcDoc={billingPreviewHtml}
            className="w-full h-[62vh] bg-white border border-gray-200 rounded-lg"
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
            <Button variant="outline" onClick={() => setBillingPreviewItem(null)}>Cancel</Button>
            <Button
              onClick={() => billingPreviewItem && sendBillingInvoice(billingPreviewItem)}
              disabled={!billingPreviewItem || (billingPreviewItem && billingSendingId === `${billingPreviewItem.item_type}:${billingPreviewItem.id}`)}
              className="bg-green-600 hover:bg-green-700"
            >
              {billingPreviewItem && billingSendingId === `${billingPreviewItem.item_type}:${billingPreviewItem.id}` ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              {billingPreviewItem && billingSendingId === `${billingPreviewItem.item_type}:${billingPreviewItem.id}` ? 'Sending...' : `Send Invoice to ${billingPreviewItem?.owner_email || ''}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

interface NewsletterSectionProps {
  title: string;
  icon: string;
  items: any[];
  selected: Set<string>;
  getLabel: (item: any) => string;
  getSub?: (item: any) => string;
  getThumb?: (item: any) => string | undefined;
  onToggle: (id: string) => void;
  onSelectAll: (on: boolean) => void;
}

const NewsletterSection: React.FC<NewsletterSectionProps> = ({ title, icon, items, selected, getLabel, getSub, getThumb, onToggle, onSelectAll }) => {
  const allSelected = items.length > 0 && items.every(i => selected.has(i.id));
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between bg-gray-50 px-3 py-2">
        <span className="text-sm font-semibold text-gray-800">{icon} {title} <span className="text-gray-400 font-normal">({selected.size}/{items.length})</span></span>
        <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
          <Checkbox checked={allSelected} onCheckedChange={(c) => onSelectAll(c === true)} />
          Select all
        </label>
      </div>
      <div className="max-h-40 overflow-y-auto divide-y divide-gray-100">
        {items.length === 0 ? (
          <p className="text-sm text-gray-400 px-3 py-3">No active {title.toLowerCase()} this month.</p>
        ) : items.map(item => (
          <label key={item.id} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-gray-50">
            <Checkbox checked={selected.has(item.id)} onCheckedChange={() => onToggle(item.id)} />
            {getThumb ? (
              <img src={getThumb(item)} alt="" className="w-10 h-10 rounded-md object-cover bg-gray-100" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            ) : <div className="w-10 h-10 rounded-md bg-gray-100 flex items-center justify-center text-gray-400 text-xs">NA</div>}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-800 font-medium truncate">{getLabel(item)}</p>
              {getSub ? <p className="text-xs text-gray-500 truncate">{getSub(item)}</p> : null}
            </div>
          </label>
        ))}
      </div>
    </div>
  );
};

export default AdminPage;





