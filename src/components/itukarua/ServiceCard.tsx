import React from 'react';
import { MapPin, Star, Clock, Sparkles } from 'lucide-react';

interface ServiceAd {
  id: string; businessName: string; description: string; category: string; image: string; location: string;
  contact: string; plan: '10-day' | '20-day' | '30-day'; expiryDate: string; featured: boolean; rating: number; reviews: number;
}


interface ServiceCardProps {
  service: ServiceAd;
  onClick?: () => void;
}

const ServiceCard: React.FC<ServiceCardProps> = ({ service, onClick }) => {
  const daysLeft = Math.max(0, Math.ceil((new Date(service.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

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
          className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-500"
        />
        {service.featured && (
          <div className="absolute top-3 left-3 px-2.5 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-semibold rounded-full flex items-center gap-1 shadow-lg">
            <Sparkles className="w-3 h-3" />
            Featured
          </div>
        )}
        <div className="absolute top-3 right-3 px-2 py-1 bg-black/60 backdrop-blur-sm text-white text-xs rounded-full flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {daysLeft}d left
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${categoryColors[service.category] || 'bg-gray-100 text-gray-700'}`}>
            {service.category}
          </span>
          <span className="text-xs text-gray-400">{service.plan}</span>
        </div>

        <h3 className="font-semibold text-gray-900 group-hover:text-green-700 transition-colors mb-1 line-clamp-1">
          {service.businessName}
        </h3>

        <p className="text-sm text-gray-500 line-clamp-2 mb-3">{service.description}</p>

        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <MapPin className="w-3.5 h-3.5 text-green-600" />
            {service.location}
          </span>
          <span className="flex items-center gap-1 text-xs">
            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            <span className="font-medium text-gray-700">{service.rating}</span>
            <span className="text-gray-400">({service.reviews})</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default ServiceCard;
