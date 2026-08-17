import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Check, Zap, Shield, Phone } from 'lucide-react';
import { PRICING_PLANS } from '@/data/siteData';
import { supabase } from '@/lib/supabase';
import { acceptTerms, checkTermsAccepted } from '@/lib/database';
import { TERMS_AND_CONDITIONS } from '@/data/termsContent';

interface PricingPageProps {
  onOpenMpesa: (amount: number, description: string, accountRef: string, paymentType?: string, relatedAdId?: string) => void;
}

const PricingPage: React.FC<PricingPageProps> = ({ onOpenMpesa }) => {
  const [user, setUser] = useState<any>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [dataSharingConsent, setDataSharingConsent] = useState(false);
  const [alreadyAccepted, setAlreadyAccepted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) {
        checkTermsAccepted(data.user.id).then(accepted => {
          setAlreadyAccepted(accepted);
          if (accepted) {
            setTermsAccepted(true);
            setDataSharingConsent(true);
          }
        });
      }
    });
  }, []);

  const handleAccept = async () => {
    if (!user || alreadyAccepted) return;
    setSaving(true);
    try {
      await acceptTerms(user.id, dataSharingConsent);
      setAlreadyAccepted(true);
    } catch (e) {
      console.error('Failed to save terms acceptance:', e);
    }
    setSaving(false);
  };

  const handlePay = (amount: number, description: string, accountRef: string) => {
    if (!alreadyAccepted) { handleAccept(); return; }
    onOpenMpesa(amount, description, accountRef);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Helmet>
        <title>Pricing - Itukarua</title>
        <meta name="description" content="Choose the plan that works for you. All payments are processed securely through M-Pesa." />
        <link rel="canonical" href="https://www.itukarua.co.ke/pricing" />
        <meta property="og:title" content="Pricing - Itukarua" />
        <meta property="og:description" content="Choose the plan that works for you. All payments are processed securely through M-Pesa." />
        <meta property="og:site_name" content="Itukarua" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Pricing - Itukarua" />
        <meta name="twitter:description" content="Choose the plan that works for you. All payments are processed securely through M-Pesa." />
        <meta name="twitter:image" content="https://www.itukarua.co.ke/og.jpg" />
      </Helmet>
      {/* Header */}
      <div className="relative py-14 lg:py-20 overflow-hidden">
        <img src="/images/pricing.png" alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
        <div className="absolute inset-0 bg-black/40"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl lg:text-4xl font-bold text-white mb-3">Simple, Transparent Pricing</h1>
          <p className="text-green-100 max-w-2xl mx-auto">Choose the plan that works for you. All payments are processed securely through M-Pesa.</p>
        </div>
      </div>

      {/* T&C Acceptance */}
      {user && !alreadyAccepted && (
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 -mt-4 mb-8">
          <div className="bg-white rounded-xl border-2 border-amber-200 p-4 shadow-sm">
            <p className="text-sm font-semibold text-gray-900 mb-2">Accept Terms to Continue</p>
            <div className="max-h-24 overflow-y-auto bg-gray-50 rounded-lg p-2.5 text-[11px] text-gray-600 leading-relaxed border mb-3">
              {TERMS_AND_CONDITIONS}
            </div>
            <div className="space-y-2">
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} className="mt-0.5" />
                <span className="text-xs text-gray-700">
                  I accept the <strong>Terms & Conditions</strong>, <strong>Privacy Policy</strong>, <strong>GDPR rules</strong>, and <strong>Indemnity clause</strong>
                </span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={dataSharingConsent} onChange={e => setDataSharingConsent(e.target.checked)} className="mt-0.5" />
                <span className="text-xs text-gray-700">
                  I consent to my information being shared with paid users on the platform
                </span>
              </label>
            </div>
            <button
              onClick={handleAccept}
              disabled={!termsAccepted || saving}
              className="mt-3 w-full py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {saving ? 'Saving...' : 'Accept & Continue'}
            </button>
          </div>
        </div>
      )}

      {user && alreadyAccepted && (
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 -mt-4 mb-8">
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
            <p className="text-sm text-green-700 font-medium">✓ Terms & Conditions accepted</p>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        {/* Jobseeker Registration */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">For Jobseekers</h2>
          <p className="text-gray-500 text-center mb-8">Monthly subscription — bid on unlimited jobs, message employers, and more</p>
          <div className="max-w-5xl mx-auto bg-gradient-to-br from-green-600 via-emerald-600 to-teal-700 rounded-3xl shadow-2xl overflow-hidden">
            <div className="grid md:grid-cols-5">
              <div className="md:col-span-3 p-8">
                <div className="inline-flex items-center gap-1.5 bg-white/20 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wide mb-3">
                  <Zap className="w-3 h-3" /> Most Popular — 30-Day Subscription
                </div>
                <h3 className="text-2xl font-bold text-white mb-1">{PRICING_PLANS.jobseeker.name}</h3>
                <p className="text-green-100 text-sm mb-5">Everything you need to land work — bid on unlimited jobs and connect with employers near you.</p>
                <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
                  {PRICING_PLANS.jobseeker.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2 text-white/95 text-xs">
                      <Check className="w-3.5 h-3.5 text-white flex-shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="md:col-span-2 bg-white/10 backdrop-blur border-t md:border-t-0 md:border-l border-white/20 p-8 flex flex-col justify-center text-center">
                <p className="text-white/80 text-sm mb-1">Monthly price</p>
                <p className="text-5xl font-extrabold text-white mb-1">
                  KES {PRICING_PLANS.jobseeker.price}<span className="text-lg text-green-200">/mo</span>
                </p>
                <p className="text-green-100 text-xs mb-6">30-day subscription • renews monthly</p>
                <button
                  onClick={() => handlePay(PRICING_PLANS.jobseeker.price, 'Jobseeker Registration', 'REG-NEW')}
                  disabled={!alreadyAccepted}
                  className={`w-full py-3.5 bg-white hover:bg-green-50 text-green-700 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors ${
                    alreadyAccepted ? '' : 'opacity-60 cursor-not-allowed'
                  }`}
                >
                  <Phone className="w-4 h-4" />
                  Pay with M-Pesa
                </button>
                {!alreadyAccepted && <p className="text-xs text-white/80 text-center mt-3">Accept Terms & Conditions above to proceed</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Advert Plans */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Business Advertising Plans</h2>
          <p className="text-gray-500 text-center mb-8">Promote your business to the local community</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {PRICING_PLANS.advertPlans.map((plan, i) => (
              <div
                key={i}
                className={`relative bg-white rounded-2xl border-2 overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 flex flex-col ${
                  plan.popular ? 'border-green-500 shadow-xl ring-4 ring-green-100' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {plan.popular && (
                  <span className="absolute top-0 right-0 bg-green-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-bl-xl z-10 tracking-wide">
                    MOST POPULAR
                  </span>
                )}
                <div className={`px-6 py-6 text-center ${plan.popular ? 'bg-gradient-to-r from-green-600 to-emerald-500' : 'bg-gradient-to-b from-gray-100 to-gray-50'}`}>
                  <h3 className={`font-bold text-lg ${plan.popular ? 'text-white' : 'text-gray-900'}`}>{plan.name}</h3>
                  <p className={`text-xs mt-1 ${plan.popular ? 'text-green-100' : 'text-gray-500'}`}>{plan.duration} listing</p>
                  <div className={`flex items-baseline justify-center gap-1 mt-2 ${plan.popular ? 'text-white' : 'text-gray-900'}`}>
                    <span className="text-3xl font-extrabold">KES {plan.price}</span>
                  </div>
                </div>
                <div className="p-5 flex flex-col flex-1 bg-white">
                  <ul className="space-y-2.5 mb-6 flex-1">
                    {plan.features.map((f, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm text-gray-600">
                        <span className={`w-4 h-4 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0 ${plan.popular ? 'bg-green-100' : 'bg-gray-100'}`}>
                          <Check className={`w-2.5 h-2.5 ${plan.popular ? 'text-green-700' : 'text-gray-500'}`} />
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => handlePay(plan.price, plan.name, `ADV-${plan.duration.replace(' ', '')}`)}
                    disabled={!alreadyAccepted}
                    className={`w-full py-3 text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 ${
                      !alreadyAccepted
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : plan.popular
                          ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-200'
                          : 'bg-gray-900 hover:bg-gray-800 text-white'
                    }`}
                  >
                    <Phone className="w-4 h-4" />
                    Pay with M-Pesa
                  </button>
                  {!alreadyAccepted && <p className="text-xs text-amber-600 text-center mt-3">Accept Terms & Conditions above to proceed</p>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Homepage/Banners Advert */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Homepage/Banners Advert</h2>
          <p className="text-gray-500 text-center mb-8">Get your business in front of every visitor — prime banner placement on the homepage carousel</p>
          <div className="max-w-5xl mx-auto bg-gradient-to-br from-amber-500 via-amber-600 to-orange-600 rounded-3xl shadow-2xl overflow-hidden">
            <div className="grid md:grid-cols-5">
              <div className="md:col-span-3 p-8">
                <div className="inline-flex items-center gap-1.5 bg-white/20 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wide mb-3">
                  <Zap className="w-3 h-3" /> Homepage Banner
                </div>
                <h3 className="text-2xl font-bold text-white mb-1">{PRICING_PLANS.homepageAdvert.name}</h3>
                <p className="text-amber-100 text-sm mb-5">Prime banner placement on the homepage carousel — seen by every visitor, 24/7.</p>
                <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
                  {PRICING_PLANS.homepageAdvert.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2 text-white/95 text-xs">
                      <Check className="w-3.5 h-3.5 text-white flex-shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="md:col-span-2 bg-white/10 backdrop-blur border-t md:border-t-0 md:border-l border-white/20 p-8 flex flex-col justify-center text-center">
                <p className="text-white/80 text-sm mb-1">Weekly price</p>
                <p className="text-5xl font-extrabold text-white mb-1">
                  KES {PRICING_PLANS.homepageAdvert.price}<span className="text-lg text-amber-200">/wk</span>
                </p>
                <p className="text-amber-100 text-xs mb-6">Live for 7 full days • renews weekly • 5 ads shown at once</p>
                <button
                  onClick={() => handlePay(PRICING_PLANS.homepageAdvert.price, 'Homepage Advert (1 week)', 'ADV-HP-WEEK')}
                  disabled={!alreadyAccepted}
                  className={`w-full py-3.5 bg-white hover:bg-amber-50 text-amber-700 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors ${
                    alreadyAccepted ? '' : 'opacity-60 cursor-not-allowed'
                  }`}
                >
                  <Phone className="w-4 h-4" />
                  Pay with M-Pesa
                </button>
                {!alreadyAccepted && <p className="text-xs text-white/80 text-center mt-3">Accept Terms & Conditions above to proceed</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Other Fees */}
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Other Platform Fees</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Shield className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{PRICING_PLANS.employerAccess.name}</h3>
                  <p className="text-sm text-gray-500">{PRICING_PLANS.employerAccess.period}</p>
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900 mb-2">KES {PRICING_PLANS.employerAccess.price}</p>
              <p className="text-sm text-gray-500">{PRICING_PLANS.employerAccess.description}</p>
            </div>
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                  <Zap className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{PRICING_PLANS.featuredBoost.name}</h3>
                  <p className="text-sm text-gray-500">{PRICING_PLANS.featuredBoost.period}</p>
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900 mb-2">KES {PRICING_PLANS.featuredBoost.price}</p>
              <p className="text-sm text-gray-500">{PRICING_PLANS.featuredBoost.description}</p>
            </div>
          </div>
        </div>

        {/* M-Pesa Info */}
        <div className="max-w-2xl mx-auto mt-16 bg-green-50 rounded-2xl p-8 border border-green-100 text-center">
          <Phone className="w-10 h-10 text-green-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-green-800 mb-2">All Payments via M-Pesa</h3>
          <p className="text-sm text-green-700 mb-4">
            We use M-Pesa for all transactions to ensure security and convenience. You can pay using our Till Number or our instant STK Push.
          </p>
          <div className="bg-white rounded-xl p-4 text-left text-sm space-y-1">
            <p className="text-gray-600"><span className="font-semibold text-gray-900">M-Pesa Till Number:</span> 1600149</p>
            <p className="text-gray-600"><span className="font-semibold text-gray-900">Business Name:</span> ITUKARUA Solutions</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;
