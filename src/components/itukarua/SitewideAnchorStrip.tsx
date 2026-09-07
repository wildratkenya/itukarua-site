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
    <div className="bg-charcoal-950 bg-gradient-to-r from-gray-900 via-neutral-900 to-gray-900 text-white border-b border-white/5">
      <a
        href={ad.destination_url || whatsapp}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => incrementAdClick(ad.id)}
        className="flex items-center gap-3 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 group"
      >
        <img
          src={proxyImageUrl(ad.image_url)}
          alt=""
          className="w-9 h-9 rounded-full object-cover bg-white/10 ring-1 ring-white/20 flex-shrink-0 hidden xs:block sm:block"
          loading="lazy"
          onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0'; }}
        />
        <div className="min-w-0 flex-1 flex items-baseline gap-2">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300/90 tracking-wide uppercase flex-shrink-0">
            <Sparkles className="w-3 h-3" /> Partner
          </span>
          <span className="truncate text-sm font-semibold">{ad.title}</span>
          {ad.description && (
            <span className="hidden md:block truncate text-xs text-white/60">{ad.description}</span>
          )}
        </div>
        <span className="flex-shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold text-black bg-amber-300 hover:bg-amber-200 rounded-full px-3.5 py-1.5 transition-colors">
          {ad.cta_text || 'Chat on WhatsApp'}
          <ExternalLink className="w-3 h-3" />
        </span>
      </a>
    </div>
  );
};

export default SitewideAnchorStrip;