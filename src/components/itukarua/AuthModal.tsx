import React, { useState, useRef, useCallback, useEffect } from 'react';
import { X, Eye, EyeOff, MapPin, User, Briefcase, Megaphone, Camera, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { KENYA_COUNTIES } from '@/data/siteData';
import { compressImage } from '@/lib/imageUtils';
import { subscribeNewsletter, updateProfile, getCustomCategories } from '@/lib/database';
import { TERMS_AND_CONDITIONS, PRIVACY_POLICY } from '@/data/termsContent';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'login' | 'signup';
  onAuth: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, initialTab = 'login', onAuth }) => {
  const [tab, setTab] = useState<'login' | 'signup'>(initialTab);
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<'advertiser' | 'employer' | 'jobseeker'>('employer');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    location: '',
    county: '',
    subcounty: '',
    skills: '',
    resume: '',
  });
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [dbJobCategories, setDbJobCategories] = useState<string[]>([]);
  const [certFiles, setCertFiles] = useState<FileList | null>(null);
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState('');
  const [subscribeToNewsletter, setSubscribeToNewsletter] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [termsScrolledToBottom, setTermsScrolledToBottom] = useState(false);
  const [privacyScrolledToBottom, setPrivacyScrolledToBottom] = useState(false);
  const termsScrollRef = useRef<HTMLDivElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    if (isOpen) getCustomCategories('job').then(setDbJobCategories);
  }, [isOpen]);

  if (!isOpen) return null;

  const validate = () => {
    const errs: Record<string, string> = {};
    if (tab === 'signup' && !formData.name.trim()) errs.name = 'Name is required';
    if (!formData.email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errs.email = 'Invalid email';
    if (!formData.password || formData.password.length < 6) errs.password = 'Min 6 characters';
    if (tab === 'signup' && !formData.phone.trim()) errs.phone = 'Phone is required';
    if (tab === 'signup' && (role === 'jobseeker' || role === 'employer') && selectedCategories.length === 0) errs.categories = 'Select at least one category of interest';
    if (tab === 'signup' && !termsAccepted) errs.terms = 'You must accept the Terms & Conditions';
    if (tab === 'signup' && !privacyAccepted) errs.privacy = 'You must accept the Privacy Policy';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setServerError('');

    try {
      if (tab === 'signup') {
        // Set the auth-complete flag BEFORE the async call so the SIGNED_IN
        // listener in AppLayout sees it when the event fires.
        onAuth();
        const signupPromise = supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
data: {
  full_name: formData.name,
  role: role,
  phone: formData.phone,
  location: formData.location,
  county: formData.county,
  subcounty: formData.subcounty,
  skills: formData.skills ? formData.skills.split(',').map(s => s.trim()) : [],
  selected_categories: (role === 'jobseeker' || role === 'employer') ? selectedCategories : [],
},
          },
        });
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('AUTH_TIMEOUT')), 15000));
        
        const { data, error } = await Promise.race([signupPromise, timeoutPromise]) as any;
        if (error) throw error;

        if (data.user) {
          // If email confirmation is disabled, signUp returns an active session
          // immediately. Persist the profile + chosen role straight to the DB.
          const hasSession = !!data.session;
          if (hasSession) {
            const profileUpsert = supabase.from('profiles').upsert({
              id: data.user.id,
              full_name: formData.name,
              email: formData.email,
              phone: formData.phone,
              role,
              location: formData.location || null,
              county: formData.county || null,
              subcounty: formData.subcounty || null,
              skills: formData.skills ? formData.skills.split(',').map(s => s.trim()) : [],
              resume: formData.resume || null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }, { onConflict: 'id' });
            const timeoutProfile = new Promise((_, reject) => setTimeout(() => reject(new Error('PROFILE_TIMEOUT')), 15000));
            const { error: profileError } = await Promise.race([profileUpsert, timeoutProfile]) as any;
            if (profileError && profileError.message !== 'PROFILE_TIMEOUT') {
              console.error('[Signup] profile upsert failed:', profileError);
            }
          }

          // Upload profile photo
          let profileImageUrl = '';
          if (profilePhotoFile) {
            const compressed = await compressImage(profilePhotoFile);
            const fileName = `${data.user.id}/avatar.${compressed.name.split('.').pop() || 'jpg'}`;
            const { error: photoError } = await supabase.storage.from('adverts').upload(fileName, compressed, { upsert: true });
            if (!photoError) {
              profileImageUrl = supabase.storage.from('adverts').getPublicUrl(fileName).data.publicUrl;
            }
          }

          // Persist profile image to profiles table so it survives page refresh
          if (profileImageUrl) {
            updateProfile(data.user.id, { profile_image: profileImageUrl }).catch(() => {});
          }

          // Upload certificates if jobseeker
          if (certFiles && certFiles.length > 0 && role === 'jobseeker') {
            const certUrls: string[] = [];
            const filesToUpload = Array.from(certFiles).slice(0, 3);
            for (const file of filesToUpload) {
              const compressed = file.type.startsWith('image/') ? await compressImage(file) : file;
              const ext = compressed.name.split('.').pop() || (file.type.startsWith('image/') ? 'jpg' : file.name.split('.').pop());
              const fileName = `${data.user.id}/certs/${Date.now()}_${crypto.randomUUID()}.${ext}`;
              const { error: certError } = await supabase.storage.from('adverts').upload(fileName, compressed);
              if (!certError) {
                const publicUrl = supabase.storage.from('adverts').getPublicUrl(fileName).data.publicUrl;
                certUrls.push(publicUrl);
              }
            }
            // Update user metadata with cert URLs
            if (certUrls.length > 0 || profileImageUrl) {
              await supabase.auth.updateUser({
                data: { 
                  ...(certUrls.length > 0 ? { certificates: certUrls } : {}),
                  ...(profileImageUrl ? { profile_image: profileImageUrl } : {}),
                }
              });
            }
          }
          
          if (subscribeToNewsletter) {
            await subscribeNewsletter(formData.email, formData.name.trim());
          }
          setServerError('');

          if (hasSession) {
            // No email confirmation required — account is live now
            onClose();
          } else {
            setEmailSent(true);
          }
        }
      } else {
        onAuth();
        const signinPromise = supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('AUTH_TIMEOUT')), 15000));
        
        const { error } = await Promise.race([signinPromise, timeoutPromise]) as any;
        if (error) throw error;
        
        setLoginAttempts(0);
        onClose();
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      if (err.message === 'AUTH_TIMEOUT' || err.code === 'timeout' || err.name === 'TimeoutError') {
        setServerError('The request took too long. Please try again.');
      } else if (err.message?.includes('rate limit') || err.status === 429) {
        setServerError('Too many signup attempts. Please wait a few minutes and try again.');
      } else if (err.message?.includes('Email rate limit')) {
        setServerError('Confirmation email already sent. Check your inbox or spam folder.');
      } else {
        setServerError(err.message || 'An error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const roles = [
    { key: 'advertiser', label: 'Advertiser', icon: Megaphone, desc: 'Create banner adverts' },
    { key: 'employer', label: 'Employer', icon: Briefcase, desc: 'Post jobs & hire' },
    { key: 'jobseeker', label: 'Jobseeker', icon: User, desc: 'Find work & bid' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">
            {tab === 'login' ? 'Welcome Back' : 'Create Account'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex border-b border-gray-100">
          <button
            onClick={() => { setTab('login'); setServerError(''); setTermsAccepted(false); setSelectedCategories([]); }}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${tab === 'login' ? 'text-green-700 border-b-2 border-green-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setTab('signup'); setServerError(''); setTermsAccepted(false); }}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${tab === 'signup' ? 'text-green-700 border-b-2 border-green-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {serverError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {serverError}
            </div>
          )}

          {emailSent && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="font-semibold text-green-800 mb-1">Check Your Email!</h3>
              <p className="text-sm text-green-700 mb-3">
                We've sent a confirmation link to <span className="font-medium">{formData.email}</span>
              </p>
              <p className="text-xs text-green-600">
                Click the link in your email to activate your account and complete your registration.
              </p>
              <button
                type="button"
                onClick={() => { setEmailSent(false); setTab('login'); setServerError(''); setFormData({ name: '', email: '', phone: '', password: '', location: '',
county: '', subcounty: '', skills: '', resume: '' }); setSelectedCategories([]); setCertFiles(null); setSubscribeToNewsletter(false); setTermsAccepted(false); setPrivacyAccepted(false); setTermsScrolledToBottom(false); setPrivacyScrolledToBottom(false); }}
                className="mt-4 text-sm text-green-700 hover:text-green-800 font-medium underline"
              >
                Back to Sign In
              </button>
            </div>
          )}

          {!emailSent && tab === 'signup' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">I am a...</label>
                <div className="grid grid-cols-3 gap-2">
                  {roles.map(r => (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => setRole(r.key as any)}
                      className={`p-3 rounded-xl border-2 text-center transition-all ${role === r.key ? 'border-green-600 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}
                    >
                      <r.icon className={`w-5 h-5 mx-auto mb-1 ${role === r.key ? 'text-green-600' : 'text-gray-400'}`} />
                      <div className={`text-xs font-semibold ${role === r.key ? 'text-green-700' : 'text-gray-600'}`}>{r.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full px-4 py-2.5 rounded-lg border ${errors.name ? 'border-red-400' : 'border-gray-300'} focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none`}
                  placeholder="John Kamau"
                />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  className={`w-full px-4 py-2.5 rounded-lg border ${errors.phone ? 'border-red-400' : 'border-gray-300'} focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none`}
                  placeholder="+254 7XX XXX XXX"
                />
                {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <input
              type="email"
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              className={`w-full px-4 py-2.5 rounded-lg border ${errors.email ? 'border-red-400' : 'border-gray-300'} focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none`}
              placeholder="you@example.com"
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                className={`w-full px-4 py-2.5 rounded-lg border ${errors.password ? 'border-red-400' : 'border-gray-300'} focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none pr-10`}
                placeholder="Min 6 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
          </div>

          {tab === 'signup' && role === 'jobseeker' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={formData.location}
                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    placeholder="e.g. Itukarua Town"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">County</label>
                <select value={formData.county} onChange={e => setFormData({ ...formData, county: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none">
                  <option value="">Select county</option>
                  {KENYA_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subcounty</label>
                <input type="text" value={formData.subcounty} onChange={e => setFormData({ ...formData, subcounty: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none" placeholder="e.g. Kikuyu" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Skills (comma separated)</label>
                <input
                  type="text"
                  value={formData.skills}
                  onChange={e => setFormData({ ...formData, skills: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  placeholder="e.g. Painting, Plumbing, Carpentry"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Professional Resume (Max 500 words)
                </label>
                <textarea
                  value={formData.resume}
                  onChange={e => {
                    const words = e.target.value.trim().split(/\s+/).length;
                    if (words <= 500 || e.target.value.length < formData.resume.length) {
                      setFormData({ ...formData, resume: e.target.value });
                    }
                  }}
                  rows={4}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none text-sm"
                  placeholder="Paste your resume here..."
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  {formData.resume.trim() ? formData.resume.trim().split(/\s+/).length : 0} / 500 words
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Profile Photo</label>
                <div className="flex items-center gap-3">
                  {profilePhotoFile ? (
                    <img src={URL.createObjectURL(profilePhotoFile)} alt="Preview" className="w-14 h-14 rounded-full object-cover border-2 border-green-200" />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center">
                      <Camera className="w-5 h-5 text-gray-400" />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => {
                      if (e.target.files?.[0]) setProfilePhotoFile(e.target.files[0]);
                    }}
                    className="flex-1 text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Certificates (Max 3, PDF or Image)
                </label>
                <input
                  type="file"
                  multiple
                  accept=".pdf,image/*"
                  onChange={e => setCertFiles(e.target.files)}
                  className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                />
                {certFiles && (
                  <p className="text-[10px] text-green-600 mt-1">
                    {certFiles.length} file(s) selected (max 3 will be uploaded)
                  </p>
                )}
              </div>
            </>
          )}

          {tab === 'signup' && (role === 'jobseeker' || role === 'employer') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Categories of Interest <span className="text-gray-400 text-xs">(select at least one)</span>
              </label>
              <p className="text-xs text-gray-500 mb-2">
                {role === 'jobseeker'
                  ? 'Choose the job categories you\'re interested in. We\'ll show matching jobs on your dashboard.'
                  : 'Choose the job categories you\'re hiring for. We\'ll help you find the right talent.'}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {dbJobCategories.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])}
                    className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all ${selectedCategories.includes(cat) ? 'border-green-500 bg-green-50 text-green-700 ring-1 ring-green-200' : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'}`}
                  >
                    {selectedCategories.includes(cat) && <span className="mr-1">&#10003;</span>}
                    {cat}
                  </button>
                ))}
              </div>
              {selectedCategories.length > 0 && (
                <p className="text-[10px] text-green-600 mt-1.5">{selectedCategories.length} {selectedCategories.length === 1 ? 'category' : 'categories'} selected</p>
              )}
              {errors.categories && <p className="text-red-500 text-xs mt-1">{errors.categories}</p>}
            </div>
          )}

          {tab === 'signup' && !emailSent && (
            <div className="flex items-start gap-2">
              <input type="checkbox" id="newsletter" checked={subscribeToNewsletter} onChange={e => setSubscribeToNewsletter(e.target.checked)} className="w-4 h-4 mt-0.5 rounded border-gray-300 text-green-600 focus:ring-green-500" />
              <label htmlFor="newsletter" className="text-xs text-gray-600">Subscribe to our newsletter for the latest jobs, services, and community updates</label>
            </div>
          )}

          {tab === 'signup' && !emailSent && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Legal Documents *</label>
              <div
                ref={termsScrollRef}
                onScroll={() => {
                  const el = termsScrollRef.current;
                  if (!el) return;
                  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 20;
                  if (atBottom) {
                    if (!termsScrolledToBottom) setTermsScrolledToBottom(true);
                    if (!privacyScrolledToBottom) setPrivacyScrolledToBottom(true);
                  }
                }}
                className="h-48 overflow-y-auto border border-gray-200 rounded-lg p-3 text-[11px] leading-relaxed text-gray-600 bg-gray-50 mb-3"
              >
                <pre className="whitespace-pre-wrap font-sans">{TERMS_AND_CONDITIONS}</pre>
                <div className="border-t border-gray-200 my-4" />
                <pre className="whitespace-pre-wrap font-sans">{PRIVACY_POLICY}</pre>
              </div>

              {/* Terms checkbox */}
              <div className="flex items-start gap-2 mb-2">
                <div className={`relative ${!termsScrolledToBottom && !termsAccepted ? 'opacity-50 pointer-events-none' : ''}`}>
                  <input
                    type="checkbox"
                    id="terms"
                    checked={termsAccepted}
                    disabled={!termsScrolledToBottom && !termsAccepted}
                    onChange={e => { if (termsScrolledToBottom || e.target.checked === false) setTermsAccepted(e.target.checked); }}
                    className="w-4 h-4 mt-0.5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                </div>
                <label htmlFor="terms" className="text-xs text-gray-600">
                  {termsScrolledToBottom ? (
                    <>I have read and agree to the <strong>Terms & Conditions</strong></>
                  ) : (
                    <span className="text-gray-400">Scroll through the documents to accept</span>
                  )}
                </label>
              </div>
              {errors.terms && <p className="text-red-500 text-xs mb-2 ml-6">{errors.terms}</p>}

              {/* Privacy checkbox */}
              <div className="flex items-start gap-2 mb-1">
                <div className={`relative ${!privacyScrolledToBottom && !privacyAccepted ? 'opacity-50 pointer-events-none' : ''}`}>
                  <input
                    type="checkbox"
                    id="privacy"
                    checked={privacyAccepted}
                    disabled={!privacyScrolledToBottom && !privacyAccepted}
                    onChange={e => { if (privacyScrolledToBottom || e.target.checked === false) setPrivacyAccepted(e.target.checked); }}
                    className="w-4 h-4 mt-0.5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                </div>
                <label htmlFor="privacy" className="text-xs text-gray-600">
                  {privacyScrolledToBottom ? (
                    <>I have read and agree to the <strong>Privacy Policy</strong></>
                  ) : (
                    <span className="text-gray-400">Scroll through the documents to accept</span>
                  )}
                </label>
              </div>
              {errors.privacy && <p className="text-red-500 text-xs mb-1 ml-6">{errors.privacy}</p>}

              {!termsScrolledToBottom && !termsAccepted && (
                <p className="text-[10px] text-amber-600 mt-1 ml-6 flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
                  Scroll to the bottom to accept both
                </p>
              )}
            </div>
          )}
          {!emailSent && (
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                tab === 'login' ? 'Sign In' : 'Create Account'
              )}
            </button>
          )}

          {!emailSent && tab === 'signup' && role === 'jobseeker' && (
            <p className="text-xs text-center text-gray-500">
              Jobseeker membership is <span className="font-semibold text-green-700">KES 100/mo</span> — a 30-day subscription. Pay now to start bidding on jobs and connecting with employers.
            </p>
          )}
        </form>
      </div>
    </div>
  );
};

export default AuthModal;

