import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, Sparkles } from 'lucide-react';
import { getAdsForDelivery, logImpression } from '@/lib/adDelivery';
import { getActiveAdsBySlot, incrementAdClick } from '@/lib/database';
import { proxyImageUrl } from '@/lib/supabase';

interface SitewideAnchorStripProps {
  page: string;
}

const SLOT_BY_PAGE: Record<string, string> = {
  home: 'sitewide_strip',
  jobs: 'category_strip',
  services: 'category_strip',
};

const SitewideAnchorStrip: React.FC<SitewideAnchorStripProps> = ({ page }) => {
  const [ad, setAd] = useState<any>(null);
  const counted = useRef(false);
  const slot = SLOT_BY_PAGE[page] || 'sitewide_strip';

  useEffect(() => {
    let cancelled = false;
    getActiveAdsBySlot(slot).then(ads => {
      if (cancelled || !ads || ads.length === 0) return;
      const ad = ads[0];
      setAd(ad);
      if (!counted.current) {
        counted.current = true;
        logImpression(ad.id);
        getAdsForDelivery(slot, undefined, undefined, 1)
          .then(() => {})
          .catch(() => {});
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [slot]);

  if (!ad) return null;

  const whatsapp = `https://wa.me/${ad.whatsapp_number || '254700000000'}?text=${encodeURIComponent(`Hi, I'm interested in "${ad.title}" from Itukarua`)}`;

  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-gray-900 via-neutral-900 to-gray-900 text-white">
      <img
        src={proxyImageUrl(ad.image_url)}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        loading="lazy"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-gray-900/70 via-gray-900/40 to-gray-900/10" />
      <a
        href={ad.destination_url || whatsapp}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => incrementAdClick(ad.id)}
        className="relative flex items-center gap-4 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 lg:py-9 group"
      >
        <div className="min-w-0 flex-1 flex flex-col gap-0.5">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-300 tracking-wide uppercase">
            <Sparkles className="w-4 h-4" /> Partner
          </span>
          <span className="truncate text-xl lg:text-2xl font-bold">{ad.title}</span>
          {ad.description && (
            <span className="truncate text-sm lg:text-base text-white/70">{ad.description}</span>
          )}
        </div>
        <span className="flex-shrink-0 inline-flex items-center gap-2 text-sm font-bold text-black bg-amber-300 hover:bg-amber-200 rounded-full px-6 py-3 transition-colors">
          {ad.cta_text || 'Chat on WhatsApp'}
          <ExternalLink className="w-4 h-4" />
        </span>
      </a>
    </div>
  );
};

export default SitewideAnchorStrip;