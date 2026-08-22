import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Briefcase } from 'lucide-react';

interface Props {
  data: { view_date: string; view_count: number }[];
  total: number;
}

const JobViewsChart: React.FC<Props> = ({ data, total }) => {
  const avg = data.length > 0 ? (total / data.length).toFixed(1) : '0';
  const peak = data.reduce((max, d) => Math.max(max, d.view_count), 0);
  const peakDate = data.find(d => d.view_count === peak)?.view_date;

  return (
    <div className="bg-white rounded-xl p-5 border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <Briefcase className="w-4 h-4 text-blue-600" />
          </div>
          <h3 className="font-semibold text-gray-900">Your Job Views</h3>
        </div>
        <span className="text-xs text-gray-400">Last 30 days</span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data}>
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
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
        <span>Total: <strong className="text-gray-900">{total}</strong></span>
        <span>Avg: <strong className="text-gray-900">{avg}/day</strong></span>
        <span>Peak: <strong className="text-gray-900">{peak}</strong>{peakDate ? ` (${peakDate})` : ''}</span>
      </div>
    </div>
  );
};

export default JobViewsChart;
