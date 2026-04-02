import React, { useState } from 'react';
import { ArrowLeft, CheckCircle, Loader2 } from 'lucide-react';
import { JOB_CATEGORIES, LOCATIONS } from '@/data/siteData';
import { createJob } from '@/lib/database';
import type { Page } from './Header';
import type { UserState } from '../AppLayout';

interface PostJobPageProps {
  onNavigate: (page: Page) => void;
  user: UserState | null;
  onOpenAuth: (tab: 'login' | 'signup') => void;
}

const PostJobPage: React.FC<PostJobPageProps> = ({ onNavigate, user, onOpenAuth }) => {
  const [formData, setFormData] = useState({ title: '', category: '', description: '', location: '', budgetMin: '', budgetMax: '', deadline: '', urgent: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { onOpenAuth('login'); return; }
    if (!validate()) return;
    setLoading(true);
    setServerError('');
    try {
      await createJob({
        title: formData.title,
        description: formData.description,
        location: formData.location,
        budget_min: parseInt(formData.budgetMin),
        budget_max: parseInt(formData.budgetMax),
        deadline: formData.deadline,
        category: formData.category,
        posted_by: user.id,
        posted_by_name: user.name,
        urgent: formData.urgent,
      });
      setSubmitted(true);
    } catch (err: any) {
      setServerError(err.message || 'Failed to post job. Please try again.');
    } finally { setLoading(false); }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-lg">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle className="w-8 h-8 text-green-600" /></div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Job Posted Successfully!</h2>
          <p className="text-gray-500 mb-6">Your job is now live and visible to workers. You'll start receiving bids soon.</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => onNavigate('jobs')} className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors">View Jobs</button>
            <button onClick={() => { setSubmitted(false); setFormData({ title: '', category: '', description: '', location: '', budgetMin: '', budgetMax: '', deadline: '', urgent: false }); }} className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">Post Another</button>
          </div>
        </div>
      </div>
    );
  }

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
                  {JOB_CATEGORIES.filter(c => c !== 'All Categories').map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {errors.category && <p className="text-red-500 text-xs mt-1">{errors.category}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location *</label>
                <select value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} className={`w-full px-4 py-2.5 rounded-lg border ${errors.location ? 'border-red-400' : 'border-gray-300'} focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none`}>
                  <option value="">Select location</option>
                  {LOCATIONS.filter(l => l !== 'All Locations').map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                {errors.location && <p className="text-red-500 text-xs mt-1">{errors.location}</p>}
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
