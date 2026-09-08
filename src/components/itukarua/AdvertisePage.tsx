import React, { useState, useEffect, Fragment } from 'react';
import SEO from '@/lib/seo';
import { CheckCircle, Send, Crown, Sparkles, Shield, Phone, Check } from 'lucide-react';
import { supabaseUrl, supabaseKey, supabase } from '@/lib/supabase';
import { CORPORATE_PACKAGES, FEATURE_CATALOG, FEATURE_GROUPS, TIER_FEATURE_IDS, CORPORATE_TIER_FEATURES, estimateCustomBundle, type SavedCorporateFeatures } from '@/data/siteData';
import { CorporateFeaturesBuilder } from './CorporateFeaturesBuilder';

interface AdvertisePageProps {
  onNavigate?: (page: string) => void;
}

const PACKAGE_RATES: Record<string, string> = {
  bronze: 'From KES 3,000/month',
  silver: 'From KES 6,000/month',
  gold: 'From KES 10,000/month',
  custom: 'From KES 12,000/month (custom scope)',
};

const TIERS: Array<{ id: string; label: string }> = [
  { id: 'bronze', label: 'Bronze' },
  { id: 'silver', label: 'Silver' },
  { id: 'gold', label: 'Gold' },
];

const fmtKES = (n: number) => `KES ${n.toLocaleString()}`;

const AdvertisePage: React.FC<AdvertisePageProps> = ({ onNavigate }) => {
  const [formData, setFormData] = useState({
    company: '',
    contact_name: '',
    phone: '',
    email: '',
    package: 'bronze',
    start_date: '',
    message: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [customBundle, setCustomBundle] = useState<SavedCorporateFeatures>(() => ({
    ids: [...TIER_FEATURE_IDS.gold, 'slot_job_listings_top'],
    placements: 4,
    team_seats: 5,
  }));

  useEffect(() => {
    const pkg = sessionStorage.getItem('advertise_package');
    if (pkg && ['bronze', 'silver', 'gold', 'custom'].includes(pkg)) {
      setFormData(f => ({ ...f, package: pkg }));
    }
    sessionStorage.removeItem('advertise_package');
  }, []);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!formData.company.trim()) errs.company = 'Company / organisation name is required';
    if (!formData.contact_name.trim()) errs.contact_name = 'Contact person is required';
    if (!formData.phone.trim()) errs.phone = 'Phone / WhatsApp number is required';
    else if (!/^\+?[0-9\s-]{9,}$/.test(formData.phone.trim())) errs.phone = 'Enter a valid phone number';
    if (!formData.email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errs.email = 'Invalid email';
    if (!formData.message.trim()) errs.message = 'Tell us a little about your goals';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    let effectiveMessage = formData.message;
    if (formData.package === 'custom') {
      const est = estimateCustomBundle(customBundle.ids, customBundle.placements, customBundle.team_seats);
      const names = customBundle.ids.map(id => FEATURE_CATALOG.find(f => f.id === id)?.label || id).join(', ');
      effectiveMessage = `${formData.message}\n\nCustom bundle request:\n- Features: ${names}\n- Placements: ${customBundle.placements}\n- Team seats: ${customBundle.team_seats}\n- Estimated: ${fmtKES(est.estimatedMonthly)}/month (${est.equivalence})`;
    }
    try {
      await supabase.from('advert_leads').insert({
        company: formData.company,
        contact_name: formData.contact_name,
        phone: formData.phone,
        email: formData.email,
        package: formData.package,
        start_date: formData.start_date || null,
        message: effectiveMessage,
        status: 'new',
      });
      fetch(`${supabaseUrl}/functions/v1/send-advert-lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
        body: JSON.stringify({ ...formData, package_tier: formData.package, message: effectiveMessage }),
      }).catch(() => {});
      setSubmitted(true);
      setFormData({ company: '', contact_name: '', phone: '', email: '', package: 'bronze', start_date: '', message: '' });
    } catch (err: any) {
      alert(err.message || 'Failed to submit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 max-w-md w-full p-10 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5"><CheckCircle className="w-8 h-8 text-green-600" /></div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Request received!</h1>
          <p className="text-sm text-gray-500 mb-6">Thanks for your interest in a corporate placement. Our team will reach out within one working day with a tailored quote.</p>
          <button onClick={() => onNavigate?.('home')} className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors">Back to Home</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SEO
        title="Advertise on Itukarua - Corporate & Community Placements"
        description="Reach your community with a steady branded presence on Itukarua. Bronze, Silver, Gold and Custom placements for co-operatives, churches, SACCOs, institutions and businesses."
        canonical="/advertise"
      />
      <div className="bg-gradient-to-br from-gray-900 via-neutral-900 to-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-16">
          <p className="flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase text-amber-300 mb-2"><Crown className="w-4 h-4" /> Corporate & Community Placements</p>
          <h1 className="text-3xl lg:text-4xl font-bold mb-3">Advertise Your Business</h1>
          <p className="text-gray-300 max-w-2xl text-sm lg:text-base">
            Tell us about your organisation and we'll craft a placement around your goals — we handle the copy, imagery and scheduling. A tailored, no-obligation quote follows within one working day.
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-8">
            {CORPORATE_PACKAGES.map(pkg => (
              <button
                key={pkg.id}
                type="button"
                onClick={() => setFormData(f => ({ ...f, package: pkg.id }))}
                className={`text-left rounded-xl p-4 border-2 transition-all ${formData.package === pkg.id ? 'border-amber-300 bg-amber-300/10' : 'border-white/10 bg-white/5 hover:border-white/30'}`}
              >
                <p className="text-xs font-bold tracking-widest uppercase text-amber-300 mb-0.5">{pkg.tier}</p>
                <p className="text-sm font-semibold">{pkg.headline}</p>
                <p className="text-[11px] text-gray-400 mt-1.5">{PACKAGE_RATES[pkg.id]}</p>
              </button>
            ))}
          </div>
          <p className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3 text-[11px] text-gray-500">
            <span>Site-wide strip — every page, every visitor</span>
            <span>Homepage + Jobs & Services strips</span>
            <span>All slots + featured boost & analytics</span>
            <span>County-wide & campaign bundles</span>
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="font-semibold text-gray-900">Corporate features — see exactly what each tier includes</h2>
              <p className="text-xs text-gray-500 mt-0.5">Order your bundle, add the right slots and capabilities, and we'll confirm the monthly rate on your quote.</p>
            </div>
            <span className="text-[11px] text-gray-400">All tiers include delivery tracking & support</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
                  <th className="px-6 py-3 font-medium">Feature</th>
                  {TIERS.map(t => <th key={t.id} className="px-4 py-3 font-medium">{t.label}</th>)}
                  <th className="px-4 py-3 font-medium">Custom <span className="normal-case text-gray-300">(your pick)</span></th>
                </tr>
              </thead>
              <tbody>
                {FEATURE_GROUPS.map(group => (
                  <Fragment key={group}>
                    <tr className="bg-gray-50">
                      <td colSpan={6} className="px-6 py-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-500">{group}</td>
                    </tr>
                    {FEATURE_CATALOG.filter(f => f.group === group).map(f => (
                      <tr key={f.id} className="border-b border-gray-50">
                        <td className="px-6 py-2.5">
                          <p className="font-medium text-gray-800">{f.label}</p>
                          <p className="text-xs text-gray-500">{f.description}</p>
                        </td>
                        {TIERS.map(t => {
                          const tierDef = CORPORATE_TIER_FEATURES[t.id as keyof typeof CORPORATE_TIER_FEATURES];
                          const included = f.perUnit ? null : (TIER_FEATURE_IDS[t.id as keyof typeof TIER_FEATURE_IDS] || []).includes(f.id);
                          return (
                            <td key={t.id} className="px-4 py-2.5 text-center">
                              {f.perUnit ? (
                                <span className="text-xs font-medium text-gray-600">{f.id === 'placements' ? tierDef.maxPlacements : tierDef.teamSeats}</span>
                              ) : included ? (
                                <Check className="w-4 h-4 mx-auto text-green-600" />
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-4 py-2.5 text-center">
                          {f.perUnit ? (
                            <span className="text-xs font-medium text-blue-600">{f.id === 'placements' ? customBundle.placements : customBundle.team_seats}</span>
                          ) : customBundle.ids.includes(f.id) ? (
                            <Check className="w-4 h-4 mx-auto text-blue-600" />
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          {formData.package === 'custom' && (
            <div className="px-6 py-5 border-t border-gray-100">
              <p className="text-sm font-semibold text-gray-900 mb-3">Build your bundle</p>
              <CorporateFeaturesBuilder tier="custom" features={customBundle} onChange={setCustomBundle} showPricing={false} />
              <p className="text-xs text-gray-500 mt-3">Your selection feeds straight into the quote request below.</p>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="space-y-6">
            <div className="bg-white rounded-xl p-6 border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Shield className="w-4 h-4 text-green-600" /> What happens next</h3>
              <ol className="space-y-3 text-sm text-gray-600">
                <li className="flex gap-2"><span className="w-5 h-5 rounded-full bg-green-100 text-green-700 text-[11px] font-bold flex items-center justify-center flex-shrink-0">1</span> We receive your request and review your goals.</li>
                <li className="flex gap-2"><span className="w-5 h-5 rounded-full bg-green-100 text-green-700 text-[11px] font-bold flex items-center justify-center flex-shrink-0">2</span> A tailored quote is emailed or sent on WhatsApp within 1 working day.</li>
                <li className="flex gap-2"><span className="w-5 h-5 rounded-full bg-green-100 text-green-700 text-[11px] font-bold flex items-center justify-center flex-shrink-0">3</span> Once agreed, we design & launch your placement — no effort on your side.</li>
              </ol>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-6 border border-amber-100">
              <p className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2"><Sparkles className="w-4 h-4 text-amber-500" /> Leading rates (Phase 1)</p>
              <ul className="space-y-1.5 text-sm text-gray-600">
                {Object.entries(PACKAGE_RATES).map(([k, v]) => (
                  <li key={k} className="flex justify-between"><span className="capitalize font-medium text-gray-700">{k}</span><span className="text-gray-500">{v}</span></li>
                ))}
              </ul>
              <p className="text-xs text-gray-500 mt-3">Monthly placements. Ad design & copy included. Pay via M-Pesa after your quote is confirmed.</p>
            </div>
            <div className="bg-white rounded-xl p-6 border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-2">Prefer to talk?</h3>
              <p className="text-sm text-gray-500 mb-3">Call or WhatsApp us directly:</p>
              <a href="tel:+254721219359" className="flex items-center gap-2 text-sm font-semibold text-blue-600"><Phone className="w-4 h-4" /> +254 721 219 359</a>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-6 lg:p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Request a quote</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Company / Organisation *</label>
                <input value={formData.company} onChange={e => setFormData({ ...formData, company: e.target.value })} placeholder="e.g. Ndeiya Dairy Co-operative" className={`w-full px-4 py-2.5 rounded-lg border ${errors.company ? 'border-red-400' : 'border-gray-300'} focus:ring-2 focus:ring-green-500 outline-none text-sm`} />
                {errors.company && <p className="text-xs text-red-500 mt-1">{errors.company}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person *</label>
                <input value={formData.contact_name} onChange={e => setFormData({ ...formData, contact_name: e.target.value })} placeholder="Full name" className={`w-full px-4 py-2.5 rounded-lg border ${errors.contact_name ? 'border-red-400' : 'border-gray-300'} focus:ring-2 focus:ring-green-500 outline-none text-sm`} />
                {errors.contact_name && <p className="text-xs text-red-500 mt-1">{errors.contact_name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone / WhatsApp *</label>
                <input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="07XX XXX XXX" className={`w-full px-4 py-2.5 rounded-lg border ${errors.phone ? 'border-red-400' : 'border-gray-300'} focus:ring-2 focus:ring-green-500 outline-none text-sm`} />
                {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="you@company.co.ke" className={`w-full px-4 py-2.5 rounded-lg border ${errors.email ? 'border-red-400' : 'border-gray-300'} focus:ring-2 focus:ring-green-500 outline-none text-sm`} />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Desired start date</label>
                <input type="date" value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 outline-none text-sm" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">About your goals *</label>
                <textarea value={formData.message} onChange={e => setFormData({ ...formData, message: e.target.value })} rows={4} placeholder="Where are you based, who do you want to reach, and what would success look like?" className={`w-full px-4 py-2.5 rounded-lg border ${errors.message ? 'border-red-400' : 'border-gray-300'} focus:ring-2 focus:ring-green-500 outline-none text-sm`} />
                {errors.message && <p className="text-xs text-red-500 mt-1">{errors.message}</p>}
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full mt-6 py-3.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
              {loading ? 'Sending…' : (<><Send className="w-4 h-4" /> Request My Quote</>)}
            </button>
            <p className="text-[11px] text-gray-400 mt-3 text-center">No payment now. We confirm the price before anything is created.</p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdvertisePage;