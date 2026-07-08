import React from 'react';
import { BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface DailyData {
  date: string;
  amount: number;
  count: number;
}

interface RevenueChartProps {
  data: DailyData[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-900 mb-1">{label}</p>
      <p className="text-green-600 font-medium">KES {payload[0].value.toLocaleString()}</p>
      <p className="text-blue-600">{payload[1]?.value || 0} transactions</p>
    </div>
  );
};

const RevenueChart: React.FC<RevenueChartProps> = ({ data }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-4">
    <h3 className="text-sm font-semibold text-gray-900 mb-4">Daily Revenue & Transactions</h3>
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
          <Bar yAxisId="left" dataKey="amount" name="Revenue (KES)" fill="#16a34a" radius={[4, 4, 0, 0]} />
          <Line yAxisId="right" dataKey="count" name="Transactions" stroke="#2563eb" strokeWidth={2} dot={{ r: 3, fill: '#2563eb' }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
);

export default RevenueChart;
