import React from 'react';
import { MapPin, Clock, Users, AlertTriangle } from 'lucide-react';

interface Job {
  id: string; title: string; description: string; location: string; budgetMin: number; budgetMax: number;
  deadline: string; category: string; postedBy: string; postedDate: string; bidsCount: number; urgent: boolean;
  status: 'open' | 'in-progress' | 'completed';
  images?: string[];
}

interface JobCardProps {
  job: Job;
  onViewJob: (jobId: string) => void;
}

const JobCard: React.FC<JobCardProps> = ({ job, onViewJob }) => {
  const categoryColors: Record<string, string> = {
    Construction: 'bg-orange-100 text-orange-700',
    Painting: 'bg-blue-100 text-blue-700',
    Plumbing: 'bg-cyan-100 text-cyan-700',
    Electrical: 'bg-yellow-100 text-yellow-700',
    'Domestic Work': 'bg-pink-100 text-pink-700',
    Farming: 'bg-green-100 text-green-700',
    Fencing: 'bg-amber-100 text-amber-700',
    Landscaping: 'bg-emerald-100 text-emerald-700',
    Transport: 'bg-purple-100 text-purple-700',
    Carpentry: 'bg-red-100 text-red-700',
    Masonry: 'bg-stone-200 text-stone-700',
    Welding: 'bg-slate-200 text-slate-700',
  };

  return (
    <div
      onClick={() => onViewJob(job.id)}
      className="bg-white rounded-xl border border-gray-100 hover:border-green-200 hover:shadow-lg transition-all duration-300 cursor-pointer group overflow-hidden flex flex-col"
    >
      <div className="w-full h-40 bg-gray-100 relative overflow-hidden">
        <img 
          src={(job.images && job.images.length > 0) ? job.images[0] : 'https://images.unsplash.com/photo-1581578731522-745d05ad9a2d?auto=format&fit=crop&q=80&w=800'} 
          alt={job.title} 
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1581578731522-745d05ad9a2d?auto=format&fit=crop&q=80&w=800';
          }}
        />
      </div>
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${categoryColors[job.category] || 'bg-gray-100 text-gray-700'}`}>
                  {job.category}
                </span>
                {job.urgent && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Urgent
                  </span>
                )}
              </div>
              <h3 className="font-semibold text-gray-900 group-hover:text-green-700 transition-colors line-clamp-2">
                {job.title}
              </h3>
            </div>
          </div>

          <p className="text-sm text-gray-500 line-clamp-3 mb-4">{job.description}</p>
        </div>

        <div>
          <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-green-600" />
              {job.location}
            </span>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-gray-50">
            <div>
              <p className="text-xs text-gray-400">Budget</p>
              <p className="font-bold text-green-700 text-sm">
                KES {job.budgetMin.toLocaleString()} - {job.budgetMax.toLocaleString()}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewJob(job.id);
              }}
              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              More Details
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobCard;
