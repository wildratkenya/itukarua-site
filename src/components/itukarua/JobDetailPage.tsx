import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, MapPin, Clock, Users, Star, Shield, AlertTriangle, Send, ChevronDown, ChevronUp, Phone, Loader2 } from 'lucide-react';
import { getJobById, getBidsForJob, createBid, createPayment, updateJob, createRating, getRatingsForJob, checkIfRated, findOrCreateConversation, checkSubscriptionActive, type DbJob, type DbBid, type DbRating } from '@/lib/database';
import { IMAGES } from '@/data/siteData';
import { optimizeImageUrl, handleImageError } from '@/lib/supabase';
import type { Page } from './Header';
import type { UserState } from '../AppLayout';
import ImageViewerModal from './ImageViewerModal';

interface JobDetailPageProps {
  jobId: string;
  onNavigate: (page: Page) => void;
  onBack: () => void;
  user: UserState | null;
  onOpenAuth: (tab: 'login' | 'signup') => void;
  onOpenMpesa: (amount: number, description: string, accountRef: string, paymentType?: string, relatedAdId?: string) => void;
}

const JobDetailPage: React.FC<JobDetailPageProps> = ({ jobId, onNavigate, onBack, user, onOpenAuth, onOpenMpesa }) => {
  const [job, setJob] = useState<DbJob | null>(null);
  const [bids, setBids] = useState<DbBid[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBidForm, setShowBidForm] = useState(false);
  const [bidPrice, setBidPrice] = useState('');
  const [bidProposal, setBidProposal] = useState('');
  const [bidSubmitted, setBidSubmitted] = useState(false);
  const [bidSubmitting, setBidSubmitting] = useState(false);
  const [sortBids, setSortBids] = useState<'rating' | 'price-low' | 'price-high'>('rating');
  const [selectedBid, setSelectedBid] = useState<string | null>(null);
  const [contactUnlocked, setContactUnlocked] = useState(false);
  const [expandedBid, setExpandedBid] = useState<string | null>(null);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [jobRatings, setJobRatings] = useState<DbRating[]>([]);
  const [hasRated, setHasRated] = useState(false);
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [selectedBidderForRating, setSelectedBidderForRating] = useState<string | null>(null);
  const [selectedBidderName, setSelectedBidderName] = useState('');
  const [viewingImage, setViewingImage] = useState<{ images: string[]; index: number } | null>(null);
  const [subscriptionActive, setSubscriptionActive] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [j, b] = await Promise.all([getJobById(jobId), getBidsForJob(jobId)]);
        setJob(j);
        setBids(b);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    const checkSub = async () => {
      if (user?.role === 'jobseeker') {
        const active = await checkSubscriptionActive(user.id);
        setSubscriptionActive(active);
      }
    };
    load();
    checkSub();
  }, [jobId, user]);


  useEffect(() => {
    const loadRatings = async () => {
      if (job) {
        const ratings = await getRatingsForJob(job.id);
        setJobRatings(ratings);
        if (user) {
          const rated = await checkIfRated(job.id, user.id);
          setHasRated(rated);
        }
      }
    };
    loadRatings();
  }, [job, user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Job Not Found</h2>
          <button onClick={onBack} className="text-green-600 hover:text-green-700 font-medium">Go Back</button>
        </div>
      </div>
    );
  }

  const daysLeft = Math.max(0, Math.ceil((new Date(job.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  const sortedBids = [...bids].sort((a, b) => {
    if (sortBids === 'rating') return (b.bidder_rating || 0) - (a.bidder_rating || 0);
    if (sortBids === 'price-low') return a.price - b.price;
    return b.price - a.price;
  });

  const handleSubmitBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { onOpenAuth('login'); return; }
    if (!bidPrice || !bidProposal.trim()) return;
    setBidSubmitting(true);
    try {
      await createBid({ job_id: jobId, bidder_id: user.id, price: parseInt(bidPrice), proposal: bidProposal });
      setBidSubmitted(true);
      setShowBidForm(false);
      const updatedBids = await getBidsForJob(jobId);
      setBids(updatedBids);
    } catch (err: any) {
      alert(err.message || 'Failed to submit bid');
    } finally { setBidSubmitting(false); }
  };

  const handleSelectBidder = (bidId: string) => {
    if (!user) { onOpenAuth('login'); return; }
    setSelectedBid(bidId);
    setWinnerId(bidId);
  };

  const handleAcceptBid = async (bid: DbBid) => {
    if (!user) { onOpenAuth('login'); return; }
    if (user.id !== job.posted_by) {
      alert('Only the job poster can accept bids');
      return;
    }
    try {
      await updateJob(job.id, { status: 'in-progress' });
      setJob({ ...job, status: 'in-progress' });
      setSelectedBid(bid.id);
      setWinnerId(bid.id);
      alert(`Bid accepted for ${bid.bidder_name || 'this bidder'}! Job is now in progress. Contact will be shared after payment.`);
    } catch (err) {
      console.error('Error accepting bid:', err);
      alert('Failed to accept bid. Please try again.');
    }
  };



  const handleRateWorker = async () => {
    if (!user || !selectedBidderForRating || ratingValue === 0) {
      alert('Please select a rating');
      return;
    }
    setRatingSubmitting(true);
    try {
      await createRating({
        job_id: job.id,
        bidder_id: selectedBidderForRating,
        poster_id: user.id,
        rating: ratingValue,
        comment: ratingComment,
      });
      setShowRatingModal(false);
      setRatingValue(0);
      setRatingComment('');
      const updatedRatings = await getRatingsForJob(job.id);
      setJobRatings(updatedRatings);
      setHasRated(true);
      alert('Rating submitted successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to submit rating');
    } finally {
      setRatingSubmitting(false);
    }
  };

  const openRatingModal = (bidderId: string, bidderName: string) => {
    setSelectedBidderForRating(bidderId);
    setSelectedBidderName(bidderName);
    setShowRatingModal(true);
  };

  const handleCompleteJob = async () => {
    if (!user) return;
    if (user.id !== job.posted_by) {
      alert('Only the job poster can complete the job');
      return;
    }
    try {
      await updateJob(job.id, { status: 'completed' });
      setJob({ ...job, status: 'completed' });
      alert('Job marked as completed! You can now rate the worker.');
      const updatedRatings = await getRatingsForJob(job.id);
      setJobRatings(updatedRatings);
    } catch (err) {
      console.error('Error completing job:', err);
      alert('Failed to complete job. Please try again.');
    }
  };
  const handleMessageBidder = async (bidderId: string) => {
    if (!user) { onOpenAuth('login'); return; }
    try {
      await findOrCreateConversation(user.id, bidderId, job.id);
      onNavigate('inbox');
    } catch (err) {
      console.error('Error starting conversation:', err);
      alert('Could not start conversation. Please try again.');
    }
  };

  const handleUnlockContact = async () => {
    if (!user) return;
    try {
      await createPayment({ user_id: user.id, payment_type: 'contact_access', amount: 100, description: `Contact access for job ${job.title}`, related_job_id: job.id });
    } catch (err) { console.error(err); }
    onOpenMpesa(100, 'Contact Access Fee', `JOB-${job.id.slice(0, 8)}`);
    setTimeout(() => setContactUnlocked(true), 500);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Helmet>
        <title>{job?.title ? `${job.title} - Itukarua` : 'Job Details - Itukarua'}</title>
        <meta name="description" content={job?.description ? job.description.substring(0, 160) : 'View job details on Itukarua'} />
        <link rel="canonical" href={job?.id ? `https://www.itukarua.co.ke/jobs/${job.id}` : 'https://www.itukarua.co.ke/jobs'} />
        <meta property="og:title" content={job?.title ? `${job.title} - Itukarua` : 'Job Details - Itukarua'} />
        <meta property="og:description" content={job?.description ? job.description.substring(0, 160) : 'View job details on Itukarua'} />
        <meta property="og:image" content={job?.images?.[0] || 'https://www.itukarua.co.ke/og.jpg'} />
        <meta property="og:site_name" content="Itukarua" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={job?.title ? `${job.title} - Itukarua` : 'Job Details - Itukarua'} />
        <meta name="twitter:description" content={job?.description ? job.description.substring(0, 160) : 'View job details on Itukarua'} />
        <meta name="twitter:image" content={job?.images?.[0] || 'https://www.itukarua.co.ke/og.jpg'} />
      </Helmet>
      <div className="bg-gradient-to-r from-green-700 to-green-800 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <button onClick={onBack} className="flex items-center gap-2 text-green-200 hover:text-white mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Jobs
          </button>
          <div className="flex flex-wrap items-start gap-3 mb-3">
            <span className="px-3 py-1 bg-white/20 text-white text-xs font-medium rounded-full">{job.category}</span>
            {job.urgent && <span className="px-3 py-1 bg-red-500/80 text-white text-xs font-medium rounded-full flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Urgent</span>}
            <span className="px-3 py-1 bg-green-500/30 text-green-200 text-xs font-medium rounded-full capitalize">{job.status}</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white mb-2">{job.title}</h1>
          <div className="flex flex-wrap gap-4 text-sm text-green-100">
            <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {job.location}</span>
            <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {job.bids_count} bids</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl p-6 border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Job Description</h2>
              <p className="text-gray-600 leading-relaxed mb-6">{job.description}</p>
              
              {job.images && job.images.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Job Images</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {job.images.map((img, i) => (
                      <div key={i} className="relative aspect-video rounded-lg overflow-hidden border border-gray-100 group">
                        <img 
                          src={optimizeImageUrl(img, 400, 400)} 
                          alt={`Job image ${i + 1}`} 
                          loading="lazy"
                          className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                          onClick={() => setViewingImage({ images: job.images, index: i })}
                          onError={handleImageError}
                          draggable={false}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-gray-100">
                <div><p className="text-xs text-gray-400">Budget Range</p><p className="font-bold text-green-700">KES {job.budget_min.toLocaleString()} - {job.budget_max.toLocaleString()}</p></div>
                <div><p className="text-xs text-gray-400">Deadline</p><p className="font-semibold text-gray-900">{new Date(job.deadline).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })}</p></div>
                <div><p className="text-xs text-gray-400">Posted By</p><p className="font-semibold text-gray-400">{job.posted_by_name}</p></div>
                <div><p className="text-xs text-gray-400">Posted Date</p><p className="font-semibold text-gray-900">{new Date(job.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })}</p></div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Bids ({sortedBids.length})</h2>
                <select value={sortBids} onChange={e => setSortBids(e.target.value as any)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none">
                  <option value="rating">Highest Rating</option>
                  <option value="price-low">Lowest Price</option>
                  <option value="price-high">Highest Price</option>
                </select>
              </div>

              {sortedBids.length > 0 ? (
                <div className="space-y-4">
              {job.status === 'completed' && !hasRated && user && user.id === job.posted_by && (
                <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <h3 className="font-semibold text-amber-800 mb-2">Job Completed! Rate the Worker</h3>
                  <p className="text-sm text-amber-700 mb-3">Your feedback helps other employers find quality workers.</p>
                  <button
                    onClick={() => openRatingModal(winnerId || '', bids.find(b => b.id === winnerId)?.bidder_name || 'Worker')}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Rate Worker
                  </button>
                </div>
              )}

              {jobRatings.length > 0 && (
                <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <h3 className="font-semibold text-gray-800 mb-3">Ratings ({jobRatings.length})</h3>
                  <div className="space-y-3">
                    {jobRatings.map((r, idx) => (
                      <div key={idx} className="bg-white p-3 rounded-lg border border-gray-100">
                        <div className="flex items-center gap-2">
                          <div className="flex">
                            {[1, 2, 3, 4, 5].map(star => (
                              <Star key={star} className={`w-4 h-4 ${star <= r.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`} />
                            ))}
                          </div>
                          <span className="text-sm text-gray-500">{new Date(r.created_at).toLocaleDateString()}</span>
                        </div>
                        {r.comment && <p className="text-sm text-gray-600 mt-2">{r.comment}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
                  {sortedBids.map((bid, idx) => (
                    <div key={bid.id} className={`border rounded-xl p-4 transition-all ${selectedBid === bid.id ? 'border-green-500 bg-green-50' : 'border-gray-100 hover:border-gray-200'}`}>
                      <div className="flex items-start gap-4">
                        <img src={optimizeImageUrl(bid.bidder_image || IMAGES.workers[idx % IMAGES.workers.length], 96, 96)} alt={bid.bidder_name || 'Bidder'} className="w-12 h-12 rounded-full object-cover ring-2 ring-gray-100" loading="lazy" onError={handleImageError} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-semibold text-gray-900">{bid.bidder_name || 'Anonymous'}</h4>
                              <div className="flex items-center gap-2 mt-0.5">
                                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                                <span className="text-sm font-medium text-gray-700">{bid.bidder_rating || 0}</span>
                                <span className="text-xs text-gray-400">({bid.bidder_reviews || 0} reviews)</span>
                              </div>
                            </div>
                            <p className="text-lg font-bold text-green-700">KES {bid.price.toLocaleString()}</p>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">{bid.bidder_qualifications || ''} {bid.bidder_experience ? `| ${bid.bidder_experience}` : ''}</p>
                          <button onClick={() => setExpandedBid(expandedBid === bid.id ? null : bid.id)} className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 mt-2">
                            {expandedBid === bid.id ? 'Hide' : 'View'} Proposal {expandedBid === bid.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                          {expandedBid === bid.id && <p className="text-sm text-gray-600 mt-2 p-3 bg-gray-50 rounded-lg">{bid.proposal}</p>}
                          <div className="flex gap-2 mt-3">
                            {winnerId === bid.id ? (
                              <span className="px-4 py-2 bg-amber-100 text-amber-700 rounded-lg text-sm font-medium flex items-center gap-2">
                                <Shield className="w-4 h-4" /> Selected
                              </span>
                            ) : (
                              user && user.id === job.posted_by && (
                                <button onClick={() => handleAcceptBid(bid)} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors">
                                  Accept Bid
                                </button>
                              )
                            )}
                            {user && user.id !== bid.bidder_id && (
                              <button onClick={() => handleMessageBidder(bid.bidder_id)} className="px-4 py-2 border border-green-600 text-green-700 text-sm font-medium rounded-lg hover:bg-green-50 transition-colors">
                                Message
                              </button>
                            )}
                          </div>
                          {winnerId === bid.id && user && user.id === job.posted_by && (
                            contactUnlocked ? (
                              <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium mt-2">
                                <Phone className="w-4 h-4" /> Contact: {bid.bidder_phone || '+254 7XX XXX XXX'}
                              </div>
                            ) : (
                              <button onClick={handleUnlockContact} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 mt-2">
                                <Phone className="w-4 h-4" /> Unlock Contact (KES 100)
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <Users className="w-10 h-10 mx-auto mb-2" /><p className="font-medium">No bids yet</p><p className="text-sm">Be the first to bid on this job!</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl p-6 border border-gray-100 sticky top-24">
              <h3 className="font-semibold text-gray-900 mb-4">Place Your Bid</h3>
              {bidSubmitted ? (
                <div className="text-center py-6">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3"><Send className="w-6 h-6 text-green-600" /></div>
                  <p className="font-semibold text-gray-900">Bid Submitted!</p>
                  <p className="text-sm text-gray-500 mt-1">The employer will review your bid.</p>
                </div>
              ) : showBidForm ? (
                <form onSubmit={handleSubmitBid} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Your Price (KES)</label>
                    <input type="number" value={bidPrice} onChange={e => setBidPrice(e.target.value)} placeholder="e.g. 12000" className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none" required />
                    <p className="text-xs text-gray-400 mt-1">Budget: KES {job.budget_min.toLocaleString()} - {job.budget_max.toLocaleString()}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Your Proposal</label>
                    <textarea value={bidProposal} onChange={e => setBidProposal(e.target.value)} placeholder="Describe why you're the best fit..." rows={4} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none" required />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" disabled={bidSubmitting} className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                      {bidSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Bid'}
                    </button>
                    <button type="button" onClick={() => setShowBidForm(false)} className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
                  </div>
                </form>
              ) : user?.role === 'jobseeker' && !subscriptionActive ? (
                <div>
                  <div className="text-center mb-4">
                    <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-2" />
                    <p className="font-semibold text-gray-900">Subscription Expired</p>
                    <p className="text-sm text-gray-500 mt-1">Renew your subscription for KES 100 to continue bidding.</p>
                  </div>
                  <button onClick={() => onOpenMpesa(100, 'Jobseeker subscription renewal', user.id)} className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors">
                    Renew KES 100
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-500 mb-4">Are you a skilled worker? Submit your bid with your best price and proposal.</p>
                  <button onClick={() => { if (!user) { onOpenAuth('signup'); return; } setShowBidForm(true); }} className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2">
                    <Send className="w-4 h-4" /> Bid on This Job
                  </button>
                  {!user && <p className="text-xs text-center text-gray-400 mt-2">You must be registered to bid</p>}
                </div>
              )}
            </div>
            <div className="bg-green-50 rounded-xl p-5 border border-green-100">
              <h4 className="font-semibold text-green-800 mb-2 flex items-center gap-2"><Shield className="w-4 h-4" /> Secure Payment</h4>
              <p className="text-sm text-green-700">All payments are processed securely through M-Pesa. The platform charges a small fee to connect you with the right talent.</p>
            </div>
          </div>
        </div>
      </div>
      {showRatingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Rate {selectedBidderName}</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Rating</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    onClick={() => setRatingValue(star)}
                    className="focus:outline-none"
                  >
                    <Star className={`w-8 h-8 ${star <= ratingValue ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`} />
                  </button>
                ))}
              </div>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Comment (optional)</label>
              <textarea
                value={ratingComment}
                onChange={e => setRatingComment(e.target.value)}
                placeholder="Share your experience working with this worker..."
                rows={3}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none"
              />
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleRateWorker}
                disabled={ratingSubmitting || ratingValue === 0}
                className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {ratingSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Rating'}
              </button>
              <button
                onClick={() => setShowRatingModal(false)}
                className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {viewingImage && (
        <ImageViewerModal
          images={viewingImage.images}
          initialIndex={viewingImage.index}
          onClose={() => setViewingImage(null)}
        />
      )}
    </div>
  );
};

export default JobDetailPage;


