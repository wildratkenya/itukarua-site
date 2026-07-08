import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface AnalyticsCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend?: { value: string; positive: boolean };
  subtitle?: string;
}

const AnalyticsCard: React.FC<AnalyticsCardProps> = ({ title, value, icon, trend, subtitle }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3 hover:shadow-sm transition-shadow">
    <div className="p-2.5 rounded-lg bg-green-50 text-green-600 flex-shrink-0">
      {icon}
    </div>
    <div className="min-w-0">
      <p className="text-xs text-gray-500 font-medium">{title}</p>
      <p className="text-xl font-bold text-gray-900 mt-0.5 truncate">{value}</p>
      {trend && (
        <p className={`text-xs flex items-center gap-0.5 mt-1 ${trend.positive ? 'text-green-600' : 'text-red-500'}`}>
          {trend.positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {trend.value}
        </p>
      )}
      {subtitle && <p className="text-[10px] text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  </div>
);

export default AnalyticsCard;
