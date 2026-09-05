import React, { useState, useEffect, useRef } from 'react';
import { X, Phone, CheckCircle, Clock, Copy, Check, AlertCircle, Key, Zap, Crown, CalendarX2 } from 'lucide-react';
import { supabaseUrl } from '@/lib/supabase';

interface MpesaModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  description: string;
  accountRef: string;
  user?: { id: string; name: string; email: string; role: string } | null;
  onPaymentComplete?: () => void;
  paymentType?: 'registration' | 'contact_access' | 'job_posting' | 'job_payment' | 'advert' | 'featured_boost' | 'single_job_post' | 'employer_day_token';
  relatedJobId?: string;
  relatedAdId?: string;
  relatedProfileId?: string;
  employerPlans?: boolean;
  relatedJobTitle?: string;
  employerExpired?: boolean;
  employerExpiredAt?: string | null;
}

const EMPLOYER_WEEKLY = {
  amount: 200,
  description: 'Employer Weekly Access',
  accountRef: 'EMP-WK',
  paymentType: 'registration' as const,
};

const EMPLOYER_DAY = {
  amount: 100,
  description: 'Single Job Token',
  accountRef: 'EMP-DAY',
  paymentType: 'employer_day_token' as const,
};

const MpesaModal: React.FC<MpesaModalProps> = ({
  isOpen, onClose, amount, description, accountRef,
  user, onPaymentComplete, paymentType = 'registration',
  relatedJobId, relatedAdId, relatedProfileId,
  employerPlans = false, relatedJobTitle, employerExpired = false, employerExpiredAt,
}) => {
  const [step, setStep] = useState<'plans' | 'instructions' | 'processing' | 'success' | 'error'>('instructions');
  const [selectedPlan, setSelectedPlan] = useState<'weekly' | 'day' | null>(null);
  const [phone, setPhone] = useState('');
  const [copied, setCopied] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [checkoutId, setCheckoutId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState('');
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const generateToken = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let token = 'ITK-';
    for (let i = 0; i < 8; i++) token += chars[Math.floor(Math.random() * chars.length)];
    return token;
  };

  const planFor = (p: 'weekly' | 'day') => {
    if (p === 'day') {
      const jobLabel = relatedJobTitle ? ` — ${relatedJobTitle}` : '';
      return {
        amount: EMPLOYER_DAY.amount,
        description: `${EMPLOYER_DAY.description}${jobLabel}`,
        accountRef: EMPLOYER_DAY.accountRef,
        paymentType: EMPLOYER_DAY.paymentType,
        relatedJobId,
      };
    }
    return {
      amount: EMPLOYER_WEEKLY.amount,
      description: EMPLOYER_WEEKLY.description,
      accountRef: EMPLOYER_WEEKLY.accountRef,
      paymentType: EMPLOYER_WEEKLY.paymentType,
      relatedJobId: undefined as string | undefined,
    };
  };

  const effective = selectedPlan ? planFor(selectedPlan) : {
    amount, description, accountRef, paymentType, relatedJobId,
  };

  useEffect(() => {
    if (isOpen) {
      setStep(employerPlans ? 'plans' : 'instructions');
      setSelectedPlan(null);
      setPhone('');
      setPhoneError('');
      setErrorMessage('');
      setTransactionId('');
      setCheckoutId(null);
      setAccessToken('');
      if (pollingRef.current) clearInterval(pollingRef.current);
    } else {
      setStep(employerPlans ? 'plans' : 'instructions');
      setSelectedPlan(null);
      if (pollingRef.current) clearInterval(pollingRef.current);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [isOpen, employerPlans]);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(field);
    setTimeout(() => setCopied(''), 2000);
  };

  const startPolling = (checkoutRequestId: string) => {
    let attempts = 0;
    const maxAttempts = 15;

    pollingRef.current = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setErrorMessage('Payment confirmation timed out. Check your M-Pesa messages for the transaction.');
        setStep('error');
        return;
      }

      try {
        const res = await fetch(
          `${supabaseUrl}/functions/v1/mpesa-stk-push/status?CheckoutRequestID=${checkoutRequestId}`
        );
        const data = await res.json();

        if (data.status === 'completed') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setTransactionId(data.payment?.mpesa_ref || `MPE${Date.now().toString().slice(-8)}`);
          setStep('success');
          onPaymentComplete?.();
        } else if (data.status === 'failed') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setErrorMessage('Payment failed. Please try again.');
          setStep('error');
        }
      } catch (err) {
        // Silently retry
      }
    }, 3000);
  };

  const handleSTKPush = async () => {
    if (!phone.trim() || phone.length < 10) {
      setPhoneError('Enter a valid phone number');
      return;
    }
    setPhoneError('');
    setStep('processing');
    setErrorMessage('');
    const token = generateToken();
    setAccessToken(token);
    const { amount: payAmount, description: payDesc, accountRef: payRef, paymentType: payType, relatedJobId: payJobId } = effective;

    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/mpesa-stk-push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          amount: payAmount,
          accountRef: payRef || 'ITUKARUA',
          description: payDesc,
          user_id: user?.id || null,
          payment_type: payType,
          related_job_id: payJobId || null,
          related_ad_id: relatedAdId || null,
          related_profile_id: relatedProfileId || null,
          token,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'STK push failed');
      }

      if (data.success && data.CheckoutRequestID) {
        setCheckoutId(data.CheckoutRequestID);
        startPolling(data.CheckoutRequestID);
      } else {
        throw new Error('Unexpected response from server');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to initiate payment. Please try again.');
      setStep('error');
    }
  };

  const resetAndClose = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setStep(employerPlans ? 'plans' : 'instructions');
    setSelectedPlan(null);
    setPhone('');
    onClose();
  };

  if (!isOpen) return null;

  const formattedExpiry = employerExpiredAt ? new Date(employerExpiredAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
  const dayTokenDisabled = employerPlans && !relatedJobId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={resetAndClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gradient-to-r from-green-600 to-green-700 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Phone className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">M-Pesa Payment</h2>
              <p className="text-green-100 text-sm">{step === 'plans' ? 'Choose your employer plan' : (selectedPlan ? effective.description : description)}</p>
            </div>
          </div>
          <button onClick={resetAndClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {employerExpired && (
          <div className="bg-red-50 px-6 py-3 border-b border-red-200 flex items-start gap-2">
            <CalendarX2 className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-700 font-medium">
              Your employer account {formattedExpiry ? <>expired on <span className="font-bold">{formattedExpiry}</span></> : 'has expired'}. Renew to continue accessing worker contacts.
            </p>
          </div>
        )}

        {step === 'plans' ? (
          <div className="p-6">
            <p className="text-sm text-gray-600 mb-4">Choose how you'd like to access employer features. This unlocks contacts but you {employerExpired ? 'need an active plan' : 'must have a valid plan'}.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="border-2 border-green-500 rounded-xl p-5 bg-green-50 relative">
                <span className="absolute -top-2.5 left-3 px-2 py-0.5 bg-green-600 text-white text-[10px] font-bold uppercase rounded-full">Recommended</span>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-3xl font-extrabold text-green-700">KES 200</span>
                  <Crown className="w-6 h-6 text-green-600" />
                </div>
                <p className="text-sm font-semibold text-gray-900">Weekly Unlimited</p>
                <p className="text-xs text-gray-500 mt-0.5">7 days access</p>
                <ul className="text-xs text-gray-600 mt-3 space-y-1.5">
                  <li>• All jobseeker contacts in your category</li>
                  <li>• Unlimited job posts & bids</li>
                  <li>• No per-job fees</li>
                </ul>
                <button
                  onClick={() => { setSelectedPlan('weekly'); setStep('instructions'); }}
                  className="mt-4 w-full py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  Choose Weekly
                </button>
              </div>

              <div className={`border-2 rounded-xl p-5 ${dayTokenDisabled ? 'border-gray-200 bg-gray-50 opacity-60' : 'border-blue-300 bg-blue-50'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-3xl font-extrabold text-blue-700">KES 100</span>
                  <Zap className="w-6 h-6 text-blue-600" />
                </div>
                <p className="text-sm font-semibold text-gray-900">Single Job Token</p>
                <p className="text-xs text-gray-500 mt-0.5">1 day access</p>
                <ul className="text-xs text-gray-600 mt-3 space-y-1.5">
                  <li>• Unlock contacts for ONE job for 24 hours</li>
                  <li>• See all bids on that job</li>
                  <li>• No weekly commitment</li>
                </ul>
                <button
                  disabled={dayTokenDisabled}
                  onClick={() => { setSelectedPlan('day'); setStep('instructions'); }}
                  className="mt-4 w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  {dayTokenDisabled ? 'Open a job to use' : 'Choose Day Token'}
                </button>
                {dayTokenDisabled && (
                  <p className="text-[10px] text-gray-400 mt-2 text-center">This token unlocks contacts for one specific job — browse a job first.</p>
                )}
              </div>
            </div>
            {relatedJobTitle && (
              <p className="text-xs text-gray-500 mt-4 text-center">Day token unlocks: <span className="font-medium text-gray-700">{relatedJobTitle}</span></p>
            )}
          </div>
        ) : (
          <>
            {/* Amount Display */}
            <div className="bg-green-50 px-6 py-4 border-b border-green-100">
              <div className="text-center">
                <p className="text-sm text-green-700 font-medium">Amount to Pay</p>
                <p className="text-3xl font-bold text-green-800">KES {effective.amount.toLocaleString()}</p>
                <p className="text-xs text-green-600 mt-1">{selectedPlan === 'day' ? '1-day access · expires in 24 hours' : selectedPlan === 'weekly' ? '7-day unlimited access' : description}</p>
              </div>
            </div>

            <div className="p-6">
              {step === 'instructions' && (
                <div className="space-y-6">
                  {employerPlans && selectedPlan && (
                    <button
                      onClick={() => { setSelectedPlan(null); setStep('plans'); }}
                      className="text-xs text-gray-400 hover:text-gray-600 underline mb-2 inline-flex items-center gap-1"
                    >
                      ← Change plan
                    </button>
                  )}
                  <div>
                    <p className="text-sm text-gray-500 mb-3">Enter your M-Pesa phone number and we'll send a payment prompt directly to your phone.</p>
                    <div className="space-y-3">
                      <div>
                        <input
                          type="tel"
                          value={phone}
                          onChange={e => setPhone(e.target.value)}
                          placeholder="07XX XXX XXX"
                          className={`w-full px-4 py-3 rounded-lg border ${phoneError ? 'border-red-400' : 'border-gray-300'} focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none text-lg`}
                        />
                        {phoneError && <p className="text-red-500 text-xs mt-1">{phoneError}</p>}
                      </div>
                      <button
                        onClick={handleSTKPush}
                        className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <Phone className="w-4 h-4" />
                        Send M-Pesa Prompt
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <svg className="w-4 h-4 text-yellow-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <p className="text-xs text-yellow-700">Secured by Safaricom M-Pesa. Your payment details are encrypted and safe.</p>
                  </div>
                </div>
              )}

              {step === 'processing' && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Processing Payment...</h3>
                  <p className="text-sm text-gray-500">Please check your phone and enter your M-Pesa PIN to complete the payment.</p>
                  <div className="flex items-center justify-center gap-2 mt-4 text-sm text-gray-400">
                    <Clock className="w-4 h-4" />
                    <span>Waiting for confirmation...</span>
                  </div>
                  <p className="text-xs text-gray-300 mt-2">This should take less than a minute</p>
                  <button
                    onClick={resetAndClose}
                    className="mt-6 text-sm text-gray-400 hover:text-gray-600 underline"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {step === 'success' && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-10 h-10 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Payment Successful!</h3>
                  <p className="text-sm text-gray-500 mb-1">KES {effective.amount.toLocaleString()} has been received.</p>
                  <p className="text-xs text-gray-400 mb-4">Transaction ID: {transactionId}</p>
                  {accessToken && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 mx-auto max-w-xs">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <Key className="w-4 h-4 text-green-600" />
                        <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">Your Access Token</span>
                      </div>
                      <div className="flex items-center justify-center gap-2">
                        <p className="text-xl font-bold text-green-800 tracking-widest">{accessToken}</p>
                        <button onClick={() => { navigator.clipboard.writeText(accessToken); setCopied('token'); setTimeout(() => setCopied(''), 2000); }} className="p-1 hover:bg-green-100 rounded transition-colors">
                          {copied === 'token' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-green-600" />}
                        </button>
                      </div>
                      <p className="text-[11px] text-green-600 mt-2">Save this token — it records your payment if you return later.</p>
                    </div>
                  )}
                  <button
                    onClick={resetAndClose}
                    className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
                  >
                    Continue
                  </button>
                </div>
              )}

              {step === 'error' && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-10 h-10 text-red-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Payment Failed</h3>
                  <p className="text-sm text-gray-500 mb-6">{errorMessage}</p>
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={() => setStep('instructions')}
                      className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
                    >
                      Try Again
                    </button>
                    <button
                      onClick={resetAndClose}
                      className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MpesaModal;