import React, { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle, Upload, Loader2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { LOCATIONS, PRICING_PLANS, KENYA_COUNTIES } from '@/data/siteData';
import { compressImage } from '@/lib/imageUtils';
import { createServiceAd, createPayment, getCustomCategories } from '@/lib/database';
import type { Page } from './Header';
import type { UserState } from '../AppLayout';

interface PostAdvertPageProps {
  onNavigate: (page: Page) => void;
  user: UserState | null;
  onOpenAuth: (tab: 'login' | 'signup') => void;
  onOpenMpesa: (amount: number, description: string, accountRef: string, paymentType?: string, relatedAdId?: string) => void;
}

const MAX_IMAGES = 3;

const PostAdvertPage: React.FC<PostAdvertPageProps> = ({ onNavigate, user, onOpenAuth, onOpenMpesa }) => {
  const [formData, setFormData] = useState({ businessName: '', category: '', description: '', location: '', county: '', subcounty: '', contact: '', plan: '' });
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const [dbCats, setDbCats] = useState<string[]>([]);

  useEffect(() => { getCustomCategories('service').then(setDbCats); }, []);

  const selectedPlan = PRICING_PLANS.advertPlans.find(p => p.name === formData.plan);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!formData.businessName.trim()) errs.businessName = 'Business name is required';
    if (!formData.category) errs.category = 'Select a category';
    if (!formData.description.trim()) errs.description = 'Description is required';
    if (!formData.location) errs.location = 'Select a location';
    if (!formData.contact.trim()) errs.contact = 'Contact is required';
    if (!formData.plan) errs.plan = 'Select a plan';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remaining = MAX_IMAGES - imageFiles.length;
    const toAdd = files.slice(0, remaining);
    
    for (const file of toAdd) {
      if (file.size > 5 * 1024 * 1024) {
        setServerError(`${file.name} exceeds 5MB limit`);
        return;
      }
    }

    setImageFiles(prev => [...prev, ...toAdd]);
    setImagePreviews(prev => [...prev, ...toAdd.map(f => URL.createObjectURL(f))]);
    setServerError('');
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(imagePreviews[index]);
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { onOpenAuth('login'); return; }
    if (!validate()) return;
    setLoading(true);
    setServerError('');
    try {
      const imageUrls: string[] = [];

      if (imageFiles.length > 0) {
        setUploadingImages(true);
        for (const file of imageFiles) {
          const compressed = await compressImage(file);
          const fileName = `img_${Date.now()}_${compressed.name.replace(/[^a-zA-Z0-9._-]/g, '')}`;
          
          const { error: uploadError } = await supabase.storage
            .from('adverts')
            .upload(fileName, compressed);
            
          if (uploadError) throw uploadError;
          
          const { data: publicUrlData } = supabase.storage
            .from('adverts')
            .getPublicUrl(fileName);
            
          imageUrls.push(publicUrlData.publicUrl);
        }
        setUploadingImages(false);
      }

      const planKey = formData.plan.includes('10') ? '10-day' : formData.plan.includes('20') ? '20-day' : '30-day';
      const ad = await createServiceAd({
        business_name: formData.businessName,
        description: formData.description,
        category: formData.category,
        image: imageUrls[0] || undefined,
        images: imageUrls.length > 0 ? imageUrls : undefined,
        location: formData.location,
        county: formData.county || undefined,
        subcounty: formData.subcounty || undefined,
        contact: formData.contact,
        plan: planKey as '10-day' | '20-day' | '30-day',
        owner_id: user.id,
      });
      if (selectedPlan) {
        await createPayment({
          user_id: user.id,
          payment_type: 'advert',
          amount: selectedPlan.price,
          description: `${selectedPlan.name} - ${formData.businessName}`,
          related_ad_id: ad.id,
        });
        onOpenMpesa(selectedPlan.price, `${selectedPlan.name} - ${formData.businessName}`, `ADV-${ad.id.slice(0, 8)}`, 'advert', ad.id);
      }
      setSubmitted(true);
    } catch (err: any) {
      setServerError(err.message || 'Failed to post advert. Please try again.');
      setUploadingImages(false);
    } finally { setLoading(false); }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-lg">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle className="w-8 h-8 text-green-600" /></div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Advert Submitted!</h2>
          <p className="text-gray-500 mb-6">Your business advert will be live once payment is confirmed.</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => onNavigate('services')} className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors">View Services</button>
            <button onClick={() => { setSubmitted(false); setFormData({ businessName: '', category: '', description: '', location: '', county: '', subcounty: '', contact: '', plan: '' }); }} className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">Post Another</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-green-700 to-green-800 py-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <button onClick={() => onNavigate('services')} className="flex items-center gap-2 text-green-200 hover:text-white mb-4 transition-colors"><ArrowLeft className="w-4 h-4" /> Back to Services</button>
          <h1 className="text-2xl lg:text-3xl font-bold text-white">Advertise Your Business</h1>
          <p className="text-green-100 mt-1">Reach the local community with your products and services</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl p-6 lg:p-8 border border-gray-100">
          {serverError && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{serverError}</div>}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Business Name *</label>
              <input type="text" value={formData.businessName} onChange={e => setFormData({ ...formData, businessName: e.target.value })} className={`w-full px-4 py-2.5 rounded-lg border ${errors.businessName ? 'border-red-400' : 'border-gray-300'} focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none`} placeholder="e.g. Kamau Hardware & Building Supplies" />
              {errors.businessName && <p className="text-red-500 text-xs mt-1">{errors.businessName}</p>}
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
                <input type="text" value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} className={`w-full px-4 py-2.5 rounded-lg border ${errors.location ? 'border-red-400' : 'border-gray-300'} focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none`} placeholder="e.g. Near Catholic Church or LandMark" />
                {errors.location && <p className="text-red-500 text-xs mt-1">{errors.location}</p>}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Business Description *</label>
              <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={4} className={`w-full px-4 py-2.5 rounded-lg border ${errors.description ? 'border-red-400' : 'border-gray-300'} focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none`} placeholder="Describe your business, products, and services..." />
              {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number *</label>
              <input type="tel" value={formData.contact} onChange={e => setFormData({ ...formData, contact: e.target.value })} className={`w-full px-4 py-2.5 rounded-lg border ${errors.contact ? 'border-red-400' : 'border-gray-300'} focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none`} placeholder="+254 7XX XXX XXX" />
              {errors.contact && <p className="text-red-500 text-xs mt-1">{errors.contact}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Business Images (max {MAX_IMAGES})</label>
              <div className="grid grid-cols-3 gap-3">
                {imagePreviews.map((preview, i) => (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 group">
                    <img src={preview} alt="" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => removeImage(i)} className="absolute top-1 right-1 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {imagePreviews.length < MAX_IMAGES && (
                  <div className="relative border-2 border-dashed border-gray-300 rounded-lg aspect-square hover:border-green-400 transition-colors cursor-pointer overflow-hidden">
                    <input type="file" accept="image/png, image/jpeg" onChange={handleImageChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    <div className="flex flex-col items-center justify-center h-full p-2">
                      <Upload className="w-6 h-6 text-gray-400 mb-1" />
                      <p className="text-[10px] text-gray-500 text-center leading-tight">Add Photo</p>
                    </div>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1">PNG, JPG up to 5MB each</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Select Advertising Plan *</label>
              {errors.plan && <p className="text-red-500 text-xs mb-2">{errors.plan}</p>}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {PRICING_PLANS.advertPlans.map((plan, i) => (
                  <button key={i} type="button" onClick={() => setFormData({ ...formData, plan: plan.name })} className={`p-4 rounded-xl border-2 text-left transition-all ${formData.plan === plan.name ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <p className="font-semibold text-gray-900">{plan.name}</p>
                    <p className="text-xs text-gray-500">{plan.duration}</p>
                    <p className="text-lg font-bold text-green-700 mt-2">KES {plan.price}</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
              <div>{selectedPlan && <p className="text-sm text-gray-500">Total: <span className="font-bold text-green-700 text-lg">KES {selectedPlan.price}</span></p>}</div>
              <button type="submit" disabled={loading} className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : uploadingImages ? 'Uploading Images...' : 'Submit & Pay via M-Pesa'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PostAdvertPage;
