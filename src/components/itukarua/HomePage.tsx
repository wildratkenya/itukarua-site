import React, { useState, useEffect, useCallback } from 'react';
import { ArrowRight, Briefcase, UserCheck, CreditCard, Star, Shield, Clock, Zap, X, Phone, Mail, MapPin, FileText, Award, Lock } from 'lucide-react';
import HeroSection from './HeroSection';
import JobCard from './JobCard';
import ServiceCard from './ServiceCard';
import { optimizeImageUrl, handleImageError } from '@/lib/supabase';
import { IMAGES } from '@/data/siteData';
import { useJobs, useServiceAds, useProfiles } from '@/hooks/useQueries';
import { getPlatformStats, createServiceRating, checkServiceRating, createProfileReview, getProfileReviews, checkContactAccess, incrementProfileViews, type PlatformStats } from '@/lib/database';
import { supabase } from '@/lib/supabase';
import type { Page } from './Header';
import ImageViewerModal from './ImageViewerModal';
import MpesaModal from './MpesaModal';

interface HomePageProps {
  onNavigate: (page: Page) => void;
  onSearch: (query: string) => void;
  onViewJob: (jobId: string) => void;
}

const HomePage: React.FC<HomePageProps> = ({ onNavigate, onSearch, onViewJob }) => {
  const [stats, setStats] = useState<PlatformStats>({ active_jobs: 0, registered_workers: 0, active_businesses: 0, completed_jobs: 0, total_payments: 0, counties_served: 0 });
  const [selectedService, setSelectedService] = useState<any | null>(null);
  const [viewingImage, setViewingImage] = useState<string[] | null>(null);
  const [userRating, setUserRating] = useState<number>(0);
  const [user, setUser] = useState<any>(null);
  const [ratingMsg, setRatingMsg] = useState('');
  const [selectedWorker, setSelectedWorker] = useState<any | null>(null);
  const [hasContactAccess, setHasContactAccess] = useState(false);
  const [workerReviews, setWorkerReviews] = useState<any[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewMsg, setReviewMsg] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => listener?.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (selectedService && user) {
      checkServiceRating(selectedService.id, user.id).then(r => setUserRating(r || 0));
    }
  }, [selectedService, user]);

  useEffect(() => {
    if (selectedWorker) {
      setHasContactAccess(false);
      setWorkerReviews([]);
      setReviewRating(0);
      setReviewComment('');
      setReviewMsg('');
      if (user) {
        checkContactAccess(user.id, selectedWorker.id).then(setHasContactAccess);
      }
      getProfileReviews(selectedWorker.id).then(setWorkerReviews);
    }
  }, [selectedWorker, user]);

  // Load homepage data with retry logic
  const { data: jobsData = [], isLoading: jobsLoading, error: jobsError, refetch: refetchJobs } = useJobs({ limit: 6 });
  const { data: servicesData = [], isLoading: servicesLoading, error: servicesError, refetch: refetchServices } = useServiceAds({ limit: 4 });
  const { data: workersData = [], isLoading: workersLoading, error: workersError, refetch: refetchWorkers } = useProfiles({ limit: 4, ratings_enabled: true });

  useEffect(() => {
    console.log('HomePage Data Check:', { 
      jobs: jobsData.length, 
      services: servicesData.length, 
      loading: { jobsLoading, servicesLoading, workersLoading },
      errors: { jobsError, servicesError, workersError }
    });
  }, [jobsData, servicesData, jobsLoading, servicesLoading, workersLoading, jobsError, servicesError, workersError]);

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
  const hasError = jobsError || servicesError || workersError;

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
  }));

  // Simple mapping for services
  const services = servicesData.map((s: any) => {
    try {
      const serviceImages = Array.isArray(s.images) && s.images.length > 0 
        ? s.images 
        : s.image 
          ? [s.image] 
          : [IMAGES.services[0]];
      
      return {
        id: s.id,
        businessName: s.business_name,
        description: s.description,
        category: s.category,
        image: s.image || (Array.isArray(s.images) && s.images[0]) || IMAGES.services[0],
        images: serviceImages,
        location: s.location,
        county: s.county,
        subcounty: s.subcounty,
        contact: s.contact,
        expiryDate: s.expiry_date,
        featured: s.featured,
        rating: Number(s.rating) || 0,
        reviews: s.reviews_count,
      };
    } catch (err) {
      console.error('Mapping error for service:', s.id, err);
      return null;
    }
  }).filter(Boolean);

  return (
    <div className="pb-12">
      <HeroSection onNavigate={onNavigate} onSearch={onSearch} stats={stats} />

      {/* Service Detail Modal - Matches ServicesPage logic */}
      {selectedService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedService(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Main Image */}
            <div className="relative m-3 rounded-2xl overflow-hidden cursor-pointer" onClick={(e) => { e.stopPropagation(); setViewingImage(selectedService.images || [selectedService.image]); }}>
              <img src={optimizeImageUrl(selectedService.image || IMAGES.services[0], 600, 300)} alt={selectedService.businessName} className="w-full h-64 object-cover" loading="lazy" onError={handleImageError} />
              <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center">
                <span className="text-white opacity-0 hover:opacity-100 font-medium">Click to enlarge</span>
              </div>
            </div>
            
            {/* Thumbnail Scroller */}
            {selectedService.images && selectedService.images.length > 1 && (
              <div className="flex gap-2 px-3 pb-3 overflow-x-auto">
                {selectedService.images.map((img: string, i: number) => (
                  <button
                    key={i}
                    onClick={(e) => { e.stopPropagation(); setViewingImage(selectedService.images); }}
                    className="flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 border-transparent hover:border-green-500 transition-colors"
                  >
                    <img src={optimizeImageUrl(img, 128, 128)} alt="" className="w-full h-full object-cover" onError={handleImageError} />
                  </button>
                ))}
              </div>
            )}
            
            <div className="p-5">
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">{selectedService.category}</span>
                    {selectedService.featured && <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Featured</span>}
                  </div>
                  <h2 className="text-lg font-bold text-gray-900">{selectedService.businessName}</h2>
                  <p className="text-sm text-gray-600 leading-relaxed">{selectedService.description}</p>
                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-xs font-medium text-gray-500 mb-1.5">Rate this service</p>
                    <div className="flex items-center gap-0.5">
                      {[1,2,3,4,5].map(star => (
                        <button
                          key={star}
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (!user) { setRatingMsg('Please sign in to rate'); return; }
                            setUserRating(star);
                            try {
                              await createServiceRating(selectedService.id, user.id, star);
                              setRatingMsg('Thank you for rating!');
                              setTimeout(() => setRatingMsg(''), 2500);
                            } catch { setRatingMsg('Failed to save rating'); }
                          }}
                          className={`w-6 h-6 transition-colors ${star <= userRating ? 'text-amber-400' : 'text-gray-200 hover:text-amber-300'}`}
                        >
                          ★
                        </button>
                      ))}
                      {ratingMsg && <span className="text-xs text-green-600 ml-2">{ratingMsg}</span>}
                    </div>
                  </div>
                </div>
                <div className="w-48 flex-shrink-0 bg-gray-50 rounded-xl p-3.5 space-y-2.5 border border-gray-100">
                  <div className="flex items-start gap-2">
                    <span className="text-green-600 mt-0.5">📍</span>
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Location</p>
                      <p className="text-sm text-gray-900 font-medium">{selectedService.location}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-green-600 mt-0.5">📞</span>
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Contact</p>
                      <p className="text-sm text-gray-900 font-medium">{selectedService.contact}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-amber-500 mt-0.5">⭐</span>
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Rating</p>
                      <p className="text-sm text-gray-900 font-medium">{Number(selectedService.rating) || 0}/5 ({selectedService.reviews} reviews)</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedService(null)} className="w-full py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors">Close</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {viewingImage && (
        <ImageViewerModal
          images={viewingImage}
          onClose={() => setViewingImage(null)}
        />
      )}

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
                  <p className="text-sm text-gray-500">
                    {(() => { const s = typeof selectedWorker.skills === 'string' ? selectedWorker.skills.split(',')[0]?.trim() : selectedWorker.skills?.[0]; return s || "Worker"; })()}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                    <span className="text-sm font-medium text-gray-700">{Number(selectedWorker.rating) || 0}/5</span>
                    <span className="text-xs text-gray-400">({selectedWorker.reviews_count || 0} reviews)</span>
                  </div>
                </div>
                <button onClick={() => setSelectedWorker(null)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Contact & Certifications Section */}
              {hasContactAccess ? (
                <div className="space-y-3 mb-4 p-4 bg-green-50 rounded-xl border border-green-100">
                  <h4 className="font-semibold text-sm text-green-800 flex items-center gap-1.5"><Mail className="w-4 h-4" /> Contact Information</h4>
                  <div className="space-y-2 text-sm">
                    {selectedWorker.phone && <p className="flex items-center gap-2 text-gray-700"><Phone className="w-4 h-4 text-green-600" /> {selectedWorker.phone}</p>}
                    {selectedWorker.email && <p className="flex items-center gap-2 text-gray-700"><Mail className="w-4 h-4 text-green-600" /> {selectedWorker.email}</p>}
                    {selectedWorker.location && <p className="flex items-center gap-2 text-gray-700"><MapPin className="w-4 h-4 text-green-600" /> {selectedWorker.county ? `${selectedWorker.county}${selectedWorker.subcounty ? `, ${selectedWorker.subcounty}` : ''} - ${selectedWorker.location}` : selectedWorker.location}</p>}
                  </div>
                  {selectedWorker.certificates && selectedWorker.certificates.length > 0 && (
                    <>
                      <h4 className="font-semibold text-sm text-green-800 flex items-center gap-1.5 pt-2 border-t border-green-200"><Award className="w-4 h-4" /> Certifications</h4>
                      <div className="flex gap-2 flex-wrap">
                        {selectedWorker.certificates.map((cert: string, i: number) => (
                          <a key={i} href={cert} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline hover:text-blue-800">
                            📄 Certificate {i + 1}
                          </a>
                        ))}
                      </div>
                    </>
                  )}
                  {selectedWorker.resume && (
                    <>
                      <h4 className="font-semibold text-sm text-green-800 flex items-center gap-1.5 pt-2 border-t border-green-200"><FileText className="w-4 h-4" /> Professional CV</h4>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedWorker.resume}</p>
                    </>
                  )}
                </div>
              ) : (
                <div className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-200 text-center">
                  <Lock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-700 mb-1">Contact & Certifications Locked</p>
                  <p className="text-xs text-gray-500 mb-3">Pay KES 100 to unlock contact details, certifications, and CV</p>
                  <button
                    onClick={async () => {
                      const { data: { user: currentUser } } = await supabase.auth.getUser();
                      if (!currentUser) { setReviewMsg('Please sign in first'); return; }
                      setUser(currentUser);
                      setShowPaymentModal(true);
                    }}
                    className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    Pay KES 100 to Unlock
                  </button>
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

      {/* Payment Modal */}
      {showPaymentModal && selectedWorker && (
        <MpesaModal
          isOpen={true}
          onClose={() => setShowPaymentModal(false)}
          amount={100}
          description={`Unlock contact for ${selectedWorker.full_name}`}
          accountRef={`WRK-${selectedWorker.id}`}
          user={user}
          paymentType="contact_access"
          relatedProfileId={selectedWorker.id}
          onPaymentComplete={() => {
            setShowPaymentModal(false);
            setHasContactAccess(true);
          }}
        />
      )}


      {/* Featured Jobs */}
      <section className="py-8 lg:py-10 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl lg:text-2xl font-bold text-gray-900">Latest Jobs</h2>
              <p className="text-gray-500 text-sm mt-1">Find local work opportunities near you</p>
            </div>
            <button onClick={() => onNavigate('jobs')} className="hidden sm:flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors">
              View All Jobs <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {[1,2,3,4].map(i => (
                <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse">
                  <div className="aspect-square bg-gray-200 rounded-lg mb-3" />
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
                  <div className="h-5 bg-gray-200 rounded w-3/4 mb-3" />
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {jobs.slice(0, 4).map(job => (
                <JobCard key={job.id} job={job} onViewJob={onViewJob} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Featured Services */}
      <section className="py-8 lg:py-10 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl lg:text-2xl font-bold text-gray-900">Featured Services</h2>
              <p className="text-gray-500 text-sm mt-1">Local businesses and service providers</p>
            </div>
            <button onClick={() => onNavigate('services')} className="hidden sm:flex items-center gap-2 px-5 py-2.5 border border-gray-300 hover:border-green-600 hover:text-green-700 text-sm font-semibold rounded-lg transition-colors">
              View All Services <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {[1,2,3,4].map(i => (
                <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden animate-pulse">
                  <div className="aspect-square bg-gray-200" />
                  <div className="p-4"><div className="h-4 bg-gray-200 rounded w-1/3 mb-2" /><div className="h-5 bg-gray-200 rounded w-3/4 mb-2" /></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {services.slice(0, 4).map(service => (
                <ServiceCard key={service.id} service={service} onClick={() => setSelectedService(service)} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Top Workers */}
      <section className="py-8 lg:py-10 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-4 gap-8 items-start">
            <div>
              <h2 className="text-lg lg:text-xl font-bold text-gray-900">Top Rated Workers</h2>
              <p className="text-gray-500 text-sm mt-1">Verified and trusted professionals in your area</p>
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
                  {workersData.map((worker) => {
                    const firstSkill = typeof worker.skills === 'string' ? worker.skills.split(',')[0]?.trim() : worker.skills?.[0];
                    return (
                    <div key={worker.id} onClick={() => { setSelectedWorker(worker); incrementProfileViews(worker.id); }} className="bg-white rounded-xl p-4 text-center border border-gray-100 hover:border-green-200 hover:shadow-md transition-all group cursor-pointer">
                      {worker.profile_image ? (
                        <img src={optimizeImageUrl(worker.profile_image, 96, 96)} alt={worker.full_name} className="w-12 h-12 rounded-full mx-auto mb-3 object-cover ring-2 ring-gray-100 group-hover:ring-green-200 transition-all" onError={handleImageError} />
                      ) : (
                        <div className="w-12 h-12 rounded-full mx-auto mb-3 bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center ring-2 ring-gray-100 group-hover:ring-green-200 transition-all">
                          <span className="text-lg font-bold text-green-700">{(firstSkill?.[0] || 'W').toUpperCase()}</span>
                        </div>
                      )}
                      <h4 className="font-semibold text-gray-900 text-sm mb-0.5 line-clamp-1">{worker.full_name}</h4>
                      <p className="text-xs text-gray-500 mb-2">{firstSkill || "Worker"}</p>
                      <div className="flex items-center justify-center gap-1">
                        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                        <span className="text-xs font-medium text-gray-700">{Number(worker.rating) || 0}</span>
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
            <button onClick={() => onNavigate('services')} className="px-8 py-4 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-500 transition-colors border border-green-500">Advertise Your Service</button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;

