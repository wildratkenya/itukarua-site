import React from 'react';
import { MapPin, Star, Sparkles } from 'lucide-react';

interface ServiceAd {
  id: string; 
  businessName: string; 
  description: string; 
  category: string; 
  image: string; 
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
      className="bg-white rounded-xl border border-gray-100 hover:border-green-200 hover:shadow-lg transition-all duration-300 cursor-pointer group overflow-hidden"
    >
      <div className="relative">
        <img
          src={service.image}
          alt={service.businessName}
          loading="lazy"
          className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-500"
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'https://d64gsuwffb70l.cloudfront.net/699028ea57858e2969bc2466_1771055543861_b8e656f2.jpg';
          }}
        />
        {service.featured && (
          <div className="absolute top-3 left-3 px-2.5 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-semibold rounded-full flex items-center gap-1 shadow-lg">
            <Sparkles className="w-3 h-3" />
            Featured
          </div>
        )}
      </div>

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
