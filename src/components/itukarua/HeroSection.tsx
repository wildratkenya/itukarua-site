import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Briefcase, Building2, Users, ArrowRight, UserCheck, Star, CreditCard, SlidersHorizontal, ExternalLink, X } from 'lucide-react';
import { IMAGES, JOB_CATEGORIES, LOCATIONS } from '@/data/siteData';
import { getCustomCategories, getNewsletterSubscribers, getActiveAds, incrementAdClick, incrementAdDisplay } from '@/lib/database';
import { optimizeImageUrl, handleImageError } from '@/lib/supabase';
import type { PlatformStats } from '@/lib/database';
import type { Page } from './Header';

interface HeroSectionProps {
  onNavigate: (page: Page) => void;
  onSearch: (query: string) => void;
  stats?: PlatformStats;
}

const steps = [
  { icon: Briefcase, title: 'Post a Job', desc: 'Describe your job, set a budget, and publish it to local workers.', color: 'bg-green-100 text-green-600' },
  { icon: UserCheck, title: 'Receive Bids', desc: 'Workers review and submit bids with their best proposals and pricing.', color: 'bg-blue-100 text-blue-600' },
  { icon: Star, title: 'Choose Best', desc: 'Compare bids by rating, experience, and price — pick the right fit.', color: 'bg-amber-100 text-amber-600' },
  { icon: CreditCard, title: 'Pay via M-Pesa', desc: 'Complete payment through M-Pesa after job completion. Secure and fast.', color: 'bg-purple-100 text-purple-600' },
];

const AD_INTERVAL = 5000;

const HeroSection: React.FC<HeroSectionProps> = ({ onNavigate, onSearch, stats }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [extraCats, setExtraCats] = useState<string[]>([]);
  const [subCount, setSubCount] = useState(0);
  const [affiliateAds, setAffiliateAds] = useState<any[]>([]);
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [modalAd, setModalAd] = useState<any>(null);
  const displayedAds = useRef<Set<string>>(new Set());
  const rotationRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    getCustomCategories('job').then(setExtraCats).catch(() => {});
    getNewsletterSubscribers().then(subs => setSubCount(subs.length)).catch(() => {});
    getActiveAds().then(ads => {
      if (ads && ads.length > 0) setAffiliateAds(ads);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (affiliateAds.length === 0) return;
    if (rotationRef.current) clearInterval(rotationRef.current);
    rotationRef.current = setInterval(() => {
      if (!isHovered) {
        setCurrentAdIndex(prev => (prev + 1) % affiliateAds.length);
      }
    }, AD_INTERVAL);
    return () => { if (rotationRef.current) clearInterval(rotationRef.current); };
  }, [affiliateAds.length, isHovered]);

  useEffect(() => {
    if (affiliateAds.length === 0) return;
    const ad = affiliateAds[currentAdIndex];
    if (ad && !displayedAds.current.has(ad.id)) {
      displayedAds.current.add(ad.id);
      incrementAdDisplay(ad.id);
    }
  }, [currentAdIndex, affiliateAds]);

  const currentAd = affiliateAds.length > 0 ? affiliateAds[currentAdIndex] : null;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearch(searchQuery);
    }
  };

  const handleFilteredSearch = () => {
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set('q', searchQuery.trim());
    if (filterCategory) params.set('category', filterCategory);
    if (filterLocation) params.set('location', filterLocation);
    onSearch(params.toString());
  };

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0">
        <img src={IMAGES.hero} alt="Itukarua Community" fetchpriority="high" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        <div className="absolute inset-0 bg-gradient-to-r from-gray-900/90 via-gray-900/75 to-gray-900/60" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-8 lg:pt-8 lg:pb-10">
        <div className="grid lg:grid-cols-5 gap-8 items-start">
          {/* Left Column: Hero Content */}
          <div className="lg:col-span-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-500/20 border border-green-500/30 rounded-full mb-4">
              <MapPin className="w-3 h-3 text-green-400" />
              <span className="text-xs text-green-300 font-medium">Itukarua County & Surrounding Areas</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight mb-3">
              Karibu<span className="text-green-400"> Itukarua</span>
            </h1>
            <p className="text-base text-gray-300 mb-6 max-w-xl">
              Connecting local communities across Kenya. Find jobs, hire skilled workers, advertise services, and transact securely with M-Pesa.
            </p>

            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search jobs, services, or businesses..."
                  className="w-full pl-10 pr-3 py-3 rounded-lg bg-white/95 backdrop-blur-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-green-500 outline-none text-sm shadow-lg"
                />
              </div>
              <button type="submit" className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors shadow-lg flex items-center justify-center gap-2">
                Search <ArrowRight className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => setShowFilters(!showFilters)} className={`px-3 py-3 rounded-lg border transition-colors flex items-center gap-1.5 text-sm ${showFilters ? 'bg-green-700 border-green-500 text-white' : 'bg-white/10 border-white/20 text-gray-300 hover:bg-white/20'}`}>
                <SlidersHorizontal className="w-4 h-4" /> Filters
              </button>
            </form>
            {showFilters && (
              <div className="flex flex-col sm:flex-row gap-2 mb-4">
                <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="px-3 py-2 rounded-lg bg-white/90 text-gray-900 text-sm border border-gray-300 focus:ring-2 focus:ring-green-500 outline-none">
                  <option value="">All Categories</option>
                  {[...JOB_CATEGORIES.filter(c => c !== 'All Categories'), ...extraCats].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={filterLocation} onChange={e => setFilterLocation(e.target.value)} className="px-3 py-2 rounded-lg bg-white/90 text-gray-900 text-sm border border-gray-300 focus:ring-2 focus:ring-green-500 outline-none">
                  <option value="">All Locations</option>
                  {LOCATIONS.filter(l => l !== 'All Locations').map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                <button onClick={handleFilteredSearch} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors">Apply</button>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex gap-2">
                <button onClick={() => onNavigate('jobs')} className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg transition-all">
                  <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center"><Briefcase className="w-4 h-4 text-green-400" /></div>
                  <div className="text-left"><p className="text-white font-semibold text-xs">Find Jobs</p><p className="text-gray-400 text-[10px]">Browse opportunities</p></div>
                </button>
                <button onClick={() => onNavigate('services')} className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg transition-all">
                  <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center"><Building2 className="w-4 h-4 text-orange-400" /></div>
                  <div className="text-left"><p className="text-white font-semibold text-xs">Services</p><p className="text-gray-400 text-[10px]">Local businesses</p></div>
                </button>
                <button onClick={() => onNavigate('post-job')} className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg transition-all">
                  <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center"><Users className="w-4 h-4 text-purple-400" /></div>
                  <div className="text-left"><p className="text-white font-semibold text-xs">Post a Job</p><p className="text-gray-400 text-[10px]">Hire local talent</p></div>
                </button>
              </div>
              <div className="flex gap-4 lg:gap-6 flex-shrink-0">
                {[
                  { label: 'Active Jobs', value: `${stats?.active_jobs || 0}+` },
                  { label: 'Workers', value: `${stats?.registered_workers || 0}+` },
                  { label: 'Subscribers', value: `${subCount}+` },
                  { label: 'Jobs Done', value: `${stats?.completed_jobs || 0}+` },
                ].map(stat => (
                  <div key={stat.label}>
                    <p className="text-lg lg:text-xl font-bold text-white">{stat.value}</p>
                    <p className="text-[10px] text-gray-400">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Affiliate Ad — Image-only banner, click opens modal */}
            {currentAd && (
              <div className="mb-6 group" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
                <button
                  onClick={() => setModalAd(currentAd)}
                  className="w-full relative rounded-xl overflow-hidden border border-white/10 hover:border-white/20 transition-all focus:outline-none"
                >
                  <img
                    key={currentAdIndex}
                    src={optimizeImageUrl(currentAd.image_url, 1200, 150)}
                    alt={currentAd.title}
                    className="w-full aspect-[728/90] object-fill animate-fade-in"
                    loading="lazy"
                    onError={handleImageError}
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                  <span className="absolute top-2 right-2 px-1.5 py-0.5 bg-amber-500/80 text-white text-[10px] font-bold rounded uppercase">Ad</span>
                </button>
                {affiliateAds.length > 1 && (
                  <div className="flex items-center justify-center gap-1.5 mt-1.5">
                    {affiliateAds.map((_, i) => (
                      <button
                        key={i}
                        onClick={e => { e.stopPropagation(); setCurrentAdIndex(i); }}
                        className={`w-1.5 h-1.5 rounded-full transition-colors ${i === currentAdIndex ? 'bg-white' : 'bg-white/30 hover:bg-white/50'}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column: How It Works Timeline */}
          <div className="lg:col-span-2 bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/10">
            <h3 className="text-white font-bold text-base mb-5 flex items-center gap-2">
              <span className="w-1.5 h-5 bg-green-400 rounded-full" />
              How Itukarua Works
            </h3>
            <div className="relative">
              <div className="absolute left-4 top-3 bottom-3 w-0.5 bg-white/20" />
              {steps.map((step, i) => (
                <div key={i} className="relative flex items-start gap-4 pb-6 last:pb-0">
                  <div className="relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-green-500 text-white text-xs font-bold">
                    {i + 1}
                  </div>
                  <div className="flex items-start gap-3 flex-1 min-w-0 pt-0.5">
                    <div className={`w-9 h-9 ${step.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                      <step.icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white">{step.title}</h4>
                      <p className="text-xs text-gray-300 mt-1 leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Ad Modal — WhatsApp / Website popup */}
      {modalAd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setModalAd(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="relative">
              <img src={optimizeImageUrl(modalAd.image_url, 600, 400)} alt={modalAd.title} className="w-full h-48 object-cover" />
              <button onClick={() => setModalAd(null)} className="absolute top-2 right-2 w-7 h-7 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors"><X className="w-4 h-4" /></button>
              <span className="absolute top-2 left-2 px-1.5 py-0.5 bg-amber-500/80 text-white text-[10px] font-bold rounded uppercase">Ad</span>
            </div>
            <div className="p-5">
              <h3 className="text-lg font-bold text-gray-900 mb-1">{modalAd.title}</h3>
              {modalAd.description && <p className="text-sm text-gray-500 mb-4">{modalAd.description}</p>}
              <div className="space-y-3">
                <a
                  href={`https://wa.me/${modalAd.whatsapp_number || '254700000000'}?text=${encodeURIComponent(`Hi, I'm interested in "${modalAd.title}" from Itukarua`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => incrementAdClick(modalAd.id)}
                  className="flex items-center justify-center gap-2 w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  Chat on WhatsApp
                </a>
                {modalAd.destination_url && (
                <a
                  href={`${modalAd.destination_url}?ref=ad_${modalAd.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => incrementAdClick(modalAd.id)}
                  className="flex items-center justify-center gap-2 w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
                >
                  <ExternalLink className="w-5 h-5" />
                  {modalAd.cta_text || 'Visit Website'}
                </a>
                )}
              </div>
              <button onClick={() => setModalAd(null)} className="w-full mt-3 py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default HeroSection;
