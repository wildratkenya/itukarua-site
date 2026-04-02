import React, { useState } from 'react';
import { X, Phone, CheckCircle, Clock, Copy, Check } from 'lucide-react';

interface MpesaModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  description: string;
  accountRef: string;
  onPaymentComplete?: () => void;
}

const MpesaModal: React.FC<MpesaModalProps> = ({ isOpen, onClose, amount, description, accountRef, onPaymentComplete }) => {
  const [step, setStep] = useState<'instructions' | 'stk' | 'processing' | 'success'>('instructions');
  const [phone, setPhone] = useState('');
  const [copied, setCopied] = useState('');
  const [phoneError, setPhoneError] = useState('');

  if (!isOpen) return null;

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(field);
    setTimeout(() => setCopied(''), 2000);
  };

  const handleSTKPush = () => {
    if (!phone.trim() || phone.length < 10) {
      setPhoneError('Enter a valid phone number');
      return;
    }
    setPhoneError('');
    setStep('processing');
    setTimeout(() => {
      setStep('success');
      onPaymentComplete?.();
    }, 3000);
  };

  const resetAndClose = () => {
    setStep('instructions');
    setPhone('');
    onClose();
  };

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
            <p className="text-xs text-green-600 mt-1">Account: {accountRef}</p>
          </div>
        </div>

        <div className="p-6">
          {step === 'instructions' && (
            <div className="space-y-6">
              {/* Manual Payment Instructions */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
                  Pay via M-Pesa (Manual)
                </h3>
                <div className="bg-gray-50 rounded-xl p-4 space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">1. Go to <strong>M-Pesa</strong> on your phone</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">2. Select <strong>Lipa na M-Pesa</strong></span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">3. Choose <strong>PayBill</strong></span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">4. Business No:</span>
                    <button
                      onClick={() => copyToClipboard('247247', 'paybill')}
                      className="flex items-center gap-1 px-2 py-1 bg-white rounded border border-gray-200 hover:bg-gray-100 transition-colors"
                    >
                      <span className="font-mono font-bold text-green-700">247247</span>
                      {copied === 'paybill' ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3 text-gray-400" />}
                    </button>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">5. Account No:</span>
                    <button
                      onClick={() => copyToClipboard(accountRef, 'account')}
                      className="flex items-center gap-1 px-2 py-1 bg-white rounded border border-gray-200 hover:bg-gray-100 transition-colors"
                    >
                      <span className="font-mono font-bold text-green-700">{accountRef}</span>
                      {copied === 'account' ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3 text-gray-400" />}
                    </button>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">6. Amount:</span>
                    <button
                      onClick={() => copyToClipboard(amount.toString(), 'amount')}
                      className="flex items-center gap-1 px-2 py-1 bg-white rounded border border-gray-200 hover:bg-gray-100 transition-colors"
                    >
                      <span className="font-mono font-bold text-green-700">KES {amount.toLocaleString()}</span>
                      {copied === 'amount' ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3 text-gray-400" />}
                    </button>
                  </div>
                  <div className="text-gray-600">7. Enter your <strong>M-Pesa PIN</strong> and confirm</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400 font-medium">OR</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              {/* STK Push */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                  Pay Instantly (STK Push)
                </h3>
                <p className="text-sm text-gray-500 mb-3">Enter your M-Pesa phone number and we'll send a payment prompt directly to your phone.</p>
                <div className="space-y-3">
                  <div>
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="+254 7XX XXX XXX"
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
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Payment Successful!</h3>
              <p className="text-sm text-gray-500 mb-1">KES {amount.toLocaleString()} has been received.</p>
              <p className="text-xs text-gray-400 mb-6">Transaction ID: MPE{Date.now().toString().slice(-8)}</p>
              <button
                onClick={resetAndClose}
                className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
              >
                Continue
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MpesaModal;
