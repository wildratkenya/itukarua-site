import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Star, MapPin, Lock, Phone, Mail, Award, FileText, Loader2, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { getProfiles, getCustomCategories } from '@/lib/database';
import { supabase, optimizeImageUrl, handleImageError } from '@/lib/supabase';
import { JOB_CATEGORIES, SERVICE_CATEGORIES, KENYA_COUNTIES } from '@/data/siteData';
import MpesaModal from './MpesaModal';

interface WorkerSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const WorkerSearchModal: React.FC<WorkerSearchModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [selectedCounty, setSelectedCounty] = useState('');
  const [location, setLocation] = useState('');
  const [selectedSkill, setSelectedSkill] = useState('');
  const [workers, setWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentWorker, setPaymentWorker] = useState<any>(null);
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());
  const [workerDetails, setWorkerDetails] = useState<Map<string, any>>(new Map());
  const [allSkills, setAllSkills] = useState<string[]>([]);
  const [expandedCv, setExpandedCv] = useState<Set<string>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  useEffect(() => {
    Promise.all([
      getCustomCategories('job'),
      getCustomCategories('service'),
    ]).then(([jobCats, serviceCats]) => {
      const predefined = [
        ...JOB_CATEGORIES.filter(c => c !== 'All Categories'),
        ...SERVICE_CATEGORIES.filter(c => c !== 'All Services'),
      ];
      const all = [...new Set([...predefined, ...jobCats, ...serviceCats])].sort();
      setAllSkills(all);
    });
  }, []);

  useEffect(() => {
    console.log('[WorkerSearch] isOpen changed to', isOpen);
    if (!isOpen) {
      setQuery('');
      setSelectedCounty('');
      setLocation('');
      setSelectedSkill('');
      setWorkers([]);
      setShowPaymentModal(false);
      setPaymentWorker(null);
      return;
    }
    fetchWorkers();
    setTimeout(() => searchRef.current?.focus(), 100);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const delay = setTimeout(() => fetchWorkers(), 300);
    return () => clearTimeout(delay);
  }, [query, selectedCounty, selectedSkill, location, isOpen]);

  const fetchWorkers = async () => {
    setLoading(true);
    try {
      const searchQuery = selectedSkill ? [...query.split(/\s+/).filter(Boolean), selectedSkill].join(' ') : query;
      console.log('[WorkerSearch] fetchWorkers called', { selectedSkill, query, searchQuery, selectedCounty, location: location.trim() });
      const results = await getProfiles({
        role: 'jobseeker',
        county: selectedCounty || undefined,
        location: location.trim() || undefined,
        search: searchQuery.trim() || undefined,
        limit: 30,
      });
      console.log('[WorkerSearch] getProfiles returned', results?.length, 'results');
      setWorkers(results || []);
    } catch (err) {
      console.error('[WorkerSearch] Error fetching workers:', err);
      setWorkers([]);
    } finally {
      setLoading(false);
    }
  };

  const [unlockMsg, setUnlockMsg] = useState('');

  const handleUnlock = (worker: any) => {
    if (!user) { setUnlockMsg('Please sign in first'); setTimeout(() => setUnlockMsg(''), 2500); return; }
    setUnlockMsg('');
    setPaymentWorker(worker);
    setShowPaymentModal(true);
  };

  const handlePaymentComplete = async () => {
    if (!paymentWorker) { console.warn('[WorkerSearch] handlePaymentComplete: no paymentWorker'); return; }
    console.log('[WorkerSearch] Fetching full profile after payment for', paymentWorker.id);
    const { data, error } = await supabase.from('profiles').select('*').eq('id', paymentWorker.id).single();
    if (error) {
      console.error('[WorkerSearch] Profile fetch error:', error);
      return;
    }
    console.log('[WorkerSearch] Profile fetched:', { id: data.id, hasResume: !!data.resume, resumeLength: data.resume?.length, hasCertificates: !!data.certificates });
    if (data) {
      setUnlockedIds(prev => new Set(prev).add(paymentWorker.id));
      setWorkerDetails(prev => new Map(prev).set(paymentWorker.id, data));
    }
    setShowPaymentModal(false);
    setPaymentWorker(null);
  };

  const getInitial = (worker: any) => {
    const s = typeof worker.skills === 'string' ? worker.skills.split(',')[0]?.trim() : worker.skills?.[0];
    return ((s && s[0]) || 'W').toUpperCase();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 sm:pt-20 bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900">Find a Worker</h2>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-5 h-5 text-gray-500" /></button>
          </div>

          <div className="p-4 border-b border-gray-100 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search by name or skill..."
                className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none"
              />
            </div>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="Town, area or estate..."
                className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={selectedCounty}
                onChange={e => setSelectedCounty(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none bg-white"
              >
                <option value="">All Counties</option>
                {KENYA_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select
                value={selectedSkill}
                onChange={e => setSelectedSkill(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none bg-white"
              >
                <option value="">All Skills</option>
                {allSkills.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-green-600" />
              </div>
            )}

            {!loading && workers.length === 0 && (
              <div className="text-center py-12">
                <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">No workers found. Try adjusting your filters.</p>
              </div>
            )}

            {!loading && workers.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-400 mb-2">{workers.length} worker{workers.length !== 1 ? 's' : ''} found</p>
                {workers.map(worker => {
                  const isUnlocked = unlockedIds.has(worker.id);
                  const details = workerDetails.get(worker.id);
                  const skills = typeof worker.skills === 'string' ? worker.skills.split(',').map((s: string) => s.trim()).filter(Boolean) : Array.isArray(worker.skills) ? worker.skills : [];
                  return (
                    <div key={worker.id} className="bg-white border border-gray-100 rounded-xl p-3 hover:border-gray-200 transition-colors">
                      <div className="flex items-start gap-3">
                        {worker.profile_image ? (
                          <img src={optimizeImageUrl(worker.profile_image, 96, 96)} alt={worker.full_name} className="w-12 h-12 rounded-full object-cover ring-2 ring-gray-100 flex-shrink-0" onError={handleImageError} />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center ring-2 ring-gray-100 flex-shrink-0">
                            <span className="text-lg font-bold text-green-700">{getInitial(worker)}</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-gray-900 text-sm truncate">{worker.full_name}</h4>
                            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-medium rounded">Jobseeker</span>
                            {worker.verified && <Shield className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {skills.slice(0, 3).map((skill: string, i: number) => (
                              <span key={i} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded">{skill}</span>
                            ))}
                            {skills.length > 3 && <span className="text-[10px] text-gray-400">+{skills.length - 3} more</span>}
                          </div>
                          <div className="flex items-center gap-3 mt-1.5">
                            <div className="flex items-center gap-1">
                              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                              <span className="text-xs font-medium text-gray-700">{Number(worker.rating) || 0}</span>
                            </div>
                            {worker.location && (
                              <div className="flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-gray-400" />
                                <span className="text-xs text-gray-400">{worker.county || worker.location}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        {!isUnlocked ? (
                          <div className="flex flex-col items-end gap-1">
                            <button
                              onClick={() => handleUnlock(worker)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors flex-shrink-0"
                            >
                              <Lock className="w-3 h-3" />
                              KES 50
                            </button>
                            {unlockMsg && <p className="text-[10px] text-red-500 whitespace-nowrap">{unlockMsg}</p>}
                          </div>
                        ) : null}
                      </div>

                      {isUnlocked && details && (
                        <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            {details.phone && <p className="flex items-center gap-1.5 text-gray-700"><Phone className="w-3.5 h-3.5 text-green-600" /> {details.phone}</p>}
                            {details.email && <p className="flex items-center gap-1.5 text-gray-700"><Mail className="w-3.5 h-3.5 text-green-600" /> {details.email}</p>}
                            {details.location && <p className="flex items-center gap-1.5 text-gray-700 col-span-2"><MapPin className="w-3.5 h-3.5 text-green-600" /> {details.county ? `${details.county}${details.subcounty ? `, ${details.subcounty}` : ''} - ${details.location}` : details.location}</p>}
                          </div>
                          {details.certificates && details.certificates.length > 0 && (
                            <div>
                              <h5 className="text-xs font-semibold text-gray-700 flex items-center gap-1 mb-1"><Award className="w-3 h-3" /> Certifications</h5>
                              <div className="flex gap-1.5 flex-wrap">
                                {details.certificates.map((cert: string, i: number) => (
                                  <a key={i} href={cert} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline hover:text-blue-800">📄 Certificate {i+1}</a>
                                ))}
                              </div>
                            </div>
                          )}
                          {details.resume ? (
                            <div>
                              <h5 className="text-xs font-semibold text-gray-700 flex items-center gap-1 mb-1"><FileText className="w-3 h-3" /> Professional CV</h5>
                              <p className={`text-xs text-gray-600 whitespace-pre-wrap ${expandedCv.has(worker.id) ? '' : 'line-clamp-4'}`}>{details.resume}</p>
                              <button
                                onClick={() => setExpandedCv(prev => {
                                  const next = new Set(prev);
                                  if (next.has(worker.id)) next.delete(worker.id); else next.add(worker.id);
                                  return next;
                                })}
                                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-1"
                              >
                                {expandedCv.has(worker.id) ? <>Show less <ChevronUp className="w-3 h-3" /></> : <>Show full CV <ChevronDown className="w-3 h-3" /></>}
                              </button>
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400 italic">No CV/resume uploaded by this worker.</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {showPaymentModal && paymentWorker && (
        <MpesaModal
          isOpen={true}
          onClose={() => { setShowPaymentModal(false); setPaymentWorker(null); }}
          amount={50}
          description={`Unlock contact for ${paymentWorker.full_name}`}
          accountRef={`WRK-${paymentWorker.id}`}
          user={user}
          paymentType="contact_access"
          relatedProfileId={paymentWorker.id}
          onPaymentComplete={handlePaymentComplete}
        />
      )}
    </>
  );
};

export default WorkerSearchModal;
