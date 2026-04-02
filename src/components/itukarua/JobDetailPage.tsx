import React, { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, Clock, Users, Star, Shield, AlertTriangle, Send, ChevronDown, ChevronUp, Phone, Loader2 } from 'lucide-react';
import { getJobById, getBidsForJob, createBid, createPayment, type DbJob, type DbBid } from '@/lib/database';
import { IMAGES } from '@/data/siteData';
import type { Page } from './Header';
import type { UserState } from '../AppLayout';

interface JobDetailPageProps {
  jobId: string;
  onNavigate: (page: Page) => void;
  onBack: () => void;
  user: UserState | null;
  onOpenAuth: (tab: 'login' | 'signup') => void;
  onOpenMpesa: (amount: number, description: string, accountRef: string) => void;
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
    load();
  }, [jobId]);

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
  };

  const handleUnlockContact = async () => {
    if (!user) return;
    try {
      await createPayment({ user_id: user.id, payment_type: 'contact_access', amount: 200, description: `Contact access for job ${job.title}`, related_job_id: job.id });
    } catch (err) { console.error(err); }
    onOpenMpesa(200, 'Contact Access Fee', `JOB-${job.id.slice(0, 8)}`);
    setTimeout(() => setContactUnlocked(true), 500);
  };

  return (
    <div className="min-h-screen bg-gray-50">
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
            <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {daysLeft} days left</span>
            <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {job.bids_count} bids</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl p-6 border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Job Description</h2>
              <p className="text-gray-600 leading-relaxed">{job.description}</p>
              <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-gray-100">
                <div><p className="text-xs text-gray-400">Budget Range</p><p className="font-bold text-green-700">KES {job.budget_min.toLocaleString()} - {job.budget_max.toLocaleString()}</p></div>
                <div><p className="text-xs text-gray-400">Deadline</p><p className="font-semibold text-gray-900">{new Date(job.deadline).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })}</p></div>
                <div><p className="text-xs text-gray-400">Posted By</p><p className="font-semibold text-gray-900">{job.posted_by_name}</p></div>
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
                  {sortedBids.map((bid, idx) => (
                    <div key={bid.id} className={`border rounded-xl p-4 transition-all ${selectedBid === bid.id ? 'border-green-500 bg-green-50' : 'border-gray-100 hover:border-gray-200'}`}>
                      <div className="flex items-start gap-4">
                        <img src={bid.bidder_image || IMAGES.workers[idx % IMAGES.workers.length]} alt={bid.bidder_name || 'Bidder'} className="w-12 h-12 rounded-full object-cover ring-2 ring-gray-100" />
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
                            {selectedBid === bid.id ? (
                              contactUnlocked ? (
                                <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium">
                                  <Phone className="w-4 h-4" /> Contact: {bid.bidder_phone || '+254 7XX XXX XXX'}
                                </div>
                              ) : (
                                <button onClick={handleUnlockContact} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
                                  <Phone className="w-4 h-4" /> Unlock Contact (KES 200)
                                </button>
                              )
                            ) : (
                              <button onClick={() => handleSelectBidder(bid.id)} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors">Select Bidder</button>
                            )}
                          </div>
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
    </div>
  );
};

export default JobDetailPage;
