import React, { useState, useEffect } from 'react';
import SEO from '@/lib/seo';
import { ArrowLeft, MapPin, Star, Phone, MessageCircle, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { getServiceAdById, createServiceRating, checkServiceRating } from '@/lib/database';
import { optimizeImageUrl, handleImageError } from '@/lib/supabase';
import type { Page } from './Header';
import type { UserState } from '../AppLayout';
import ImageViewerModal from './ImageViewerModal';
import JobListingsTopBanner from './JobListingsTopBanner';

interface ServiceDetailPageProps {
  serviceId: string;
  onNavigate: (page: Page) => void;
  onBack: () => void;
  user: UserState | null;
  onOpenAuth: (tab: 'login' | 'signup') => void;
}

const ServiceDetailPage: React.FC<ServiceDetailPageProps> = ({ serviceId, onNavigate, onBack, user, onOpenAuth }) => {
  const [service, setService] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentImg, setCurrentImg] = useState(0);
  const [viewingImage, setViewingImage] = useState<{ images: string[]; index: number } | null>(null);
  const [userRating, setUserRating] = useState<number>(0);
  const [ratingMsg, setRatingMsg] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const s = await getServiceAdById(serviceId);
        setService(s);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [serviceId]);

  useEffect(() => {
    if (service && user) {
      checkServiceRating(service.id, user.id).then(r => setUserRating(r || 0));
    }
  }, [service, user]);

  const handleRate = async (star: number) => {
    if (!user) { onOpenAuth('login'); return; }
    setUserRating(star);
    try {
      await createServiceRating(service.id, user.id, star);
      setRatingMsg('Thank you for rating!');
      setTimeout(() => setRatingMsg(''), 2500);
    } catch {
      setRatingMsg('Failed to save rating');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
      </div>
    );
  }

  if (!service) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Service Not Found</h2>
          <button onClick={onBack} className="text-green-600 hover:text-green-700 font-medium">Go Back</button>
        </div>
      </div>
    );
  }

  const allImages = service.images && service.images.length > 0
    ? service.images
    : service.image
      ? [service.image]
      : [];

  return (
    <>
      <SEO
        title={`${service.business_name} - ${service.category} | Itukarua`}
        description={service.description?.substring(0, 160) || `${service.business_name} - ${service.category} in ${service.location || service.county || 'Kenya'}`}
        canonical={`/services/${service.id}`}
      />

      <JobListingsTopBanner />

      <div className="min-h-screen bg-gray-50">
        <div className="bg-gradient-to-r from-green-700 to-green-800 py-8">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <button onClick={onBack} className="flex items-center gap-2 text-green-200 hover:text-white mb-4 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to Services
            </button>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl lg:text-3xl font-bold text-white">{service.business_name}</h1>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">{service.category}</span>
              {service.featured && (
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-amber-500 to-orange-500 text-white">Featured</span>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              {allImages.length > 0 && (
                <div className="bg-white rounded-xl overflow-hidden border border-gray-100">
                  <div className="relative aspect-[16/9] cursor-pointer" onClick={() => setViewingImage({ images: allImages, index: currentImg })}>
                    <img src={optimizeImageUrl(allImages[currentImg], 800, 450)} alt={service.business_name} className="w-full h-full object-cover" onError={handleImageError} />
                    {allImages.length > 1 && (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); setCurrentImg(prev => prev === 0 ? allImages.length - 1 : prev - 1); }} className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"><ChevronLeft className="w-5 h-5" /></button>
                        <button onClick={(e) => { e.stopPropagation(); setCurrentImg(prev => prev === allImages.length - 1 ? 0 : prev + 1); }} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"><ChevronRight className="w-5 h-5" /></button>
                      </>
                    )}
                  </div>
                  {allImages.length > 1 && (
                    <div className="flex gap-2 p-3 overflow-x-auto bg-gray-50">
                      {allImages.map((img: string, i: number) => (
                        <button key={i} onClick={() => setCurrentImg(i)} className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${i === currentImg ? 'border-green-500' : 'border-transparent hover:border-gray-300'}`}>
                          <img src={optimizeImageUrl(img, 128, 128)} alt="" className="w-full h-full object-cover" onError={handleImageError} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="bg-white rounded-xl p-6 border border-gray-100">
                <h2 className="text-lg font-bold text-gray-900 mb-3">About This Business</h2>
                <p className="text-gray-600 leading-relaxed whitespace-pre-line">{service.description}</p>
              </div>

              <div className="bg-white rounded-xl p-6 border border-gray-100">
                <h2 className="text-lg font-bold text-gray-900 mb-3">Rate This Service</h2>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button key={star} onClick={() => handleRate(star)} className={`text-2xl transition-colors ${star <= userRating ? 'text-amber-400' : 'text-gray-200 hover:text-amber-300'}`}>?</button>
                  ))}
                  {ratingMsg && <span className="text-sm text-green-600 ml-2">{ratingMsg}</span>}
                </div>
                <p className="text-sm text-gray-500 mt-2">{Number(service.rating) || 0}/5 ({service.reviews_count || service.reviews || 0} reviews)</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-white rounded-xl p-6 border border-gray-100 sticky top-4">
                <h3 className="font-bold text-gray-900 mb-4">Contact Information</h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Location</p>
                      <p className="text-sm text-gray-900">{service.location}{service.subcounty ? `, ${service.subcounty}` : ''}{service.county ? `, ${service.county}` : ''}</p>
                    </div>
                  </div>
                  {service.contact && (
                    <div className="flex items-start gap-3">
                      <Phone className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500 font-medium">Phone</p>
                        <a href={`tel:${service.contact}`} className="text-sm text-green-600 hover:text-green-700 font-medium">{service.contact}</a>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <Star className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Rating</p>
                      <p className="text-sm text-gray-900">{Number(service.rating) || 0}/5 ({service.reviews_count || service.reviews || 0} reviews)</p>
                    </div>
                  </div>
                </div>
                <div className="mt-6 space-y-3">
                  {service.contact && (
                    <a href={`tel:${service.contact}`} className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
                      <Phone className="w-4 h-4" /> Call Now
                    </a>
                  )}
                  {service.contact && (
                    <a href={`https://wa.me/${service.contact.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
                      <MessageCircle className="w-4 h-4" /> Chat on WhatsApp
                    </a>
                  )}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-400">Listed: {new Date(service.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {viewingImage && (
        <ImageViewerModal images={viewingImage.images} initialIndex={viewingImage.index} onClose={() => setViewingImage(null)} />
      )}
    </>
  );
};

export default ServiceDetailPage;
