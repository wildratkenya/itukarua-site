import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import SEO, { generateOrganizationSchema, generateLocalBusinessSchema } from '@/lib/seo';
import { ArrowRight, Briefcase, UserCheck, CreditCard, Star, Shield, Clock, Zap, X, Phone, Mail, MapPin, FileText, Award, Lock, ThumbsUp, ThumbsDown } from 'lucide-react';
import HeroSection from './HeroSection';
import AdBanner from './AdBanner';
import JobCard from './JobCard';
import ServiceCard from './ServiceCard';
import WorkerSearchModal from './WorkerSearchModal';
import TopRatedWorkersModal from './TopRatedWorkersModal';
import CertificateViewer from './CertificateViewer';
import { optimizeImageUrl, handleImageError } from '@/lib/supabase';

import { useJobs, useServiceAds, useProfiles } from '@/hooks/useQueries';
import { getPlatformStats, createProfileReview, getProfileReviews, getProfileContact, getContactAccessConfig, incrementProfileViews, setProfileVote, clearProfileVote, getMyProfileVote, CONTACT_ACCESS_FEE_DEFAULT, CONTACT_ACCESS_WINDOW_HOURS_DEFAULT, type PlatformStats, type ProfileContactResult } from '@/lib/database';
import { supabase } from '@/lib/supabase';
import type { Page } from './Header';

interface HomePageProps {
  onNavigate: (page: Page) => void;
  onSearch: (query: string) => void;
  onViewJob: (jobId: string) => void;
  onViewService: (serviceId: string) => void;
  onOpenAuth: (tab: 'login' | 'signup') => void;
  onOpenMpesa: (amount: number, description: string, accountRef: string, paymentType?: string, relatedAdId?: string, relatedJobId?: string, relatedProfileId?: string, onComplete?: () => void) => void;
  onOpenEmployerPayment?: (jobId?: string, jobTitle?: string, onComplete?: () => void) => void;
  onWorkerPopupOpen?: () => void;
  onWorkerSearchAuth?: () => void;
  autoOpenWorkerSearch?: boolean;
  onConsumeAutoOpenWorkerSearch?: () => void;
}

// A row only needs a scroll control when its content genuinely overflows the
// visible track, and that differs by breakpoint: five cards fit at lg, two at
// sm, one on phones. Counting items cannot answer it, so measure the element.
const useRowOverflow = (ref: React.RefObject<HTMLDivElement>, itemCount: number): boolean => {
  const [overflowing, setOverflowing] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setOverflowing(el.scrollWidth > el.clientWidth + 8);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [ref, itemCount]);
  return overflowing;
};

const HomePage: React.FC<HomePageProps> = ({ onNavigate, onSearch, onViewJob, onViewService, onOpenAuth, onOpenMpesa, onOpenEmployerPayment, onWorkerPopupOpen, onWorkerSearchAuth, autoOpenWorkerSearch, onConsumeAutoOpenWorkerSearch }) => {
  const pendingAdvertNav = useRef(false);
  const [stats, setStats] = useState<PlatformStats>({ active_jobs: 0, registered_workers: 0, active_businesses: 0, completed_jobs: 0, total_payments: 0, counties_served: 0 });
  const [user, setUser] = useState<any>(null);
  const [showSticker, setShowSticker] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<any | null>(null);
  const [hasContactAccess, setHasContactAccess] = useState(false);
  const [workerContact, setWorkerContact] = useState<ProfileContactResult['contact']>(null);
  const [workerContactCerts, setWorkerContactCerts] = useState<string[]>([]);
  const [workerContactResumes, setWorkerContactResumes] = useState('');
  const [workerAccessExpiresAt, setWorkerAccessExpiresAt] = useState<string | null>(null);
  const [contactOptedOut, setContactOptedOut] = useState(false);
  const [contactFee, setContactFee] = useState(CONTACT_ACCESS_FEE_DEFAULT);
  const [contactWindowHours, setContactWindowHours] = useState(CONTACT_ACCESS_WINDOW_HOURS_DEFAULT);
  const [workerReviews, setWorkerReviews] = useState<any[]>([]);
  const [showWorkerSearch, setShowWorkerSearch] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewMsg, setReviewMsg] = useState('');
  const [myVote, setMyVote] = useState<'up' | 'down' | null>(null);
  const [workerVotes, setWorkerVotes] = useState<Record<string, { likes: number; dislikes: number }>>({});
  const [viewerCert, setViewerCert] = useState<string | null>(null);
  const [showTopRated, setShowTopRated] = useState(false);
  const [userCategories, setUserCategories] = useState<string[]>([]);

  useEffect(() => {
    const loadUser = async (authUser: any) => {
      if (!authUser) { setUser(null); setUserCategories([]); return; }
      const { data: profile } = await supabase.from('profiles').select('role, registration_paid, subscription_expires_at').eq('id', authUser.id).maybeSingle();
      setUserCategories((authUser.user_metadata?.selected_categories as string[]) || []);
      setUser({
        ...authUser,
        role: profile?.role || 'employer',
        registration_paid: !!profile?.registration_paid,
        subscription_expires_at: profile?.subscription_expires_at || null,
      });
    };
    supabase.auth.getUser().then(({ data }) => loadUser(data.user));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      loadUser(session?.user ?? null);
    });
    return () => listener?.subscription.unsubscribe();
  }, []);

  const handleVote = async (profileId: string, type: 'up' | 'down') => {
    if (!user) { onOpenAuth('login'); return; }
    try {
      if (myVote === type) {
        await clearProfileVote(user.id, profileId);
        setMyVote(null);
      } else {
        await setProfileVote(user.id, profileId, type);
        setMyVote(type);
      }
      const { data }: any = await supabase.from('profiles').select('likes_count, dislikes_count').eq('id', profileId).single();
      const counts = { likes: data?.likes_count ?? 0, dislikes: data?.dislikes_count ?? 0 };
      setWorkerVotes(prev => ({ ...prev, [profileId]: counts }));
      if (selectedWorker && selectedWorker.id === profileId) {
        setSelectedWorker({ ...selectedWorker, likes_count: counts.likes, dislikes_count: counts.dislikes });
      }
    } catch (e) { console.error('Vote failed:', e); }
  };

  // "Our Other Services" sticker: pop in 5s after load, then hide for ~1 min
  // and reappear on a loop. A manual close hides it for the current cycle.
  useEffect(() => {
    const VISIBLE_MS = 5000;
    const HIDDEN_MS = 60000;
    let timer: number;
    let stopped = false;
    const run = (show: boolean) => {
      if (stopped) return;
      setShowSticker(show);
      timer = window.setTimeout(() => run(!show), show ? VISIBLE_MS : HIDDEN_MS);
    };
    timer = window.setTimeout(() => run(true), 5000);
    return () => { stopped = true; window.clearTimeout(timer); };
  }, []);

  // After sign-in/sign-up from the CTA, continue to the advert form
  useEffect(() => {
    if (user && pendingAdvertNav.current) {
      pendingAdvertNav.current = false;
      onNavigate('post-advert');
    }
  }, [user, onNavigate]);

  const handleAdvertiseClick = () => {
    if (user) {
      onNavigate('post-advert');
    } else {
      pendingAdvertNav.current = true;
      onOpenAuth('signup');
    }
  };

  // Contact details come only from the server-side gate, which enforces the
  // payment window and the worker's consent flag together.
  const loadWorkerContact = async (profileId: string) => {
    const result = await getProfileContact(profileId);
    if (!result) return;
    if (!result.allowed) {
      setWorkerContact(null);
      setContactOptedOut(result.reason === 'opted_out');
      setHasContactAccess(false);
      return;
    }
    setContactOptedOut(false);
    setWorkerContact(result.contact || null);
    setWorkerContactCerts(result.certificates || []);
    setWorkerContactResumes(result.resume || '');
    setWorkerAccessExpiresAt(result.expiresAt || null);
    setHasContactAccess(true);
  };

  useEffect(() => {
    if (selectedWorker) {
      setHasContactAccess(false);
      setWorkerContact(null);
      setWorkerContactCerts([]);
      setWorkerContactResumes('');
      setWorkerAccessExpiresAt(null);
      setContactOptedOut(false);
      setWorkerReviews([]);
      setReviewRating(0);
      setReviewComment('');
      setReviewMsg('');
      if (user) loadWorkerContact(selectedWorker.id);
      getProfileReviews(selectedWorker.id).then(setWorkerReviews);
      if (user) { setMyVote(null); getMyProfileVote(user.id, selectedWorker.id).then(v => setMyVote(v || null)).catch(() => {}); }
    }
  }, [selectedWorker, user]);

  useEffect(() => {
    if (!selectedWorker) return;
    getContactAccessConfig().then(cfg => { setContactFee(cfg.fee); setContactWindowHours(cfg.windowHours); }).catch(() => {});
  }, [selectedWorker]);

  // Load homepage data with retry logic
  const { data: jobsData = [], isLoading: jobsLoading } = useJobs({ featured: true, activeOnly: true, limit: 50 });
  const { data: servicesData = [], isLoading: servicesLoading } = useServiceAds({ featured: true, limit: 50 });
  const { data: workersData = [], isLoading: workersLoading } = useProfiles({ limit: 4, ratings_enabled: true, role: 'jobseeker' });
  const jobsRowRef = useRef<HTMLDivElement>(null);
  const servicesRowRef = useRef<HTMLDivElement>(null);

  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const st = await getPlatformStats();
        setStats(st);
      } catch (err) {
        console.error('Error loading stats:', err);
      }
    };
    loadStats();
  }, []);

  const loading = (jobsLoading || servicesLoading || workersLoading) && !timedOut;

  // Simple mapping for jobs
  const jobs = jobsData.map((j: any) => ({
    id: j.id,
    title: j.title,
    description: j.description,
    location: j.location,
    county: j.county,
    subcounty: j.subcounty,
    budgetMin: j.budget_min,
    budgetMax: j.budget_max,
    deadline: j.deadline,
    category: j.category,
    postedBy: j.posted_by_name,
    postedDate: j.created_at?.split('T')[0] || '',
    bidsCount: j.bids_count,
    urgent: j.urgent,
    status: j.status,
    images: j.images,
    corporate_account_id: j.corporate_account_id,
  }));

  // Simple mapping for services
  const services = servicesData.map((s: any) => {
    try {
      const serviceImages = Array.isArray(s.images) && s.images.length > 0 
        ? s.images 
        : s.image 
          ? [s.image] 
          : [];
      
      return {
        id: s.id,
        businessName: s.business_name,
        description: s.description,
        category: s.category,
        image: s.image || (Array.isArray(s.images) && s.images[0]) || '',
        images: serviceImages,
        location: s.location,
        county: s.county,
        subcounty: s.subcounty,
        contact: s.contact,
        expiryDate: s.expiry_date,
        featured: s.featured,
        rating: Number(s.rating) || 0,
        reviews: s.reviews_count,
        corporate_account_id: s.corporate_account_id,
      };
    } catch (err) {
      console.error('Mapping error for service:', s.id, err);
      return null;
    }
  }).filter(Boolean);

  // Cards with a photo fill the scrolling row; cards without one drop into a
  // compact strip beneath it, so an empty image slot never stretches a tall
  // grey column across the grid.
  const hasImages = (images: unknown): boolean => Array.isArray(images) && images.length > 0;
  const jobsWithImage = jobs.filter(job => hasImages(job.images));
  const jobsWithoutImage = jobs.filter(job => !hasImages(job.images));
  const servicesWithImage = services.filter(service => hasImages(service.images));
  const servicesWithoutImage = services.filter(service => !hasImages(service.images));
  const jobsOverflow = useRowOverflow(jobsRowRef, jobsWithImage.length);
  const servicesOverflow = useRowOverflow(servicesRowRef, servicesWithImage.length);

  // Sort top-rated workers: rating desc, then thumbs-up desc, then reviews desc
  const topRatedWorkers = useMemo(() => {
    const list = [...workersData];
    list.sort((a, b) => {
      const r = (Number(b.rating) || 0) - (Number(a.rating) || 0);
      if (r !== 0) return r;
      const l = (Number(b.likes_count) || 0) - (Number(a.likes_count) || 0);
      if (l !== 0) return l;
      return (Number(b.reviews_count) || 0) - (Number(a.reviews_count) || 0);
    });
    return list;
  }, [workersData]);

  return (
    <div className="relative pb-12">
      <SEO
        title="Find Local Jobs, Services & Opportunities in Kenya"
        description="Find local jobs, business listings, and service providers across all 47 counties in Kenya. Browse opportunities in Nairobi, Kiambu, Mombasa, Kisumu, and more."
        canonical="/"
        jsonLd={[generateOrganizationSchema(), generateLocalBusinessSchema()]}
      />
      {showSticker && (
        <div className="absolute top-4 right-4 z-40">
          <a
            href="https://ikenya-ebon.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="relative block w-48 h-48 lg:w-64 lg:h-64 rounded-xl overflow-hidden shadow-lg hover:shadow-xl hover:scale-105 transition-all group animate-slide-in-right"
          >
            <img src="/images/sticker.jpg" alt="Our Other Services" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 group-hover:bg-black/30 transition-colors" />
            <div className="absolute inset-0 flex items-center justify-center p-3">
              <span className="text-white text-4xl lg:text-5xl font-['Changa_One'] text-center leading-tight">
                Our Other Services
              </span>
            </div>
          </a>
          <button
            onClick={() => setShowSticker(false)}
            aria-label="Close Our Other Services sticker"
            className="absolute -top-2 -right-2 w-7 h-7 bg-white/90 hover:bg-white text-gray-700 rounded-full shadow-lg flex items-center justify-center transition-colors z-10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      <HeroSection onNavigate={onNavigate} onSearch={onSearch} onOpenWorkerSearch={() => setShowWorkerSearch(true)} stats={stats} />
      <AdBanner />


      {/* Worker Detail Popup */}
      {selectedWorker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedWorker(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              {/* Header */}
              <div className="flex items-start gap-4 mb-4">
                {selectedWorker.profile_image ? (
                  <img src={optimizeImageUrl(selectedWorker.profile_image, 128, 128)} alt={selectedWorker.full_name} className="w-16 h-16 rounded-full object-cover ring-2 ring-gray-100" onError={handleImageError} />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center ring-2 ring-gray-100 flex-shrink-0">
                    <span className="text-xl font-bold text-green-700">
                      {(() => { const s = typeof selectedWorker.skills === 'string' ? selectedWorker.skills.split(',')[0]?.trim() : selectedWorker.skills?.[0]; return (s?.[0] || 'W').toUpperCase(); })()}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-gray-900 truncate">{selectedWorker.full_name}</h3>
                  {selectedWorker.is_featured && <span className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded"><Zap className="w-3 h-3" />Featured</span>}
                  <p className="text-sm text-gray-500">
                    {(() => { const s = typeof selectedWorker.skills === 'string' ? selectedWorker.skills.split(',')[0]?.trim() : selectedWorker.skills?.[0]; return s || "Worker"; })()}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                    <span className="text-sm font-medium text-gray-700">{Number(selectedWorker.rating) || 0}/5</span>
                    <span className="text-xs text-gray-400">({selectedWorker.reviews_count || 0} reviews)</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => handleVote(selectedWorker.id, 'up')}
                      className={"inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors " + (myVote === 'up' ? 'bg-green-50 border-green-300 text-green-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50')}
                    >
                      <ThumbsUp className={"w-3.5 h-3.5 " + (myVote === 'up' ? 'fill-green-500 text-green-500' : '')} />
                      {workerVotes[selectedWorker.id]?.likes ?? (Number(selectedWorker.likes_count) || 0)}
                    </button>
                    <button
                      onClick={() => handleVote(selectedWorker.id, 'down')}
                      className={"inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors " + (myVote === 'down' ? 'bg-red-50 border-red-300 text-red-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50')}
                    >
                      <ThumbsDown className={"w-3.5 h-3.5 " + (myVote === 'down' ? 'fill-red-500 text-red-500' : '')} />
                      {workerVotes[selectedWorker.id]?.dislikes ?? (Number(selectedWorker.dislikes_count) || 0)}
                    </button>
                  </div>
                </div>
                <button onClick={() => setSelectedWorker(null)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Contact & Certifications Section — revealed only by the server gate */}
              {hasContactAccess && workerContact ? (
                <div className="space-y-3 mb-4 p-4 bg-green-50 rounded-xl border border-green-100">
                  <h4 className="font-semibold text-sm text-green-800 flex items-center gap-1.5"><Mail className="w-4 h-4" /> Contact Information</h4>
                  <div className="space-y-2 text-sm">
                    {workerContact.phone && <p className="flex items-center gap-2 text-gray-700"><Phone className="w-4 h-4 text-green-600" /> {workerContact.phone}</p>}
                    {workerContact.email && <p className="flex items-center gap-2 text-gray-700"><Mail className="w-4 h-4 text-green-600" /> {workerContact.email}</p>}
                    {workerContact.whatsapp && <a href={`https://wa.me/${workerContact.whatsapp.replace(/^0/, '254')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-green-600 hover:text-green-700 font-medium"><span className="w-4 h-4 flex items-center justify-center">💬</span> Chat on WhatsApp</a>}
                    {workerContact.location && <p className="flex items-center gap-2 text-gray-700"><MapPin className="w-4 h-4 text-green-600" /> {workerContact.county ? `${workerContact.county}${workerContact.subcounty ? `, ${workerContact.subcounty}` : ''} - ${workerContact.location}` : workerContact.location}</p>}
                  </div>
                  {workerContactResumes !== undefined && workerContactResumes ? (
                    <>
                      <h4 className="font-semibold text-sm text-green-800 flex items-center gap-1.5 pt-2 border-t border-green-200"><FileText className="w-4 h-4" /> Professional CV</h4>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{workerContactResumes}</p>
                    </>
                  ) : (
                    <p className="text-xs text-gray-500 italic">No CV uploaded by this worker.</p>
                  )}
                  {workerContactCerts && workerContactCerts.length > 0 && (
                    <>
                      <h4 className="font-semibold text-sm text-green-800 flex items-center gap-1.5 pt-2 border-t border-green-200"><Award className="w-4 h-4" /> Certifications</h4>
                      <div className="flex gap-2 flex-wrap">
                        {workerContactCerts.map((cert: string, i: number) => (
                          <button key={i} type="button" onClick={() => setViewerCert(cert)} className="text-xs text-blue-600 underline hover:text-blue-800 cursor-pointer">
                            📄 Certificate {i + 1}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  {workerAccessExpiresAt && (
                    <p className="text-[11px] text-green-700 pt-2 border-t border-green-200">
                      Access until {new Date(workerAccessExpiresAt).toLocaleString('en-KE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              ) : contactOptedOut ? (
                <div className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-200 text-center">
                  <Lock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-700 mb-1">Contact details not shared</p>
                  <p className="text-xs text-gray-500">This worker has chosen not to share their phone, email or WhatsApp.</p>
                </div>
              ) : (
                <div className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-200 text-center">
                  <Lock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-700 mb-1">Contact & Certifications Locked</p>
                  <p className="text-xs text-gray-500 mb-3">Unlock this worker for KES {contactFee} for {contactWindowHours} hours, or subscribe for all contacts</p>
                  <div className="flex flex-col sm:flex-row gap-2 justify-center">
                    {!user ? (
                      <button
                        onClick={() => onOpenAuth('login')}
                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors"
                      >
                        Sign In to View Profile
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            if (!onOpenMpesa) return;
                            onOpenMpesa(contactFee, `One-Day Access — ${selectedWorker.full_name}`, 'ITK-CONTACT', 'contact_access', undefined, undefined, selectedWorker.id, () => { loadWorkerContact(selectedWorker.id); });
                          }}
                          className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors"
                        >
                          Unlock for KES {contactFee} ({contactWindowHours}h)
                        </button>
                        <button
                          onClick={() => {
                            if (onOpenEmployerPayment) {
                              onOpenEmployerPayment();
                            } else {
                              onOpenMpesa(200, 'Employer Weekly Access', 'EMP-WK', 'registration', undefined, undefined, undefined, undefined, false, false, null, 'employer');
                            }
                          }}
                          className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors"
                        >
                          Subscribe to All
                        </button>
                      </>
                    )}
                  </div>
                  {reviewMsg === 'Please sign in first' && <p className="text-xs text-red-500 mt-2">{reviewMsg}</p>}
                </div>
              )}

              {/* Reviews Section */}
              <div className="border-t pt-4">
                <h4 className="font-semibold text-sm text-gray-900 mb-3">Reviews ({workerReviews.length})</h4>
                {workerReviews.length > 0 ? (
                  <div className="space-y-3 max-h-48 overflow-y-auto">
                    {workerReviews.map((review: any) => (
                      <div key={review.id} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="flex text-amber-400 text-xs">
                            {[1,2,3,4,5].map(s => <span key={s} className={s <= review.rating ? '' : 'text-gray-200'}>{'★'}</span>)}
                          </div>
                          <span className="text-xs font-medium text-gray-700">{review.reviewer?.full_name || 'Anonymous'}</span>
                        </div>
                        {review.comment && <p className="text-sm text-gray-600">{review.comment}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-3">No reviews yet</p>
                )}

                {/* Leave a Review */}
                {user && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs font-medium text-gray-600 mb-2">Leave a Review</p>
                    <div className="flex items-center gap-0.5 mb-2">
                      {[1,2,3,4,5].map(star => (
                        <button
                          key={star}
                          onClick={() => setReviewRating(star)}
                          className={`text-lg transition-colors ${star <= reviewRating ? 'text-amber-400' : 'text-gray-200 hover:text-amber-300'}`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={reviewComment}
                      onChange={e => setReviewComment(e.target.value)}
                      placeholder="Share your experience (optional)..."
                      className="w-full text-sm border rounded-lg p-2.5 resize-none h-20 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={async () => {
                          if (reviewRating === 0) { setReviewMsg('Please select a rating'); return; }
                          try {
                            await createProfileReview(user.id, selectedWorker.id, reviewRating, reviewComment);
                            setReviewMsg('Thank you for your review!');
                            setReviewRating(0);
                            setReviewComment('');
                            getProfileReviews(selectedWorker.id).then(setWorkerReviews);
                          } catch { setReviewMsg('Failed to save review'); }
                          setTimeout(() => setReviewMsg(''), 2500);
                        }}
                        className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors"
                      >
                        Submit Review
                      </button>
                      {reviewMsg && <span className={`text-xs ${reviewMsg.includes('Thank') ? 'text-green-600' : 'text-red-500'}`}>{reviewMsg}</span>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subscription Prompt instead of payment modal */}

      <WorkerSearchModal
        isOpen={showWorkerSearch}
        onClose={() => setShowWorkerSearch(false)}
        onOpenAuth={onOpenAuth}
        onOpenMpesa={onOpenMpesa}
        onOpenEmployerPayment={onOpenEmployerPayment}
        onNeedAuth={() => onWorkerSearchAuth?.()}
      />

      <TopRatedWorkersModal
        isOpen={showTopRated}
        onClose={() => setShowTopRated(false)}
        defaultCategories={userCategories}
        onSelectWorker={(worker) => {
          setShowTopRated(false);
          setSelectedWorker(worker);
          incrementProfileViews(worker.id);
          onWorkerPopupOpen?.();
        }}
      />

      <CertificateViewer url={viewerCert} label="Certificate" onClose={() => setViewerCert(null)} />


      {/* Latest Jobs — shows boosted jobs only; hidden when none are boosted */}
      {jobs.length > 0 && (
        <section className="py-8 lg:py-10 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl lg:text-2xl font-bold text-gray-900">Latest Jobs</h2>
                <p className="text-gray-500 text-sm mt-1">Boosted jobs from local employers</p>
              </div>
              <button onClick={() => onNavigate('jobs')} className="hidden sm:flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors">
                View All Jobs <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <div className="relative">
              <div ref={jobsRowRef} className="flex gap-5 overflow-x-auto pb-3 snap-x snap-mandatory">
                {jobsWithImage.map(job => (
                  <div key={job.id} className="shrink-0 snap-start w-[85%] sm:w-[calc(50%-0.625rem)] lg:w-[calc(20%-1rem)]">
                    <JobCard job={job} onViewJob={onViewJob} />
                  </div>
                ))}
              </div>
              {jobsOverflow && (
                <button
                  onClick={() => { const el = jobsRowRef.current; if (el) el.scrollBy({ left: el.clientWidth, behavior: 'smooth' }); }}
                  className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 w-9 h-9 items-center justify-center rounded-full bg-white shadow-md border border-gray-200 text-gray-600 hover:text-green-600 transition-colors"
                  aria-label="Show more jobs"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
            {jobsWithoutImage.length > 0 && (
              <div className="mt-5 flex gap-3 overflow-x-auto pb-2">
                {jobsWithoutImage.map(job => (
                  <div key={job.id} className="shrink-0 w-[90%] sm:w-[calc(50%-0.375rem)] lg:w-[calc(33.333%-0.5rem)]">
                    <JobCard job={job} onViewJob={onViewJob} compact />
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Featured Services — shows boosted services only; hidden when none
          are boosted */}
      {services.length > 0 && (
        <section className="py-8 lg:py-10 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl lg:text-2xl font-bold text-gray-900">Featured Services</h2>
                <p className="text-gray-500 text-sm mt-1">Boosted local businesses and service providers</p>
              </div>
              <button onClick={() => onNavigate('services')} className="hidden sm:flex items-center gap-2 px-5 py-2.5 border border-gray-300 hover:border-green-600 hover:text-green-700 text-sm font-semibold rounded-lg transition-colors">
                View All Services <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <div className="relative">
              <div ref={servicesRowRef} className="flex gap-5 overflow-x-auto pb-3 snap-x snap-mandatory">
                {servicesWithImage.map(service => (
                  <div key={service.id} className="shrink-0 snap-start w-[85%] sm:w-[calc(50%-0.625rem)] lg:w-[calc(20%-1rem)]">
                    <ServiceCard service={service} onClick={() => onViewService(service.id)} />
                  </div>
                ))}
              </div>
              {servicesOverflow && (
                <button
                  onClick={() => { const el = servicesRowRef.current; if (el) el.scrollBy({ left: el.clientWidth, behavior: 'smooth' }); }}
                  className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 w-9 h-9 items-center justify-center rounded-full bg-white shadow-md border border-gray-200 text-gray-600 hover:text-green-600 transition-colors"
                  aria-label="Show more services"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
            {servicesWithoutImage.length > 0 && (
              <div className="mt-5 flex gap-3 overflow-x-auto pb-2">
                {servicesWithoutImage.map(service => (
                  <div key={service.id} className="shrink-0 w-[90%] sm:w-[calc(50%-0.375rem)] lg:w-[calc(33.333%-0.5rem)]">
                    <ServiceCard service={service} compact onClick={() => onViewService(service.id)} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Top Workers */}
      <section className="py-8 lg:py-10 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-4 gap-8 items-start">
            <div>
              <h2 className="text-lg lg:text-xl font-bold text-gray-900">Top Rated Workers</h2>
              <p className="text-gray-500 text-sm mt-1">Verified and trusted professionals in your area</p>
              <button onClick={() => setShowTopRated(true)} className="mt-3 flex items-center gap-2 px-4 py-2 border border-gray-300 hover:border-green-600 hover:text-green-700 text-sm font-semibold rounded-lg transition-colors">
                More <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <div className="lg:col-span-3">
              {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="bg-white rounded-xl p-4 animate-pulse">
                      <div className="w-12 h-12 bg-gray-200 rounded-full mx-auto mb-3" />
                      <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {topRatedWorkers.map((worker) => {
                    const firstSkill = typeof worker.skills === 'string' ? worker.skills.split(',')[0]?.trim() : worker.skills?.[0];
                    return (
                    <div key={worker.id} onClick={() => { setSelectedWorker(worker); incrementProfileViews(worker.id); onWorkerPopupOpen?.(); }} className="bg-white rounded-xl p-4 text-center border border-gray-100 hover:border-green-200 hover:shadow-md transition-all group cursor-pointer">
                      {worker.profile_image ? (
                        <img src={optimizeImageUrl(worker.profile_image, 96, 96)} alt={worker.full_name} className="w-12 h-12 rounded-full mx-auto mb-3 object-cover ring-2 ring-gray-100 group-hover:ring-green-200 transition-all" onError={handleImageError} />
                      ) : (
                        <div className="w-12 h-12 rounded-full mx-auto mb-3 bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center ring-2 ring-gray-100 group-hover:ring-green-200 transition-all">
                          <span className="text-lg font-bold text-green-700">{(firstSkill?.[0] || 'W').toUpperCase()}</span>
                        </div>
                      )}
                      <h4 className="font-semibold text-gray-900 text-sm mb-0.5 line-clamp-1">{worker.full_name}</h4>
                      {worker.is_featured && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-bold rounded mb-1"><Zap className="w-2.5 h-2.5" />Featured</span>}
                      <p className="text-xs text-gray-500 mb-2">{firstSkill || "Worker"}</p>
                      <div className="flex items-center justify-center gap-1">
                        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                        <span className="text-xs font-medium text-gray-700">{Number(worker.rating) || 0}</span>
                      </div>
                      <div className="flex items-center justify-center gap-3 mt-1.5">
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-green-600">
                          <ThumbsUp className="w-3 h-3" /> {workerVotes[worker.id]?.likes ?? (Number(worker.likes_count) || 0)}
                        </span>
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-red-500">
                          <ThumbsDown className="w-3 h-3" /> {workerVotes[worker.id]?.dislikes ?? (Number(worker.dislikes_count) || 0)}
                        </span>
                      </div>
                      {worker.verified && (
                        <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 bg-green-50 text-green-700 text-[10px] font-medium rounded-full">
                          <Shield className="w-3 h-3" /> Verified
                        </span>
                      )}
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>


      {/* CTA */}
      <section className="py-16 lg:py-20 bg-gradient-to-br from-green-700 via-green-800 to-green-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Ready to Connect Your Community?</h2>
          <p className="text-green-100 max-w-2xl mx-auto mb-8">Join thousands of Kenyans building stronger local economies through ITUKARUA Solutions.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button onClick={() => onNavigate('post-job')} className="px-8 py-4 bg-white text-green-700 font-semibold rounded-xl hover:bg-green-50 transition-colors shadow-lg">Post a Job</button>
            <button onClick={handleAdvertiseClick} className="px-8 py-4 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-500 transition-colors border border-green-500">Advertise your business →</button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;

