import React, { useState } from 'react';
import { Search, MapPin, Briefcase, Building2, Users, ArrowRight } from 'lucide-react';
import { IMAGES } from '@/data/siteData';
import type { PlatformStats } from '@/lib/database';
import type { Page } from './Header';

interface HeroSectionProps {
  onNavigate: (page: Page) => void;
  onSearch: (query: string) => void;
  stats?: PlatformStats;
}

const HeroSection: React.FC<HeroSectionProps> = ({ onNavigate, onSearch, stats }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearch(searchQuery);
    }
  };

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0">
        <img src={IMAGES.hero} alt="Itukarua Community" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-gray-900/90 via-gray-900/75 to-gray-900/60" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-green-500/20 border border-green-500/30 rounded-full mb-6">
            <MapPin className="w-4 h-4 text-green-400" />
            <span className="text-sm text-green-300 font-medium">Itukarua County & Surrounding Areas</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-4">
            Karibu<span className="text-green-400"> Itukarua</span>
          </h1>
          <p className="text-lg text-gray-300 mb-8 max-w-xl">
            Connecting local communities across Kenya. Find jobs, hire skilled workers, advertise services, and transact securely with M-Pesa.
          </p>

          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 mb-10">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search jobs, services, or businesses..."
                className="w-full pl-12 pr-4 py-4 rounded-xl bg-white/95 backdrop-blur-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-green-500 outline-none text-sm shadow-lg"
              />
            </div>
            <button type="submit" className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors shadow-lg flex items-center justify-center gap-2">
              Search <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-10">
            <button onClick={() => onNavigate('jobs')} className="flex items-center gap-3 px-4 py-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl transition-all">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center"><Briefcase className="w-5 h-5 text-green-400" /></div>
              <div className="text-left"><p className="text-white font-semibold text-sm">Find Jobs</p><p className="text-gray-400 text-xs">Browse opportunities</p></div>
            </button>
            <button onClick={() => onNavigate('services')} className="flex items-center gap-3 px-4 py-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl transition-all">
              <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center"><Building2 className="w-5 h-5 text-orange-400" /></div>
              <div className="text-left"><p className="text-white font-semibold text-sm">Services</p><p className="text-gray-400 text-xs">Local businesses</p></div>
            </button>
            <button onClick={() => onNavigate('post-job')} className="flex items-center gap-3 px-4 py-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl transition-all">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center"><Users className="w-5 h-5 text-purple-400" /></div>
              <div className="text-left"><p className="text-white font-semibold text-sm">Post a Job</p><p className="text-gray-400 text-xs">Hire local talent</p></div>
            </button>
          </div>

          <div className="flex flex-wrap gap-6 lg:gap-10">
            {[
              { label: 'Active Jobs', value: `${stats?.active_jobs || 0}+` },
              { label: 'Workers', value: `${stats?.registered_workers || 0}+` },
              { label: 'Businesses', value: `${stats?.active_businesses || 0}+` },
              { label: 'Jobs Done', value: `${stats?.completed_jobs || 0}+` },
            ].map(stat => (
              <div key={stat.label}>
                <p className="text-2xl lg:text-3xl font-bold text-white">{stat.value}</p>
                <p className="text-xs text-gray-400">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
