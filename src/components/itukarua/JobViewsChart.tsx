import React, { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Briefcase, Download } from 'lucide-react';

interface Props {
  data: { view_date: string; view_count: number }[];
  total: number;
}

type Period = 'day' | 'week' | 'month';

const fmtLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const JobViewsChart: React.FC<Props> = ({ data, total }) => {
  const [period, setPeriod] = useState<Period>('month');

  const windowData = useMemo(() => {
    const today = new Date();
    if (period === 'month') return data;
    const cut = new Date(today);
    if (period === 'week') cut.setDate(cut.getDate() - 6);
    else cut.setHours(0, 0, 0, 0);
    const cutKey = fmtLocal(cut);
    return data.filter(d => d.view_date >= cutKey);
  }, [data, period]);

  const windowTotal = windowData.reduce((s, d) => s + d.view_count, 0);
  const avg = windowData.length > 0 ? (windowTotal / windowData.length).toFixed(1) : '0';
  const peak = windowData.reduce((max, d) => Math.max(max, d.view_count), 0);
  const peakDate = windowData.find(d => d.view_count === peak)?.view_date;
  const rangeLabel = period === 'day' ? 'Today' : period === 'week' ? 'Last 7 days' : 'Last 30 days';

  const exportCSV = () => {
    const csv = ['Date,Views', ...windowData.map(d => `${d.view_date},${d.view_count}`)].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `job-views-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-xl p-5 border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <Briefcase className="w-4 h-4 text-blue-600" />
          </div>
          <h3 className="font-semibold text-gray-900">Your Job Views</h3>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">{rangeLabel}</span>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
            {(['day', 'week', 'month'] as Period[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${period === p ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {p === 'day' ? 'Day' : p === 'week' ? 'Week' : 'Month'}
              </button>
            ))}
          </div>
          <button onClick={exportCSV} disabled={windowData.length === 0} className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            <Download className="w-3 h-3" /> CSV
          </button>
        </div>
      </div>
      {windowData.length > 0 ? (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={windowData}>
            <defs>
              <linearGradient id="jvGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="view_date" tick={{ fontSize: 10 }} tickFormatter={v => v?.slice(5) || ''} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
              labelFormatter={l => `Date: ${l}`}
              formatter={(v: number) => [v, 'Views']}
            />
            <Area type="monotone" dataKey="view_count" stroke="#3b82f6" fill="url(#jvGradient)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[200px] flex items-center justify-center text-gray-400 text-xs">No views in this period yet</div>
      )}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
        <span>Views: <strong className="text-gray-900">{windowTotal}</strong></span>
        <span>Avg: <strong className="text-gray-900">{avg}/{period === 'day' ? 'day' : 'day'}</strong></span>
        <span>Peak: <strong className="text-gray-900">{peak}</strong>{peakDate ? ` (${peakDate})` : ''}</span>
        <span className="ml-auto">All-time: <strong className="text-gray-900">{total}</strong></span>
      </div>
    </div>
  );
};

export default JobViewsChart;