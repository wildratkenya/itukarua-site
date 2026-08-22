import React from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart } from 'recharts';
import { Activity } from 'lucide-react';

interface Props {
  data: { date: string; visitors: number; page_views: number }[];
}

const SiteTrafficChart: React.FC<Props> = ({ data }) => {
  const totalVisitors = data.reduce((s, d) => s + d.visitors, 0);
  const totalPageViews = data.reduce((s, d) => s + d.page_views, 0);

  return (
    <div className="bg-white rounded-xl p-5 border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
            <Activity className="w-4 h-4 text-green-600" />
          </div>
          <h3 className="font-semibold text-gray-900">Itukarua Website Traffic Activity</h3>
        </div>
        <span className="text-xs text-gray-400">Last 30 days</span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data}>
          <defs>
            <linearGradient id="stGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => v?.slice(5) || ''} interval="preserveStartEnd" />
          <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
          <Tooltip
            contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
            labelFormatter={l => `Date: ${l}`}
          />
          <Bar dataKey="page_views" fill="#22c55e" opacity={0.3} radius={[2, 2, 0, 0]} name="Page Views" />
          <Line type="monotone" dataKey="visitors" stroke="#16a34a" strokeWidth={2} dot={false} name="Visitors" />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
        <span>Total Visitors: <strong className="text-gray-900">{totalVisitors}</strong></span>
        <span>Page Views: <strong className="text-gray-900">{totalPageViews}</strong></span>
      </div>
    </div>
  );
};

export default SiteTrafficChart;
