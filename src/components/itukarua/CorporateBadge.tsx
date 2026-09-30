import React, { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import { getCorporateCompanyName } from '@/lib/database';

interface CorporateBadgeProps {
  accountId?: string | null;
}

const CorporateBadge: React.FC<CorporateBadgeProps> = ({ accountId }) => {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!accountId) {
      setName(null);
      return;
    }
    getCorporateCompanyName(accountId).then(n => { if (!cancelled) setName(n); }).catch(() => {});
    return () => { cancelled = true; };
  }, [accountId]);

  if (!accountId || !name) return null;

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-600 text-white text-[10px] font-bold rounded-full whitespace-nowrap" title={`Corporate partner — ${name}`}>
      <Building2 className="w-2.5 h-2.5" /> {name}
    </span>
  );
};

export default CorporateBadge;