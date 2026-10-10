import React, { useState, useEffect } from 'react';
import { Search, X, Star, Loader2, Shield, Zap, ThumbsUp, ThumbsDown, Users } from 'lucide-react';
import { getProfiles, getCustomCategories } from '@/lib/database';
import { optimizeImageUrl, handleImageError } from '@/lib/supabase';
import { isPremiumOrFeatured } from '@/lib/utils';

interface TopRatedWorkersModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCategories?: string[];
  onSelectWorker: (worker: any) => void;
}

const workerSkills = (worker: any): string[] => {
  if (Array.isArray(worker.skills)) return worker.skills.map((s: string) => String(s).trim()).filter(Boolean);
  if (typeof worker.skills === 'string') return worker.skills.split(',').map((s: string) => s.trim()).filter(Boolean);
  return [];
};

const matchesCategory = (worker: any, categories: string[]): boolean => {
  if (categories.length === 0) return true;
  const skills = workerSkills(worker).map(s => s.toLowerCase());
  return categories.some(c => skills.some(s => s.includes(c.toLowerCase()) || c.toLowerCase().includes(s)));
};

const TopRatedWorkersModal: React.FC<TopRatedWorkersModalProps> = ({ isOpen, onClose, defaultCategories, onSelectWorker }) => {
  const [workers, setWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    getCustomCategories('job').then(cats => setCategories((prev: string[]) => [...new Set([...cats, ...prev])].sort()));
    getCustomCategories('service').then(cats => setCategories((prev: string[]) => [...new Set([...prev, ...cats])].sort()));
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setSelected((defaultCategories || []).filter(c => categories.includes(c)));
    let cancelled = false;
    setLoading(true);
    setWorkers([]);
    getProfiles({ role: 'jobseeker', ratings_enabled: true, limit: 100 })
      .then(results => { if (!cancelled) setWorkers(results || []); })
      .catch(() => { if (!cancelled) setWorkers([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isOpen, categories, defaultCategories]);

  const sorted = React.useMemo(() => {
    const list = [...workers];
    list.sort((a, b) => {
      const r = (Number(b.rating) || 0) - (Number(a.rating) || 0);
      if (r !== 0) return r;
      const l = (Number(b.likes_count) || 0) - (Number(a.likes_count) || 0);
      if (l !== 0) return l;
      return (Number(b.reviews_count) || 0) - (Number(a.reviews_count) || 0);
    });
    return list;
  }, [workers]);

  const filtered = React.useMemo(() => sorted.filter(w => matchesCategory(w, selected)), [sorted, selected]);

  const toggleCategory = (cat: string) => {
    setSelected(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 sm:pt-16 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Top Rated Workers</h2>
            <p className="text-xs text-gray-500">Highest rated, then most thumbs up</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-5 h-5 text-gray-500" /></button>
        </div>

        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <p className="text-xs font-medium text-gray-600">Filter by category</p>
            {selected.length > 0 && (
              <button onClick={() => setSelected([])} className="text-xs text-green-700 hover:text-green-800 font-medium">Show all workers</button>
            )}
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <button
              onClick={() => setSelected([])}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap flex-shrink-0 ${selected.length === 0 ? 'bg-green-600 border-green-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap flex-shrink-0 ${selected.includes(cat) ? 'bg-green-600 border-green-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                {selected.includes(cat) && <span className="mr-1">&#10003;</span>}
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-green-600" />
            </div>
          )}

          {!loading && sorted.length === 0 && (
            <div className="text-center py-12">
              <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No rated workers yet.</p>
            </div>
          )}

          {!loading && sorted.length > 0 && (
            <>
              <p className="text-xs text-gray-400 mb-2">{filtered.length} worker{filtered.length !== 1 ? 's' : ''}{selected.length > 0 ? ` in ${selected.length} selected categor${selected.length === 1 ? 'y' : 'ies'}` : ''}</p>
              {filtered.length === 0 && (
                <div className="text-center py-8">
                  <Search className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 mb-3">No workers in your selected categories.</p>
                  <button onClick={() => setSelected([])} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors">Show all workers</button>
                </div>
              )}
              <div className="space-y-2">
                {filtered.map(worker => {
                  const skills = workerSkills(worker);
                  const firstSkill = skills[0];
                  return (
                    <div key={worker.id} onClick={() => onSelectWorker(worker)} className="bg-white border border-gray-100 rounded-xl p-3 hover:border-green-200 hover:shadow-sm transition-all cursor-pointer">
                      <div className="flex items-start gap-3">
                        {worker.profile_image ? (
                          <img src={optimizeImageUrl(worker.profile_image, 96, 96)} alt={worker.full_name} className="w-12 h-12 rounded-full object-cover ring-2 ring-gray-100 flex-shrink-0" onError={handleImageError} />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center ring-2 ring-gray-100 flex-shrink-0">
                            <span className="text-lg font-bold text-green-700">{((firstSkill?.[0]) || 'W').toUpperCase()}</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-gray-900 text-sm truncate">{worker.full_name}</h4>
                            {isPremiumOrFeatured(worker) && <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded flex items-center gap-0.5 flex-shrink-0"><Zap className="w-2.5 h-2.5" />Featured</span>}
                            {worker.verified && <Shield className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />}
                          </div>
                          {skills.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {skills.slice(0, 3).map((skill: string, i: number) => (
                                <span key={i} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded">{skill}</span>
                              ))}
                              {skills.length > 3 && <span className="text-[10px] text-gray-400">+{skills.length - 3} more</span>}
                            </div>
                          )}
                          <div className="flex items-center gap-3 mt-1.5">
                            <div className="flex items-center gap-1">
                              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                              <span className="text-xs font-medium text-gray-700">{Number(worker.rating) || 0}</span>
                              <span className="text-[10px] text-gray-400">({worker.reviews_count || 0})</span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px]">
                              <span className="inline-flex items-center gap-0.5 text-green-600"><ThumbsUp className="w-3 h-3" /> {Number(worker.likes_count) || 0}</span>
                              <span className="inline-flex items-center gap-0.5 text-red-500"><ThumbsDown className="w-3 h-3" /> {Number(worker.dislikes_count) || 0}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TopRatedWorkersModal;