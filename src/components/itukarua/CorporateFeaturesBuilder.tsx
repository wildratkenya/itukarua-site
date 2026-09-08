import { useMemo } from 'react';
import {
  FEATURE_CATALOG,
  FEATURE_GROUPS,
  TIER_FEATURE_IDS,
  CORPORATE_TIER_FEATURES,
  estimateCustomBundle,
  type SavedCorporateFeatures,
  type CorporateFeature,
} from '@/data/siteData';

const fmtKES = (n: number) => `KES ${n.toLocaleString()}`;

const UNIT_LABEL: Record<string, string> = { placements: 'placement', team_seats: 'seat' };

interface Props {
  tier: string;
  features: SavedCorporateFeatures;
  onChange: (next: SavedCorporateFeatures) => void;
  /** When false, suppresses per-feature KES, quantity overage costs and the estimate strip (public pages). Defaults to true. */
  showPricing?: boolean;
}

// Shared builder for the corporate features catalog. Fixed tiers show their
// included features read-only; the Custom tier is an interactive checklist with
// a live aggregate estimate so a bundle can be rated ("from KES X/mo").
export function CorporateFeaturesBuilder({ tier, features, onChange, showPricing = true }: Props) {
  const isCustom = tier === 'custom';
  const fixed = CORPORATE_TIER_FEATURES[tier] || CORPORATE_TIER_FEATURES.bronze;
  const checkedIds = isCustom ? features.ids : TIER_FEATURE_IDS[tier] || [];

  const estimate = useMemo(
    () => (isCustom ? estimateCustomBundle(features.ids, features.placements || 1, features.team_seats || 1) : null),
    [isCustom, features.ids, features.placements, features.team_seats]
  );

  const toggle = (id: string, checked: boolean) => {
    if (!isCustom) return;
    const next = checked ? [...features.ids, id] : features.ids.filter((x) => x !== id);
    onChange({ ...features, ids: next });
  };

  const setQty = (id: 'placements' | 'team_seats', value: number) => {
    if (!isCustom) return;
    const v = Math.max(1, Number.isFinite(value) ? value : 1);
    onChange({ ...features, [id]: v } as SavedCorporateFeatures);
  };

  const renderQuantityRow = (f: CorporateFeature) => {
    const qty = f.id === 'placements'
      ? isCustom ? (features.placements || 1) : fixed.maxPlacements
      : isCustom ? (features.team_seats || 1) : fixed.teamSeats;
    const checked = checkedIds.includes(f.id);
    return (
      <div key={f.id} className="flex items-center justify-between gap-2 rounded border border-gray-100 px-2 py-1.5">
        <div className="flex items-center gap-2 min-w-0">
          {isCustom ? (
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => toggle(f.id, e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
            />
          ) : (
            <span className="w-4 h-4 inline-flex items-center justify-center text-green-600 text-sm font-bold">✓</span>
          )}
          <span className="text-sm text-gray-700">{f.label}</span>
        </div>
        <div className="flex items-center gap-2">
          {isCustom ? (
            <input
              type="number"
              min={1}
              value={qty}
              disabled={!checked}
              onChange={(e) => setQty(f.id as 'placements' | 'team_seats', parseInt(e.target.value || '1', 10))}
              className="w-16 px-2 py-1 border border-gray-300 rounded text-sm disabled:opacity-40"
            />
          ) : (
            <span className="text-sm font-medium text-gray-600">{qty} {UNIT_LABEL[f.id] || 'unit'}{qty !== 1 ? 's' : ''}</span>
          )}
        </div>
        {qty > 1 && showPricing && (
          <span className="text-[11px] text-gray-400 shrink-0">{fmtKES((qty - 1) * f.monthly)}/mo</span>
        )}
      </div>
    );
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-900">Corporate Features</h4>
        <span className="text-[11px] text-gray-400">{isCustom ? 'Tailor the bundle' : 'Included with tier'}</span>
      </div>
      {FEATURE_GROUPS.map((group) => {
        const items = FEATURE_CATALOG.filter((f) => f.group === group);
        return (
          <div key={group}>
            <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">{group}</p>
            <div className="space-y-1.5">
              {items.map((f) => {
                if (f.perUnit) return renderQuantityRow(f);
                const checked = checkedIds.includes(f.id);
                return (
                  <label
                    key={f.id}
                    className={`flex items-start gap-2 rounded border px-2 py-1.5 ${checked ? 'border-green-200 bg-green-50/40' : 'border-gray-100'} ${isCustom ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    {isCustom ? (
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => toggle(f.id, e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                    ) : (
                      <span className="mt-0.5 w-4 h-4 inline-flex items-center justify-center text-green-600 text-sm font-bold">
                        {checked ? '✓' : '–'}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-gray-800">{f.label}</span>
                        {showPricing && <span className="text-xs text-gray-400 shrink-0">{fmtKES(f.monthly)}/mo</span>}
                      </div>
                      {f.description && <p className="text-[11px] text-gray-500">{f.description}</p>}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
      {isCustom && showPricing && estimate && (
        <div className="rounded-lg bg-gray-900 text-white px-3 py-2 flex items-center justify-between">
          <span className="text-sm">Estimated monthly</span>
          <span className="text-sm font-bold text-amber-400">{fmtKES(estimate.monthly)}/mo · {estimate.equivalence}</span>
        </div>
      )}
    </div>
  );
}