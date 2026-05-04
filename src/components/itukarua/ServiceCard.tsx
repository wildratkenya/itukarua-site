import React, { useState } from 'react';
import { MapPin, Star, Sparkles, Phone, Camera } from 'lucide-react';

interface ServiceAd {
  id: string; 
  businessName: string; 
  description: string; 
  category: string; 
  image: string; 
  images?: string[];
  location: string;
  contact: string; 
  expiryDate: string; 
  featured: boolean; 
  rating: number; 
  reviews: number;
}


interface ServiceCardProps {
  service: ServiceAd;
  onClick?: () => void;
}

const ServiceCard: React.FC<ServiceCardProps> = ({ service, onClick }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const allImages = service.images && service.images.length > 0 
    ? service.images 
    : service.image 
      ? [service.image] 
      : [];
  const hasMultipleImages = allImages.length > 1;

  const categoryColors: Record<string, string> = {
    Shops: 'bg-blue-100 text-blue-700',
    Plumbing: 'bg-cyan-100 text-cyan-700',
    Electrical: 'bg-yellow-100 text-yellow-700',
    'Salon & Beauty': 'bg-pink-100 text-pink-700',
    Tutoring: 'bg-purple-100 text-purple-700',
    Mechanics: 'bg-orange-100 text-orange-700',
    Catering: 'bg-red-100 text-red-700',
    Photography: 'bg-indigo-100 text-indigo-700',
    'IT Services': 'bg-teal-100 text-teal-700',
    Cleaning: 'bg-emerald-100 text-emerald-700',
    Security: 'bg-slate-200 text-slate-700',
  };

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-gray-100 hover:border-green-200 hover:shadow-lg transition-all duration-300 cursor-pointer group"
    >
      <div className="relative aspect-square overflow-hidden rounded-xl">
        {allImages.length > 0 ? (
          <>
            <img
              src={allImages[currentImageIndex]}
              alt={`${service.businessName} - Image ${currentImageIndex + 1}`}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://d64gsuwffb70l.cloudfront.net/699028ea57858e2969bc2466_1771055543861_b8e656f2.jpg';
              }}
              draggable={false}
            />
            {hasMultipleImages && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentImageIndex(prev => prev === 0 ? allImages.length - 1 : prev - 1);
                  }}
                  className="absolute left-1 top-1/2 -translate-y-1/2 w-6 h-6 bg-black/50 hover:bg-black/70 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ‹
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentImageIndex(prev => prev === allImages.length - 1 ? 0 : prev + 1);
                  }}
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 bg-black/50 hover:bg-black/70 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ›
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                  {allImages.map((_, i) => (
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
                  {allImages.length}
                </div>
              </>
)}
            {hasMultipleImages && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                {allImages.map((_, i) => (
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
            src='https://d64gsuwffb70l.cloudfront.net/699028ea57858e2969bc2466_1771055543861_b8e656f2.jpg'
            alt={service.businessName}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        )}
        {service.featured && (
          <div className="absolute top-3 left-3 px-2.5 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-semibold rounded-full flex items-center gap-1 shadow-lg">
            <Sparkles className="w-3 h-3" />
            Featured
          </div>
        )}
      </div>
      {allImages.length > 0 && (
        <div className="flex gap-1 p-2 bg-gray-50 overflow-x-auto min-h-[52px] items-center">
          {allImages.length === 1 ? (
            <button
              onClick={(e) => e.stopPropagation()}
              className="flex-shrink-0 w-12 h-12 rounded overflow-hidden border-2 border-green-500"
            >
              <img src={allImages[0]} alt="" className="w-full h-full object-cover" />
            </button>
          ) : (
            allImages.map((img, i) => (
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
                <img src={img} alt="" className="w-full h-full object-cover" />
              </button>
            ))
          )}
        </div>
      )}

      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${categoryColors[service.category] || 'bg-gray-100 text-gray-700'}`}>
            {service.category}
          </span>
        </div>

        <h3 className="font-semibold text-gray-900 group-hover:text-green-700 transition-colors mb-1 line-clamp-1">
          {service.businessName}
        </h3>

        <p className="text-sm text-gray-500 line-clamp-3 mb-4">{service.description}</p>

        <div className="flex items-center justify-between pt-3 border-t border-gray-50">
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <MapPin className="w-3.5 h-3.5 text-green-600" />
            {service.location}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onClick) onClick();
            }}
            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            More Details
          </button>
        </div>
      </div>
    </div>
  );
};

export default ServiceCard;
