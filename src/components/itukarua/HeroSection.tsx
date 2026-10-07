import React, { useState, useEffect } from 'react';
import { Search, MapPin, Briefcase, Building2, Users, ArrowRight, UserCheck, Star, CreditCard, SlidersHorizontal, ChevronRight, UserPlus, Compass, Send, Banknote } from 'lucide-react';
import { IMAGES, KENYA_COUNTIES } from '@/data/siteData';
import { getSubcounties } from '@/data/kenyaLocations';
import { getCustomCategories, getNewsletterSubscriberCount } from '@/lib/database';
import type { PlatformStats } from '@/lib/database';
import type { Page } from './Header';

interface HeroSectionProps {
  onNavigate: (page: Page) => void;
  onSearch: (query: string) => void;
  onOpenWorkerSearch?: () => void;
  stats?: PlatformStats;
}

const steps = [
  { icon: Briefcase, title: 'Post a Job', color: 'bg-green-100 text-green-600' },
  { icon: UserCheck, title: 'Receive Bids', color: 'bg-blue-100 text-blue-600' },
  { icon: Star, title: 'Choose Best', color: 'bg-amber-100 text-amber-600' },
  { icon: CreditCard, title: 'Pay via M-Pesa', color: 'bg-purple-100 text-purple-600' },
];

const jobseekerSteps = [
  { icon: UserPlus, title: 'Sign Up', color: 'bg-cyan-100 text-cyan-600' },
  { icon: Compass, title: 'Browse Jobs / Make Yourself Available', color: 'bg-green-100 text-green-600' },
  { icon: Send, title: 'Bid on Jobs', color: 'bg-blue-100 text-blue-600' },
  { icon: Banknote, title: 'Get Jobs', color: 'bg-purple-100 text-purple-600' },
];

const HeroSection: React.FC<HeroSectionProps> = ({ onNavigate, onSearch, onOpenWorkerSearch, stats }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterCounty, setFilterCounty] = useState('');
  const [filterSubcounty, setFilterSubcounty] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [dbCats, setDbCats] = useState<string[]>([]);
  const [subCats, setSubCats] = useState<string[]>([]);
  const [subCount, setSubCount] = useState(0);

  useEffect(() => {
    getCustomCategories('job').then(setDbCats).catch(() => {});
    getNewsletterSubscriberCount().then(setSubCount).catch(() => {});
  }, []);

  useEffect(() => {
    if (filterCounty) {
      setSubCats(getSubcounties(filterCounty));
      setFilterSubcounty('');
    } else {
      setSubCats([]);
    }
  }, [filterCounty]);

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
    if (filterCounty) params.set('county', filterCounty);
    if (filterSubcounty) params.set('subcounty', filterSubcounty);
    if (filterLocation.trim()) params.set('location', filterLocation.trim());
    onSearch(params.toString());
  };

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0">
        <img src={IMAGES.hero} alt="Itukarua Community" fetchPriority="high" decoding="async" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        <div className="absolute inset-0 bg-gradient-to-r from-gray-900/90 via-gray-900/75 to-gray-900/60" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-1 pb-2 lg:pt-2 lg:pb-3">
        <div className="grid lg:grid-cols-7 gap-8 items-start">
          {/* Left Column: Hero Content */}
          <div className="lg:col-span-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-500/20 border border-green-500/30 rounded-full mb-4">
              <MapPin className="w-3 h-3 text-green-400" />
              <span className="text-xs text-green-300 font-medium">Itukarua County & Surrounding Areas</span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white leading-tight mb-2">
              Karibu<span className="text-green-400"> Itukarua</span>
            </h1>
            <p className="text-base text-gray-300 mb-3 max-w-xl">
              Connecting local communities across Kenya. Find jobs, hire skilled workers, advertise services, and transact securely with M-Pesa.
            </p>

            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search jobs, services, or businesses..."
                  className="w-full pl-10 pr-3 py-2.5 rounded-lg bg-white/95 backdrop-blur-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-green-500 outline-none text-sm shadow-lg"
                />
              </div>
              <button type="submit" className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors shadow-lg flex items-center justify-center gap-2">
                Search <ArrowRight className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => setShowFilters(!showFilters)} className={`px-3 py-2.5 rounded-lg border transition-colors flex items-center gap-1.5 text-sm ${showFilters ? 'bg-green-700 border-green-500 text-white' : 'bg-white/10 border-white/20 text-gray-300 hover:bg-white/20'}`}>
                <SlidersHorizontal className="w-4 h-4" /> Filters
              </button>
            </form>
            {showFilters && (
              <div className="flex flex-col sm:flex-row gap-2 mb-4">
                <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="px-3 py-2 rounded-lg bg-white/90 text-gray-900 text-sm border border-gray-300 focus:ring-2 focus:ring-green-500 outline-none">
                  <option value="">All Categories</option>
                  {dbCats.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={filterCounty} onChange={e => setFilterCounty(e.target.value)} className="px-3 py-2 rounded-lg bg-white/90 text-gray-900 text-sm border border-gray-300 focus:ring-2 focus:ring-green-500 outline-none">
                  <option value="">All Counties</option>
                  {KENYA_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {filterCounty && subCats.length > 0 && (
                  <select value={filterSubcounty} onChange={e => setFilterSubcounty(e.target.value)} className="px-3 py-2 rounded-lg bg-white/90 text-gray-900 text-sm border border-gray-300 focus:ring-2 focus:ring-green-500 outline-none">
                    <option value="">All Sub-Counties</option>
                    {subCats.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
                <input
                  type="text"
                  value={filterLocation}
                  onChange={e => setFilterLocation(e.target.value)}
                  placeholder="Location/landmark..."
                  className="px-3 py-2 rounded-lg bg-white/90 text-gray-900 text-sm border border-gray-300 focus:ring-2 focus:ring-green-500 outline-none w-44"
                />
                <button onClick={handleFilteredSearch} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors">Apply</button>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 mb-2">
              {/* Quick action buttons, hidden below lg.

                This row is the last thing in the hero that could overflow on a
                phone. The three buttons need roughly 353px at min-content,
                because a flex item will not shrink below its longest word and
                "opportunities" is 13 characters at text-[10px]. The stats group
                adds roughly 188px and is flex-shrink-0, so it holds its width
                however tight the row gets. With the gap-3 between them that is
                about 553px of min-content against the 328px available inside
                px-4 on a 360px Android viewport, so the row was overflowing by
                roughly 225px and being clipped by the section's overflow-hidden.

                lg rather than sm is deliberate: at the sm breakpoint, 640px, the
                row is about 673px at max-content against 592px available, so it
                is still overflowing there. md at 768px would fit, 673 against
                720, but lg is used so these buttons come back at the same
                breakpoint as the two How It Works cards rather than introducing
                a third one.

                The buttons duplicate the header nav and the search field, so
                they are the cheapest thing to drop. The counts are the part
                that earns the space, so they stay. */}
              <div className="hidden lg:flex gap-2">
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
                  ...((stats?.completed_jobs || 0) > 0 ? [{ label: 'Jobs Done', value: `${stats?.completed_jobs}+` }] : []),
                ].map(stat => (
                  <div key={stat.label}>
                    <p className="text-lg lg:text-xl font-bold text-white">{stat.value}</p>
                    <p className="text-[10px] text-gray-400">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Right Column: How It Works — two cards.

              Both cards are hidden below lg. On mobile the two sit side by side
              in a flex row, which leaves each card about 170px wide on a 375px
              screen for content built from 36px icons and wrapped headings. The
              mobile hero is better served by the search field and the quick
              action buttons above.

              lg:-mr-[...] is what puts "How to Apply for Jobs" at the far right
              of the section. The content lives in a centred max-w-7xl, so its
              right edge sits at
              (100vw - min(100vw, 80rem)) / 2 + 2rem from the viewport edge.
              Cancelling exactly that leaves the card on the section edge.

              max(0px, ...) guards the case where the viewport is narrower than
              80rem: there the container is already full width, so the only
              offset is the 2rem gutter and the expression must not go positive.

              The outer section is overflow-hidden, so the sub-pixel scrollbar
              width folded into 100vw clips rather than scrolling sideways. */}
          <div className="lg:col-span-3 hidden lg:flex gap-3 lg:-mr-[calc(max(0px,(100vw-80rem)/2)+2rem)]">
            {/* Card 1: Employer — How Local Jobs Works */}
            <div className="flex-1 bg-white/10 backdrop-blur-sm rounded-2xl p-3 border border-white/10">
              <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
                <span className="w-1 h-4 bg-green-400 rounded-full" />
                How Local Jobs Works
              </h3>
              <div className="relative">
                <div className="absolute left-4 top-3 bottom-3 w-0.5 bg-white/20" />
                {steps.map((step, i) => (
                  <div key={i} className="relative flex items-start gap-3 pb-1 last:pb-0">
                    <div className="relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-green-500 text-white text-xs font-bold">
                      {i + 1}
                    </div>
                    <div className="flex items-start gap-3 flex-1 min-w-0 pt-0.5">
                      <div className={`w-9 h-9 ${step.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                        <step.icon className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-white">{step.title}</h4>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={onOpenWorkerSearch}
                className="mt-2 w-full flex items-center justify-between gap-2 px-4 py-3 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 rounded-xl transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                    <Users className="w-6 h-6 text-green-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-white font-semibold text-lg">Find a Worker</p>
                    <p className="text-gray-400 text-sm">Search jobseekers by skill</p>
                  </div>
                </div>
                <ChevronRight className="w-6 h-6 text-green-400 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>

            {/* Card 2: Jobseeker — How to Apply for Jobs */}
            <div className="flex-1 bg-white/10 backdrop-blur-sm rounded-2xl p-3 border border-white/10">
              <h3 className="text-white font-bold text-sm mb-3 flex items-center justify-end gap-2">
                How to Apply for Jobs
                <span className="w-1 h-4 bg-green-400 rounded-full" />
              </h3>
              <div className="relative">
                <div className="absolute right-4 top-3 bottom-3 w-0.5 bg-white/20" />
                {jobseekerSteps.map((step, i) => {
                  // Sign Up is redundant on mobile, where the search field above
                  // already covers first contact, so it is dropped below lg.
                  // It is kept from lg up, where the card is beside the hero
                  // copy rather than stacked under it.
                  //
                  // The badge needs two numbers as a result: with step 1 gone,
                  // mobile must read 1/2/3 rather than 2/3/4.
                  const isSignup = i === 0;
                  return (
                  <div
                    key={i}
                    className={`relative items-start justify-end gap-3 pb-1 last:pb-0 ${isSignup ? 'hidden lg:flex' : 'flex'}`}
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0 pt-0.5 flex-row-reverse">
                      <div className={`w-9 h-9 ${step.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                        <step.icon className="w-4 h-4" />
                      </div>
                      <div className="text-right">
                        <h4 className="text-xs font-semibold text-white">{step.title}</h4>
                      </div>
                    </div>
                    <div className="relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-green-500 text-white text-xs font-bold">
                      <span className="lg:hidden">{i}</span>
                      <span className="hidden lg:inline">{i + 1}</span>
                    </div>
                  </div>
                  );
                })}
              </div>
              <button
                onClick={() => onNavigate('jobs')}
                className="mt-2 w-full flex items-center justify-between gap-2 px-4 py-3 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 rounded-xl transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                    <Briefcase className="w-6 h-6 text-green-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-white font-semibold text-lg">Browse Jobs</p>
                    <p className="text-gray-400 text-sm">Find work near you</p>
                  </div>
                </div>
                <ChevronRight className="w-6 h-6 text-green-400 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </div>

    </section>
  );
};

export default HeroSection;
