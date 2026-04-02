import React, { useState, useEffect, useCallback } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import JobCard from './JobCard';
import { JOB_CATEGORIES, LOCATIONS } from '@/data/siteData';
import { getJobs, type DbJob } from '@/lib/database';
import type { Page } from './Header';

interface JobsPageProps {
  onViewJob: (jobId: string) => void;
  onNavigate: (page: Page) => void;
  initialSearch?: string;
}

const JobsPage: React.FC<JobsPageProps> = ({ onViewJob, onNavigate, initialSearch = '' }) => {
  const [search, setSearch] = useState(initialSearch);
  const [category, setCategory] = useState('All Categories');
  const [location, setLocation] = useState('All Locations');
  const [sortBy, setSortBy] = useState<'newest' | 'budget-high' | 'budget-low' | 'urgent'>('newest');
  const [showFilters, setShowFilters] = useState(false);
  const [jobs, setJobs] = useState<DbJob[]>([]);
  const [loading, setLoading] = useState(true);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getJobs({
        category: category !== 'All Categories' ? category : undefined,
        location: location !== 'All Locations' ? location : undefined,
        search: search.trim() || undefined,
      });
      // Client-side sort
      let sorted = [...data];
      switch (sortBy) {
        case 'newest': sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); break;
        case 'budget-high': sorted.sort((a, b) => b.budget_max - a.budget_max); break;
        case 'budget-low': sorted.sort((a, b) => a.budget_min - b.budget_min); break;
        case 'urgent': sorted.sort((a, b) => (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0)); break;
      }
      setJobs(sorted);
    } catch (err) {
      console.error('Error loading jobs:', err);
    } finally {
      setLoading(false);
    }
  }, [search, category, location, sortBy]);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  const mapJob = (j: DbJob) => ({
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
    status: j.status as 'open' | 'in-progress' | 'completed',
  });

  const clearFilters = () => {
    setSearch('');
    setCategory('All Categories');
    setLocation('All Locations');
    setSortBy('newest');
  };

  const hasActiveFilters = search || category !== 'All Categories' || location !== 'All Locations';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-green-700 to-green-800 py-10 lg:py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl lg:text-4xl font-bold text-white mb-2">Browse Jobs</h1>
          <p className="text-green-100 mb-6">Find local work opportunities across Itukarua County</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search jobs by title, skill, or keyword..." className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-green-400 outline-none text-sm" />
            </div>
            <button onClick={() => setShowFilters(!showFilters)} className="flex items-center justify-center gap-2 px-5 py-3.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors border border-white/20">
              <SlidersHorizontal className="w-4 h-4" /> Filters
            </button>
            <button onClick={() => onNavigate('post-job')} className="px-6 py-3.5 bg-white text-green-700 font-semibold rounded-xl hover:bg-green-50 transition-colors">Post a Job</button>
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
                  {JOB_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Location</label>
                <select value={location} onChange={e => setLocation(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none">
                  {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Sort By</label>
                <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none">
                  <option value="newest">Newest First</option>
                  <option value="budget-high">Budget: High to Low</option>
                  <option value="budget-low">Budget: Low to High</option>
                  <option value="urgent">Urgent First</option>
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-gray-500">Showing <span className="font-semibold text-gray-900">{jobs.length}</span> jobs</p>
          <div className="hidden lg:flex gap-2 overflow-x-auto">
            {JOB_CATEGORIES.slice(0, 6).map(c => (
              <button key={c} onClick={() => setCategory(c)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${category === c ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{c}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
                <div className="h-5 bg-gray-200 rounded w-3/4 mb-3" />
                <div className="h-3 bg-gray-200 rounded w-full mb-2" />
                <div className="h-3 bg-gray-200 rounded w-2/3 mb-4" />
                <div className="h-4 bg-gray-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : jobs.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {jobs.map(job => <JobCard key={job.id} job={mapJob(job)} onViewJob={onViewJob} />)}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4"><Search className="w-7 h-7 text-gray-400" /></div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No jobs found</h3>
            <p className="text-sm text-gray-500 mb-4">Try adjusting your search or filters</p>
            <button onClick={clearFilters} className="px-5 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors">Clear Filters</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default JobsPage;
