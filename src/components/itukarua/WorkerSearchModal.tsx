import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Star, MapPin, Lock, Phone, Mail, Award, FileText, Loader2, Shield, ChevronDown, ChevronUp, Key, Zap, Crown, ThumbsUp, ThumbsDown } from 'lucide-react';
import { getProfiles, getCustomCategories, trackProfileView, checkContactAccess, redeemToken, checkSubscriptionActive, hasEntitlement, getProfileContact, getContactAccessConfig, CONTACT_ACCESS_FEE_DEFAULT, CONTACT_ACCESS_WINDOW_HOURS_DEFAULT } from '@/lib/database';
import { supabase, optimizeImageUrl, handleImageError } from '@/lib/supabase';
import { KENYA_COUNTIES, PRICING_PLANS } from '@/data/siteData';
import { isPremiumOrFeatured } from '@/lib/utils';
import CertificateViewer from './CertificateViewer';
import type { MpesaHandler } from '@/lib/mpesa';

interface WorkerSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAuth?: (tab: 'login' | 'signup') => void;
  onNavigate?: (page: string) => void;
  onOpenMpesa?: MpesaHandler;
  onOpenEmployerPayment?: (jobId?: string, jobTitle?: string, onComplete?: () => void) => void;
  onNeedAuth?: () => void;
}

const WorkerSearchModal: React.FC<WorkerSearchModalProps> = ({ isOpen, onClose, onOpenAuth, onNavigate, onOpenMpesa, onOpenEmployerPayment, onNeedAuth }) => {
  const [query, setQuery] = useState('');
  const [selectedCounty, setSelectedCounty] = useState('');
  const [location, setLocation] = useState('');
  const [selectedSkill, setSelectedSkill] = useState('');
  const [workers, setWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [showSubscriptionPrompt, setShowSubscriptionPrompt] = useState(false);
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());
  const [workerDetails, setWorkerDetails] = useState<Map<string, any>>(new Map());
  const [dbJobCats, setDbJobCats] = useState<string[]>([]);
  const [dbServiceCats, setDbServiceCats] = useState<string[]>([]);
  const [expandedCv, setExpandedCv] = useState<Set<string>>(new Set());
  const [viewerCert, setViewerCert] = useState<string | null>(null);
  const allSkills = React.useMemo(
    () => [...new Set([...dbJobCats, ...dbServiceCats])].sort(),
    [dbJobCats, dbServiceCats]
  );
  const searchRef = useRef<HTMLInputElement>(null);

  const refreshAuth = async (authUser: any) => {
    setUser(authUser);
    if (authUser) {
      const { data: profile } = await supabase.from('profiles').select('role, registration_paid, subscription_expires_at').eq('id', authUser.id).maybeSingle();
      const isAdminOrSuper = profile?.role === 'admin' || profile?.role === 'super_admin';
      if (isAdminOrSuper) {
        setHasSubscription(true);
      } else {
        const isEmployer = profile?.role === 'employer';
        const employerEnt = await hasEntitlement(authUser.id, 'employer');
        if (isEmployer) {
          const paidReg = !!profile?.registration_paid;
          const subActive = profile?.subscription_expires_at ? new Date(profile.subscription_expires_at).getTime() > Date.now() : false;
          setHasSubscription(employerEnt || (paidReg && subActive));
        } else {
          const active = employerEnt || (await hasEntitlement(authUser.id, 'jobseeker')) || (await checkSubscriptionActive(authUser.id));
          setHasSubscription(active);
        }
      }
    } else {
      setHasSubscription(false);
    }
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => refreshAuth(data.user));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      refreshAuth(session?.user ?? null);
    });
    return () => listener?.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    getCustomCategories('job').then(setDbJobCats);
    getCustomCategories('service').then(setDbServiceCats);
  }, []);

  // Contact details are only ever read through the server-side gate, which
  // enforces both the payment window and the jobseeker's consent flag.
  const loadContact = async (profileId: string): Promise<boolean> => {
    const result = await getProfileContact(profileId);
    if (!result) return false;
    if (!result.allowed) {
      setOptedOutIds(prev => new Set(prev).add(profileId));
      return false;
    }
    setUnlockedIds(prev => new Set(prev).add(profileId));
    setWorkerDetails(prev => {
      const next = new Map(prev);
      next.set(profileId, {
        phone: result.contact?.phone || '',
        email: result.contact?.email || '',
        whatsapp_number: result.contact?.whatsapp || '',
        location: result.contact?.location || '',
        county: result.contact?.county || '',
        subcounty: result.contact?.subcounty || '',
        certificates: result.certificates || [],
        resume: result.resume || '',
        access_expires_at: result.expiresAt || null,
      });
      return next;
    });
    return true;
  };

  useEffect(() => {
    if (!isOpen || !user || workers.length === 0) return;
    workers.forEach(async (w) => {
      try {
        // A live subscription covers every contact, so skip the per-worker
        // payment check and go straight to the reveal.
        if (hasSubscription) {
          await loadContact(w.id);
          return;
        }
        const hasAccess = await checkContactAccess(user.id, w.id);
        if (hasAccess) await loadContact(w.id);
      } catch (err) {
        console.error('[WorkerSearch] access check failed:', err);
      }
    });
  }, [workers, user, isOpen, hasSubscription]);

  useEffect(() => {
    console.log('[WorkerSearch] isOpen changed to', isOpen);
    if (!isOpen) {
      setQuery('');
      setSelectedCounty('');
      setLocation('');
      setSelectedSkill('');
      setWorkers([]);
      setShowSubscriptionPrompt(false);
      return;
    }
    fetchWorkers();
    setTimeout(() => searchRef.current?.focus(), 100);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const delay = setTimeout(() => fetchWorkers(), 300);
    return () => clearTimeout(delay);
  }, [query, selectedCounty, selectedSkill, location, isOpen]);

  const fetchWorkers = async () => {
    setLoading(true);
    try {
      const searchQuery = selectedSkill ? [...query.split(/\s+/).filter(Boolean), selectedSkill].join(' ') : query;
      console.log('[WorkerSearch] fetchWorkers called', { selectedSkill, query, searchQuery, selectedCounty, location: location.trim() });
      const results = await getProfiles({
        role: 'jobseeker',
        county: selectedCounty || undefined,
        location: location.trim() || undefined,
        search: searchQuery.trim() || undefined,
        limit: 30,
      });
      console.log('[WorkerSearch] getProfiles returned', results?.length, 'results');
      setWorkers(results || []);
    } catch (err) {
      console.error('[WorkerSearch] Error fetching workers:', err);
      setWorkers([]);
    } finally {
      setLoading(false);
    }
  };

  const [unlockMsg, setUnlockMsg] = useState('');
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);
  const [showRedeemInput, setShowRedeemInput] = useState(false);
  const [redeemTokenValue, setRedeemTokenValue] = useState('');
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemMsg, setRedeemMsg] = useState('');
  const [optedOutIds, setOptedOutIds] = useState<Set<string>>(new Set());
  const [contactTarget, setContactTarget] = useState<any>(null);
  const [contactFee, setContactFee] = useState(CONTACT_ACCESS_FEE_DEFAULT);
  const [contactWindowHours, setContactWindowHours] = useState(CONTACT_ACCESS_WINDOW_HOURS_DEFAULT);

  useEffect(() => {
    if (!isOpen) return;
    getContactAccessConfig()
      .then(cfg => { setContactFee(cfg.fee); setContactWindowHours(cfg.windowHours); })
      .catch(() => {});
  }, [isOpen]);

  const handleUnlock = (worker: any) => {
    if (!user) {
      setShowGuestPrompt(true);
      return;
    }
    if (user?.role === 'admin' || user?.role === 'super_admin') return;
    if (!hasSubscription) {
      setShowSubscriptionPrompt(true);
      return;
    }
  };

  // Per-contact unlock: pay once, see this worker for the window, no
  // subscription required.
  const handleUnlockThisContact = (worker: any) => {
    if (!user) {
      setShowGuestPrompt(true);
      return;
    }
    if (worker.allow_contact_display === false) return;
    setContactTarget(worker);
  };

  const handleConfirmContactPurchase = () => {
    const worker = contactTarget;
    setContactTarget(null);
    if (!worker) return;
    onOpenMpesa?.(
      contactFee,
      `One-Day Access — ${worker.full_name}`,
      'ITK-CONTACT',
      'contact_access',
      undefined,
      undefined,
      worker.id,
      () => { loadContact(worker.id); },
    );
  };

  const handleGuestSignIn = () => {
    setShowGuestPrompt(false);
    onClose();
    onNeedAuth?.();
    onOpenAuth?.('login');
  };

  const handleGuestSubscribe = () => {
    setShowGuestPrompt(false);
    onClose();
    onNeedAuth?.();
    onOpenAuth?.('signup');
  };

  const handleSubscribe = () => {
    setShowSubscriptionPrompt(false);
    if (onOpenEmployerPayment) {
      onOpenEmployerPayment(undefined, undefined, () => {
        setHasSubscription(true);
      });
    } else {
      onOpenMpesa?.(200, 'Employer Weekly Access', 'EMP-WK', 'registration', undefined, undefined, undefined, () => {
        setHasSubscription(true);
      }, false, false, null, 'employer');
    }
  };

  const handleRedeemToken = async () => {
    const token = redeemTokenValue.trim().toUpperCase();
    if (!token || token.length < 8) { setRedeemMsg('Enter a valid token (e.g. ITK-XXXXXXXX)'); return; }
    setRedeemLoading(true);
    setRedeemMsg('');
    try {
      // The RPC validates the token, checks the window has not lapsed, and
      // binds a guest purchase to the signed-in account.
      const result = await redeemToken(token);
      if (!result) { setRedeemMsg('Invalid or expired token.'); setRedeemLoading(false); return; }
      const revealed = await loadContact(result.profileId);
      if (!revealed) { setRedeemMsg('This worker has chosen not to share contact details.'); setRedeemLoading(false); return; }
      const until = result.expiresAt
        ? new Date(result.expiresAt).toLocaleString('en-KE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
        : '';
      setRedeemMsg(until ? `Unlocked until ${until}.` : 'Unlocked.');
      setShowRedeemInput(false);
      setRedeemTokenValue('');
    } catch {
      setRedeemMsg('Something went wrong. Try again.');
    } finally {
      setRedeemLoading(false);
    }
  };

  const handlePaymentComplete = async () => {
    setHasSubscription(true);
  };

  const getInitial = (worker: any) => {
    const s = typeof worker.skills === 'string' ? worker.skills.split(',')[0]?.trim() : worker.skills?.[0];
    return ((s && s[0]) || 'W').toUpperCase();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 sm:pt-20 bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900">Find a Worker</h2>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowRedeemInput(!showRedeemInput)} className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium transition-colors">
                <Key className="w-3.5 h-3.5" />
                Have a token?
              </button>
              <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
          </div>

          {showRedeemInput && (
            <div className="px-4 py-3 border-b border-gray-100 bg-green-50">
              <p className="text-xs text-green-700 mb-2 font-medium">Enter your access token to unlock a previously paid contact:</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={redeemTokenValue}
                  onChange={e => setRedeemTokenValue(e.target.value.toUpperCase())}
                  placeholder="ITK-XXXXXXXX"
                  className="flex-1 px-3 py-2 border border-green-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-green-500 outline-none bg-white"
                />
                <button onClick={handleRedeemToken} disabled={redeemLoading} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1">
                  {redeemLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                  Redeem
                </button>
              </div>
              {redeemMsg && <p className="text-xs text-red-500 mt-1.5">{redeemMsg}</p>}
            </div>
          )}

          <div className="p-4 border-b border-gray-100 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search by name or skill..."
                className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none"
              />
            </div>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="Town, area or estate..."
                className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={selectedCounty}
                onChange={e => setSelectedCounty(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none bg-white"
              >
                <option value="">All Counties</option>
                {KENYA_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select
                value={selectedSkill}
                onChange={e => setSelectedSkill(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none bg-white"
              >
                <option value="">All Skills</option>
                {allSkills.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-green-600" />
              </div>
            )}

            {!loading && workers.length === 0 && (
              <div className="text-center py-12">
                <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">No workers found. Try adjusting your filters.</p>
              </div>
            )}

            {!loading && workers.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-400 mb-2">{workers.length} worker{workers.length !== 1 ? 's' : ''} found</p>
                {workers.map(worker => {
                  const isUnlocked = hasSubscription || unlockedIds.has(worker.id);
                  const details = workerDetails.get(worker.id);
                  const skills = typeof worker.skills === 'string' ? worker.skills.split(',').map((s: string) => s.trim()).filter(Boolean) : Array.isArray(worker.skills) ? worker.skills : [];
                  return (
                    <div key={worker.id} className="bg-white border border-gray-100 rounded-xl p-3 hover:border-gray-200 transition-colors">
                      <div className="flex items-start gap-3">
                        {worker.profile_image ? (
                          <img src={optimizeImageUrl(worker.profile_image, 96, 96)} alt={worker.full_name} className="w-12 h-12 rounded-full object-cover ring-2 ring-gray-100 flex-shrink-0" onError={handleImageError} />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center ring-2 ring-gray-100 flex-shrink-0">
                            <span className="text-lg font-bold text-green-700">{getInitial(worker)}</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-gray-900 text-sm truncate">{worker.full_name}</h4>
                            {isPremiumOrFeatured(worker) && <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded flex items-center gap-0.5"><Zap className="w-2.5 h-2.5" />Featured</span>}
                            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-medium rounded">Jobseeker</span>
                            {worker.verified && <Shield className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {skills.slice(0, 3).map((skill: string, i: number) => (
                              <span key={i} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded">{skill}</span>
                            ))}
                            {skills.length > 3 && <span className="text-[10px] text-gray-400">+{skills.length - 3} more</span>}
                          </div>
                          <div className="flex items-center gap-3 mt-1.5">
                            <div className="flex items-center gap-1">
                              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                              <span className="text-xs font-medium text-gray-700">{Number(worker.rating) || 0}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px]">
                              <span className="inline-flex items-center gap-0.5 text-green-600"><ThumbsUp className="w-3 h-3" /> {Number(worker.likes_count) || 0}</span>
                              <span className="inline-flex items-center gap-0.5 text-red-500"><ThumbsDown className="w-3 h-3" /> {Number(worker.dislikes_count) || 0}</span>
                            </div>
                            {worker.location && (
                              <div className="flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-gray-400" />
                                <span className="text-xs text-gray-400">{worker.county || worker.location}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        {!isUnlocked && (
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            {worker.allow_contact_display === false ? (
                              <span className="text-[10px] text-gray-400 text-right max-w-[9rem] leading-tight">
                                Contact details not shared
                              </span>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleUnlockThisContact(worker)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors"
                                >
                                  <Key className="w-3 h-3" />
                                  KES {contactFee} — 24h access
                                </button>
                                <button
                                  onClick={() => handleUnlock(worker)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-semibold rounded-lg transition-colors"
                                >
                                  <Lock className="w-3 h-3" />
                                  Subscribe to all
                                </button>
                              </>
                            )}
                          </div>
                        )}
                        {isUnlocked && hasSubscription && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 text-[10px] font-semibold rounded-lg flex-shrink-0">
                            <Crown className="w-3 h-3" /> Subscribed
                          </div>
                        )}
                        {isUnlocked && !hasSubscription && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 text-[10px] font-semibold rounded-lg flex-shrink-0">
                            <Key className="w-3 h-3" /> {contactWindowHours}h access
                          </div>
                        )}
                      </div>

                      {isUnlocked && optedOutIds.has(worker.id) && (
                        <p className="text-xs text-gray-400 italic mt-2">
                          This worker has chosen not to share their contact details.
                        </p>
                      )}

                      {isUnlocked && details && (
                        <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            {details.phone && <p className="flex items-center gap-1.5 text-gray-700"><Phone className="w-3.5 h-3.5 text-green-600" /> {details.phone}</p>}
                            {details.email && <p className="flex items-center gap-1.5 text-gray-700"><Mail className="w-3.5 h-3.5 text-green-600" /> {details.email}</p>}
                            {details.whatsapp_number && <p className="flex items-center gap-1.5 text-gray-700"><a href={`https://wa.me/${details.whatsapp_number.replace(/^0/, '254')}`} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:text-green-700 font-medium">Chat on WhatsApp</a></p>}
                            {details.location && <p className="flex items-center gap-1.5 text-gray-700 col-span-2"><MapPin className="w-3.5 h-3.5 text-green-600" /> {details.county ? `${details.county}${details.subcounty ? `, ${details.subcounty}` : ''} - ${details.location}` : details.location}</p>}
                          </div>
                          {details.certificates && details.certificates.length > 0 && (
                            <div>
                              <h5 className="text-xs font-semibold text-gray-700 flex items-center gap-1 mb-1"><Award className="w-3 h-3" /> Certifications</h5>
                              <div className="flex gap-1.5 flex-wrap">
                                {details.certificates.map((cert: string, i: number) => (
                                  <button key={i} type="button" onClick={() => setViewerCert(cert)} className="text-xs text-blue-600 underline hover:text-blue-800 cursor-pointer">📄 Certificate {i+1}</button>
                                ))}
                              </div>
                            </div>
                          )}
                          {details.resume ? (
                            <div>
                              <h5 className="text-xs font-semibold text-gray-700 flex items-center gap-1 mb-1"><FileText className="w-3 h-3" /> Professional CV</h5>
                              <p className={`text-xs text-gray-600 whitespace-pre-wrap ${expandedCv.has(worker.id) ? '' : 'line-clamp-4'}`}>{details.resume}</p>
                              <button
                                onClick={() => setExpandedCv(prev => {
                                  const next = new Set(prev);
                                  if (next.has(worker.id)) next.delete(worker.id); else next.add(worker.id);
                                  return next;
                                })}
                                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-1"
                              >
                                {expandedCv.has(worker.id) ? <>Show less <ChevronUp className="w-3 h-3" /></> : <>Show full CV <ChevronDown className="w-3 h-3" /></>}
                              </button>
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400 italic">No CV/resume uploaded by this worker.</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {showGuestPrompt && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => { setShowGuestPrompt(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Sign in to view contacts</h3>
            <p className="text-sm text-gray-600 mb-1">Unlock a single worker for <span className="font-bold text-green-700">KES {contactFee}</span> for {contactWindowHours} hours, or subscribe for <span className="font-semibold">all</span> contacts.</p>
            <p className="text-sm text-gray-500 mb-5">Choose how you'd like to continue:</p>
            <div className="space-y-3">
              <button onClick={handleGuestSubscribe} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
                <Crown className="w-4 h-4" /> Subscribe — KES 200/week
              </button>
              <button onClick={handleGuestSignIn} className="w-full py-3 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors">
                Sign In / Create Account
              </button>
              <button onClick={() => { setShowGuestPrompt(false); }} className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showSubscriptionPrompt && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => { setShowSubscriptionPrompt(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Crown className="w-6 h-6 text-indigo-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2 text-center">Subscribe or Unlock This Worker</h3>
            <p className="text-sm text-gray-600 mb-2 text-center">Subscribe to <span className="font-bold text-gray-800">{PRICING_PLANS.employerSubscription.name}</span> — <span className="font-bold text-indigo-600">KES {PRICING_PLANS.employerSubscription.price}/week</span> (or <span className="font-bold text-blue-600">KES {PRICING_PLANS.singleJobPost.price}</span> for 1 day) to access jobseeker contacts in your category.</p>
            <ul className="text-xs text-gray-500 mb-4 space-y-1 text-center">
              {PRICING_PLANS.employerSubscription.features.map((f, j) => (
                <li key={j}>• {f}</li>
              ))}
            </ul>
            <p className="text-sm text-gray-500 mb-5 text-center">Prefer just this one? Unlock a single contact for <span className="font-bold text-green-700">KES {contactFee}</span> for {contactWindowHours} hours instead.</p>
            <div className="space-y-3">
              {contactTarget && (
                <button onClick={handleConfirmContactPurchase} className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
                  <Key className="w-4 h-4" /> Unlock this worker — KES {contactFee}
                </button>
              )}
              <button onClick={() => { setShowSubscriptionPrompt(false); handleSubscribe(); }} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
                <Phone className="w-4 h-4" /> Subscribe with M-Pesa
              </button>
              <button onClick={() => { setShowSubscriptionPrompt(false); }} className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors">
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      )}

      {contactTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => { setContactTarget(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Key className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2 text-center">Unlock {contactTarget.full_name}</h3>
            <p className="text-sm text-gray-600 mb-1 text-center">
              Pay <span className="font-bold text-green-700">KES {contactFee}</span> once to view this worker's phone, email and WhatsApp for <span className="font-bold">{contactWindowHours} hours</span>.
            </p>
            <p className="text-sm text-gray-500 mb-5 text-center">
              Works on any device you sign in from. After {contactWindowHours} hours you pay again to reopen it.
            </p>
            <div className="space-y-3">
              <button onClick={handleConfirmContactPurchase} className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
                <Phone className="w-4 h-4" /> Pay KES {contactFee} with M-Pesa
              </button>
              <button onClick={() => setContactTarget(null)} className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <CertificateViewer url={viewerCert} label="Certificate" onClose={() => setViewerCert(null)} />
    </>
  );
};

export default WorkerSearchModal;
