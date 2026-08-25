import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, CheckCircle, Loader2, Upload, X, Mail, Shield, Phone, Zap, Briefcase } from 'lucide-react';
import { KENYA_COUNTIES } from '@/data/siteData';
import { getSubcounties } from '@/data/kenyaLocations';
import { createJob, getCustomCategories, notifyJobseekersOfNewJob, checkSubscriptionActive, countRecentSingleJobs } from '@/lib/database';
import { supabase } from '@/lib/supabase';
import { compressImage } from '@/lib/imageUtils';
import type { Page } from './Header';
import type { UserState } from '../AppLayout';

interface PostJobPageProps {
  onNavigate: (page: Page) => void;
  user: UserState | null;
  onOpenAuth: (tab: 'login' | 'signup') => void;
  onOpenMpesa?: (amount: number, description: string, accountRef: string, paymentType?: string, relatedAdId?: string, relatedJobId?: string, relatedProfileId?: string, onComplete?: () => void) => void;
}

const MAX_IMAGES = 3;
const SUPABASE_URL = 'https://xahaxtbudiubelemewna.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhaGF4dGJ1ZGl1YmVsZW1ld25hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMjE5MDYsImV4cCI6MjA5MDY5NzkwNn0.jF-4s0Sv8O0PDrO9XeYU4w4W8kFpJ7lY3xQ5b2r0Z6E';

type Step = 'form' | 'otp' | 'payment' | 'success';

const PostJobPage: React.FC<PostJobPageProps> = ({ onNavigate, user, onOpenAuth, onOpenMpesa }) => {
  const [step, setStep] = useState<Step>('form');
  const [formData, setFormData] = useState({ title: '', category: '', description: '', location: '', county: '', subcounty: '', budgetMin: '', budgetMax: '', deadline: '', urgent: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const [dbCats, setDbCats] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [createdJobId, setCreatedJobId] = useState<string>('');
  const [hasSubscription, setHasSubscription] = useState(false);
  const [recentSingleCount, setRecentSingleCount] = useState(0);
  const [showUpsell, setShowUpsell] = useState(false);

  // OTP state
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpExpiry, setOtpExpiry] = useState<Date | null>(null);
  const [otpResendTimer, setOtpResendTimer] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => { getCustomCategories('job').then(setDbCats); }, []);

  // OTP countdown timer
  useEffect(() => {
    if (otpResendTimer <= 0) return;
    const t = setInterval(() => setOtpResendTimer(prev => prev - 1), 1000);
    return () => clearInterval(t);
  }, [otpResendTimer]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!formData.title.trim()) errs.title = 'Job title is required';
    if (!formData.category) errs.category = 'Select a category';
    if (!formData.description.trim()) errs.description = 'Description is required';
    if (!formData.location) errs.location = 'Select a location';
    if (!formData.budgetMin) errs.budgetMin = 'Enter minimum budget';
    if (!formData.budgetMax) errs.budgetMax = 'Enter maximum budget';
    if (!formData.deadline) errs.deadline = 'Set a deadline';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const addImages = async (list: FileList | null) => {
    if (!list) return;
    const files = Array.from(list).filter(f => f.type.startsWith('image/'));
    const remaining = MAX_IMAGES - imageFiles.length;
    const toAdd = files.slice(0, remaining);
    if (toAdd.length === 0) return;

    const compressed: File[] = [];
    const previews: string[] = [];
    for (const f of toAdd) {
      const c = await compressImage(f, 1200, 0.8);
      compressed.push(c);
      previews.push(URL.createObjectURL(c));
    }
    setImageFiles(prev => [...prev, ...compressed]);
    setImagePreviews(prev => [...prev, ...previews]);
  };

  const removeImage = (idx: number) => {
    URL.revokeObjectURL(imagePreviews[idx]);
    setImageFiles(prev => prev.filter((_, i) => i !== idx));
    setImagePreviews(prev => prev.filter((_, i) => i !== idx));
  };

  // Step 1: Validate form + upload images + send OTP
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { onOpenAuth('login'); return; }
    if (!validate()) return;
    setLoading(true);
    setServerError('');
    try {
      // Upload images first
      let imageUrls: string[] = [];
      if (imageFiles.length > 0) {
        for (const file of imageFiles) {
          const fileExt = file.name.split('.').pop();
          const fileName = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${fileExt}`;
          const filePath = `${user.id}/${fileName}`;
          const { error: uploadError } = await supabase.storage.from('jobs').upload(filePath, file);
          if (uploadError) throw uploadError;
          const { data } = supabase.storage.from('jobs').getPublicUrl(filePath);
          imageUrls.push(data.publicUrl);
        }
      }

      // Store job data + send OTP
      const jobData = {
        title: formData.title,
        description: formData.description,
        location: formData.location,
        county: formData.county || undefined,
        subcounty: formData.subcounty || undefined,
        budget_min: parseInt(formData.budgetMin),
        budget_max: parseInt(formData.budgetMax),
        deadline: formData.deadline,
        category: formData.category,
        posted_by: user.id,
        posted_by_name: user.name,
        urgent: formData.urgent,
        images: imageUrls.length > 0 ? imageUrls : undefined,
      };

      const { data: otpResult, error: otpError } = await supabase.functions.invoke('send-job-otp', {
        body: { user_id: user.id, email: user.email, job_data: jobData },
      });

      if (otpError) throw new Error(otpError.message || 'Failed to send verification code');
      if (otpResult?.error) throw new Error(otpResult.error);

      setOtpExpiry(new Date(otpResult.expires_at));
      setOtpResendTimer(60);
      setStep('otp');
      // Auto-focus first OTP input
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err: any) {
      setServerError(err.message || 'Failed to send verification code. Please try again.');
    } finally { setLoading(false); }
  };

  // OTP input handler
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

  // Step 2: Verify OTP + create job
  const handleVerifyOtp = async () => {
    const code = otpCode.join('');
    if (code.length !== 6) { setOtpError('Enter the full 6-digit code'); return; }
    setOtpLoading(true);
    setOtpError('');
    try {
      const { data: result, error: verifyError } = await supabase.functions.invoke('verify-job-otp', {
        body: { user_id: user?.id, otp_code: code },
      });

      if (verifyError) throw new Error(verifyError.message || 'Verification failed');
      if (result?.error) throw new Error(result.error);
      if (!result?.valid) throw new Error('Invalid verification code');

      // Create the job with the stored data
      const newJob = await createJob(result.job_data);
      notifyJobseekersOfNewJob(newJob.id).catch(console.error);
      setCreatedJobId(newJob.id);

      // Check if employer has active subscription
      if (user) {
        const active = await checkSubscriptionActive(user.id);
        setHasSubscription(active);
        if (active) {
          setStep('success');
        } else {
          const count = await countRecentSingleJobs(user.id);
          setRecentSingleCount(count);
          setStep('payment');
        }
      } else {
        setStep('success');
      }
    } catch (err: any) {
      setOtpError(err.message || 'Invalid code. Please try again.');
      setOtpCode(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } finally { setOtpLoading(false); }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (otpResendTimer > 0) return;
    setOtpLoading(true);
    setOtpError('');
    try {
      // Re-upload images to get URLs (they were uploaded in step 1)
      const jobData = {
        title: formData.title,
        description: formData.description,
        location: formData.location,
        county: formData.county || undefined,
        subcounty: formData.subcounty || undefined,
        budget_min: parseInt(formData.budgetMin),
        budget_max: parseInt(formData.budgetMax),
        deadline: formData.deadline,
        category: formData.category,
        posted_by: user!.id,
        posted_by_name: user!.name,
        urgent: formData.urgent,
      };

      const { data: otpResult, error: otpError } = await supabase.functions.invoke('send-job-otp', {
        body: { user_id: user!.id, email: user!.email, job_data: jobData },
      });

      if (otpError) throw new Error(otpError.message || 'Failed to resend');
      if (otpResult?.error) throw new Error(otpResult.error);

      setOtpExpiry(new Date(otpResult.expires_at));
      setOtpResendTimer(60);
      setOtpCode(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } catch (err: any) {
      setOtpError(err.message || 'Failed to resend code');
    } finally { setOtpLoading(false); }
  };

  // Reset form
  const resetAll = () => {
    setFormData({ title: '', category: '', description: '', location: '', county: '', subcounty: '', budgetMin: '', budgetMax: '', deadline: '', urgent: false });
    setImageFiles([]);
    setImagePreviews([]);
    setOtpCode(['', '', '', '', '', '']);
    setServerError('');
    setOtpError('');
    setCreatedJobId('');
    setHasSubscription(false);
    setRecentSingleCount(0);
    setShowUpsell(false);
    setStep('form');
  };

  // Success screen
  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-lg">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle className="w-8 h-8 text-green-600" /></div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Job Posted Successfully!</h2>
          <p className="text-gray-500 mb-6">Your job is now live and visible to workers. You'll start receiving bids soon.</p>
          {hasSubscription && <p className="text-xs text-green-600 mb-4 font-medium">Your Employer Access subscription gives you full contact access for all bids.</p>}
          <div className="flex gap-3 justify-center">
            <button onClick={() => onNavigate('jobs')} className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors">View Jobs</button>
            <button onClick={resetAll} className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">Post Another</button>
          </div>
        </div>
      </div>
    );
  }

  // Payment prompt screen (after job created, non-subscriber)
  if (step === 'payment') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-lg w-full shadow-lg">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle className="w-8 h-8 text-blue-600" /></div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Job Posted!</h2>
            <p className="text-gray-500">Your job is live. Unlock bidder contacts with a one-time payment.</p>
          </div>

          {/* Single Job Post option */}
          <div className="border-2 border-blue-200 rounded-xl p-5 mb-4 bg-blue-50/50">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Post & Unlock This Job</h3>
                <p className="text-xs text-gray-500">One-time payment — no commitment</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-3">Pay KES 100 to unlock contact details (phone, email, WhatsApp) for all jobseekers who bid on this job.</p>
            <button
              onClick={() => {
                if (!onOpenMpesa || !user) return;
                onOpenMpesa(100, `Single Job Post — unlock contacts`, `SJP-${createdJobId.slice(0, 8)}`, 'single_job_post', undefined, createdJobId, undefined, () => {
                  setShowUpsell(recentSingleCount >= 1);
                  setStep('success');
                });
              }}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <Phone className="w-4 h-4" /> Pay KES 100 with M-Pesa
            </button>
          </div>

          {/* Subscription upsell */}
          <div className="border border-gray-200 rounded-xl p-5 mb-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                <Shield className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Employer Access</h3>
                <p className="text-xs text-gray-500">KES 200/week — best for repeat hiring</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-3">Post unlimited jobs & access all jobseeker contacts in your category. No per-contact fees.</p>
            <button
              onClick={() => {
                if (!onOpenMpesa || !user) return;
                onOpenMpesa(200, 'Employer Weekly Access', 'EMP-WK', 'registration', undefined, undefined, undefined, () => {
                  setHasSubscription(true);
                  setStep('success');
                });
              }}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <Phone className="w-4 h-4" /> Subscribe — KES 200/week
            </button>
          </div>

          {/* Skip option */}
          <button onClick={() => setStep('success')} className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors">
            Skip for now — I'll pay later
          </button>
        </div>
      </div>
    );
  }

  // OTP verification screen
  if (step === 'otp') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-gradient-to-r from-green-700 to-green-800 py-10">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <button onClick={() => setStep('form')} className="flex items-center gap-2 text-green-200 hover:text-white mb-4 transition-colors"><ArrowLeft className="w-4 h-4" /> Back to Form</button>
            <h1 className="text-2xl lg:text-3xl font-bold text-white">Verify Your Email</h1>
            <p className="text-green-100 mt-1">Enter the 6-digit code sent to {user?.email}</p>
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
              <span className="font-medium text-gray-700">{user?.email}</span>
            </p>

            {otpError && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{otpError}</div>}

            {/* OTP Input */}
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
              disabled={otpLoading || otpCode.join('').length !== 6}
              className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mb-4"
            >
              {otpLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Shield className="w-4 h-4" /> Verify & Post Job</>}
            </button>

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

  // Form screen
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-green-700 to-green-800 py-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <button onClick={() => onNavigate('jobs')} className="flex items-center gap-2 text-green-200 hover:text-white mb-4 transition-colors"><ArrowLeft className="w-4 h-4" /> Back to Jobs</button>
          <h1 className="text-2xl lg:text-3xl font-bold text-white">Post a New Job</h1>
          <p className="text-green-100 mt-1">Describe your job and let local workers bid on it</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl p-6 lg:p-8 border border-gray-100">
          {serverError && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{serverError}</div>}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Job Title *</label>
              <input type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} className={`w-full px-4 py-2.5 rounded-lg border ${errors.title ? 'border-red-400' : 'border-gray-300'} focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none`} placeholder="e.g. House Painting - 3 Bedroom Bungalow" />
              {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className={`w-full px-4 py-2.5 rounded-lg border ${errors.category ? 'border-red-400' : 'border-gray-300'} focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none`}>
                  <option value="">Select category</option>
                  {dbCats.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {errors.category && <p className="text-red-500 text-xs mt-1">{errors.category}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location *</label>
                <input type="text" value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} className={`w-full px-4 py-2.5 rounded-lg border ${errors.location ? 'border-red-400' : 'border-gray-300'} focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none`} placeholder="e.g. Regen, Near PCEA Baraka Church" />
                {errors.location && <p className="text-red-500 text-xs mt-1">{errors.location}</p>}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">County</label>
                <select value={formData.county} onChange={e => setFormData({ ...formData, county: e.target.value, subcounty: '' })} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none">
                  <option value="">Select county</option>
                  {KENYA_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subcounty</label>
                {formData.county && getSubcounties(formData.county).length > 0 ? (
                  <select value={formData.subcounty} onChange={e => setFormData({ ...formData, subcounty: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none">
                    <option value="">Select subcounty</option>
                    {getSubcounties(formData.county).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                ) : (
                  <input type="text" value={formData.subcounty} onChange={e => setFormData({ ...formData, subcounty: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none" placeholder="e.g. Kikuyu" />
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Job Description *</label>
              <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={5} className={`w-full px-4 py-2.5 rounded-lg border ${errors.description ? 'border-red-400' : 'border-gray-300'} focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none`} placeholder="Describe the job in detail..." />
              {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description}</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min Budget (KES) *</label>
                <input type="number" value={formData.budgetMin} onChange={e => setFormData({ ...formData, budgetMin: e.target.value })} className={`w-full px-4 py-2.5 rounded-lg border ${errors.budgetMin ? 'border-red-400' : 'border-gray-300'} focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none`} placeholder="5000" />
                {errors.budgetMin && <p className="text-red-500 text-xs mt-1">{errors.budgetMin}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Budget (KES) *</label>
                <input type="number" value={formData.budgetMax} onChange={e => setFormData({ ...formData, budgetMax: e.target.value })} className={`w-full px-4 py-2.5 rounded-lg border ${errors.budgetMax ? 'border-red-400' : 'border-gray-300'} focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none`} placeholder="15000" />
                {errors.budgetMax && <p className="text-red-500 text-xs mt-1">{errors.budgetMax}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deadline *</label>
                <input type="date" value={formData.deadline} onChange={e => setFormData({ ...formData, deadline: e.target.value })} className={`w-full px-4 py-2.5 rounded-lg border ${errors.deadline ? 'border-red-400' : 'border-gray-300'} focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none`} />
                {errors.deadline && <p className="text-red-500 text-xs mt-1">{errors.deadline}</p>}
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={formData.urgent} onChange={e => setFormData({ ...formData, urgent: e.target.checked })} className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500" />
              <span className="text-sm text-gray-700">Mark as urgent</span>
            </label>

            {/* Image Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Photos (optional, max {MAX_IMAGES})</label>
              <p className="text-xs text-gray-400 mb-3">Add images to help workers understand the job better</p>
              <div className="flex flex-wrap gap-3">
                {imagePreviews.map((src, idx) => (
                  <div key={idx} className="relative w-24 h-24 rounded-lg overflow-hidden border border-gray-200 group">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => removeImage(idx)} className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {imageFiles.length < MAX_IMAGES && (
                  <label className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 hover:border-green-400 flex flex-col items-center justify-center cursor-pointer transition-colors">
                    <Upload className="w-5 h-5 text-gray-400 mb-1" />
                    <span className="text-[10px] text-gray-400">Add Photo</span>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={e => addImages(e.target.files)} />
                  </label>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100">
              <button type="submit" disabled={loading} className="w-full sm:w-auto px-8 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Post Job'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PostJobPage;
