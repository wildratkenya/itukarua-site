import React, { useState, useEffect, useRef } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { incrementAdClick, incrementAdDisplay } from '@/lib/database';
import { getAdsForDelivery, logImpression } from '@/lib/adDelivery';
import { proxyImageUrl } from '@/lib/supabase';

const JobListingsTopBanner: React.FC = () => {
  const [ads, setAds] = useState<any[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [modalAd, setModalAd] = useState<any>(null);
  const [modalImg, setModalImg] = useState('');
  const displayedAds = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const modalImages = modalAd
    ? (modalAd.images?.length ? modalAd.images : modalAd.image_url ? [modalAd.image_url] : [])
    : [];

  useEffect(() => {
    setModalImg(modalImages[0] || '');
  }, [modalAd]);

  useEffect(() => {
    getAdsForDelivery('job_listings_top', undefined, undefined, 10).then(setAds).catch(() => {});
  }, []);

  useEffect(() => {
    ads.forEach((ad: any) => {
      if (!displayedAds.current.has(ad.id)) {
        displayedAds.current.add(ad.id);
        logImpression(ad.id);
        incrementAdDisplay(ad.id).catch(() => {});
      }
    });
  }, [ads]);

  useEffect(() => {
    if (ads.length <= 1) return;
    timerRef.current = setInterval(() => {
      setCurrentIdx(prev => (prev + 1) % ads.length);
    }, 5000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [ads.length]);

  if (ads.length === 0) return null;

  const ad = ads[currentIdx];

  return (
    <>
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <button
          onClick={() => setModalAd(ad)}
          className="relative w-full rounded-xl overflow-hidden bg-gray-100 group cursor-pointer block"
          style={{ height: 120 }}
        >
          <img
            src={proxyImageUrl(ad.image_url)}
            alt={ad.title}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="eager"
            onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0'; }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          <span className="absolute top-2 left-2 px-2 py-0.5 bg-amber-500/90 text-white text-[10px] font-bold rounded uppercase">Ad</span>
          <p className="absolute bottom-2 left-3 text-white text-sm font-semibold drop-shadow-lg">{ad.title}</p>
          {ads.length > 1 && (
            <div className="absolute bottom-2 right-3 flex gap-1">
              {ads.map((_, i) => (
                <span key={i} className={`w-2 h-2 rounded-full transition-colors ${i === currentIdx ? 'bg-white' : 'bg-white/40'}`} />
              ))}
            </div>
          )}
        </button>
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
                    <button key={i} onClick={() => setModalImg(url)} className={`w-14 h-10 rounded-md overflow-hidden border-2 transition-colors ${url === modalImg ? 'border-green-400' : 'border-white/40 hover:border-white'}`}>
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
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 1.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
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
    </>
  );
};

export default JobListingsTopBanner;
