import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Star } from 'lucide-react';
import { getTestimonials, getPortfolioSites, getWebsitesCarouselSettings, type DbTestimonial, type DbPortfolioSite, type WebsitesCarouselSettings } from '@/lib/database';
import { proxyImageUrl } from '@/lib/supabase';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 5;
const DEFAULT_SETTINGS: WebsitesCarouselSettings = {
  scrollIntervalSeconds: 5,
  transitionDurationSeconds: 0.8,
  effect: 'slide',
};

const WebsitesTestimonials: React.FC = () => {
  const [testimonials, setTestimonials] = useState<DbTestimonial[]>([]);
  const [sites, setSites] = useState<DbPortfolioSite[]>([]);
  const [settings, setSettings] = useState<WebsitesCarouselSettings>(DEFAULT_SETTINGS);
  const [currentPage, setCurrentPage] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    getTestimonials().then(setTestimonials).catch(() => {});
    getPortfolioSites().then(setSites).catch(() => {});
    getWebsitesCarouselSettings().then(setSettings).catch(() => {});
  }, []);

  const pageCount = Math.max(1, Math.ceil(sites.length / PAGE_SIZE));

  const pages = useMemo(() => {
    const groups: DbPortfolioSite[][] = [];
    for (let i = 0; i < sites.length; i += PAGE_SIZE) {
      groups.push(sites.slice(i, i + PAGE_SIZE));
    }
    return groups;
  }, [sites]);

  const goToPage = useCallback((index: number) => {
    setCurrentPage(((index % pageCount) + pageCount) % pageCount);
  }, [pageCount]);

  const goNextPage = useCallback(() => {
    setCurrentPage(prev => (prev + 1) % pageCount);
  }, [pageCount]);

  const goPrevPage = useCallback(() => {
    setCurrentPage(prev => (prev - 1 + pageCount) % pageCount);
  }, [pageCount]);

  // Autoplay
  useEffect(() => {
    if (pageCount <= 1) return;
    const interval = setInterval(() => {
      if (!isHovered) goNextPage();
    }, Math.max(1000, settings.scrollIntervalSeconds * 1000));
    return () => clearInterval(interval);
  }, [pageCount, settings.scrollIntervalSeconds, isHovered, goNextPage]);

  const transitionMs = Math.round(Math.max(0, settings.transitionDurationSeconds) * 1000);
  const isFade = settings.effect === 'fade';
  const isZoom = settings.effect === 'zoom';

  const renderSiteCard = (site: SiteCard) => (
    <a
      key={site.url}
      href={site.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all group/site bg-white"
    >
      {/* Browser chrome */}
      <div className="flex items-center gap-1.5 px-3 py-2.5 bg-gray-100 border-b border-gray-200">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
        <span className="ml-2 flex-1 truncate text-[10px] text-gray-500 bg-white border border-gray-200 rounded-md px-2 py-1">
          {site.url.replace(/^https?:\/\//, '')}
        </span>
      </div>
      {/* Card body */}
      <div className="p-4 flex-1 flex flex-col">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center text-white font-bold mb-3">
          {site.initials}
        </div>
        <h3 className="font-semibold text-gray-900 truncate">{site.title}</h3>
        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{site.description}</p>
        <div className="mt-auto pt-3 flex items-center gap-2 text-green-600 text-sm font-medium">
          Visit Site <ExternalLink className="w-3.5 h-3.5 group-hover/site:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </a>
  );

  const renderPage = (pageSites: SiteCard[]) => (
    <div className="w-full h-full grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {pageSites.map(site => renderSiteCard(site))}
    </div>
  );

  return (
    <section className="py-12 lg:py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Websites scroller */}
        <div className="text-center mb-8">
          <h2 className="text-xl lg:text-2xl font-bold text-gray-900">Websites We Build</h2>
          <p className="text-gray-500 text-sm mt-1">Hand-crafted websites for our clients across Kenya</p>
        </div>

        <div
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="group/scroller relative"
        >
          <div className="min-h-[220px]">
            {isFade ? (
              <div className="relative">
                {pages.map((pageSites, i) => (
                  <div
                    key={i}
                    className={cn(
                      'transition-opacity',
                      i === currentPage ? 'opacity-100 relative z-10' : 'opacity-0 absolute inset-0 z-0 pointer-events-none'
                    )}
                    style={{ transitionDuration: `${transitionMs}ms` }}
                  >
                    {renderPage(pageSites)}
                  </div>
                ))}
              </div>
            ) : isZoom ? (
              <div className="relative">
                {pages.map((pageSites, i) => (
                  <div
                    key={i}
                    className={cn(
                      'transition-all',
                      i === currentPage ? 'opacity-100 scale-100 relative z-10' : 'opacity-0 scale-95 absolute inset-0 z-0 pointer-events-none'
                    )}
                    style={{ transitionDuration: `${transitionMs}ms` }}
                  >
                    {renderPage(pageSites)}
                  </div>
                ))}
              </div>
            ) : (
              <div
                className="flex"
                style={{ transform: `translateX(-${currentPage * 100}%)`, transition: `transform ${transitionMs}ms ease` }}
              >
                {pages.map((pageSites, i) => (
                  <div key={i} className="w-full flex-shrink-0">
                    {renderPage(pageSites)}
                  </div>
                ))}
              </div>
            )}
          </div>

          {pageCount > 1 && (
            <>
              <button
                onClick={goPrevPage}
                aria-label="Previous websites"
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 w-9 h-9 rounded-full bg-white shadow-md border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 flex items-center justify-center opacity-0 group-hover/scroller:opacity-100 transition-opacity z-20"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={goNextPage}
                aria-label="Next websites"
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 w-9 h-9 rounded-full bg-white shadow-md border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 flex items-center justify-center opacity-0 group-hover/scroller:opacity-100 transition-opacity z-20"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5">
                {pages.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => goToPage(i)}
                    aria-label={`Go to websites page ${i + 1}`}
                    className={cn(
                      'h-1.5 rounded-full transition-all',
                      i === currentPage ? 'w-6 bg-green-500' : 'w-1.5 bg-gray-300 hover:bg-gray-400'
                    )}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Client comments */}
        <div className="text-center mt-12 mb-8">
          <h2 className="text-xl lg:text-2xl font-bold text-gray-900">What Clients Say</h2>
          <p className="text-gray-500 text-sm mt-1">Kind words from people we have worked with</p>
        </div>

        {testimonials.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-6">Testimonials coming soon.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {testimonials.map(t => (
              <div key={t.id} className="bg-gray-50 rounded-2xl border border-gray-200 p-5 flex flex-col">
                <div className="flex items-center gap-0.5 text-amber-400 mb-3">
                  {[1,2,3,4,5].map(s => <Star key={s} className={`w-4 h-4 ${s <= t.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />)}
                </div>
                <p className="text-sm text-gray-700 flex-1 leading-relaxed">"{t.comment}"</p>
                <div className="mt-4 pt-3 border-t border-gray-200">
                  <p className="font-semibold text-gray-900 text-sm">{t.client_name}</p>
                  {t.company && <p className="text-xs text-gray-500">{t.company}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default WebsitesTestimonials;
