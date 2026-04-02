import React, { useState, useEffect, useCallback } from 'react';
import { Search, SlidersHorizontal, X, Plus } from 'lucide-react';
import ServiceCard from './ServiceCard';
import { SERVICE_CATEGORIES, LOCATIONS, IMAGES } from '@/data/siteData';
import { getServiceAds, type DbServiceAd } from '@/lib/database';
import type { Page } from './Header';

interface ServicesPageProps {
  onNavigate: (page: Page) => void;
}

const ServicesPage: React.FC<ServicesPageProps> = ({ onNavigate }) => {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All Services');
  const [location, setLocation] = useState('All Locations');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedService, setSelectedService] = useState<DbServiceAd | null>(null);
  const [services, setServices] = useState<DbServiceAd[]>([]);
  const [loading, setLoading] = useState(true);

  const loadServices = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getServiceAds({
        category: category !== 'All Services' ? category : undefined,
        location: location !== 'All Locations' ? location : undefined,
        search: search.trim() || undefined,
        activeOnly: true,
      });
      setServices(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [search, category, location]);

  useEffect(() => { loadServices(); }, [loadServices]);

  const mapService = (s: DbServiceAd) => ({
    id: s.id,
    businessName: s.business_name,
    description: s.description,
    category: s.category,
    image: s.image || IMAGES.services[0],
    location: s.location,
    contact: s.contact,
    plan: s.plan,
    expiryDate: s.expiry_date,
    featured: s.featured,
    rating: Number(s.rating) || 0,
    reviews: s.reviews_count,
  });

  const clearFilters = () => { setSearch(''); setCategory('All Services'); setLocation('All Locations'); };
  const hasActiveFilters = search || category !== 'All Services' || location !== 'All Locations';

  return (
    <div className="min-h-screen bg-gray-50">
      {selectedService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedService(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <img src={selectedService.image || IMAGES.services[0]} alt={selectedService.business_name} className="w-full h-56 object-cover rounded-t-2xl" />
            <div className="p-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">{selectedService.category}</span>
                {selectedService.featured && <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Featured</span>}
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">{selectedService.business_name}</h2>
              <p className="text-gray-600 mb-4">{selectedService.description}</p>
              <div className="space-y-2 text-sm text-gray-600">
                <p><span className="font-medium text-gray-900">Location:</span> {selectedService.location}</p>
                <p><span className="font-medium text-gray-900">Contact:</span> {selectedService.contact}</p>
                <p><span className="font-medium text-gray-900">Plan:</span> {selectedService.plan}</p>
                <p><span className="font-medium text-gray-900">Rating:</span> {Number(selectedService.rating) || 0}/5 ({selectedService.reviews_count} reviews)</p>
              </div>
              <button onClick={() => setSelectedService(null)} className="w-full mt-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-gradient-to-r from-green-700 to-green-800 py-10 lg:py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
                  {SERVICE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Location</label>
                <select value={location} onChange={e => setLocation(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none">
                  {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
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
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {SERVICE_CATEGORIES.map(c => (
            <button key={c} onClick={() => setCategory(c)} className={`px-4 py-2 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${category === c ? 'bg-green-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}>{c}</button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <p className="text-sm text-gray-500 mb-6">Showing <span className="font-semibold text-gray-900">{services.length}</span> businesses & services</p>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {[1,2,3,4].map(i => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden animate-pulse">
                <div className="h-48 bg-gray-200" />
                <div className="p-4"><div className="h-4 bg-gray-200 rounded w-1/3 mb-2" /><div className="h-5 bg-gray-200 rounded w-3/4 mb-2" /><div className="h-3 bg-gray-200 rounded w-full" /></div>
              </div>
            ))}
          </div>
        ) : services.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {services.map(service => (
              <ServiceCard key={service.id} service={mapService(service)} onClick={() => setSelectedService(service)} />
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
    </div>
  );
};

export default ServicesPage;
