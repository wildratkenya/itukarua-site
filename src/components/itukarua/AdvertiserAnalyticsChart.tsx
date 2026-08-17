import React, { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { MousePointerClick, Eye } from 'lucide-react';
import type { AdAnalyticsPoint } from '@/lib/database';

interface Props {
  data: AdAnalyticsPoint[];
  totalClicks: number;
  totalImpressions: number;
}

type Period = 'daily' | 'weekly' | 'monthly';

function aggregate(data: AdAnalyticsPoint[], period: Period): AdAnalyticsPoint[] {
  if (period === 'daily') return data;
  const grouped: Record<string, { clicks: number; impressions: number; count: number }> = {};
  for (const point of data) {
    const d = new Date(point.date);
    let key: string;
    if (period === 'weekly') {
      const dayOfWeek = d.getDay();
      const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const monday = new Date(d);
      monday.setDate(monday.getDate() - mondayOffset);
      key = monday.toISOString().slice(0, 10);
    } else {
      key = d.toISOString().slice(0, 7);
    }
    if (!grouped[key]) grouped[key] = { clicks: 0, impressions: 0, count: 0 };
    grouped[key].clicks += point.clicks;
    grouped[key].impressions += point.impressions;
    grouped[key].count++;
  }
  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date: period === 'monthly' ? date : date,
      clicks: v.clicks,
      impressions: v.impressions,
    }));
}

const AdvertiserAnalyticsChart: React.FC<Props> = ({ data, totalClicks, totalImpressions }) => {
  const [period, setPeriod] = useState<Period>('daily');
  const chartData = useMemo(() => aggregate(data, period), [data, period]);
  const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(1) : '0';

  return (
    <div className="bg-white rounded-xl p-5 border border-gray-100">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <MousePointerClick className="w-4 h-4 text-blue-600" />
          </div>
          <h3 className="font-semibold text-gray-900">Advert Performance</h3>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          {(['daily', 'weekly', 'monthly'] as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${period === p ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="clicksGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="impressionsGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => v?.slice(5) || v} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
              labelFormatter={l => `Date: ${l}`}
            />
            <Legend />
            <Area type="monotone" dataKey="impressions" name="Impressions" stroke="#10b981" fill="url(#impressionsGrad)" strokeWidth={2} />
            <Area type="monotone" dataKey="clicks" name="Clicks" stroke="#3b82f6" fill="url(#clicksGrad)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[250px] flex items-center justify-center text-gray-400 text-sm">
          No analytics data yet. Data will appear as people view and click your adverts.
        </div>
      )}

      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500 flex-wrap">
        <span>Total Clicks: <strong className="text-gray-900">{totalClicks}</strong></span>
        <span>Total Impressions: <strong className="text-gray-900">{totalImpressions}</strong></span>
        <span>CTR: <strong className="text-gray-900">{ctr}%</strong></span>
      </div>
    </div>
  );
};

export default AdvertiserAnalyticsChart;
