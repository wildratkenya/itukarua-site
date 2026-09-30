import React, { useEffect, useState } from 'react';
import { Building2, CalendarX2, AlertTriangle, ChevronRight } from 'lucide-react';
import { getCorporateAccounts, type DbCorporateAccount } from '@/lib/database';
import { corporateMonthlyAmount } from '@/data/siteData';

interface CorporateExpiryAlertsProps {
  onNavigateCorporate: () => void;
}

type NoticeAccount = DbCorporateAccount & { status: 'overdue' | 'suspended' | 'due-soon' };

const CorporateExpiryAlerts: React.FC<CorporateExpiryAlertsProps> = ({ onNavigateCorporate }) => {
  const [accounts, setAccounts] = useState<DbCorporateAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCorporateAccounts()
      .then(setAccounts)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  const notices: NoticeAccount[] = accounts
    .map(acct => {
      let status: NoticeAccount['status'] | null = null;
      if (acct.next_billing_date) {
        const due = new Date(acct.next_billing_date + 'T00:00:00Z');
        if (!acct.is_active) status = 'suspended';
        else if (due < today) status = 'overdue';
        else if (due <= in7Days) status = 'due-soon';
      } else if (!acct.is_active) {
        status = 'suspended';
      }
      return status ? { ...acct, status } : null;
    })
    .filter((a): a is NoticeAccount => a !== null)
    .sort((a, b) => {
      const rank = { overdue: 0, suspended: 1, 'due-soon': 2 };
      return rank[a.status] - rank[b.status];
    });

  if (notices.length === 0) return null;

  const styleFor = (status: NoticeAccount['status']) =>
    status === 'overdue'
      ? { badge: 'bg-red-50 text-red-600', ring: 'border-red-100', icon: <CalendarX2 className="w-4 h-4 text-red-500" /> }
      : status === 'suspended'
        ? { badge: 'bg-gray-100 text-gray-600', ring: 'border-gray-100', icon: <Building2 className="w-4 h-4 text-gray-500" /> }
        : { badge: 'bg-amber-50 text-amber-700', ring: 'border-amber-100', icon: <AlertTriangle className="w-4 h-4 text-amber-500" /> };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <CalendarX2 className="w-4 h-4 text-red-500" /> Corporate Billing Alerts ({notices.length})
        </h3>
        <button onClick={onNavigateCorporate} className="flex items-center gap-1 text-xs font-semibold text-green-700 hover:text-green-800 transition-colors">
          Corporate billing <ChevronRight className="w-3 h-3" />
        </button>
      </div>
      <div className="space-y-2">
        {notices.map(acct => {
          const style = styleFor(acct.status);
          return (
            <div key={acct.id} className={`flex items-center gap-3 text-xs border ${style.ring} rounded-lg px-3 py-2`}>
              {style.icon}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{acct.company_name}</p>
                <p className="text-gray-500">
                  {acct.status === 'overdue' && `Overdue — next billing ${acct.next_billing_date} · KES ${corporateMonthlyAmount(acct).toLocaleString()}/mo`}
                  {acct.status === 'suspended' && 'Suspended — awaiting reactivation'}
                  {acct.status === 'due-soon' && `Due soon — ${acct.next_billing_date} · KES ${corporateMonthlyAmount(acct).toLocaleString()}/mo`}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CorporateExpiryAlerts;