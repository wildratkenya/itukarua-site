import React, { useState, useEffect, useRef } from 'react';
import { X, Phone, CheckCircle, Clock, Copy, Check, AlertCircle, Key } from 'lucide-react';
import { supabaseUrl } from '@/lib/supabase';

interface MpesaModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  description: string;
  accountRef: string;
  user?: { id: string; name: string; email: string; role: string } | null;
  onPaymentComplete?: () => void;
  paymentType?: 'registration' | 'contact_access' | 'job_posting' | 'job_payment' | 'advert' | 'featured_boost';
  relatedJobId?: string;
  relatedAdId?: string;
  relatedProfileId?: string;
}

const MpesaModal: React.FC<MpesaModalProps> = ({
  isOpen, onClose, amount, description, accountRef,
  user, onPaymentComplete, paymentType = 'registration',
  relatedJobId, relatedAdId, relatedProfileId,
}) => {
  const [step, setStep] = useState<'instructions' | 'processing' | 'success' | 'error'>('instructions');
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

  useEffect(() => {
    if (!isOpen) {
      setStep('instructions');
      setPhone('');
      setPhoneError('');
      setErrorMessage('');
      setTransactionId('');
      setCheckoutId(null);
      setAccessToken('');
      if (pollingRef.current) clearInterval(pollingRef.current);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [isOpen]);

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

    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/mpesa-stk-push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          amount,
          accountRef: accountRef || 'ITUKARUA',
          description,
          user_id: user?.id || null,
          payment_type: paymentType,
          related_job_id: relatedJobId || null,
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
    setStep('instructions');
    setPhone('');
    onClose();
  };

  if (!isOpen) return null;

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
              <p className="text-green-100 text-sm">{description}</p>
            </div>
          </div>
          <button onClick={resetAndClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Amount Display */}
        <div className="bg-green-50 px-6 py-4 border-b border-green-100">
          <div className="text-center">
            <p className="text-sm text-green-700 font-medium">Amount to Pay</p>
            <p className="text-3xl font-bold text-green-800">KES {amount.toLocaleString()}</p>
          </div>
        </div>

        <div className="p-6">
          {step === 'instructions' && (
            <div className="space-y-6">
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
              <p className="text-sm text-gray-500 mb-1">KES {amount.toLocaleString()} has been received.</p>
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
                  <p className="text-[11px] text-green-600 mt-2">Save this token — use it to unlock this contact if you return later.</p>
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
      </div>
    </div>
  );
};

export default MpesaModal;
