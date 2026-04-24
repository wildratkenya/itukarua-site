import React, { useState, useEffect } from 'react';
import { ArrowRight, Briefcase, UserCheck, CreditCard, Star, Shield, Clock, Zap } from 'lucide-react';
import HeroSection from './HeroSection';
import JobCard from './JobCard';
import ServiceCard from './ServiceCard';
import { IMAGES } from '@/data/siteData';
import { useJobs, useServiceAds, useProfiles } from '@/hooks/useQueries';
import { getPlatformStats, type PlatformStats } from '@/lib/database';
import type { Page } from './Header';

interface HomePageProps {
  onNavigate: (page: Page) => void;
  onSearch: (query: string) => void;
  onViewJob: (jobId: string) => void;
}

const HomePage: React.FC<HomePageProps> = ({ onNavigate, onSearch, onViewJob }) => {
  const [stats, setStats] = useState<PlatformStats>({ active_jobs: 0, registered_workers: 0, active_businesses: 0, completed_jobs: 0, total_payments: 0, counties_served: 0 });
  const [selectedService, setSelectedService] = useState<any | null>(null);

  // Load homepage data with retry logic
  const { data: jobsData = [], isLoading: jobsLoading, error: jobsError, refetch: refetchJobs } = useJobs({ limit: 6 });
  const { data: servicesData = [], isLoading: servicesLoading, error: servicesError, refetch: refetchServices } = useServiceAds({ limit: 4 });
  const { data: workersData = [], isLoading: workersLoading, error: workersError, refetch: refetchWorkers } = useProfiles({ limit: 6 });

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
      return {
        id: s.id,
        businessName: s.business_name,
        description: s.description,
        category: s.category,
        image: s.image || (Array.isArray(s.images) && s.images[0]) || IMAGES.services[0],
        location: s.location,
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <img src={selectedService.image || IMAGES.services[0]} alt={selectedService.businessName} className="w-full h-56 object-cover rounded-t-2xl" loading="lazy" />
            <div className="p-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">{selectedService.category}</span>
                {selectedService.featured && <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Featured</span>}
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">{selectedService.businessName}</h2>
              <p className="text-gray-600 mb-4">{selectedService.description}</p>
              <div className="space-y-2 text-sm text-gray-600">
                <p><span className="font-medium text-gray-900">Location:</span> {selectedService.location}</p>
                <p><span className="font-medium text-gray-900">Contact:</span> {selectedService.contact}</p>
                <p><span className="font-medium text-gray-900">Rating:</span> {Number(selectedService.rating) || 0}/5 ({selectedService.reviews} reviews)</p>
              </div>
              <button onClick={() => setSelectedService(null)} className="w-full mt-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* How It Works */}
      <section className="py-16 lg:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">How Itukarua Works</h2>
            <p className="text-gray-500 max-w-2xl mx-auto">Simple steps to connect with local talent and opportunities</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { icon: Briefcase, title: 'Post a Job', desc: 'Describe your job, set a budget, and publish it for local workers to see.', color: 'bg-green-100 text-green-600' },
              { icon: UserCheck, title: 'Receive Bids', desc: 'Qualified workers bid on your job with proposals, pricing, and ratings.', color: 'bg-blue-100 text-blue-600' },
              { icon: Star, title: 'Choose the Best', desc: 'Compare bidders by rating, price, and qualifications. Pick the best fit.', color: 'bg-amber-100 text-amber-600' },
              { icon: CreditCard, title: 'Pay via M-Pesa', desc: 'Securely pay through M-Pesa. Workers get paid after job completion.', color: 'bg-purple-100 text-purple-600' },
            ].map((step, i) => (
              <div key={i} className="text-center group">
                <div className="relative inline-block mb-4">
                  <div className={`w-16 h-16 ${step.color} rounded-2xl flex items-center justify-center mx-auto group-hover:scale-110 transition-transform`}>
                    <step.icon className="w-7 h-7" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-7 h-7 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold">{i + 1}</div>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-500">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Jobs */}
      <section className="py-16 lg:py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl lg:text-3xl font-bold text-gray-900">Latest Jobs</h2>
              <p className="text-gray-500 mt-1">Find local work opportunities near you</p>
            </div>
            <button onClick={() => onNavigate('jobs')} className="hidden sm:flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors">
              View All Jobs <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1,2,3].map(i => (
                <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
                  <div className="h-5 bg-gray-200 rounded w-3/4 mb-3" />
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {jobs.map(job => (
                <JobCard key={job.id} job={job} onViewJob={onViewJob} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Featured Services */}
      <section className="py-16 lg:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl lg:text-3xl font-bold text-gray-900">Featured Services</h2>
              <p className="text-gray-500 mt-1">Local businesses and service providers</p>
            </div>
            <button onClick={() => onNavigate('services')} className="hidden sm:flex items-center gap-2 px-5 py-2.5 border border-gray-300 hover:border-green-600 hover:text-green-700 text-sm font-semibold rounded-lg transition-colors">
              View All Services <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {[1,2,3,4].map(i => (
                <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden animate-pulse">
                  <div className="h-48 bg-gray-200" />
                  <div className="p-4"><div className="h-4 bg-gray-200 rounded w-1/3 mb-2" /><div className="h-5 bg-gray-200 rounded w-3/4 mb-2" /></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {services.map(service => (
                <ServiceCard key={service.id} service={service} onClick={() => setSelectedService(service)} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Top Workers */}
      <section className="py-16 lg:py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-2xl lg:text-3xl font-bold text-gray-900">Top Rated Workers</h2>
            <p className="text-gray-500 mt-1">Verified and trusted professionals in your area</p>
          </div>
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {[1,2,3,4,5,6].map(i => (
                <div key={i} className="bg-white rounded-xl p-4 animate-pulse">
                  <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto mb-3" />
                  <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {workersData.map((worker, idx) => (
                <div key={worker.id} className="bg-white rounded-xl p-4 text-center border border-gray-100 hover:border-green-200 hover:shadow-md transition-all group">
                  <img src={worker.profile_image || IMAGES.workers[idx % IMAGES.workers.length]} alt={worker.full_name} className="w-16 h-16 rounded-full mx-auto mb-3 object-cover ring-2 ring-gray-100 group-hover:ring-green-200 transition-all" />
                  <h4 className="font-semibold text-gray-900 text-sm mb-0.5 line-clamp-1">{worker.full_name}</h4>
                  <p className="text-xs text-gray-500 mb-2">{worker.skills?.[0] || 'Worker'}</p>
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
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-16 lg:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Why Choose Itukarua?</h2>
              <p className="text-gray-500 mb-8">We're building the largest community marketplace in Central Kenya, connecting talent with opportunity.</p>
              <div className="space-y-4">
                {[
                  { icon: Shield, title: 'Verified Workers', desc: 'All workers are vetted and verified before they can bid on jobs.' },
                  { icon: CreditCard, title: 'Secure M-Pesa Payments', desc: 'All transactions go through M-Pesa for maximum security and convenience.' },
                  { icon: Clock, title: 'Fast Matching', desc: 'Post a job and receive bids within hours from local skilled workers.' },
                  { icon: Zap, title: 'Community Driven', desc: 'Built by and for the local community, supporting economic growth.' },
                ].map((item, i) => (
                  <div key={i} className="flex gap-4 p-4 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <item.icon className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">{item.title}</h4>
                      <p className="text-sm text-gray-500">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <img src={IMAGES.community[0]} alt="Community" className="rounded-2xl shadow-xl w-full" />
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
