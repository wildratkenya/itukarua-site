import React, { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { MousePointerClick, Eye, ChevronDown, BarChart3 } from 'lucide-react';
import type { AdAnalyticsByAd } from '@/lib/database';

interface Props {
  analyticsByAd: AdAnalyticsByAd[];
}

type Period = 'daily' | 'weekly' | 'monthly';

function aggregate(data: { date: string; clicks: number; impressions: number }[], period: Period) {
  if (period === 'daily') return data;
  const grouped: Record<string, { clicks: number; impressions: number }> = {};
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
    if (!grouped[key]) grouped[key] = { clicks: 0, impressions: 0 };
    grouped[key].clicks += point.clicks;
    grouped[key].impressions += point.impressions;
  }
  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));
}

const AdvertiserAnalyticsChart: React.FC<Props> = ({ analyticsByAd }) => {
  const [period, setPeriod] = useState<Period>('daily');
  const [selectedAd, setSelectedAd] = useState<string>('__all__');

  const allData = useMemo(() => {
    const combined: Record<string, { clicks: number; impressions: number }> = {};
    for (const ad of analyticsByAd) {
      for (const p of ad.data) {
        if (!combined[p.date]) combined[p.date] = { clicks: 0, impressions: 0 };
        combined[p.date].clicks += p.clicks;
        combined[p.date].impressions += p.impressions;
      }
    }
    return Object.entries(combined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v }));
  }, [analyticsByAd]);

  const chartData = useMemo(() => {
    if (selectedAd === '__all__') return aggregate(allData, period);
    const ad = analyticsByAd.find(a => a.adId === selectedAd);
    return ad ? aggregate(ad.data, period) : [];
  }, [allData, analyticsByAd, selectedAd, period]);

  const totalClicks = useMemo(() => {
    if (selectedAd === '__all__') return analyticsByAd.reduce((s, a) => s + a.totalClicks, 0);
    return analyticsByAd.find(a => a.adId === selectedAd)?.totalClicks || 0;
  }, [analyticsByAd, selectedAd]);

  const totalImpressions = useMemo(() => {
    if (selectedAd === '__all__') return analyticsByAd.reduce((s, a) => s + a.totalImpressions, 0);
    return analyticsByAd.find(a => a.adId === selectedAd)?.totalImpressions || 0;
  }, [analyticsByAd, selectedAd]);

  const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(1) : '0';

  const sortedAds = useMemo(() =>
    [...analyticsByAd].sort((a, b) => b.totalClicks - a.totalClicks),
    [analyticsByAd]
  );

  return (
    <div className="bg-white rounded-xl p-5 border border-gray-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <MousePointerClick className="w-4 h-4 text-blue-600" />
          </div>
          <h3 className="font-semibold text-gray-900">Advert Performance</h3>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Ad filter */}
          <div className="relative">
            <select
              value={selectedAd}
              onChange={e => setSelectedAd(e.target.value)}
              className="appearance-none bg-gray-100 text-xs font-medium text-gray-700 rounded-lg px-3 py-1.5 pr-7 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="__all__">All Ads ({analyticsByAd.length})</option>
              {sortedAds.map(ad => (
                <option key={ad.adId} value={ad.adId}>
                  {ad.title} ({ad.totalClicks} clicks)
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          </div>
          {/* Period toggle */}
          <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
            {(['daily', 'weekly', 'monthly'] as Period[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)} className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${period === p ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-blue-50 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-blue-600 text-xs mb-1">
            <MousePointerClick className="w-3.5 h-3.5" />
            <span>Clicks</span>
          </div>
          <p className="text-xl font-bold text-blue-900">{totalClicks.toLocaleString()}</p>
        </div>
        <div className="bg-emerald-50 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-emerald-600 text-xs mb-1">
            <Eye className="w-3.5 h-3.5" />
            <span>Impressions</span>
          </div>
          <p className="text-xl font-bold text-emerald-900">{totalImpressions.toLocaleString()}</p>
        </div>
        <div className="bg-purple-50 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-purple-600 text-xs mb-1">
            <BarChart3 className="w-3.5 h-3.5" />
            <span>CTR</span>
          </div>
          <p className="text-xl font-bold text-purple-900">{ctr}%</p>
        </div>
      </div>

      {/* Chart */}
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

      {/* Per-ad breakdown table */}
      {analyticsByAd.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Per Ad Breakdown (last 30 days)</h4>
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 font-medium text-gray-500">Ad</th>
                  <th className="text-center py-2 font-medium text-gray-500">Status</th>
                  <th className="text-right py-2 font-medium text-gray-500">Clicks</th>
                  <th className="text-right py-2 font-medium text-gray-500">Impressions</th>
                  <th className="text-right py-2 font-medium text-gray-500">CTR</th>
                  <th className="text-right py-2 font-medium text-gray-500 hidden sm:table-cell">Created</th>
                </tr>
              </thead>
              <tbody>
                {sortedAds.map(ad => {
                  const adCtr = ad.totalImpressions > 0 ? ((ad.totalClicks / ad.totalImpressions) * 100).toFixed(1) : '0';
                  const isHighlighted = selectedAd === ad.adId;
                  return (
                    <tr
                      key={ad.adId}
                      onClick={() => setSelectedAd(isHighlighted ? '__all__' : ad.adId)}
                      className={`border-b border-gray-50 cursor-pointer transition-colors ${isHighlighted ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                    >
                      <td className="py-2.5 pr-3">
                        <span className="font-medium text-gray-900 truncate max-w-[180px] block">{ad.title}</span>
                      </td>
                      <td className="text-center py-2.5">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${ad.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {ad.active ? 'Live' : 'Paused'}
                        </span>
                      </td>
                      <td className="text-right py-2.5 font-medium text-blue-700">{ad.totalClicks.toLocaleString()}</td>
                      <td className="text-right py-2.5 font-medium text-emerald-700">{ad.totalImpressions.toLocaleString()}</td>
                      <td className="text-right py-2.5 font-medium text-purple-700">{adCtr}%</td>
                      <td className="text-right py-2.5 text-gray-400 hidden sm:table-cell">{new Date(ad.created_at).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvertiserAnalyticsChart;
