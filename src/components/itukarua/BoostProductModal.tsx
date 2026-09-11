import { useEffect, useState } from 'react';
import { Megaphone, Briefcase, Wrench, LogIn, X, Zap, Clock, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getMyAds, getMyServiceAds, getJobs } from '@/lib/database';

type BoostType = 'banner' | 'job' | 'service';

type BoostableItem = {
  id: string;
  title: string;
  image?: string | null;
  subtitle?: string;
  boosted: boolean;
  boostUntil?: string | null;
};

const TYPE_META: Record<BoostType, { label: string; icon: typeof Megaphone; desc: string }> = {
  banner:  { label: 'Banner Advert', icon: Megaphone, desc: 'Full-width brand imagery' },
  job:     { label: 'Featured Job',  icon: Briefcase, desc: 'Priority position in search' },
  service: { label: 'Service Ad',    icon: Wrench,    desc: 'Showcase at the top of your category' },
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  user: any | null;
  role: string | null | undefined;
  onOpenMpesa: (
    amount: number,
    description: string,
    accountRef: string,
    paymentType: string,
    relatedAdId?: string,
    relatedJobId?: string
  ) => void;
  onOpenAuth: (tab?: string) => void;
  refreshJobs?: () => void;
}

export default function BoostProductModal({
  isOpen,
  onClose,
  user,
  role,
  onOpenMpesa,
  onOpenAuth,
}: Props) {
  const [selectedType, setSelectedType] = useState<BoostType | null>(null);
  const [items, setItems] = useState<BoostableItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [boostingId, setBoostingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !selectedType || !user) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        let boostable: BoostableItem[] = [];
        const now = new Date();

        if (selectedType === 'banner') {
          const ads = await getMyAds(user.id);
          boostable = ads
            .filter(a => a.active && !a.is_affiliate)
            .map(a => ({
              id: a.id,
              title: a.title || 'Untitled Banner',
              image: a.image_url,
              subtitle: a.slot || 'Homepage banner',
              boosted: !!a.featured && !!a.boost_until && new Date(a.boost_until) > now,
              boostUntil: a.boost_until,
            }));
        } else if (selectedType === 'job') {
          const jobs = await getJobs({ postedBy: user.id, activeOnly: true });
          boostable = jobs
            .filter(j => j.status === 'open')
            .map(j => ({
              id: j.id,
              title: j.title || 'Untitled Job',
              image: j.images?.[0] ?? null,
              subtitle: j.category || 'General',
              boosted: !!j.featured && !!j.boost_until && new Date(j.boost_until) > now,
              boostUntil: j.boost_until,
            }));
        } else {
          const ads = await getMyServiceAds(user.id);
          boostable = ads
            .filter(a => !a.expiry_date || new Date(a.expiry_date) > now)
            .map(a => ({
              id: a.id,
              title: a.business_name || 'Untitled Service',
              image: a.images?.[0] ?? null,
              subtitle: a.service_type || 'Service',
              boosted: !!a.featured && !!a.boost_until && new Date(a.boost_until) > now,
              boostUntil: a.boost_until,
            }));
        }

        if (!cancelled) setItems(boostable);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [isOpen, selectedType, user]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedType(null);
      setItems([]);
      setBoostingId(null);
    }
  }, [isOpen]);

  const handleBoost = (item: BoostableItem) => {
    if (!user) return;
    setBoostingId(item.id);
    const ref = `BOOST-${item.id.slice(0, 8).toUpperCase()}`;
    const relatedAdId = selectedType === 'job' ? undefined : item.id;
    const relatedJobId = selectedType === 'job' ? item.id : undefined;
    onOpenMpesa(500, `Featured Boost — ${item.title}`, ref, 'featured_boost', relatedAdId, relatedJobId);
    setTimeout(() => {
      setBoostingId(null);
      onClose();
    }, 2000);
  };

  if (!isOpen) return null;

  // Not logged in
  if (!user) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center space-y-5" onClick={e => e.stopPropagation()}>
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto"><LogIn className="w-7 h-7 text-green-600" /></div>
          <h3 className="text-xl font-bold text-gray-900">Sign in required</h3>
          <p className="text-gray-600">You need a signed-in advertiser or employer account to boost a product.</p>
          <div className="flex gap-3 justify-center">
            <button onClick={onClose} className="px-5 py-2.5 bg-gray-100 rounded-xl text-gray-700 hover:bg-gray-200 transition-colors text-sm font-medium">Cancel</button>
            <button onClick={() => { onOpenAuth('advertiser'); onClose(); }} className="px-5 py-2.5 bg-green-600 rounded-xl text-white hover:bg-green-700 transition-colors text-sm font-medium">Sign in / Register</button>
          </div>
        </div>
      </div>
    );
  }

  // Not advertiser/employer
  if (role && !['employer', 'advertiser'].includes(role)) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center space-y-5" onClick={e => e.stopPropagation()}>
          <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto"><Briefcase className="w-7 h-7 text-amber-600" /></div>
          <h3 className="text-xl font-bold text-gray-900">Advertiser / Employer only</h3>
          <p className="text-gray-600">Boosting is available for advertiser and employer accounts. Switch to a business account to boost your product.</p>
          <div className="flex gap-3 justify-center">
            <button onClick={onClose} className="px-5 py-2.5 bg-gray-100 rounded-xl text-gray-700 hover:bg-gray-200 transition-colors text-sm font-medium">Close</button>
          </div>
        </div>
      </div>
    );
  }

  const daysLeft = (until?: string | null) => {
    if (!until) return 0;
    const ms = new Date(until).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-bold text-gray-900">Boost Your Product</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-6">
          {!selectedType ? (
            <>
              <p className="text-sm text-gray-500">Choose the product you want to boost. Boosted products are prioritised for 7 days and shown to thousands of visitors across Itukarua.</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(Object.keys(TYPE_META) as BoostType[]).map(type => {
                  const meta = TYPE_META[type];
                  const Icon = meta.icon;
                  return (
                    <button
                      key={type}
                      onClick={() => setSelectedType(type)}
                      className="group text-left bg-gray-50 hover:bg-green-50 border border-gray-200 hover:border-green-300 rounded-xl p-4 transition-all space-y-2"
                    >
                      <div className="w-10 h-10 bg-white rounded-lg shadow-sm group-hover:bg-green-100 flex items-center justify-center transition-colors">
                        <Icon className="w-5 h-5 text-gray-500 group-hover:text-green-600 transition-colors" />
                      </div>
                      <p className="text-sm font-bold text-gray-900">{meta.label}</p>
                      <p className="text-xs text-gray-500">{meta.desc}</p>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <button onClick={() => { setSelectedType(null); setItems([]); }} className="text-sm text-green-700 hover:text-green-800 font-medium flex items-center gap-1">&larr; Back to product types</button>
                <span className="text-sm text-gray-400">{TYPE_META[selectedType].label}</span>
              </div>

              {loading ? (
                <div className="space-y-3">
                  {[0,1,2].map(i => (
                    <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : items.length === 0 ? (
                <div className="text-center py-8 text-gray-400 space-y-2">
                  <p className="text-sm font-medium">No eligible {TYPE_META[selectedType].label.toLowerCase()}s found.</p>
                  <p className="text-xs">Only active, non-affiliated products owned by your account appear here.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map(item => {
                    const isBoosted = item.boosted;
                    const boosting = boostingId === item.id;
                    const left = daysLeft(item.boostUntil);
                    return (
                      <div
                        key={item.id}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-xl border transition-colors',
                          isBoosted
                            ? 'bg-green-50 border-green-200'
                            : 'bg-white border-gray-200 hover:border-green-300'
                        )}
                      >
                        {item.image ? (
                          <img src={item.image} alt="" className="w-12 h-12 rounded-lg object-cover bg-gray-100 flex-shrink-0" />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                            {selectedType === 'banner' ? <Megaphone className="w-5 h-5 text-gray-400" /> :
                             selectedType === 'job' ? <Briefcase className="w-5 h-5 text-gray-400" /> :
                             <Wrench className="w-5 h-5 text-gray-400" />}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{item.title}</p>
                          <p className="text-xs text-gray-500">{item.subtitle}</p>
                        </div>
                        <div className="flex-shrink-0">
                          <div className="flex items-center gap-2">
                            {isBoosted && (
                              <span className="flex items-center gap-1 px-2.5 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                                <Check className="w-3.5 h-3.5" />
                                Boosted · {left}d left
                              </span>
                            )}
                            <button
                              onClick={() => handleBoost(item)}
                              disabled={boosting}
                              className={cn(
                                'flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all',
                                boosting
                                  ? 'bg-green-200 text-green-700 cursor-wait'
                                  : isBoosted
                                    ? 'bg-white text-green-700 border border-green-300 hover:bg-green-50'
                                    : 'bg-green-600 text-white hover:bg-green-700 shadow-sm hover:shadow'
                              )}
                            >
                              {boosting ? (
                                <><Clock className="w-3.5 h-3.5 animate-spin" /> Processing…</>
                              ) : (
                                <><Zap className="w-3.5 h-3.5" /> {isBoosted ? 'Extend +7d' : 'Boost'} · KES 500</>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
