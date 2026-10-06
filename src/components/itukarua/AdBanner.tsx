import React, { useState, useEffect, useRef } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { incrementAdClick, incrementAdDisplay, getAdBannerSettings, type AdBannerSettings, DEFAULT_AD_BANNER_SETTINGS } from '@/lib/database';
import { getAdsForDelivery, logImpression } from '@/lib/adDelivery';
import { proxyImageUrl } from '@/lib/supabase';

const DESKTOP_VISIBLE = 5;
const MOBILE_VISIBLE = 1;
const DESKTOP_GAP = 12;
const MOBILE_GAP = 8;

function useMobile() {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener('change', handler);
    setMobile(mq.matches);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return mobile;
}

const AdBanner: React.FC = () => {
  const [affiliateAds, setAffiliateAds] = useState<any[]>([]);
  const [settings, setSettings] = useState<AdBannerSettings>(DEFAULT_AD_BANNER_SETTINGS);
  const [isHovered, setIsHovered] = useState(false);
  const isMobile = useMobile();
  const [modalAd, setModalAd] = useState<any>(null);
  const [modalImg, setModalImg] = useState('');
  const displayedAds = useRef<Set<string>>(new Set());
  const [viewportEl, setViewportEl] = useState<HTMLDivElement | null>(null);
  const [tileWidth, setTileWidth] = useState(0);

  const visible = isMobile ? MOBILE_VISIBLE : DESKTOP_VISIBLE;
  const gap = isMobile ? MOBILE_GAP : DESKTOP_GAP;

  const modalImages = modalAd
    ? (modalAd.images?.length ? modalAd.images : modalAd.image_url ? [modalAd.image_url] : [])
    : [];

  useEffect(() => {
    setModalImg(modalImages[0] || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalAd]);

  // Tile width has to be measured: the track is `width: max-content`, so a
  // percentage width on its children would resolve against the track itself.
  // The viewport div only mounts once ads arrive, hence viewportEl is a ref
  // state rather than a plain ref object - the measurement runs on attach.
  useEffect(() => {
    if (!viewportEl) return;
    const measure = () => {
      const w = viewportEl.clientWidth;
      if (w <= 0) { setTileWidth(0); return; }
      setTileWidth(Math.max(1, Math.floor((w - gap * (visible - 1)) / visible)));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(viewportEl);
    return () => ro.disconnect();
  }, [viewportEl, visible, gap]);

  useEffect(() => {
    const load = () => {
      getAdsForDelivery("homepage_banner", undefined, undefined, 100, true).then(ads => {
        if (ads && ads.length > 0) setAffiliateAds(ads);
      }).catch(() => {});
      getAdBannerSettings().then(setSettings).catch(() => {});
    };
    load();
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // The whole list is in view continuously now, so each ad is counted once as
  // soon as it arrives rather than when its page becomes active.
  useEffect(() => {
    affiliateAds.forEach((ad: any) => {
      if (!displayedAds.current.has(ad.id)) {
        displayedAds.current.add(ad.id);
        logImpression(ad.id);
        incrementAdDisplay(ad.id).catch(() => {});
      }
    });
  }, [affiliateAds]);

  if (affiliateAds.length === 0) return null;

  const loopSeconds = Math.max(5, Math.round(settings.horizontalLoopSeconds));
  const track = [...affiliateAds, ...affiliateAds];

  return (
    <section>
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="group relative overflow-hidden bg-gray-100 p-2 sm:p-3"
      >
        <div ref={setViewportEl} className="w-full h-[210px] sm:h-[250px] lg:h-[280px] overflow-hidden">
          {tileWidth > 0 && (
          <div
            className="itukarua-marquee flex h-full"
            style={{
              width: 'max-content',
              animation: `itukarua-scroll-${settings.horizontalDirection} ${loopSeconds}s linear infinite`,
              animationPlayState: isHovered ? 'paused' : 'running',
            }}
          >
            {track.map((ad, i) => (
              <button
                key={`${ad.id}-${i}`}
                onClick={() => setModalAd(ad)}
                style={{ width: tileWidth, marginRight: gap, height: '100%' }}
                className="group/item relative shrink-0 rounded-lg overflow-hidden bg-gray-200 cursor-pointer"
              >
                <img
                  src={proxyImageUrl(ad.image_url)}
                  alt={ad.title}
                  className="absolute inset-0 w-full h-full object-cover group-hover/item:scale-105 transition-transform duration-300"
                  loading="lazy"
                  decoding="async"
                  onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0'; }}
                />
                <div className="absolute inset-0 bg-black/0 group-hover/item:bg-black/25 transition-colors" />
                <div className="absolute bottom-0 inset-x-0 p-1.5 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover/item:opacity-100 transition-opacity">
                  <p className="text-white text-[10px] sm:text-xs font-medium truncate">{ad.title}</p>
                </div>
                <span className="absolute top-1 left-1 px-1 py-0.5 bg-amber-500/80 text-white text-[8px] font-bold rounded uppercase">Ad</span>
              </button>
            ))}
          </div>
          )}
        </div>
      </div>

      {modalAd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setModalAd(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="relative bg-black">
              <img src={proxyImageUrl(modalImg)} alt={modalAd.title} className="w-full max-h-[60vh] object-contain" onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0'; }} />
              <button onClick={() => setModalAd(null)} className="absolute top-2 right-2 w-7 h-7 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors"><X className="w-4 h-4" /></button>
              <span className="absolute top-2 left-2 px-1.5 py-0.5 bg-amber-500/80 text-white text-[10px] font-bold rounded uppercase">Ad</span>
              {modalImages.length > 1 && (
                <div className="absolute bottom-0 inset-x-0 flex justify-center gap-2 p-2 bg-gradient-to-t from-black/80 to-transparent">
                  {modalImages.map((url, i) => (
                    <button
                      key={i}
                      onClick={() => setModalImg(url)}
                      className={`w-14 h-10 rounded-md overflow-hidden border-2 transition-colors ${url === modalImg ? 'border-green-400' : 'border-white/40 hover:border-white'}`}
                    >
                      <img src={proxyImageUrl(url)} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0'; }} />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="p-5">
              <h3 className="text-lg font-bold text-gray-900 mb-1">{modalAd.title}</h3>
              {modalAd.description && <p className="text-sm text-gray-500 mb-4">{modalAd.description}</p>}
              <div className="space-y-3">
                <a
                  href={`https://wa.me/${modalAd.whatsapp_number || '254700000000'}?text=${encodeURIComponent(`Hi, I'm interested in "${modalAd.title}" from Itukarua`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => incrementAdClick(modalAd.id)}
                  className="flex items-center justify-center gap-2 w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  Chat on WhatsApp
                </a>
                {modalAd.destination_url && (
                <a
                  href={`${modalAd.destination_url}?ref=ad_${modalAd.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => incrementAdClick(modalAd.id)}
                  className="flex items-center justify-center gap-2 w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
                >
                  <ExternalLink className="w-5 h-5" />
                  {modalAd.cta_text || 'Visit Website'}
                </a>
                )}
              </div>
              <button onClick={() => setModalAd(null)} className="w-full mt-3 py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default AdBanner;
