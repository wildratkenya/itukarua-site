import React, { useState } from 'react';
import SEO from '@/lib/seo';
import { Check, Zap, Shield, Phone, CheckCircle, ChevronDown, ChevronUp, Star, Crown, Briefcase, ArrowRight } from 'lucide-react';
import { PRICING_PLANS } from '@/data/siteData';

interface PricingPageProps {
  onOpenMpesa: (amount: number, description: string, accountRef: string, paymentType?: string, relatedAdId?: string, relatedJobId?: string, relatedProfileId?: string, onComplete?: () => void) => void;
  onNavigate?: (page: string) => void;
}

const PricingPage: React.FC<PricingPageProps> = ({ onOpenMpesa, onNavigate }) => {
  const [showComparison, setShowComparison] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <SEO
        title="Pricing Plans - Jobs, Services & Adverts"
        description="Choose the plan that works for you. Jobseeker subscriptions from KES 100/month, employer plans from KES 500/month, advert packages from KES 300. All payments via M-Pesa."
        canonical="/pricing"
      />

      {/* Hero Header */}
      <div className="relative py-16 lg:py-24 overflow-hidden">
        <img src="/images/pricing.png" alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-br from-green-900/80 via-emerald-800/70 to-teal-900/80"></div>
        <div className="absolute top-10 left-10 w-32 h-32 bg-green-400/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-10 right-20 w-48 h-48 bg-emerald-400/15 rounded-full blur-3xl"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md text-white text-xs font-semibold px-4 py-2 rounded-full mb-6 border border-white/20">
            <Star className="w-4 h-4 text-yellow-300" />
            Simple, Transparent Pricing
          </div>
          <h1 className="text-4xl lg:text-5xl font-extrabold text-white mb-4 tracking-tight">
            Plans That <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-300 to-emerald-300">Grow With You</span>
          </h1>
          <p className="text-green-100/90 max-w-2xl mx-auto text-lg">Start free, upgrade when you're ready. All payments processed securely via M-Pesa.</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">

        {/* ═══ JOBSEEKER SECTION ═══ */}
        <div className="mb-24">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 text-xs font-bold px-4 py-1.5 rounded-full mb-4 uppercase tracking-wider">
              <Briefcase className="w-3.5 h-3.5" /> For Jobseekers
            </div>
            <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Find Your Dream Job</h2>
            <p className="text-gray-500 text-lg">Start for free — upgrade when you want the full toolkit</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto mb-14">
            {/* Free Card */}
            <div className="relative group bg-white rounded-3xl border-2 border-gray-200 shadow-sm hover:shadow-2xl transition-all duration-500 flex flex-col overflow-hidden hover:-translate-y-1">
              <div className="h-2 bg-gradient-to-r from-gray-300 via-gray-200 to-gray-300"></div>
              <div className="p-8 lg:p-10 flex-1 flex flex-col">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 bg-gradient-to-br from-gray-100 to-gray-50 rounded-2xl flex items-center justify-center border border-gray-200">
                    <Check className="w-6 h-6 text-gray-600" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-extrabold text-gray-900">Free</h3>
                    <p className="text-xs text-gray-400 font-medium">No credit card required</p>
                  </div>
                </div>
                <div className="flex items-baseline gap-1 mt-4 mb-6">
                  <span className="text-5xl font-extrabold text-gray-900">KES 0</span>
                  <span className="text-gray-400 font-medium">/forever</span>
                </div>
                <p className="text-sm text-gray-500 mb-6 -mt-2">Everything you need to start applying</p>
                <ul className="space-y-3 mb-8 flex-1">
                  {PRICING_PLANS.jobseekerFree.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-3 text-sm text-gray-700">
                      <span className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-3 h-3 text-green-600" />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => onNavigate?.('signup')}
                  className="w-full py-4 bg-gray-900 hover:bg-black text-white text-base font-bold rounded-2xl transition-all shadow-lg shadow-gray-200 hover:shadow-xl flex items-center justify-center gap-2 group-hover:scale-[1.02]"
                >
                  Get Started Free
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            </div>

            {/* Premium Card */}
            <div className="relative group rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-500 flex flex-col overflow-hidden hover:-translate-y-1">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500 via-emerald-500 to-teal-600"></div>
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-300 via-white to-yellow-300"></div>
              <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-md text-white text-[10px] font-bold px-4 py-1.5 rounded-full tracking-wider border border-white/30 flex items-center gap-1">
                <Crown className="w-3 h-3 text-yellow-300" /> MOST POPULAR
              </div>
              <div className="relative p-8 lg:p-10 flex-1 flex flex-col z-10">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center">
                    <Zap className="w-6 h-6 text-yellow-300" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-extrabold text-white">Premium</h3>
                    <p className="text-xs text-green-100/80 font-medium">Full access — cancel anytime</p>
                  </div>
                </div>
                <div className="flex items-baseline gap-1 mt-4 mb-6">
                  <span className="text-5xl font-extrabold text-white">KES 100</span>
                  <span className="text-green-100/80 font-medium">/month</span>
                </div>
                <p className="text-sm text-green-100/90 mb-6 -mt-2">Unlock your full potential</p>
                <ul className="space-y-3 mb-8 flex-1">
                  {PRICING_PLANS.jobseekerPremium.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-3 text-sm text-white/95">
                      <span className="w-5 h-5 rounded-full bg-white/20 backdrop-blur flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-3 h-3 text-green-300" />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => onOpenMpesa(PRICING_PLANS.jobseekerPremium.price, 'Jobseeker Premium Subscription', 'PREM-NEW', 'registration')}
                  className="w-full py-4 bg-white hover:bg-green-50 text-green-700 font-bold text-base rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-black/10 group-hover:scale-[1.02]"
                >
                  <Phone className="w-4 h-4" />
                  Subscribe with M-Pesa
                </button>
              </div>
            </div>
          </div>

          {/* Comparison Table */}
          <div className="max-w-5xl mx-auto">
            <button
              onClick={() => setShowComparison(!showComparison)}
              className="flex items-center justify-center gap-2 mx-auto text-sm font-semibold text-green-700 hover:text-green-800 transition-colors mb-6"
            >
              {showComparison ? 'Hide' : 'Show'} Full Comparison
              {showComparison ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showComparison && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-4 px-6 font-bold text-gray-900">Feature</th>
                      <th className="text-center py-4 px-4 font-bold text-gray-900 w-28 bg-gray-50">Free</th>
                      <th className="text-center py-4 px-4 font-bold text-green-700 w-28 bg-green-50">Premium</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { feature: 'Job bids per week', free: '10 in category', premium: 'Unlimited' },
                      { feature: 'Profile visibility', free: 'Basic', premium: 'Priority' },
                      { feature: 'Job notifications', free: true, premium: true },
                      { feature: 'Direct messaging', free: false, premium: true },
                      { feature: 'Ratings & recommendations', free: false, premium: true },
                      { feature: 'Profile views analytics', free: false, premium: true },
                      { feature: 'Featured badge', free: false, premium: true },
                      { feature: 'WhatsApp contact', free: false, premium: true },
                    ].map((row, i) => (
                      <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                        <td className="py-3.5 px-6 text-gray-700 font-medium">{row.feature}</td>
                        <td className="py-3.5 px-4 text-center bg-gray-50/50">
                          {typeof row.free === 'string' ? (
                            <span className="text-gray-600 font-medium">{row.free}</span>
                          ) : row.free ? (
                            <Check className="w-4 h-4 text-green-500 mx-auto" />
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center bg-green-50/50">
                          {typeof row.premium === 'string' ? (
                            <span className="text-green-700 font-bold">{row.premium}</span>
                          ) : row.premium ? (
                            <Check className="w-4 h-4 text-green-500 mx-auto" />
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ═══ EMPLOYER SECTION ═══ */}
        <div className="mb-24">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 text-xs font-bold px-4 py-1.5 rounded-full mb-4 uppercase tracking-wider">
              <Briefcase className="w-3.5 h-3.5" /> For Employers
            </div>
            <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Hire the Best Talent</h2>
            <p className="text-gray-500 text-lg">Pay once per job, or subscribe for unlimited access</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Single Job Post Card */}
            <div className="relative group bg-white rounded-3xl border-2 border-gray-200 shadow-sm hover:shadow-2xl transition-all duration-500 flex flex-col overflow-hidden hover:-translate-y-1">
              <div className="h-2 bg-gradient-to-r from-blue-400 via-blue-300 to-blue-400"></div>
              <div className="p-8 lg:p-10 flex-1 flex flex-col">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-50 rounded-2xl flex items-center justify-center border border-blue-200">
                    <Briefcase className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-extrabold text-gray-900">{PRICING_PLANS.singleJobPost.name}</h3>
                    <p className="text-xs text-gray-400 font-medium">No commitment needed</p>
                  </div>
                </div>
                <div className="flex items-baseline gap-1 mt-4 mb-6">
                  <span className="text-5xl font-extrabold text-gray-900">KES 100</span>
                  <span className="text-gray-400 font-medium">/one-time</span>
                </div>
                <p className="text-sm text-gray-500 mb-6 -mt-2">Perfect for one-off hires — a single job listing with contact access</p>
                <ul className="space-y-3 mb-8 flex-1">
                  {PRICING_PLANS.singleJobPost.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-3 text-sm text-gray-700">
                      <span className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-3 h-3 text-blue-600" />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="space-y-2">
                  <button
                    onClick={() => onNavigate?.('post-job')}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white text-base font-bold rounded-2xl transition-all shadow-lg shadow-blue-200 hover:shadow-xl flex items-center justify-center gap-2 group-hover:scale-[1.02]"
                  >
                    <Briefcase className="w-4 h-4" />
                    Post a Job Now
                  </button>
                  <p className="text-center text-xs text-gray-400">Pay KES 100 when you post</p>
                </div>
              </div>
            </div>

            {/* Employer Access Subscription Card */}
            <div className="relative group rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-500 flex flex-col overflow-hidden hover:-translate-y-1">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700"></div>
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-300 via-white to-cyan-300"></div>
              <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-md text-white text-[10px] font-bold px-4 py-1.5 rounded-full tracking-wider border border-white/30 flex items-center gap-1">
                <Zap className="w-3 h-3 text-yellow-300" /> BEST VALUE
              </div>
              <div className="relative p-8 lg:p-10 flex-1 flex flex-col z-10">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-extrabold text-white">{PRICING_PLANS.employerSubscription.name}</h3>
                    <p className="text-xs text-blue-100/80 font-medium">Unlimited — best for repeat hiring</p>
                  </div>
                </div>
                <div className="flex items-baseline gap-1 mt-4 mb-6">
                  <span className="text-5xl font-extrabold text-white">KES 200</span>
                  <span className="text-blue-100/80 font-medium">/week</span>
                </div>
                <p className="text-sm text-blue-100/90 mb-6 -mt-2">Post unlimited jobs & access all jobseekers in your category</p>
                <ul className="space-y-3 mb-8 flex-1">
                  {PRICING_PLANS.employerSubscription.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-3 text-sm text-white/95">
                      <span className="w-5 h-5 rounded-full bg-white/20 backdrop-blur flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-3 h-3 text-blue-200" />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => onOpenMpesa(PRICING_PLANS.employerSubscription.price, 'Employer Weekly Access', 'EMP-WK', 'registration')}
                  className="w-full py-4 bg-white hover:bg-blue-50 text-indigo-700 font-bold text-base rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-black/10 group-hover:scale-[1.02]"
                >
                  <Phone className="w-4 h-4" />
                  Subscribe with M-Pesa
                </button>
              </div>
            </div>
          </div>

          {/* Value comparison nudge */}
          <div className="max-w-3xl mx-auto mt-8 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-2xl p-6 border border-indigo-100 text-center">
            <p className="text-sm text-indigo-800 font-medium">
              Posting more than 2 jobs this week? <span className="font-bold">Employer Access at KES 200/week</span> already pays for itself.
            </p>
          </div>
        </div>

        {/* ═══ ADVERT PLANS ═══ */}
        <div className="mb-16">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-purple-100 text-purple-700 text-xs font-bold px-4 py-1.5 rounded-full mb-4 uppercase tracking-wider">
              <Zap className="w-3.5 h-3.5" /> Business Advertising
            </div>
            <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Promote Your Business</h2>
            <p className="text-gray-500 text-lg">Reach the local community with targeted business listings</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {PRICING_PLANS.advertPlans.map((plan, i) => (
              <div
                key={i}
                className={`relative bg-white rounded-2xl border-2 overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 flex flex-col ${
                  plan.popular ? 'border-purple-500 shadow-xl ring-4 ring-purple-100' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {plan.popular && (
                  <span className="absolute top-0 right-0 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-bl-xl z-10 tracking-wide">
                    MOST POPULAR
                  </span>
                )}
                <div className={`px-6 py-6 text-center ${plan.popular ? 'bg-gradient-to-r from-purple-600 to-indigo-500' : 'bg-gradient-to-b from-gray-100 to-gray-50'}`}>
                  <h3 className={`font-bold text-lg ${plan.popular ? 'text-white' : 'text-gray-900'}`}>{plan.name}</h3>
                  <p className={`text-xs mt-1 ${plan.popular ? 'text-purple-100' : 'text-gray-500'}`}>{plan.duration} listing</p>
                  <div className={`flex items-baseline justify-center gap-1 mt-2 ${plan.popular ? 'text-white' : 'text-gray-900'}`}>
                    <span className="text-3xl font-extrabold">KES {plan.price}</span>
                  </div>
                </div>
                <div className="p-5 flex flex-col flex-1 bg-white">
                  <ul className="space-y-2.5 mb-6 flex-1">
                    {plan.features.map((f, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm text-gray-600">
                        <span className={`w-4 h-4 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0 ${plan.popular ? 'bg-purple-100' : 'bg-gray-100'}`}>
                          <Check className={`w-2.5 h-2.5 ${plan.popular ? 'text-purple-700' : 'text-gray-500'}`} />
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => onOpenMpesa(plan.price, plan.name, `ADV-${plan.duration.replace(' ', '')}`, 'advert')}
                    className={`w-full py-3 text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 ${
                      plan.popular
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg shadow-purple-200'
                        : 'bg-gray-900 hover:bg-gray-800 text-white'
                    }`}
                  >
                    <Phone className="w-4 h-4" />
                    Pay with M-Pesa
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ═══ HOMEPAGE ADVERT ═══ */}
        <div className="mb-16">
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
                <p className="text-amber-100 text-xs mb-6">Live for 7 full days — Exclusive of ad design — user to provide</p>
                <button
                  onClick={() => onOpenMpesa(PRICING_PLANS.homepageAdvert.price, 'Homepage Advert (1 week)', 'ADV-HP-WEEK', 'advert')}
                  className="w-full py-3.5 bg-white hover:bg-amber-50 text-amber-700 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  <Phone className="w-4 h-4" />
                  Pay with M-Pesa
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ JOB LISTINGS TOP BANNER ═══ */}
        <div className="mb-16">
          <div className="max-w-6xl mx-auto bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 rounded-3xl shadow-2xl overflow-hidden">
            <div className="grid md:grid-cols-5">
              <div className="md:col-span-3 p-8">
                <div className="inline-flex items-center gap-1.5 bg-white/20 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wide mb-3">
                  <Zap className="w-3 h-3" /> Premium Placement
                </div>
                <h3 className="text-2xl font-bold text-white mb-1">{PRICING_PLANS.jobListingsBanner.name}</h3>
                <p className="text-emerald-100 text-sm mb-5">Full-width banner at the top of every Jobs page — seen by every jobseeker browsing listings.</p>
                <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
                  {PRICING_PLANS.jobListingsBanner.features.map((f, j) => (
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
                  KES {PRICING_PLANS.jobListingsBanner.price}<span className="text-lg text-emerald-200">/wk</span>
                </p>
                <p className="text-emerald-100 text-xs mb-6">Live for 7 full days — Exclusive of ad design — user to provide</p>
                <button
                  onClick={() => onOpenMpesa(PRICING_PLANS.jobListingsBanner.price, 'Job Listings Banner (1 week)', 'ADV-JL-WEEK', 'advert')}
                  className="w-full py-3.5 bg-white hover:bg-emerald-50 text-emerald-700 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  <Phone className="w-4 h-4" />
                  Pay with M-Pesa
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ WHY JOB LISTINGS BANNER IS WORTH IT ═══ */}
        <div className="max-w-5xl mx-auto mb-16">
          <div className="text-center mb-8">
            <h3 className="text-2xl font-extrabold text-gray-900 mb-2">Why KES 500 Instead of KES 200?</h3>
            <p className="text-gray-500 text-sm max-w-2xl mx-auto">The Job Listings Banner commands a premium because of where it sits and who sees it. Here's what makes it worth 2.5× the price of the Homepage Banner:</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {PRICING_PLANS.jobListingsBanner.valueProps.map((vp, i) => (
              <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  <h4 className="font-bold text-gray-900 text-sm">{vp.label}</h4>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">{vp.detail}</p>
              </div>
            ))}
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-5 border border-emerald-100 flex flex-col justify-center">
              <p className="text-sm text-emerald-800 font-semibold mb-2">Quick Comparison</p>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-gray-600">Homepage Banner</span><span className="font-bold text-gray-900">KES 200/wk</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Job Listings Banner</span><span className="font-bold text-emerald-700">KES 500/wk</span></div>
                <div className="h-px bg-emerald-200 my-1" />
                <div className="flex justify-between"><span className="text-gray-600">Extra cost</span><span className="font-bold text-gray-900">+KES 300/wk</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Audience intent</span><span className="font-bold text-emerald-700">3× higher</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ FEATURED BOOST ═══ */}
        <div className="max-w-4xl mx-auto mb-16">
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-8 border-2 border-amber-300 shadow-lg shadow-amber-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl">POPULAR</div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-md">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-lg">{PRICING_PLANS.featuredBoost.name}</h3>
                <p className="text-sm text-amber-600 font-medium">{PRICING_PLANS.featuredBoost.period}</p>
              </div>
            </div>
            <p className="text-3xl font-extrabold text-gray-900 mb-3">KES {PRICING_PLANS.featuredBoost.price}</p>
            <p className="text-sm text-gray-600 mb-4">{PRICING_PLANS.featuredBoost.description}</p>
            <ul className="space-y-2 mb-5">
              <li className="flex items-start gap-2 text-sm text-gray-700"><CheckCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" /> Prime homepage carousel — seen by every visitor</li>
              <li className="flex items-start gap-2 text-sm text-gray-700"><CheckCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" /> Top of search results for 7 days</li>
              <li className="flex items-start gap-2 text-sm text-gray-700"><CheckCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" /> Up to 5 images with full-size popup</li>
              <li className="flex items-start gap-2 text-sm text-gray-700"><CheckCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" /> WhatsApp chat + website link buttons</li>
              <li className="flex items-start gap-2 text-sm text-gray-700"><CheckCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" /> Clicks & views tracked in your analytics</li>
            </ul>
            <button onClick={() => onNavigate('dashboard')} className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-xl transition-all shadow-md shadow-amber-200 hover:shadow-lg flex items-center justify-center gap-2">
              <Zap className="w-4 h-4" /> Boost My Ad Now
            </button>
          </div>
        </div>

        {/* M-Pesa Info */}
        <div className="max-w-2xl mx-auto mt-16 bg-green-50 rounded-2xl p-8 border border-green-100">
          <div className="flex items-center gap-2 mb-4">
            <img src="/images/mpesa.png" alt="M-Pesa" className="w-72 h-36 flex-shrink-0" />
            <h3 className="text-xl font-bold text-green-800">All Payments via M-Pesa</h3>
          </div>
          <p className="text-sm text-green-700 mb-4">
            We use M-Pesa for all transactions to ensure security and convenience. You can pay using our Till Number or our instant STK Push.
          </p>
          <div className="bg-white rounded-xl p-4 text-center text-sm space-y-1">
            <p className="text-gray-600 font-semibold"><span className="font-bold text-gray-900">M-Pesa Till Number:</span> 1600149</p>
            <p className="text-gray-600 font-semibold"><span className="font-bold text-gray-900">Business Name:</span> ITUKARUA KENYA</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;