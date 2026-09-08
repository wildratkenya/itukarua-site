import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, Sparkles } from 'lucide-react';
import { getAdsForDelivery, logImpression } from '@/lib/adDelivery';
import { incrementAdClick } from '@/lib/database';
import { proxyImageUrl } from '@/lib/supabase';

interface SitewideAnchorStripProps {
  page: string;
}

const SLOT_BY_PAGE: Record<string, string> = {
  home: 'sitewide_strip',
  jobs: 'category_strip',
  services: 'category_strip',
};

const TIER_DURATION_MS: Record<string, number> = {
  gold: 7000,
  custom: 7000,
  silver: 5000,
  bronze: 3000,
};

const SitewideAnchorStrip: React.FC<SitewideAnchorStripProps> = ({ page }) => {
  const [ads, setAds] = useState<any[]>([]);
  const [index, setIndex] = useState(0);
  const [faded, setFaded] = useState(false);
  const [hover, setHover] = useState(false);
  const logged = useRef<Set<string>>(new Set());
  const slot = SLOT_BY_PAGE[page] || 'sitewide_strip';

  useEffect(() => {
    let cancelled = false;
    getAdsForDelivery(slot, undefined, undefined, 10)
      .then(delivered => {
        if (cancelled || !delivered || delivered.length === 0) return;
        setAds(delivered);
        setIndex(0);
        setFaded(false);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [slot]);

  useEffect(() => {
    if (ads.length === 0 || !ads[index]) return;
    const adId = ads[index].id;
    if (!logged.current.has(adId)) {
      logged.current.add(adId);
      logImpression(adId).catch(() => {});
    }
  }, [ads, index]);

  useEffect(() => {
    if (ads.length === 0 || hover) return;
    const ad = ads[index];
    const duration = TIER_DURATION_MS[ad?.corporate_tier] ?? 5000;
    const timer = setTimeout(() => {
      setFaded(true);
      setTimeout(() => {
        setIndex(i => (i + 1) % ads.length);
        setFaded(false);
      }, 400);
    }, duration);
    return () => clearTimeout(timer);
  }, [ads, index, hover]);

  if (ads.length === 0 || !ads[index]) return null;

  const ad = ads[index];
  const whatsapp = `https://wa.me/${ad.whatsapp_number || '254700000000'}?text=${encodeURIComponent(`Hi, I'm interested in "${ad.title}" from Itukarua`)}`;

  return (
    <div
      className="relative overflow-hidden bg-gradient-to-r from-gray-900 via-neutral-900 to-gray-900 text-white transition-opacity duration-500"
      style={{ opacity: faded ? 0 : 1 }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
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
      {ads.length > 1 && (
        <div className="absolute bottom-3 right-4 z-10 flex items-center gap-1.5">
          {ads.map((a, i) => (
            <button
              key={a.id}
              onClick={() => {
                setFaded(true);
                setTimeout(() => {
                  setIndex(i);
                  setFaded(false);
                }, 250);
              }}
              aria-label={`Partner ${i + 1}`}
              className={`w-2 h-2 rounded-full transition-all ${i === index ? 'bg-amber-300 scale-110' : 'bg-white/40 hover:bg-white/70'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default SitewideAnchorStrip;