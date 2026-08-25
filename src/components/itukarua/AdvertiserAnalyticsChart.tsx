import React, { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { MousePointerClick, Eye, BarChart3, ChevronDown, ChevronUp } from 'lucide-react';
import type { AdAnalyticsByAd } from '@/lib/database';

interface Props {
  analyticsByAd: AdAnalyticsByAd[];
  ads?: Array<{ id: string; billing_start?: string; billing_end?: string; displays?: number; expected_impressions?: number; target_county?: string; target_subcounty?: string; created_at: string }>;
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

function ChartSection({ data, id }: { data: { date: string; clicks: number; impressions: number }[]; id: string }) {
  if (data.length === 0) {
    return <div className="h-[180px] flex items-center justify-center text-gray-400 text-xs">No data yet</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id={`clicksGrad-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
          <linearGradient id={`impGrad-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => v?.slice(5) || v} interval="preserveStartEnd" />
        <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
        <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }} labelFormatter={l => `Date: ${l}`} />
        <Legend />
        <Area type="monotone" dataKey="impressions" name="Impressions" stroke="#10b981" fill={`url(#impGrad-${id})`} strokeWidth={2} />
        <Area type="monotone" dataKey="clicks" name="Clicks" stroke="#3b82f6" fill={`url(#clicksGrad-${id})`} strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function calcPace(ad: { billing_start?: string; billing_end?: string; displays?: number; expected_impressions?: number; created_at: string }) {
  const now = Date.now();
  const start = new Date(ad.billing_start || ad.created_at).getTime();
  const end = new Date(ad.billing_end || start + 7 * 86400000).getTime();
  const totalMs = Math.max(end - start, 1);
  const elapsedMs = Math.max(now - start, 0);
  const fraction = Math.min(elapsedMs / totalMs, 1);
  const expected = ad.expected_impressions || 1000;
  const expectedSoFar = Math.round(fraction * expected);
  const delivered = ad.displays || 0;
  const ratio = expectedSoFar > 0 ? delivered / expectedSoFar : 1;
  const daysLeft = Math.max((end - now) / 86400000, 0);
  return { ratio, delivered, expected: expectedSoFar, daysLeft, totalDays: totalMs / 86400000 };
}

const AdvertiserAnalyticsChart: React.FC<Props> = ({ analyticsByAd, ads = [] }) => {
  const [expandedAd, setExpandedAd] = useState<string | null>(analyticsByAd.length === 1 ? analyticsByAd[0]?.adId : null);

  const sortedAds = useMemo(() =>
    [...analyticsByAd].sort((a, b) => b.totalClicks - a.totalClicks),
    [analyticsByAd]
  );

  const totals = useMemo(() => {
    const clicks = analyticsByAd.reduce((s, a) => s + a.totalClicks, 0);
    const impressions = analyticsByAd.reduce((s, a) => s + a.totalImpressions, 0);
    const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(1) : '0';
    return { clicks, impressions, ctr };
  }, [analyticsByAd]);

  return (
    <div className="space-y-4">
      {/* Overall Summary */}
      <div className="bg-white rounded-xl p-5 border border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <MousePointerClick className="w-4 h-4 text-blue-600" />
          </div>
          <h3 className="font-semibold text-gray-900">Advert Performance</h3>
          <span className="text-xs text-gray-400 ml-1">{analyticsByAd.length} advert{analyticsByAd.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-blue-600 text-xs mb-1">
              <MousePointerClick className="w-3.5 h-3.5" />
              <span>Clicks</span>
            </div>
            <p className="text-xl font-bold text-blue-900">{totals.clicks.toLocaleString()}</p>
          </div>
          <div className="bg-emerald-50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-emerald-600 text-xs mb-1">
              <Eye className="w-3.5 h-3.5" />
              <span>Impressions</span>
            </div>
            <p className="text-xl font-bold text-emerald-900">{totals.impressions.toLocaleString()}</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-purple-600 text-xs mb-1">
              <BarChart3 className="w-3.5 h-3.5" />
              <span>CTR</span>
            </div>
            <p className="text-xl font-bold text-purple-900">{totals.ctr}%</p>
          </div>
        </div>
      </div>

      {/* Per-ad cards */}
      {sortedAds.map(ad => {
        const isExpanded = expandedAd === ad.adId;
        const adCtr = ad.totalImpressions > 0 ? ((ad.totalClicks / ad.totalImpressions) * 100).toFixed(1) : '0';
        const data = aggregate(ad.data, 'daily');

        return (
          <div key={ad.adId} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {/* Ad header — clickable */}
            <button
              onClick={() => setExpandedAd(isExpanded ? null : ad.adId)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${ad.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {ad.active ? 'Live' : 'Off'}
                </span>
                <span className="font-medium text-gray-900 truncate">{ad.title}</span>
                <span className="text-xs text-gray-400 hidden sm:inline">Created {new Date(ad.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <div className="hidden sm:flex items-center gap-3 text-xs">
                  <span className="text-blue-600 font-medium">{ad.totalClicks.toLocaleString()} clicks</span>
                  <span className="text-emerald-600 font-medium">{ad.totalImpressions.toLocaleString()} views</span>
                  <span className="text-purple-600 font-medium">{adCtr}% CTR</span>
                </div>
                {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </div>
            </button>

            {/* Expanded detail */}
            {isExpanded && (
              <div className="px-4 pb-4 border-t border-gray-100">
                {/* Mobile stats */}
                <div className="flex items-center gap-4 sm:hidden py-3 text-xs">
                  <span className="text-blue-600 font-medium">{ad.totalClicks.toLocaleString()} clicks</span>
                  <span className="text-emerald-600 font-medium">{ad.totalImpressions.toLocaleString()} views</span>
                  <span className="text-purple-600 font-medium">{adCtr}% CTR</span>
                </div>
                {/* Mini summary */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="bg-blue-50 rounded-lg p-2 text-center">
                    <p className="text-[10px] text-blue-600 mb-0.5">Clicks</p>
                    <p className="text-sm font-bold text-blue-900">{ad.totalClicks.toLocaleString()}</p>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-2 text-center">
                    <p className="text-[10px] text-emerald-600 mb-0.5">Impressions</p>
                    <p className="text-sm font-bold text-emerald-900">{ad.totalImpressions.toLocaleString()}</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-2 text-center">
                    <p className="text-[10px] text-purple-600 mb-0.5">CTR</p>
                    <p className="text-sm font-bold text-purple-900">{adCtr}%</p>
                  </div>
                </div>
                {/* Pacing + targeting info */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {(() => {
                    const adData = ads.find(a => a.id === ad.adId);
                    if (!adData) return null;
                    const pace = calcPace(adData);
                    const paceColor = pace.ratio < 0.8 ? 'text-amber-600' : pace.ratio > 1.2 ? 'text-red-600' : 'text-green-600';
                    const paceBg = pace.ratio < 0.8 ? 'bg-amber-50' : pace.ratio > 1.2 ? 'bg-red-50' : 'bg-green-50';
                    return (
                      <>
                        <div className={`${paceBg} rounded-lg p-2 text-center`}>
                          <p className="text-[10px] text-gray-500 mb-0.5">Pace</p>
                          <p className={`text-sm font-bold ${paceColor}`}>{Math.round(pace.ratio * 100)}%</p>
                          <p className="text-[9px] text-gray-400">{pace.delivered}/{pace.expected} expected</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2 text-center">
                          <p className="text-[10px] text-gray-500 mb-0.5">Days Left</p>
                          <p className="text-sm font-bold text-gray-900">{Math.round(pace.daysLeft)}</p>
                          <p className="text-[9px] text-gray-400">of {Math.round(pace.totalDays)} total</p>
                        </div>
                        {(adData.target_county || adData.target_subcounty) && (
                          <div className="col-span-2 bg-blue-50 rounded-lg p-2 text-center">
                            <p className="text-[10px] text-blue-600">Targeting: {adData.target_subcounty ? `${adData.target_subcounty} sub-county` : `${adData.target_county} county`}</p>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
                <ChartSection data={data} id={ad.adId} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default AdvertiserAnalyticsChart;
