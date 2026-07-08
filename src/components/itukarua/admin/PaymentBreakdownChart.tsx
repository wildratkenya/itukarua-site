import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface BreakdownItem {
  name: string;
  value: number;
  amount: number;
}

interface PaymentBreakdownChartProps {
  data: BreakdownItem[];
}

const COLORS = ['#16a34a', '#2563eb', '#d97706', '#9333ea', '#dc2626', '#0891b2'];

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-900 capitalize mb-1">{d.name.replace(/_/g, ' ')}</p>
      <p className="text-gray-600">{d.value} transactions</p>
      <p className="text-green-600 font-medium">KES {d.amount.toLocaleString()}</p>
    </div>
  );
};

const PaymentBreakdownChart: React.FC<PaymentBreakdownChartProps> = ({ data }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-4">
    <h3 className="text-sm font-semibold text-gray-900 mb-4">Payment Type Breakdown</h3>
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} formatter={(val: string) => val.replace(/_/g, ' ')} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  </div>
);

export default PaymentBreakdownChart;
