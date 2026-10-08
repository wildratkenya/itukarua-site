import React from 'react';
import { Check } from 'lucide-react';
import { PRICING_PLANS } from '@/data/siteData';

export type AdvertPlan = (typeof PRICING_PLANS.advertPlans)[number];

interface AdvertPlanPickerProps {
  onSelect: (plan: AdvertPlan) => void;
  onBeforeSelect?: (plan: AdvertPlan) => Promise<boolean>; // if returns false, selection is aborted (no STK)
  onBack?: () => void;
  backLabel?: string;
  busy?: boolean;
}

const AdvertPlanPicker: React.FC<AdvertPlanPickerProps> = ({ onSelect, onBeforeSelect, onBack, backLabel = 'Back', busy = false }) => (
  <div>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
      {PRICING_PLANS.advertPlans.map(plan => (
        <button
          key={plan.name}
          type="button"
          disabled={busy}
          onClick={async () => {
            if (busy) return;
            if (onBeforeSelect) {
              const ok = await onBeforeSelect(plan);
              if (!ok) return;
            }
            onSelect(plan);
          }}
          className={`relative p-4 rounded-xl border-2 text-left transition-all disabled:opacity-60 ${
            plan.popular ? 'border-purple-300 bg-purple-50 hover:border-purple-400' : 'border-gray-200 bg-white hover:border-green-400'
          }`}
        >
          {plan.popular && (
            <span className="absolute top-2 right-2 text-[9px] font-bold text-purple-600 tracking-wide">MOST POPULAR</span>
          )}
          <p className="font-semibold text-gray-900">{plan.name}</p>
          <p className="text-xs text-gray-500">{plan.duration} listing</p>
          <p className="text-lg font-bold text-green-700 mt-2">KES {plan.price}</p>
          <ul className="mt-2 space-y-1">
            {plan.features.slice(0, 3).map(f => (
              <li key={f} className="flex items-start gap-1.5 text-[11px] text-gray-500">
                <Check className="w-3 h-3 text-green-600 mt-0.5 flex-shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </button>
      ))}
    </div>
    <p className="text-xs text-gray-500 mt-3 text-center sm:text-left">
      Advertiser access is free — pay your package price once via M-Pesa when you submit your advert.
    </p>
    {onBack && (
      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-semibold rounded-lg transition-colors"
        >
          {backLabel}
        </button>
      </div>
    )}
  </div>
);

export default AdvertPlanPicker;
