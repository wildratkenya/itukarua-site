import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle, Loader2, Mail, Shield, Building2, Crown, Phone, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { CORPORATE_PACKAGES, CORPORATE_TIER_ANCHOR_KES } from '@/data/siteData';
import type { Page } from './Header';

interface CorporateSignupPageProps {
  onNavigate: (page: Page) => void;
  onOpenAuth: (tab: 'login' | 'signup') => void;
  onAuthComplete: () => void;
}

type Step = 'details' | 'otp' | 'success';

const SELF_SERVE_TIERS = ['bronze', 'silver', 'gold'] as const;
type Tier = typeof SELF_SERVE_TIERS[number];

const CorporateSignupPage: React.FC<CorporateSignupPageProps> = ({ onNavigate, onOpenAuth, onAuthComplete }) => {
  const [tier, setTier] = useState<Tier>('bronze');
  const [step, setStep] = useState<Step>('details');
  const [form, setForm] = useState({
    company_name: '',
    email: '',
    contact_person: '',
    contact_phone: '',
    contact_email: '',
    billing_email: '',
  });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  // OTP state
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpResendTimer, setOtpResendTimer] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const saved = sessionStorage.getItem('corporate_signup_tier') as Tier | null;
    if (saved && SELF_SERVE_TIERS.includes(saved)) setTier(saved);
    sessionStorage.removeItem('corporate_signup_tier');
  }, []);

  // OTP countdown timer
  useEffect(() => {
    if (otpResendTimer <= 0) return;
    const t = setInterval(() => setOtpResendTimer(prev => prev - 1), 1000);
    return () => clearInterval(t);
  }, [otpResendTimer]);

  const pkg = CORPORATE_PACKAGES.find(p => p.id === tier) || CORPORATE_PACKAGES[0];
  const anchor = CORPORATE_TIER_ANCHOR_KES[tier];

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.company_name.trim()) errs.company_name = 'Company name is required';
    if (!form.email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email';
    if (!termsAccepted) errs.terms = 'You must accept the Terms & Conditions';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setServerError('');
    try {
      const email = form.email.trim().toLowerCase();
      const { data: otpResult, error: otpError } = await supabase.functions.invoke('send-corporate-otp', {
        body: {
          email,
          tier,
          company_name: form.company_name.trim(),
          contact_person: form.contact_person.trim() || undefined,
          contact_phone: form.contact_phone.trim() || undefined,
          contact_email: form.contact_email.trim() || undefined,
          billing_email: form.billing_email.trim() || undefined,
        },
      });
      if (otpError) throw new Error(otpError.message || 'Failed to send verification code');
      if (otpResult?.error) throw new Error(otpResult.error);
      setOtpCode(['', '', '', '', '', '']);
      setOtpError('');
      setOtpResendTimer(60);
      setStep('otp');
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err: any) {
      setServerError(err.message || 'Failed to send verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (idx: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otpCode];
    newOtp[idx] = value.slice(-1);
    setOtpCode(newOtp);
    setOtpError('');
    if (value && idx < 5) otpRefs.current[idx + 1]?.focus();
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpCode[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtpCode(pasted.split(''));
      otpRefs.current[5]?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    const code = otpCode.join('');
    if (code.length !== 6) { setOtpError('Enter the full 6-digit code'); return; }
    setOtpLoading(true);
    setOtpError('');
    try {
      const email = form.email.trim().toLowerCase();
      const { data: result, error: verifyError } = await supabase.functions.invoke('verify-corporate-otp', {
        body: { email, otp_code: code },
      });
      if (verifyError) throw new Error(verifyError.message || 'Verification failed');
      if (result?.error) throw new Error(result.error);
      if (!result?.success) throw new Error('Verification failed');

      // Auto sign-in with the one-time temporary password.
      onAuthComplete();
      setFinalizing(true);
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: result.temp_password });
      if (signInError) {
        setFinalizing(false);
        setStep('success');
        return;
      }
      // The SIGNED_IN listener routes corporate users to the panel; this is a
      // fallback in case profile refresh is slow.
      window.setTimeout(() => onNavigate('corporate'), 2500);
    } catch (err: any) {
      setFinalizing(false);
      setOtpError(err.message || 'Invalid code. Please try again.');
      setOtpCode(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (otpResendTimer > 0) return;
    setOtpLoading(true);
    setOtpError('');
    try {
      const email = form.email.trim().toLowerCase();
      const { data: otpResult, error: otpError } = await supabase.functions.invoke('send-corporate-otp', {
        body: {
          email,
          tier,
          company_name: form.company_name.trim(),
          contact_person: form.contact_person.trim() || undefined,
          contact_phone: form.contact_phone.trim() || undefined,
          contact_email: form.contact_email.trim() || undefined,
          billing_email: form.billing_email.trim() || undefined,
        },
      });
      if (otpError) throw new Error(otpError.message || 'Failed to resend');
      if (otpResult?.error) throw new Error(otpResult.error);
      setOtpResendTimer(60);
      setOtpCode(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } catch (err: any) {
      setOtpError(err.message || 'Failed to resend code');
    } finally {
      setOtpLoading(false);
    }
  };

  // ── SUCCESS SCREEN ────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-gradient-to-r from-green-700 to-green-800 py-10">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-2xl lg:text-3xl font-bold text-white">Account Created</h1>
            <p className="text-green-100 mt-1">Welcome to Itukarua Corporate</p>
          </div>
        </div>
        <div className="max-w-md mx-auto px-4 py-12">
          <div className="bg-white rounded-xl p-8 border border-gray-100 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">{form.company_name} is live!</h2>
            <p className="text-sm text-gray-500 mb-4">
              Your <span className="capitalize font-medium text-gray-700">{tier}</span> tier corporate account is ready
              on the <span className="font-medium text-gray-700">Corporate &amp; Community Placements</span> plan.
            </p>
            <p className="text-xs text-gray-400 mb-6 leading-relaxed">
              Login details were sent to <span className="font-medium text-gray-600">{form.email}</span>. You can sign in
              with that email and the temporary password from the email, then manage placements, team and billing from
              your panel.
            </p>
            <div className="space-y-2">
              <button
                onClick={() => onOpenAuth('login')}
                className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
              >
                Sign In to Your Panel
              </button>
              <button
                onClick={() => onNavigate('home')}
                className="w-full py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Back to Itukarua
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── OTP SCREEN ────────────────────────────────────────────────────
  if (step === 'otp') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-gradient-to-r from-green-700 to-green-800 py-10">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <button onClick={() => { setStep('details'); setServerError(''); }} className="flex items-center gap-2 text-green-200 hover:text-white mb-4 transition-colors"><ArrowLeft className="w-4 h-4" /> Back to Details</button>
            <h1 className="text-2xl lg:text-3xl font-bold text-white">Verify Your Email</h1>
            <p className="text-green-100 mt-1">Enter the 6-digit code sent to {form.email}</p>
          </div>
        </div>

        <div className="max-w-md mx-auto px-4 py-12">
          <div className="bg-white rounded-xl p-8 border border-gray-100 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <Mail className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Check Your Email</h2>
            <p className="text-sm text-gray-500 mb-6">
              We sent a verification code to<br />
              <span className="font-medium text-gray-700">{form.email}</span>
            </p>

            {otpError && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{otpError}</div>}

            <div className="flex justify-center gap-2 mb-6">
              {otpCode.map((digit, idx) => (
                <input
                  key={idx}
                  ref={el => { otpRefs.current[idx] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleOtpChange(idx, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(idx, e)}
                  onPaste={idx === 0 ? handleOtpPaste : undefined}
                  className="w-12 h-14 text-center text-xl font-bold rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-colors"
                />
              ))}
            </div>

            <button
              onClick={handleVerifyOtp}
              disabled={otpLoading || finalizing || otpCode.join('').length !== 6}
              className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mb-4"
            >
              {otpLoading || finalizing ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Shield className="w-4 h-4" /> Verify &amp; Activate Account</>}
            </button>
            {finalizing && <p className="text-xs text-green-600 mb-4">Account created — taking you to your corporate panel…</p>}

            <div className="text-sm text-gray-500">
              {otpResendTimer > 0 ? (
                <p>Resend code in <span className="font-medium text-gray-700">{otpResendTimer}s</span></p>
              ) : (
                <button onClick={handleResendOtp} disabled={otpLoading} className="text-green-700 hover:underline font-medium">
                  Resend Code
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── DETAILS SCREEN ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-gray-900 via-neutral-900 to-gray-900 text-white py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <button onClick={() => onNavigate('pricing')} className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"><ArrowLeft className="w-4 h-4" /> Back to Pricing</button>
          <div className="flex items-center gap-2 mb-2">
            <Crown className="w-5 h-5 text-amber-300" />
            <p className="text-xs font-bold tracking-widest uppercase text-amber-300">Partnerships — Self-Service Signup</p>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold">Create your corporate account</h1>
          <p className="text-gray-300 mt-2 max-w-2xl text-sm">
            Co-operatives, churches, SACCOs, institutions and businesses get a steady branded presence on Itukarua.
            Pick your plan, verify your email, and your panel is live in minutes.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="grid lg:grid-cols-5 gap-6">
          {/* Plan choice */}
          <div className="lg:col-span-2 space-y-3">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">1 · Choose your plan</h2>
            {CORPORATE_PACKAGES.filter(p => SELF_SERVE_TIERS.includes(p.id as Tier)).map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setTier(p.id as Tier)}
                className={`w-full text-left rounded-xl border-2 p-4 transition-all ${tier === p.id ? 'border-amber-400 bg-amber-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="font-bold text-gray-900">{p.tier}</p>
                  <p className="text-xs font-semibold text-amber-700">From KES {CORPORATE_TIER_ANCHOR_KES[p.id].toLocaleString()}/mo</p>
                </div>
                <p className="text-xs text-gray-500 mb-2">{p.headline}</p>
                <ul className="text-[11px] text-gray-600 space-y-0.5">
                  {p.features.slice(0, 3).map((f, i) => (
                    <li key={i} className="flex items-start gap-1"><span className="text-amber-500 mt-0.5">•</span>{f}</li>
                  ))}
                </ul>
              </button>
            ))}
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-4">
              <p className="text-xs text-gray-600">
                <span className="font-semibold text-gray-900">Need something custom?</span> County-wide scope, event-timed
                campaigns or extra placements — our team can build a bespoke bundle.
              </p>
              <button onClick={() => onNavigate('advertise')} className="mt-2 text-xs font-semibold text-amber-700 hover:underline">
                Request a custom quote →
              </button>
            </div>
          </div>

          {/* Details form */}
          <div className="lg:col-span-3">
            <form onSubmit={handleSendOtp} className="bg-white rounded-2xl border border-gray-100 p-6">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4">2 · Your details</h2>

              {serverError && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{serverError}</div>}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company Name <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      value={form.company_name}
                      onChange={e => setForm({ ...form, company_name: e.target.value })}
                      className={`w-full pl-10 pr-4 py-2.5 rounded-lg border ${errors.company_name ? 'border-red-400' : 'border-gray-300'} focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none`}
                      placeholder="e.g. Kamau Enterprises Ltd"
                    />
                  </div>
                  {errors.company_name && <p className="text-red-500 text-xs mt-1">{errors.company_name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Login Email <span className="text-red-500">*</span></label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    className={`w-full px-4 py-2.5 rounded-lg border ${errors.email ? 'border-red-400' : 'border-gray-300'} focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none`}
                    placeholder="owner@company.com"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">We'll verify this email with a code and send your login details here.</p>
                  {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        value={form.contact_person}
                        onChange={e => setForm({ ...form, contact_person: e.target.value })}
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                        placeholder="Accounts manager"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="tel"
                        value={form.contact_phone}
                        onChange={e => setForm({ ...form, contact_phone: e.target.value })}
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                        placeholder="+254 7XX XXX XXX"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
                    <input
                      type="email"
                      value={form.contact_email}
                      onChange={e => setForm({ ...form, contact_email: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                      placeholder="Different from login (optional)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Billing Email</label>
                    <input
                      type="email"
                      value={form.billing_email}
                      onChange={e => setForm({ ...form, billing_email: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                      placeholder="Invoices go here (optional)"
                    />
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="cs-terms"
                    checked={termsAccepted}
                    onChange={e => setTermsAccepted(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                  />
                  <label htmlFor="cs-terms" className="text-xs text-gray-600">
                    I agree to the <strong>Terms &amp; Conditions</strong> and <strong>Privacy Policy</strong> of Itukarua, and confirm my organization
                    is authorised to open this corporate account.
                  </label>
                </div>
                {errors.terms && <p className="text-red-500 text-xs ml-6">{errors.terms}</p>}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-6 w-full py-3 bg-gradient-to-r from-amber-300 to-orange-300 hover:from-amber-200 hover:to-orange-200 text-gray-900 font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Shield className="w-4 h-4" /> Send Verification Code</>}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>

              <p className="text-[11px] text-gray-400 mt-3 text-center">
                Your <span className="capitalize">{tier}</span> plan starts at KES {anchor.toLocaleString()}/mo. Placement
                billing and invoicing happen from your corporate panel.
              </p>
            </form>
          </div>
        </div>

        <div className="mt-10 text-center">
          <p className="text-sm text-gray-500">Already have a corporate account?</p>
          <button onClick={() => onOpenAuth('login')} className="mt-1 text-sm font-semibold text-green-700 hover:underline">
            Sign in to your panel
          </button>
        </div>
      </div>
    </div>
  );
};

export default CorporateSignupPage;