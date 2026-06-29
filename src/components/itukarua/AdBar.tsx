import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { getActiveAds } from '@/lib/database';

interface Ad {
  id: string;
  title: string;
  image_url: string;
  destination_url: string;
  is_affiliate: boolean;
}

const DEFAULT_ADS: Ad[] = [
  {
    id: 'affiliate-1',
    title: 'Advertise Here',
    image_url: '/images/placeholder.svg',
    destination_url: '/contact',
    is_affiliate: true,
  },
];

const AdBar: React.FC = () => {
  const [ads, setAds] = useState<Ad[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    getActiveAds()
      .then((data: any[]) => {
        if (data.length > 0) {
          setAds(data);
        } else {
          setAds(DEFAULT_ADS);
        }
      })
      .catch(() => setAds(DEFAULT_ADS));
  }, []);

  if (dismissed || ads.length === 0) return null;

  const ad = ads[current];

  return (
    <div className="relative bg-gradient-to-r from-green-900 via-green-800 to-green-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            {ads.length > 1 && (
              <div className="flex gap-1">
                {ads.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrent(i)}
                    className={`w-2 h-2 rounded-full transition-colors ${i === current ? 'bg-white' : 'bg-white/30'}`}
                  />
                ))}
              </div>
            )}
            <a
              href={`${ad.destination_url}${ad.is_affiliate ? `?ref=ad_${ad.id}` : ''}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-90 transition-opacity"
            >
              <div className="w-16 h-10 rounded overflow-hidden flex-shrink-0 bg-white/10">
                <img src={ad.image_url} alt={ad.title} className="w-full h-full object-cover" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </div>
              <span className="text-sm text-white/90 font-medium truncate">{ad.title}</span>
              {ad.is_affiliate && (
                <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 text-[10px] font-semibold rounded uppercase">Ad</span>
              )}
            </a>
          </div>
          <button onClick={() => setDismissed(true)} className="p-1 text-white/50 hover:text-white transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdBar;