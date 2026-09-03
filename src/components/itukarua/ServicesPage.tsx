import React, { useState, useEffect, useMemo } from 'react';
import SEO from '@/lib/seo';
import { Search, SlidersHorizontal, X, Plus, Zap } from 'lucide-react';
import ServiceCard from './ServiceCard';
import VerticalAdRail from './VerticalAdRail';
import JobListingsTopBanner from './JobListingsTopBanner';
import { optimizeImageUrl, handleImageError } from '@/lib/supabase';
import { IMAGES, KENYA_COUNTIES } from '@/data/siteData';
import { getSubcounties } from '@/data/kenyaLocations';
import { useServiceAds } from '@/hooks/useQueries';
import { createServiceRating, checkServiceRating, getCustomCategories } from '@/lib/database';
import { supabase } from '@/lib/supabase';
import type { Page } from './Header';
import ImageViewerModal from './ImageViewerModal';

interface ServicesPageProps {
  onNavigate: (page: Page) => void;
  onViewService: (serviceId: string) => void;
}

const ServicesPage: React.FC<ServicesPageProps> = ({ onNavigate, onViewService }) => {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All Services');
  const [subcounty, setSubcounty] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [county, setCounty] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [dbCats, setDbCats] = useState<string[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  useEffect(() => { getCustomCategories('service').then(setDbCats); }, []);


  const filters = useMemo(() => ({
    category: category !== 'All Services' ? category : undefined,
    subcounty: subcounty || undefined,
    county: county || undefined,
    search: search.trim() || undefined,
  }), [category, subcounty, county, search]);

  const { data: servicesData = [], isLoading, error, refetch } = useServiceAds(filters);

  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  const loading = isLoading && !timedOut;
  const hasError = !!error;

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

  const clearFilters = () => { setSearch(''); setCategory('All Services'); setSubcounty(''); setCounty(''); setLocationFilter(''); };
  const hasActiveFilters = search || category !== 'All Services' || !!subcounty || !!county || !!locationFilter;

  return (
    <div className="min-h-screen bg-gray-50">
      <SEO
        title="Find Local Services in Kenya - Plumbers, Electricians, Mechanics & More"
        description="Find trusted service providers across Kenya. Browse plumbers, electricians, mechanics, tutors, and more in all 47 counties."
        canonical="/services"
      />

      <div className="relative py-10 lg:py-14 overflow-hidden">
        <img src="/images/services.png" alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
        <div className="absolute inset-0 bg-black/40"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl lg:text-4xl font-bold text-white mb-2">Services & Business Directory</h1>
          <p className="text-green-100 mb-6">Discover local businesses and service providers in your area</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search businesses or services..." className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-green-400 outline-none text-sm" />
            </div>
            <button onClick={() => setShowFilters(!showFilters)} className="flex items-center justify-center gap-2 px-5 py-3.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors border border-white/20">
              <SlidersHorizontal className="w-4 h-4" /> Filters
            </button>
            <button onClick={() => onNavigate('post-advert')} className="px-6 py-3.5 bg-white text-green-700 font-semibold rounded-xl hover:bg-green-50 transition-colors flex items-center gap-2">
              <Plus className="w-4 h-4" /> Post Advert
            </button>
          </div>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white border-b border-gray-100 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                <select value={category} onChange={e => setCategory(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none">
                  <option value="All Services">All Services</option>
                  {dbCats.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">County</label>
                <select value={county} onChange={e => setCounty(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none">
                  <option value="">All Counties</option>
                  {KENYA_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {county && getSubcounties(county).length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Sub County</label>
                <select value={subcounty} onChange={e => setSubcounty(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none">
                  <option value="">All Sub Counties</option>
                  {getSubcounties(county).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Location</label>
                <input type="text" value={locationFilter} onChange={e => setLocationFilter(e.target.value)} placeholder="e.g. Near church, Town center..." className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none w-52" />
              </div>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="flex items-center gap-1 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors mt-5">
                  <X className="w-4 h-4" /> Clear All
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-200 flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center shadow-sm">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Boost your business to the top!</p>
              <p className="text-xs text-gray-500">KES 500 � Appear first in search + homepage for 7 days</p>
            </div>
          </div>
          <button onClick={() => onNavigate('dashboard')} className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-sm font-bold rounded-lg transition-all shadow-sm whitespace-nowrap flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" /> Boost Now
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button key="all-services" onClick={() => setCategory('All Services')} className={`px-4 py-2 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${category === 'All Services' ? 'bg-green-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}>All Services</button>
          {dbCats.map(c => (
            <button key={c} onClick={() => setCategory(c)} className={`px-4 py-2 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${category === c ? 'bg-green-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}>{c}</button>
          ))}
        </div>
      </div>

      <JobListingsTopBanner />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-6 items-start">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-500 mb-6">Showing <span className="font-semibold text-gray-900">{services.length}</span> businesses & services</p>
            {isLoading ? (
              <div className="flex flex-col gap-3">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="bg-white rounded-xl border border-gray-100 p-3 animate-pulse flex gap-3">
                    <div className="w-36 h-28 rounded-lg bg-gray-200 flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-gray-200 rounded w-1/4" />
                      <div className="h-4 bg-gray-200 rounded w-3/4" />
                      <div className="h-3 bg-gray-200 rounded w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : services.length > 0 ? (
              <div className="flex flex-col gap-3">
                {services.map(service => (
                  <ServiceCard key={service.id} service={service} onClick={() => onViewService(service.id)} compact />
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4"><Search className="w-7 h-7 text-gray-400" /></div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No services found</h3>
                <p className="text-sm text-gray-500 mb-4">Try adjusting your search or filters</p>
                <button onClick={clearFilters} className="px-5 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors">Clear Filters</button>
              </div>
            )}
          </div>
          <aside className="hidden lg:block w-64 xl:w-72 flex-shrink-0 sticky top-6">
            <VerticalAdRail />
          </aside>
        </div>
      </div>
    </div>
  );
};

export default ServicesPage;

