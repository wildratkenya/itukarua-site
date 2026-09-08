import React, { useState, useEffect, useCallback } from 'react';
import { Building2, LayoutDashboard, BarChart3, User, Receipt, Users, Plus, X, Upload, Eye, EyeOff, Loader2, Zap, Crown, Settings, LogOut, ChevronDown, ChevronUp, ExternalLink, Trash2, Save } from 'lucide-react';
import { supabase, proxyRequest, proxyTable, proxyImageUrl } from '@/lib/supabase';
import { getMyCorporateAccount, getCorporateMembers, getCorporateAccountAds, getCorporateAdAnalytics, getCorporateInvoices, type DbCorporateAccount, type DbCorporateMember, type AdAnalyticsByAd } from '@/lib/database';
import { CORPORATE_TIER_FEATURES } from '@/data/siteData';
import { compressImage } from '@/lib/imageUtils';
import { cn } from '@/lib/utils';

interface CorporateDashboardProps {
  user: { id: string; name: string; email: string; role: string; profile?: any };
  onNavigate: (page: string) => void;
  onLogout: () => void;
}

type Tab = 'placements' | 'analytics' | 'profile' | 'billing' | 'team';

const SLOT_LABELS: Record<string, string> = {
  sitewide_strip: 'Site-wide Strip',
  category_strip: 'Category Strip',
  homepage_banner: 'Homepage Carousel',
  job_listings_top: 'Job Listings Top',
};

const CorporateDashboard: React.FC<CorporateDashboardProps> = ({ user, onNavigate, onLogout }) => {
  const [account, setAccount] = useState<DbCorporateAccount | null>(null);
  const [members, setMembers] = useState<DbCorporateMember[]>([]);
  const [ads, setAds] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<AdAnalyticsByAd[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('placements');
  const [tabLoading, setTabLoading] = useState(false);
  const [error, setError] = useState('');

  // Edit ad state
  const [editingAd, setEditingAd] = useState<any | null>(null);
  const [adForm, setAdForm] = useState({ title: '', description: '', cta_text: 'Learn More', whatsapp_number: '', destination_url: '', images: [] as string[] });
  const [adUploading, setAdUploading] = useState(false);

  // Create ad state
  const [showCreateAd, setShowCreateAd] = useState(false);
  const [createForm, setCreateForm] = useState({ title: '', description: '', cta_text: 'Learn More', whatsapp_number: '', destination_url: '', slot: '', images: [] as string[] });
  const [creatingAd, setCreatingAd] = useState(false);

  // Profile edit state
  const [profileForm, setProfileForm] = useState({ company_name: '', contact_person: '', contact_phone: '', contact_email: '', billing_email: '' });
  const [savingProfile, setSavingProfile] = useState(false);

  // Add member state
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberForm, setMemberForm] = useState({ email: '', password: '', full_name: '' });
  const [addingMember, setAddingMember] = useState(false);

  const tierFeatures = account ? CORPORATE_TIER_FEATURES[account.tier] || CORPORATE_TIER_FEATURES.bronze : CORPORATE_TIER_FEATURES.bronze;
  const isOwner = !!members.find(m => m.profile_id === user.id && m.member_role === 'owner');

  const loadAccount = useCallback(async () => {
    try {
      const acct = await getMyCorporateAccount(user.id);
      setAccount(acct);
      if (acct) {
        setProfileForm({ company_name: acct.company_name, contact_person: acct.contact_person || '', contact_phone: acct.contact_phone || '', contact_email: acct.contact_email || '', billing_email: acct.billing_email || '' });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load account');
    }
  }, [user.id]);

  const loadAds = useCallback(async () => {
    if (!account) return;
    try { setAds(await getCorporateAccountAds(account.id)); } catch {}
  }, [account]);

  const loadMembers = useCallback(async () => {
    if (!account) return;
    try { setMembers(await getCorporateMembers(account.id)); } catch {}
  }, [account]);

  const loadAnalytics = useCallback(async () => {
    if (!account) return;
    try { setAnalytics(await getCorporateAdAnalytics(account.id)); } catch {}
  }, [account]);

  const loadInvoices = useCallback(async () => {
    if (!account) return;
    try { setInvoices(await getCorporateInvoices(account.id)); } catch {}
  }, [account]);

  useEffect(() => { loadAccount().then(() => setLoading(false)); }, [loadAccount]);
  useEffect(() => { if (account) loadAds(); }, [account, loadAds]);
  useEffect(() => { if (account) loadMembers(); }, [account, loadMembers]);
  useEffect(() => { if (account && activeTab === 'analytics') loadAnalytics(); }, [account, activeTab, loadAnalytics]);
  useEffect(() => { if (account && activeTab === 'billing') loadInvoices(); }, [account, activeTab, loadInvoices]);

  const uploadImages = async (files: File[]): Promise<string[]> => {
    const urls: string[] = [];
    for (const file of files) {
      const compressed = await compressImage(file);
      const fileName = `corp_${Date.now()}_${compressed.name.replace(/[^a-zA-Z0-9._-]/g, '')}`;
      const { error } = await supabase.storage.from('adverts').upload(fileName, compressed);
      if (!error) urls.push(supabase.storage.from('adverts').getPublicUrl(fileName).data.publicUrl);
    }
    return urls;
  };

  const handleSaveAd = async () => {
    if (!editingAd) return;
    setAdUploading(true);
    try {
      const { error } = await proxyTable('advertisements').update({
        title: adForm.title, description: adForm.description, cta_text: adForm.cta_text,
        whatsapp_number: adForm.whatsapp_number, destination_url: adForm.destination_url,
        images: adForm.images.length > 0 ? adForm.images : undefined,
        image_url: adForm.images[0] || editingAd.image_url,
      }, 'id', editingAd.id);
      if (error) throw error;
      setEditingAd(null);
      await loadAds();
    } catch (err: any) { alert(err.message); }
    finally { setAdUploading(false); }
  };

  const handleCreateAd = async (files: File[]) => {
    if (!account || !createForm.slot) return;
    setCreatingAd(true);
    try {
      const imageUrls = files.length > 0 ? await uploadImages(files) : [];
      const features = CORPORATE_TIER_FEATURES[account.tier];
      const { error } = await proxyTable('advertisements').insert({
        title: createForm.title, description: createForm.description, cta_text: createForm.cta_text,
        whatsapp_number: createForm.whatsapp_number, destination_url: createForm.destination_url,
        image_url: imageUrls[0] || '', images: imageUrls.length > 0 ? imageUrls : [],
        slot: createForm.slot, corporate_account_id: account.id, corporate_tier: account.tier, active: true,
        featured: features?.featured || false, is_affiliate: false,
      });
      if (error) throw error;
      setShowCreateAd(false);
      setCreateForm({ title: '', description: '', cta_text: 'Learn More', whatsapp_number: '', destination_url: '', slot: '', images: [] });
      await loadAds();
    } catch (err: any) { alert(err.message); }
    finally { setCreatingAd(false); }
  };

  const handleToggleActive = async (ad: any) => {
    try {
      await proxyTable('advertisements').update({ active: !ad.active }, 'id', ad.id);
      setAds(prev => prev.map(a => a.id === ad.id ? { ...a, active: !a.active } : a));
    } catch (err: any) { alert(err.message); }
  };

  const handleSaveProfile = async () => {
    if (!account) return;
    setSavingProfile(true);
    try {
      const { error } = await proxyTable('corporate_accounts').update({
        company_name: profileForm.company_name, contact_person: profileForm.contact_person,
        contact_phone: profileForm.contact_phone, contact_email: profileForm.contact_email,
        billing_email: profileForm.billing_email,
      }, 'id', account.id);
      if (error) throw error;
      setAccount(prev => prev ? { ...prev, ...profileForm } as DbCorporateAccount : prev);
    } catch (err: any) { alert(err.message); }
    finally { setSavingProfile(false); }
  };

  const handleAddMember = async () => {
    if (!account) return;
    setAddingMember(true);
    try {
      const supabaseUrl = (await import('@/lib/supabase')).supabaseUrl;
      const supabaseKey = (await import('@/lib/supabase')).supabaseKey;
      const token = (await import('@/lib/supabase')).getLocalToken();
      const res = await fetch(`${supabaseUrl}/functions/v1/create-corporate-member`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', apikey: supabaseKey, Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: memberForm.email, password: memberForm.password, full_name: memberForm.full_name, account_id: account.id }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to add member');
      setShowAddMember(false);
      setMemberForm({ email: '', password: '', full_name: '' });
      await loadMembers();
    } catch (err: any) { alert(err.message); }
    finally { setAddingMember(false); }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Remove this team member?')) return;
    try {
      const { error } = await proxyRequest(`/rest/v1/corporate_members?id=eq.${memberId}`, 'DELETE');
      if (error) throw error;
      await loadMembers();
    } catch (err: any) { alert(err.message); }
  };

  if (loading) return <div className="flex items-center justify-center py-32"><div className="w-12 h-12 border-4 border-green-200 border-t-green-600 rounded-full animate-spin" /></div>;

  if (!account) return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-gray-900 mb-2">No Corporate Account</h2>
        <p className="text-sm text-gray-500 mb-4">Your account hasn't been assigned to a corporate account yet. Contact your administrator.</p>
        <button onClick={onLogout} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Log out</button>
      </div>
    </div>
  );

  if (!account.is_active) return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 max-w-md w-full p-10 text-center">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5"><Building2 className="w-8 h-8 text-red-500" /></div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Account Suspended</h1>
        <p className="text-sm text-gray-500 mb-6">Your corporate account has been suspended. Please contact your account manager to reactivate.</p>
        <button onClick={onLogout} className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors">Log out</button>
      </div>
    </div>
  );

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'placements', label: 'Placements', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'profile', label: 'Profile', icon: <Settings className="w-4 h-4" /> },
    { id: 'billing', label: 'Billing', icon: <Receipt className="w-4 h-4" /> },
    { id: 'team', label: 'Team', icon: <Users className="w-4 h-4" /> },
  ];

  const currentTabLabel = tabs.find(t => t.id === activeTab)?.label || '';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-xl sm:text-2xl font-bold">{account.company_name}</h1>
                <span className="px-2 py-0.5 bg-amber-400/20 text-amber-300 text-xs font-bold rounded-full uppercase flex items-center gap-1"><Crown className="w-3 h-3" /> {account.tier}</span>
              </div>
              <p className="text-sm text-gray-400">Corporate Panel</p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={onLogout} className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors"><LogOut className="w-4 h-4" /> Log out</button>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex overflow-x-auto -mb-px gap-1 sm:gap-0">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={cn('flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors',
                  activeTab === tab.id ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300')}>
                {tab.icon} {tab.label}
                {tab.id === 'placements' && <span className="ml-1 px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-bold rounded-full">{ads.length}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* ── PLACEMENTS TAB ── */}
        {activeTab === 'placements' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">{ads.length} placement{ads.length !== 1 ? 's' : ''} · {tierFeatures.maxPlacements < 99 ? `max ${tierFeatures.maxPlacements}` : 'unlimited'} · slots: {tierFeatures.slots.map(s => SLOT_LABELS[s] || s).join(', ')}</p>
              {ads.length < tierFeatures.maxPlacements && (
                <button onClick={() => setShowCreateAd(true)} className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"><Plus className="w-4 h-4" /> New Placement</button>
              )}
            </div>
            {ads.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-10 text-center">
                <LayoutDashboard className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-400 mb-4">No placements yet. Create your first one to get started.</p>
                <button onClick={() => setShowCreateAd(true)} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg">Create Placement</button>
              </div>
            ) : (
              <div className="space-y-3">
                {ads.map(ad => (
                  <div key={ad.id} className="bg-white rounded-xl border border-gray-100 p-4 sm:p-5">
                    <div className="flex items-start gap-4">
                      <img src={proxyImageUrl(ad.image_url)} alt="" className="w-20 h-14 sm:w-28 sm:h-[72px] object-cover rounded-lg bg-gray-100 flex-shrink-0" onError={e => { (e.target as HTMLImageElement).style.opacity = '0'; }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900 truncate">{ad.title}</h3>
                          <span className={cn('px-2 py-0.5 text-[10px] font-bold rounded-full uppercase', ad.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500')}>{ad.active ? 'Live' : 'Paused'}</span>
                          <span className="px-2 py-0.5 bg-gray-50 text-gray-500 text-[10px] font-medium rounded-full">{SLOT_LABELS[ad.slot] || ad.slot}</span>
                        </div>
                        {ad.description && <p className="text-xs text-gray-500 line-clamp-1 mb-2">{ad.description}</p>}
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                          {ad.display_count != null && <span>👁 {ad.display_count}</span>}
                          {ad.billing_end && <span>Ends {new Date(ad.billing_end).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => { setEditingAd(ad); setAdForm({ title: ad.title, description: ad.description || '', cta_text: ad.cta_text || 'Learn More', whatsapp_number: ad.whatsapp_number || '', destination_url: ad.destination_url || '', images: ad.images || [] }); }} className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Edit</button>
                        <button onClick={() => handleToggleActive(ad)} className={cn('px-3 py-1.5 text-xs font-medium rounded-lg transition-colors', ad.active ? 'text-amber-700 bg-amber-50 hover:bg-amber-100' : 'text-white bg-green-600 hover:bg-green-700')}>{ad.active ? 'Pause' : 'Activate'}</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── ANALYTICS TAB ── */}
        {activeTab === 'analytics' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Performance across all placements (last 30 days)</p>
            {analytics.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-10 text-center">
                <BarChart3 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-400">No analytics data yet. Data appears once your placements start serving.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {analytics.map(a => (
                  <div key={a.adId} className="bg-white rounded-xl border border-gray-100 p-5">
                    <h3 className="font-semibold text-gray-900 text-sm mb-3">{a.title}</h3>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="bg-blue-50 rounded-lg p-3 text-center">
                        <p className="text-xl font-bold text-blue-600">{a.totalImpressions}</p>
                        <p className="text-[11px] text-blue-500 font-medium">Impressions</p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-3 text-center">
                        <p className="text-xl font-bold text-green-600">{a.totalClicks}</p>
                        <p className="text-[11px] text-green-500 font-medium">Clicks</p>
                      </div>
                    </div>
                    {a.data.length > 0 && tierFeatures.analyticsDepth === 'full' && (
                      <div className="text-xs text-gray-400">
                        {a.data.slice(-7).map(d => (
                          <div key={d.date} className="flex justify-between py-0.5"><span>{d.date}</span><span>{d.impressions} imp / {d.clicks} clk</span></div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── PROFILE TAB ── */}
        {activeTab === 'profile' && (
          <div className="bg-white rounded-xl border border-gray-100 p-6 max-w-2xl">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Company Profile</h2>
            <p className="text-sm text-gray-500 mb-6">Update your company details and billing email.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                <input value={profileForm.company_name} onChange={e => setProfileForm(p => ({ ...p, company_name: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
                  <input value={profileForm.contact_person} onChange={e => setProfileForm(p => ({ ...p, contact_person: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
                  <input value={profileForm.contact_phone} onChange={e => setProfileForm(p => ({ ...p, contact_phone: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
                  <input value={profileForm.contact_email} onChange={e => setProfileForm(p => ({ ...p, contact_email: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Billing Email</label>
                  <input value={profileForm.billing_email} onChange={e => setProfileForm(p => ({ ...p, billing_email: e.target.value }))} placeholder="For invoices" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                </div>
              </div>
              <button onClick={handleSaveProfile} disabled={savingProfile || !isOwner} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                {savingProfile ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save Changes</>}
              </button>
              {!isOwner && <p className="text-[11px] text-amber-600">Only the account owner can edit company details.</p>}
            </div>
          </div>
        )}

        {/* ── BILLING TAB ── */}
        {activeTab === 'billing' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Payment and invoice history for your placements.</p>
            {invoices.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-10 text-center">
                <Receipt className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-400">No invoices yet.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Description</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Amount</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                  </tr></thead>
                  <tbody>
                    {invoices.map((inv: any) => (
                      <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="px-4 py-3 text-gray-600">{new Date(inv.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                        <td className="px-4 py-3 text-gray-900 font-medium">{inv.description || inv.payment_type}</td>
                        <td className="px-4 py-3 text-gray-900">KES {Number(inv.amount).toLocaleString()}</td>
                        <td className="px-4 py-3"><span className={cn('px-2 py-0.5 text-[10px] font-bold rounded-full uppercase', inv.status === 'completed' ? 'bg-green-50 text-green-700' : inv.status === 'pending' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-500')}>{inv.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── TEAM TAB ── */}
        {activeTab === 'team' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">{members.length} member{members.length !== 1 ? 's' : ''} · max {tierFeatures.teamSeats}</p>
              {members.length < tierFeatures.teamSeats && isOwner && (
                <button onClick={() => setShowAddMember(true)} className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"><Plus className="w-4 h-4" /> Add Member</button>
              )}
              {!isOwner && <p className="text-[11px] text-amber-600">Only the account owner can manage team members.</p>}
            </div>
            <div className="space-y-2">
              {members.map(m => (
                <div key={m.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{m.full_name || m.email}</p>
                    <p className="text-xs text-gray-500">{m.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-bold rounded-full uppercase">{m.member_role}</span>
                    {m.member_role !== 'owner' && m.profile_id !== user.id && (
                      <button onClick={() => handleRemoveMember(m.id)} className="p-1 text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── EDIT AD MODAL ── */}
      {editingAd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setEditingAd(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Edit Placement</h2>
              <button onClick={() => setEditingAd(null)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input value={adForm.title} onChange={e => setAdForm(p => ({ ...p, title: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={adForm.description} onChange={e => setAdForm(p => ({ ...p, description: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">CTA Text</label>
                  <input value={adForm.cta_text} onChange={e => setAdForm(p => ({ ...p, cta_text: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp Number</label>
                  <input value={adForm.whatsapp_number} onChange={e => setAdForm(p => ({ ...p, whatsapp_number: e.target.value }))} placeholder="2547XX..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" /></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Destination URL</label>
                <input value={adForm.destination_url} onChange={e => setAdForm(p => ({ ...p, destination_url: e.target.value }))} placeholder="https://..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" /></div>
              {tierFeatures.multiImages && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Images (upload new to replace)</label>
                  <input type="file" accept="image/*" multiple onChange={async (e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length > 0) {
                      setAdUploading(true);
                      const urls = await uploadImages(files);
                      setAdForm(p => ({ ...p, images: urls.length > 0 ? urls : p.images }));
                      setAdUploading(false);
                    }
                  }} className="w-full text-sm" />
                </div>
              )}
              <button onClick={handleSaveAd} disabled={adUploading} className="w-full py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2">
                {adUploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CREATE AD MODAL ── */}
      {showCreateAd && (
        <CreateAdModal account={account} features={tierFeatures} form={createForm} setForm={setCreateForm} loading={creatingAd}
          onSubmit={async (files: File[]) => { await handleCreateAd(files); }}
          onClose={() => setShowCreateAd(false)} uploadImages={uploadImages} />
      )}

      {/* ── ADD MEMBER MODAL ── */}
      {showAddMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowAddMember(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Add Team Member</h2>
              <button onClick={() => setShowAddMember(false)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input value={memberForm.full_name} onChange={e => setMemberForm(p => ({ ...p, full_name: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={memberForm.email} onChange={e => setMemberForm(p => ({ ...p, email: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input type="password" value={memberForm.password} onChange={e => setMemberForm(p => ({ ...p, password: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" /></div>
              <button onClick={handleAddMember} disabled={addingMember || !memberForm.email || !memberForm.password}
                className="w-full py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2">
                {addingMember ? <><Loader2 className="w-4 h-4 animate-spin" /> Adding...</> : 'Add Member'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Create Ad Modal (extracted to avoid deep nesting) ────────────────────────────

function CreateAdModal({ account, features, form, setForm, loading, onSubmit, onClose, uploadImages }: {
  account: DbCorporateAccount; features: typeof CORPORATE_TIER_FEATURES.bronze;
  form: { title: string; description: string; cta_text: string; whatsapp_number: string; destination_url: string; slot: string; images: string[] };
  setForm: React.Dispatch<React.SetStateAction<any>>; loading: boolean;
  onSubmit: (files: File[]) => Promise<void>; onClose: () => void;
  uploadImages: (files: File[]) => Promise<string[]>;
}) {
  const [files, setFiles] = useState<File[]>([]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">New Placement</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Placement Slot *</label>
            <select value={form.slot} onChange={e => setForm((p: any) => ({ ...p, slot: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none">
              <option value="">Choose a slot…</option>
              {features.slots.map(s => <option key={s} value={s}>{SLOT_LABELS[s] || s}</option>)}
            </select></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input value={form.title} onChange={e => setForm((p: any) => ({ ...p, title: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm((p: any) => ({ ...p, description: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">CTA Text</label>
              <input value={form.cta_text} onChange={e => setForm((p: any) => ({ ...p, cta_text: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
              <input value={form.whatsapp_number} onChange={e => setForm((p: any) => ({ ...p, whatsapp_number: e.target.value }))} placeholder="2547XX..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" /></div>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Destination URL</label>
            <input value={form.destination_url} onChange={e => setForm((p: any) => ({ ...p, destination_url: e.target.value }))} placeholder="https://..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Images</label>
            <input type="file" accept="image/*" multiple onChange={e => setFiles(Array.from(e.target.files || []))} className="w-full text-sm" /></div>
          <button onClick={() => onSubmit(files)} disabled={loading || !form.title || !form.slot}
            className="w-full py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : 'Create Placement'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CorporateDashboard;
