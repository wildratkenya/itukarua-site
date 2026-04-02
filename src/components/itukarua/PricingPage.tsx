import React from 'react';
import { Check, Zap, Shield, Phone } from 'lucide-react';
import { PRICING_PLANS } from '@/data/siteData';

interface PricingPageProps {
  onOpenMpesa: (amount: number, description: string, accountRef: string) => void;
}

const PricingPage: React.FC<PricingPageProps> = ({ onOpenMpesa }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-700 to-green-800 py-14 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl lg:text-4xl font-bold text-white mb-3">Simple, Transparent Pricing</h1>
          <p className="text-green-100 max-w-2xl mx-auto">Choose the plan that works for you. All payments are processed securely through M-Pesa.</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Jobseeker Registration */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">For Jobseekers</h2>
          <p className="text-gray-500 text-center mb-8">Register once and start bidding on unlimited jobs</p>
          <div className="max-w-md mx-auto bg-white rounded-2xl border-2 border-green-500 shadow-xl overflow-hidden">
            <div className="bg-green-600 px-6 py-4 text-center">
              <p className="text-green-100 text-sm font-medium">One-Time Registration</p>
              <div className="flex items-baseline justify-center gap-1 mt-1">
                <span className="text-4xl font-bold text-white">KES {PRICING_PLANS.jobseeker.price}</span>
              </div>
            </div>
            <div className="p-6">
              <ul className="space-y-3 mb-6">
                {PRICING_PLANS.jobseeker.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-gray-600">
                    <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => onOpenMpesa(PRICING_PLANS.jobseeker.price, 'Jobseeker Registration', 'REG-NEW')}
                className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Phone className="w-4 h-4" />
                Pay with M-Pesa
              </button>
            </div>
          </div>
        </div>

        {/* Advert Plans */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Business Advertising Plans</h2>
          <p className="text-gray-500 text-center mb-8">Promote your business to the local community</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {PRICING_PLANS.advertPlans.map((plan, i) => (
              <div
                key={i}
                className={`bg-white rounded-2xl border-2 overflow-hidden transition-all hover:shadow-xl ${
                  plan.popular ? 'border-green-500 shadow-xl scale-105' : 'border-gray-200'
                }`}
              >
                {plan.popular && (
                  <div className="bg-green-600 text-center py-1.5">
                    <span className="text-xs font-semibold text-white flex items-center justify-center gap-1">
                      <Zap className="w-3 h-3" /> Most Popular
                    </span>
                  </div>
                )}
                <div className="p-6">
                  <h3 className="font-semibold text-gray-900 mb-1">{plan.name}</h3>
                  <p className="text-xs text-gray-500 mb-4">{plan.duration} listing</p>
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-3xl font-bold text-gray-900">KES {plan.price}</span>
                  </div>
                  <ul className="space-y-2.5 mb-6">
                    {plan.features.map((f, j) => (
                      <li key={j} className="flex items-center gap-2 text-sm text-gray-600">
                        <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => onOpenMpesa(plan.price, plan.name, `ADV-${plan.duration.replace(' ', '')}`)}
                    className={`w-full py-3 font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 ${
                      plan.popular
                        ? 'bg-green-600 hover:bg-green-700 text-white'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
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
            We use M-Pesa for all transactions to ensure security and convenience. You can pay using PayBill or our instant STK Push.
          </p>
          <div className="bg-white rounded-xl p-4 text-left text-sm space-y-1">
            <p className="text-gray-600"><span className="font-semibold text-gray-900">PayBill Number:</span> 247247</p>
            <p className="text-gray-600"><span className="font-semibold text-gray-900">Business Name:</span> ITUKARUA Solutions</p>
            <p className="text-gray-600"><span className="font-semibold text-gray-900">Account Number:</span> Your User ID or Reference</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;
