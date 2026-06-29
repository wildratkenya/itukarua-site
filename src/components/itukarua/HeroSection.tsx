import React, { useState, useEffect } from 'react';
import { Search, MapPin, Briefcase, Building2, Users, ArrowRight, UserCheck, Star, CreditCard, SlidersHorizontal } from 'lucide-react';
import { IMAGES, JOB_CATEGORIES, LOCATIONS } from '@/data/siteData';
import { supabase } from '@/lib/supabase';
import { getCustomCategories, getNewsletterSubscribers } from '@/lib/database';
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

const HeroSection: React.FC<HeroSectionProps> = ({ onNavigate, onSearch, stats }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [extraCats, setExtraCats] = useState<string[]>([]);
  const [subCount, setSubCount] = useState(0);

  useEffect(() => {
    getCustomCategories('job').then(setExtraCats);
    getNewsletterSubscribers().then(subs => setSubCount(subs.length));
  }, []);

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

            <div className="flex items-center justify-between gap-3 mb-6">
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
    </section>
  );
};

export default HeroSection;
