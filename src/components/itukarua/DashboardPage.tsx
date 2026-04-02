import React, { useState, useEffect } from 'react';
import { Briefcase, FileText, CreditCard, User, Star, MapPin, Clock, TrendingUp, Users, Building2, Settings, Bell, Loader2 } from 'lucide-react';
import { getJobs, getBidsByUser, getServiceAds, getPayments, getWorkers, getAllProfiles, getPlatformStats, updateProfile, type DbJob, type DbBid, type DbServiceAd, type DbPayment, type DbProfile, type PlatformStats } from '@/lib/database';
import { IMAGES } from '@/data/siteData';
import type { Page } from './Header';
import type { UserState } from '../AppLayout';

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
  const [payments, setPayments] = useState<DbPayment[]>([]);
  const [profiles, setProfiles] = useState<DbProfile[]>([]);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [profileForm, setProfileForm] = useState({ full_name: user.name, email: user.email, phone: '', location: '' });
  const [saving, setSaving] = useState(false);

  const isAdmin = user.role === 'admin';
  const isJobseeker = user.role === 'jobseeker';

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const promises: Promise<any>[] = [
          getPayments(isAdmin ? undefined : user.id),
        ];
        if (isAdmin) {
          promises.push(getJobs({}), getServiceAds({}), getAllProfiles(), getPlatformStats());
        } else if (isJobseeker) {
          promises.push(getBidsByUser(user.id));
        } else {
          promises.push(getJobs({ postedBy: user.id }), getServiceAds({ ownerId: user.id }));
        }

        const results = await Promise.all(promises);
        setPayments(results[0] || []);

        if (isAdmin) {
          setJobs(results[1] || []);
          setAds(results[2] || []);
          setProfiles(results[3] || []);
          setStats(results[4] || null);
        } else if (isJobseeker) {
          setBids(results[1] || []);
        } else {
          setJobs(results[1] || []);
          setAds(results[2] || []);
        }

        if (user.profile) {
          setProfileForm({
            full_name: user.profile.full_name || user.name,
            email: user.profile.email || user.email,
            phone: user.profile.phone || '',
            location: user.profile.location || '',
          });
        }
      } catch (err) { console.error('Dashboard load error:', err); }
      finally { setLoading(false); }
    };
    load();
  }, [user.id, user.role, isAdmin, isJobseeker]);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await updateProfile(user.id, { full_name: profileForm.full_name, phone: profileForm.phone, location: profileForm.location });
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const tabs = isAdmin
    ? [{ id: 'overview', label: 'Overview', icon: TrendingUp }, { id: 'users', label: 'Users', icon: Users }, { id: 'jobs', label: 'Jobs', icon: Briefcase }, { id: 'payments', label: 'Payments', icon: CreditCard }, { id: 'adverts', label: 'Adverts', icon: Building2 }, { id: 'settings', label: 'Settings', icon: Settings }]
    : isJobseeker
    ? [{ id: 'overview', label: 'Overview', icon: TrendingUp }, { id: 'bids', label: 'My Bids', icon: FileText }, { id: 'payments', label: 'Payments', icon: CreditCard }, { id: 'profile', label: 'Profile', icon: User }]
    : [{ id: 'overview', label: 'Overview', icon: TrendingUp }, { id: 'jobs', label: 'My Jobs', icon: Briefcase }, { id: 'adverts', label: 'My Adverts', icon: Building2 }, { id: 'payments', label: 'Payments', icon: CreditCard }, { id: 'profile', label: 'Profile', icon: User }];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
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
            <button className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors relative">
              <Bell className="w-5 h-5 text-white" />
            </button>
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
              ] : [
                { label: 'Posted Jobs', value: jobs.length.toString(), icon: Briefcase, color: 'bg-blue-100 text-blue-600' },
                { label: 'Total Bids', value: jobs.reduce((sum, j) => sum + j.bids_count, 0).toString(), icon: FileText, color: 'bg-green-100 text-green-600' },
                { label: 'Payments', value: payments.length.toString(), icon: CreditCard, color: 'bg-amber-100 text-amber-600' },
                { label: 'Active Adverts', value: ads.length.toString(), icon: Building2, color: 'bg-purple-100 text-purple-600' },
              ]).map((stat, i) => (
                <div key={i} className="bg-white rounded-xl p-5 border border-gray-100">
                  <div className={`w-10 h-10 ${stat.color} rounded-lg flex items-center justify-center mb-3`}><stat.icon className="w-5 h-5" /></div>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                </div>
              ))}
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

        {activeTab === 'adverts' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">{isAdmin ? 'All Adverts' : 'My Adverts'}</h3>
              <button onClick={() => onNavigate('post-advert')} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors">Post New Advert</button>
            </div>
            {ads.length > 0 ? ads.map(ad => (
              <div key={ad.id} className="bg-white rounded-xl p-4 border border-gray-100 flex items-center gap-4">
                <img src={ad.image || IMAGES.services[0]} alt={ad.business_name} className="w-16 h-16 rounded-lg object-cover" />
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
                <button onClick={handleSaveProfile} disabled={saving} className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
                </button>
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
                  { label: 'Jobseeker Registration', desc: 'One-time fee', val: 500 },
                  { label: 'Contact Access Fee', desc: 'Per contact unlock', val: 200 },
                ].map((fee, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div><p className="font-medium text-gray-900">{fee.label}</p><p className="text-xs text-gray-500">{fee.desc}</p></div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">KES</span>
                      <input type="number" defaultValue={fee.val} className="w-24 px-3 py-2 rounded-lg border border-gray-300 text-right focus:ring-2 focus:ring-green-500 outline-none" />
                    </div>
                  </div>
                ))}
                <button className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors">Save Settings</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
