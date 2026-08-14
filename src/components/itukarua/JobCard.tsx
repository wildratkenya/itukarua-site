import React, { useState } from 'react';
import { MapPin, AlertTriangle, Camera } from 'lucide-react';
import { optimizeImageUrl, handleImageError } from '@/lib/supabase';

interface Job {
  id: string; title: string; description: string; location: string; county?: string; subcounty?: string; budgetMin: number; budgetMax: number;
  deadline: string; category: string; postedBy: string; postedDate: string; bidsCount: number; urgent: boolean;
  status: 'open' | 'in-progress' | 'completed';
  images?: string[];
}

interface JobCardProps {
  job: Job;
  onViewJob: (jobId: string) => void;
  compact?: boolean;
}

const JobCard: React.FC<JobCardProps> = ({ job, onViewJob, compact }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const images = job.images && job.images.length > 0 ? job.images : [];
  const hasMultipleImages = images.length > 1;

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

  if (compact) {
    const imgSrc = images.length > 0 ? optimizeImageUrl(images[0], 200, 150) : '/images/services-fallback.jpg';
    return (
      <div
        onClick={() => onViewJob(job.id)}
        className="bg-white rounded-xl border border-gray-100 hover:border-green-200 hover:shadow-md transition-all cursor-pointer flex gap-3 p-3"
      >
        <div className="w-36 h-28 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
          <img src={imgSrc} alt={job.title} className="w-full h-full object-cover" loading="lazy" onError={handleImageError} />
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${categoryColors[job.category] || 'bg-gray-100 text-gray-700'}`}>
                {job.category}
              </span>
              {job.urgent && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700 flex items-center gap-0.5">
                  <AlertTriangle className="w-2.5 h-2.5" />
                  Urgent
                </span>
              )}
            </div>
            <h3 className="text-sm font-semibold text-gray-900 line-clamp-1">{job.title}</h3>
            <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{job.description}</p>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="flex items-center gap-1 text-[11px] text-gray-500">
              <MapPin className="w-3 h-3 text-green-600" />
              {job.county || job.location || ''}
            </span>
            <span className="text-xs font-semibold text-green-700">
              KES {job.budgetMin.toLocaleString()} - {job.budgetMax.toLocaleString()}
            </span>
            <span className="text-[11px] text-gray-400">{job.bidsCount} bids</span>
            <button
              onClick={(e) => { e.stopPropagation(); onViewJob(job.id); }}
              className="ml-auto px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white text-[11px] font-semibold rounded-lg transition-colors"
            >
              Bid
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => onViewJob(job.id)}
      className="bg-white rounded-xl border border-gray-100 hover:border-green-200 hover:shadow-lg transition-all duration-300 cursor-pointer group overflow-hidden flex flex-col"
    >
      <div className="w-full aspect-square bg-gray-100 relative overflow-hidden rounded-xl">
        {images.length > 0 ? (
          <>
            <img
              src={optimizeImageUrl(images[currentImageIndex], 400, 400)}
              alt={`${job.title} - Image ${currentImageIndex + 1}`}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              onError={handleImageError}
              draggable={false}
            />
            {hasMultipleImages && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentImageIndex(prev => prev === 0 ? images.length - 1 : prev - 1);
                  }}
                  className="absolute left-1 top-1/2 -translate-y-1/2 w-6 h-6 bg-black/50 hover:bg-black/70 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ‹
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentImageIndex(prev => prev === images.length - 1 ? 0 : prev + 1);
                  }}
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 bg-black/50 hover:bg-black/70 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ›
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                  {images.map((_, i) => (
                    <button
                      key={i}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentImageIndex(i);
                      }}
                      className={`w-2 h-2 rounded-full transition-colors ${i === currentImageIndex ? 'bg-white' : 'bg-white/50'}`}
                    />
                  ))}
                </div>
                <div className="absolute top-2 right-2 px-2 py-1 bg-black/50 text-white text-xs rounded-full flex items-center gap-1">
                  <Camera className="w-3 h-3" />
                  {images.length}
                </div>
              </>
            )}
            {hasMultipleImages && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                {images.map((_, i) => (
                  <button
                    key={i}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentImageIndex(i);
                    }}
                    className={`w-2 h-2 rounded-full transition-colors ${i === currentImageIndex ? 'bg-white' : 'bg-white/50'}`}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <img
            src='/images/services-fallback.jpg'
            alt={job.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        )}
      </div>
      {images.length > 0 && (
        <div className="flex gap-1 p-2 bg-gray-50 overflow-x-auto min-h-[52px] items-center">
          {images.length === 1 ? (
            <button
              onClick={(e) => e.stopPropagation()}
              className="flex-shrink-0 w-12 h-12 rounded overflow-hidden border-2 border-green-500"
            >
              <img src={optimizeImageUrl(images[0], 100, 100)} alt="" className="w-full h-full object-cover" />
            </button>
          ) : (
            images.map((img, i) => (
              <button
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentImageIndex(i);
                }}
                className={`flex-shrink-0 w-12 h-12 rounded overflow-hidden border-2 transition-colors ${
                  i === currentImageIndex ? 'border-green-500' : 'border-transparent hover:border-gray-300'
                }`}
              >
                <img src={optimizeImageUrl(img, 100, 100)} alt="" className="w-full h-full object-cover" />
              </button>
            ))
          )}
        </div>
      )}
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
              {job.county ? `${job.county}${job.subcounty ? `, ${job.subcounty}` : ''}${job.location ? ` - ${job.location}` : ''}` : job.location}
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
              Bid
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobCard;
