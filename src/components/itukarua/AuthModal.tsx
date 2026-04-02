import React, { useState } from 'react';
import { X, Eye, EyeOff, MapPin, User, Briefcase, Shield } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'login' | 'signup';
  onAuth: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, initialTab = 'login', onAuth }) => {
  const [tab, setTab] = useState<'login' | 'signup'>(initialTab);
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<'jobseeker' | 'employer' | 'admin'>('employer');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    location: '',
    skills: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');

  if (!isOpen) return null;

  const validate = () => {
    const errs: Record<string, string> = {};
    if (tab === 'signup' && !formData.name.trim()) errs.name = 'Name is required';
    if (!formData.email.trim()) errs.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) errs.email = 'Invalid email';
    if (!formData.password || formData.password.length < 6) errs.password = 'Min 6 characters';
    if (tab === 'signup' && !formData.phone.trim()) errs.phone = 'Phone is required';
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
        const { data, error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              full_name: formData.name,
              role: role,
              phone: formData.phone,
              location: formData.location,
              skills: formData.skills ? formData.skills.split(',').map(s => s.trim()) : [],
            },
          },
        });
        if (error) throw error;

        // Update profile with extra fields after signup
        if (data.user) {
          await supabase.from('profiles').update({
            phone: formData.phone,
            location: formData.location,
            skills: formData.skills ? formData.skills.split(',').map(s => s.trim()) : [],
          }).eq('id', data.user.id);
        }

        onAuth();
        onClose();
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });
        if (error) throw error;
        onAuth();
        onClose();
      }
    } catch (err: any) {
      setServerError(err.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const roles = [
    { key: 'employer', label: 'Employer / Advertiser', icon: Briefcase, desc: 'Post jobs & adverts' },
    { key: 'jobseeker', label: 'Jobseeker', icon: User, desc: 'Find work & bid' },
    { key: 'admin', label: 'Admin', icon: Shield, desc: 'Manage platform' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
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
            onClick={() => { setTab('login'); setServerError(''); }}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${tab === 'login' ? 'text-green-700 border-b-2 border-green-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setTab('signup'); setServerError(''); }}
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

          {tab === 'signup' && (
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Skills (comma separated)</label>
                <input
                  type="text"
                  value={formData.skills}
                  onChange={e => setFormData({ ...formData, skills: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  placeholder="e.g. Painting, Plumbing, Carpentry"
                />
              </div>
            </>
          )}

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

          {tab === 'signup' && role === 'jobseeker' && (
            <p className="text-xs text-center text-gray-500">
              Jobseeker registration requires a one-time M-Pesa payment of <span className="font-semibold text-green-700">KES 500</span> to activate your profile.
            </p>
          )}
        </form>
      </div>
    </div>
  );
};

export default AuthModal;
