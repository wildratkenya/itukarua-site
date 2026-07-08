import React, { useEffect, useState } from 'react';
import { DollarSign, CreditCard, TrendingUp, CheckCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import AnalyticsCard from './AnalyticsCard';
import RevenueChart from './RevenueChart';
import PaymentBreakdownChart from './PaymentBreakdownChart';
import RecentTransactions from './RecentTransactions';

interface DbPayment {
  id: string;
  amount: number;
  status: string;
  payment_type: string;
  mpesa_ref?: string;
  description?: string;
  created_at: string;
}

interface DailyData {
  date: string;
  amount: number;
  count: number;
}

interface BreakdownItem {
  name: string;
  value: number;
  amount: number;
}

const AdminDashboard: React.FC<{ onNavigatePayments: () => void }> = ({ onNavigatePayments }) => {
  const [payments, setPayments] = useState<DbPayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('payments').select('*').order('created_at', { ascending: false }).then(({ data }) => {
      setPayments(data || []);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-green-600" />
      </div>
    );
  }

  const completed = payments.filter(p => p.status === 'completed');
  const totalRevenue = completed.reduce((sum, p) => sum + p.amount, 0);
  const now = new Date();
  const thisMonth = completed.filter(p => {
    const d = new Date(p.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthRevenue = thisMonth.reduce((sum, p) => sum + p.amount, 0);
  const successRate = payments.length > 0 ? (completed.length / payments.length) * 100 : 0;

  const dailyMap = new Map<string, { amount: number; count: number }>();
  const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  completed
    .filter(p => new Date(p.created_at) >= last30)
    .forEach(p => {
      const key = new Date(p.created_at).toLocaleDateString('en-KE', { day: '2-digit', month: 'short' });
      const e = dailyMap.get(key) || { amount: 0, count: 0 };
      e.amount += p.amount;
      e.count += 1;
      dailyMap.set(key, e);
    });
  const dailyData: DailyData[] = Array.from(dailyMap.entries())
    .map(([date, { amount, count }]) => ({ date, amount, count }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const typeMap = new Map<string, { value: number; amount: number }>();
  completed.forEach(p => {
    const e = typeMap.get(p.payment_type) || { value: 0, amount: 0 };
    e.value += 1;
    e.amount += p.amount;
    typeMap.set(p.payment_type, e);
  });
  const breakdown: BreakdownItem[] = Array.from(typeMap.entries()).map(([name, d]) => ({ name, ...d }));

  const recent = payments.slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <AnalyticsCard
          title="Total Revenue"
          value={`KES ${totalRevenue.toLocaleString()}`}
          icon={<DollarSign className="w-5 h-5" />}
          subtitle={`${completed.length} completed payments`}
        />
        <AnalyticsCard
          title="This Month"
          value={`KES ${monthRevenue.toLocaleString()}`}
          icon={<CreditCard className="w-5 h-5" />}
          subtitle={`${thisMonth.length} transactions this month`}
        />
        <AnalyticsCard
          title="Total Transactions"
          value={payments.length.toLocaleString()}
          icon={<TrendingUp className="w-5 h-5" />}
          subtitle={`${completed.length} completed, ${payments.length - completed.length} other`}
        />
        <AnalyticsCard
          title="Success Rate"
          value={`${successRate.toFixed(1)}%`}
          icon={<CheckCircle className="w-5 h-5" />}
          trend={successRate >= 70 ? { value: `${completed.length}/${payments.length} completed`, positive: true } : { value: `${completed.length}/${payments.length} completed`, positive: false }}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <RevenueChart data={dailyData} />
        </div>
        <div>
          <PaymentBreakdownChart data={breakdown} />
        </div>
      </div>

      {/* Recent Transactions */}
      <RecentTransactions transactions={recent} onViewAll={onNavigatePayments} />
    </div>
  );
};

export default AdminDashboard;
