import React from 'react';
import { ArrowRight } from 'lucide-react';

interface Transaction {
  id: string;
  amount: number;
  status: string;
  payment_type: string;
  mpesa_ref?: string;
  description?: string;
  created_at: string;
}

interface RecentTransactionsProps {
  transactions: Transaction[];
  onViewAll: () => void;
}

const statusColor: Record<string, string> = {
  completed: 'bg-green-100 text-green-700',
  pending: 'bg-gray-100 text-gray-600',
  failed: 'bg-red-100 text-red-700',
  refunded: 'bg-amber-100 text-amber-700',
};

const typeLabel = (t: string) => t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const RecentTransactions: React.FC<RecentTransactionsProps> = ({ transactions, onViewAll }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-4">
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-sm font-semibold text-gray-900">Recent M-Pesa Transactions</h3>
      <button onClick={onViewAll} className="text-xs text-green-600 hover:text-green-700 font-medium flex items-center gap-1">
        View All <ArrowRight className="w-3 h-3" />
      </button>
    </div>
    <div className="space-y-1">
      {transactions.length === 0 ? (
        <p className="text-xs text-gray-400 py-4 text-center">No transactions yet</p>
      ) : (
        transactions.slice(0, 10).map(tx => (
          <div key={tx.id} className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-gray-50 transition-colors">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 truncate">{typeLabel(tx.payment_type)}</p>
              <p className="text-[11px] text-gray-400">
                {new Date(tx.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                {tx.mpesa_ref && <span className="ml-2 font-mono">Ref: {tx.mpesa_ref}</span>}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-3">
              <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${statusColor[tx.status] || 'bg-gray-100 text-gray-600'}`}>{tx.status}</span>
              <span className="text-sm font-bold text-gray-900">KES {tx.amount.toLocaleString()}</span>
            </div>
          </div>
        ))
      )}
    </div>
  </div>
);

export default RecentTransactions;
