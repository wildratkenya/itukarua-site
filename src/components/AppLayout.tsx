import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { CheckCircle, CalendarX2, X } from 'lucide-react';
import { supabase, saveSession, restoreSession, proxyRequest, proxyTable } from '@/lib/supabase';
import { getProfile, boostAd, type DbProfile } from '@/lib/database';
import Header, { type Page } from './itukarua/Header';
import Footer from './itukarua/Footer';
import HomePage from './itukarua/HomePage';
import JobsPage from './itukarua/JobsPage';
import JobDetailPage from './itukarua/JobDetailPage';
import ServiceDetailPage from './itukarua/ServiceDetailPage';
import ServicesPage from './itukarua/ServicesPage';
import PricingPage from './itukarua/PricingPage';
import AboutPage from './itukarua/AboutPage';
import ContactPage from './itukarua/ContactPage';
import PostJobPage from './itukarua/PostJobPage';
import PostAdvertPage from './itukarua/PostAdvertPage';
import DashboardPage from './itukarua/DashboardPage';
import InboxPage from './itukarua/InboxPage';
import AuthModal from './itukarua/AuthModal';
import MpesaModal from './itukarua/MpesaModal';
import AdminPage from './itukarua/AdminPage';
import ChatBot from './itukarua/ChatBot';

export interface UserState {
  id: string;
  name: string;
  email: string;
  role: string;
  profile?: DbProfile | null;
}

const PAYABLE_ROLES = ['jobseeker', 'employer', 'advertiser'];

interface SubscriptionNotice {
  role: string;
  status: 'active' | 'expired';
  days?: number;
  expiredAt?: string | null;
}

// Payment spec shown on login when the account's subscription has expired/not paid.
const rolePaymentSpec = (role: string) => {
  if (role === 'employer') {
    return { employerChooser: true, amount: 0, description: '', accountRef: '', paymentType: 'registration' as const };
  }
  if (role === 'jobseeker') {
    return { employerChooser: false, amount: 100, description: 'Jobseeker Premium Subscription', accountRef: 'PREM-NEW', paymentType: 'registration' as const };
  }
  return { employerChooser: false, amount: 100, description: 'Advertiser Subscription', accountRef: 'ADV-SUB', paymentType: 'registration' as const };
};

// Evaluate the subscription status shown after login for payable profiles.
// Employers must hold a paid account (nag if unpaid/expired). Jobseekers only
// get a notice once they've had a premium subscription (free plan = quiet).
// Advertisers pay per advert, so no login subscription notice.
const evaluateSubscriptionNotice = (profile: any): SubscriptionNotice | null => {
  if (!profile || !PAYABLE_ROLES.includes(profile.role)) return null;
  const paidReg = !!profile.registration_paid;
  const expires = profile.subscription_expires_at ? new Date(profile.subscription_expires_at) : null;
  const hasExpiry = !!expires;
  const active = paidReg && hasExpiry && expires.getTime() > Date.now();

  if (active && expires) {
    const days = Math.max(1, Math.ceil((expires.getTime() - Date.now()) / 86400000));
    return { role: profile.role, status: 'active', days, expiredAt: expires.toISOString() };
  }
  if (profile.role === 'employer') {
    return { role: profile.role, status: 'expired', expiredAt: hasExpiry ? expires!.toISOString() : null };
  }
  if (profile.role === 'jobseeker' && hasExpiry) {
    return { role: profile.role, status: 'expired', expiredAt: expires!.toISOString() };
  }
  return null;
};

const AppLayout: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [user, setUser] = useState<UserState | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'signup'>('login');
  const loginJustHappened = useRef(false);
  const loginFromWorkerPopup = useRef(false);
  const [subNotice, setSubNotice] = useState<SubscriptionNotice | null>(null);
  const [subNoticeDismissed, setSubNoticeDismissed] = useState(false);
  const [mpesaModal, setMpesaModal] = useState<{
    open: boolean;
    amount: number;
    description: string;
    accountRef: string;
    paymentType?: 'registration' | 'contact_access' | 'job_posting' | 'job_payment' | 'advert' | 'featured_boost' | 'single_job_post' | 'employer_day_token' | 'employer_day_access';
    relatedAdId?: string;
    relatedJobId?: string;
    relatedJobTitle?: string;
    relatedProfileId?: string;
    employerPlans?: boolean;
    employerExpired?: boolean;
    employerExpiredAt?: string | null;
    onComplete?: () => void;
  }>({ open: false, amount: 0, description: '', accountRef: '' });
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [autoOpenWorkerSearch, setAutoOpenWorkerSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [authLoading, setAuthLoading] = useState(true);

  // Load user from Supabase session on mount
  useEffect(() => {
    let mounted = true;
    
    const loadUser = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (!mounted) return;
        if (sessionError) throw sessionError;
        
        if (session?.user) {
          let profile = await getProfile(session.user.id);
          if (!mounted) return;

          // If no profile exists yet (email confirmation was required),
          // create it from the signup metadata stored on the auth user.
          if (!profile && session.user.user_metadata) {
            const meta = session.user.user_metadata;
            const now = new Date().toISOString();
            const { error: upsertErr } = await proxyRequest('/rest/v1/profiles', 'POST', {
              id: session.user.id,
              full_name: meta.full_name || session.user.email?.split('@')[0] || '',
              email: session.user.email || '',
              phone: meta.phone || '',
              role: meta.role || 'employer',
              location: meta.location || null,
              county: meta.county || null,
              subcounty: meta.subcounty || null,
              skills: meta.skills || [],
              created_at: now,
              updated_at: now,
            }, { Prefer: 'resolution=merge-duplicates' });
            if (upsertErr) console.error('[Auth] profile creation from metadata failed:', upsertErr);
            profile = await getProfile(session.user.id);
            if (!mounted) return;
          }

          if (profile?.suspended) {
            await supabase.auth.signOut();
            alert('Your account has been suspended. Please contact support.');
            setUser(null);
          } else {
            setUser({
              id: session.user.id,
              name: profile?.full_name || session.user.email?.split('@')[0] || '',
              email: session.user.email || '',
              role: profile?.role || 'employer',
              profile,
            });
            promptLoginSubscriptionCheck(profile);
          }
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Error loading user:', err);
        }
      } finally {
        if (mounted) setAuthLoading(false);
      }
    };

    restoreSession().finally(() => {
      if (mounted) loadUser();
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (session) saveSession(session);
      else if (event === 'SIGNED_OUT') saveSession(null);
      
      if (event === 'SIGNED_IN' && session?.user) {
        const profile = await getProfile(session.user.id);
        if (!mounted) return;

        // If no profile exists yet (email confirmation was required),
        // create it from the signup metadata stored on the auth user.
        if (!profile && session.user.user_metadata) {
          const meta = session.user.user_metadata;
          const now = new Date().toISOString();
          const { error: upsertErr } = await proxyRequest('/rest/v1/profiles', 'POST', {
            id: session.user.id,
            full_name: meta.full_name || session.user.email?.split('@')[0] || '',
            email: session.user.email || '',
            phone: meta.phone || '',
            role: meta.role || 'employer',
            location: meta.location || null,
            county: meta.county || null,
            subcounty: meta.subcounty || null,
            skills: meta.skills || [],
            created_at: now,
            updated_at: now,
          }, { Prefer: 'resolution=merge-duplicates' });
          if (upsertErr) console.error('[Auth] profile creation from metadata failed:', upsertErr);

          // Retry fetching the profile
          const refreshedProfile = await getProfile(session.user.id);
          if (!mounted) return;
          if (refreshedProfile?.suspended) {
            await supabase.auth.signOut();
            setUser(null);
          } else {
            setUser({
              id: session.user.id,
              name: refreshedProfile?.full_name || session.user.email?.split('@')[0] || '',
              email: session.user.email || '',
              role: refreshedProfile?.role || meta.role || 'employer',
              profile: refreshedProfile,
            });
            promptLoginSubscriptionCheck(refreshedProfile);
            if (loginJustHappened.current) { loginJustHappened.current = false; setCurrentPage(loginFromWorkerPopup.current ? 'home' : 'dashboard'); loginFromWorkerPopup.current = false; }
          }
          return;
        }

        if (profile?.suspended) {
          await supabase.auth.signOut();
          setUser(null);
        } else {
          setUser({
            id: session.user.id,
            name: profile?.full_name || session.user.email?.split('@')[0] || '',
            email: session.user.email || '',
            role: profile?.role || 'employer',
            profile,
          });
          promptLoginSubscriptionCheck(profile);
          if (loginJustHappened.current) { loginJustHappened.current = false; setCurrentPage(loginFromWorkerPopup.current ? 'home' : 'dashboard'); loginFromWorkerPopup.current = false; }
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setSubNotice(null);
        setSubNoticeDismissed(false);
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        // Handle token refresh - update user state
        const profile = await getProfile(session.user.id);
        if (!mounted) return;
        setUser({
          id: session.user.id,
          name: profile?.full_name || session.user.email?.split('@')[0] || '',
          email: session.user.email || '',
          role: profile?.role || 'employer',
          profile,
        });
        promptLoginSubscriptionCheck(profile);
      }
      
      if (mounted) setAuthLoading(false);
    });

    // Final safety failsafe
    const timer = setTimeout(() => {
      if (mounted) setAuthLoading(false);
    }, 3000);

    return () => { 
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  // Scroll to top on page change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (currentPage === 'dashboard' && !user && !authLoading) {
      setCurrentPage('home');
      setAuthTab('login');
      setAuthModalOpen(true);
    }
  }, [currentPage, user, authLoading]);

  const handleNavigate = useCallback((page: Page) => {
    if (page === 'admin' && (!user || user.role !== 'super_admin')) {
      return; // Don't allow navigation to admin if not super admin
    }
    setCurrentPage(page);
  }, [user]);

  const handleOpenAuth = useCallback((tab: 'login' | 'signup') => {
    setAuthTab(tab);
    setAuthModalOpen(true);
  }, []);

  const handleAuthComplete = useCallback(() => {
    loginJustHappened.current = true;
  }, []);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSubNotice(null);
    setSubNoticeDismissed(false);
    setCurrentPage('home');
  }, []);

const handleWorkerPopupOpen = useCallback(() => { loginFromWorkerPopup.current = true; }, []);
  const handleWorkerSearchAuth = useCallback(() => { loginFromWorkerPopup.current = true; setAutoOpenWorkerSearch(true); }, []);

  const handleViewJob = useCallback((jobId: string) => {
    setSelectedJobId(jobId);
    setCurrentPage('job-detail');
  }, []);

  const handleViewService = useCallback((serviceId: string) => {
    setSelectedServiceId(serviceId);
    setCurrentPage('service-detail');
  }, []);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setCurrentPage('jobs');
  }, []);

  const handleOpenMpesa = useCallback((amount: number, description: string, accountRef: string, paymentType?: string, relatedAdId?: string, relatedJobId?: string, relatedProfileId?: string, onComplete?: () => void, employerPlans?: boolean, employerExpired?: boolean, employerExpiredAt?: string | null) => {
    setMpesaModal({ open: true, amount, description, accountRef, paymentType: paymentType as any, relatedAdId, relatedJobId, relatedProfileId, onComplete, employerPlans, employerExpired, employerExpiredAt });
  }, []);

  // Open the employer payment popup offering BOTH plans (KES 100/1-day job token
  // and KES 200/weekly unlimited), plus an expired-account notice when applicable.
  const handleOpenEmployerPayment = useCallback((jobId?: string, jobTitle?: string, onComplete?: () => void) => {
    const profile = user?.profile;
    const expiredAt = profile?.subscription_expires_at && new Date(profile.subscription_expires_at).getTime() < Date.now()
      ? (profile.subscription_expires_at as string)
      : null;
    setMpesaModal({
      open: true,
      amount: 200,
      description: 'Employer Weekly Access',
      accountRef: 'EMP-WK',
      paymentType: 'registration',
      relatedJobId: jobId,
      relatedJobTitle: jobTitle,
      employerPlans: true,
      employerExpired: !!expiredAt,
      employerExpiredAt: expiredAt,
      onComplete,
    });
  }, [user]);

  // Payable profiles (jobseeker/employer/advertiser) must have a valid paid
  // account. After login: show a status notice (days remaining, or expired) and
  // auto-prompt the payment flow when the account is expired / unpaid.
  const syncSubscriptionNotice = useCallback((p: any) => {
    setSubNotice(evaluateSubscriptionNotice(p));
  }, []);

  const promptLoginSubscriptionCheck = useCallback((p: any) => {
    const notice = evaluateSubscriptionNotice(p);
    setSubNotice(notice);
    if (notice?.status === 'expired') {
      setSubNoticeDismissed(false);
      const spec = rolePaymentSpec(notice.role);
      setTimeout(() => {
        if (spec.employerChooser) {
          handleOpenEmployerPayment();
        } else {
          handleOpenMpesa(spec.amount, spec.description, spec.accountRef, spec.paymentType, undefined, undefined, undefined, undefined, spec.employerChooser, true, notice.expiredAt);
        }
      }, 400);
    }
  }, [handleOpenEmployerPayment, handleOpenMpesa]);

  const handleCloseMpesa = useCallback(() => {
    setMpesaModal(prev => ({ ...prev, open: false }));
  }, []);

  // Simplified user object for components that don't need full profile
  const simpleUser = user ? { name: user.name, email: user.email, role: user.role } : null;

  // Track page visits for site traffic analytics
  useEffect(() => {
    if (!currentPage) return;
    proxyRequest('/rest/v1/site_visits_log', 'POST', {
      user_id: user?.id || null,
      page_path: currentPage,
    }).then(() => {}).catch(() => {});
  }, [currentPage]);

  const renderPage = () => {
    try {
      switch (currentPage) {
        case 'home':
          return <HomePage onNavigate={handleNavigate} onSearch={handleSearch} onViewJob={handleViewJob} onViewService={handleViewService} onOpenMpesa={handleOpenMpesa} onOpenEmployerPayment={handleOpenEmployerPayment} onWorkerPopupOpen={handleWorkerPopupOpen} onWorkerSearchAuth={handleWorkerSearchAuth} autoOpenWorkerSearch={autoOpenWorkerSearch} onConsumeAutoOpenWorkerSearch={() => setAutoOpenWorkerSearch(false)} onOpenAuth={handleOpenAuth} />;
        case 'jobs':
          return <JobsPage onViewJob={handleViewJob} onNavigate={handleNavigate} initialSearch={searchQuery} />;
        case 'job-detail':
          return (
            <JobDetailPage
              jobId={selectedJobId}
              onNavigate={handleNavigate}
              onBack={() => setCurrentPage('jobs')}
              user={user}
              onOpenAuth={handleOpenAuth}
              onOpenMpesa={handleOpenMpesa}
              onOpenEmployerPayment={handleOpenEmployerPayment} onWorkerPopupOpen={handleWorkerPopupOpen}
            />
          );
        case 'services':
          return <ServicesPage onNavigate={handleNavigate} />;
        case 'pricing':
          return <PricingPage onOpenMpesa={handleOpenMpesa} onOpenEmployerPayment={handleOpenEmployerPayment} onWorkerPopupOpen={handleWorkerPopupOpen} onNavigate={handleNavigate} />;
        case 'about':
          return <AboutPage />;
        case 'contact':
          return <ContactPage />;
        case 'post-job':
          return <PostJobPage onNavigate={handleNavigate} user={user} onOpenAuth={handleOpenAuth} onOpenMpesa={handleOpenMpesa} onOpenEmployerPayment={handleOpenEmployerPayment} />;
        case 'post-advert':
          return <PostAdvertPage onNavigate={handleNavigate} user={user} onOpenAuth={handleOpenAuth} onOpenMpesa={handleOpenMpesa} onWorkerPopupOpen={handleWorkerPopupOpen} />;
        case 'dashboard':
          if (!user) {
            return <HomePage onNavigate={handleNavigate} onSearch={handleSearch} onViewJob={handleViewJob} onOpenMpesa={handleOpenMpesa} onOpenEmployerPayment={handleOpenEmployerPayment} onWorkerPopupOpen={handleWorkerPopupOpen} onOpenAuth={handleOpenAuth} />;
          }
          return <DashboardPage user={user} onNavigate={handleNavigate} onViewJob={handleViewJob} onOpenMpesa={handleOpenMpesa} onWorkerPopupOpen={handleWorkerPopupOpen} />;
        case 'inbox':
          if (!user) {
            return <HomePage onNavigate={handleNavigate} onSearch={handleSearch} onViewJob={handleViewJob} onOpenMpesa={handleOpenMpesa} onOpenEmployerPayment={handleOpenEmployerPayment} onWorkerPopupOpen={handleWorkerPopupOpen} onOpenAuth={handleOpenAuth} />;
          }
          return <InboxPage userId={user.id} onBack={() => setCurrentPage('dashboard')} />;
        case 'admin':
          if (!user || user.role !== 'super_admin') {
            return <HomePage onNavigate={handleNavigate} onSearch={handleSearch} onViewJob={handleViewJob} onOpenMpesa={handleOpenMpesa} onOpenEmployerPayment={handleOpenEmployerPayment} onWorkerPopupOpen={handleWorkerPopupOpen} onOpenAuth={handleOpenAuth} />;
          }
          return <AdminPage />;
        default:
          return <HomePage onNavigate={handleNavigate} onSearch={handleSearch} onViewJob={handleViewJob} onOpenMpesa={handleOpenMpesa} onOpenEmployerPayment={handleOpenEmployerPayment} onWorkerPopupOpen={handleWorkerPopupOpen} onOpenAuth={handleOpenAuth} />;
      }
    } catch (err: any) {
      console.error('CRITICAL RENDER ERROR:', err);
      return (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-red-50 min-h-[60vh] rounded-xl border-2 border-red-200">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-red-900 mb-2">Something went wrong</h2>
          <p className="text-red-700 mb-6 max-w-md font-medium">The page failed to load. This often happens if the data from the database is missing a required field or is formatted incorrectly.</p>
          <div className="flex gap-4">
            <button onClick={() => window.location.reload()} className="px-6 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors">Reload App</button>
            <button onClick={() => setCurrentPage('home')} className="px-6 py-2 bg-white text-red-600 border border-red-200 font-semibold rounded-lg hover:bg-red-50 transition-colors">Go to Home</button>
          </div>
          <pre className="mt-8 p-4 bg-gray-900 rounded text-left text-xs overflow-auto max-w-full text-green-400 font-mono">
            Error: {err?.message || 'Unknown Error'}
            {'\n'}
            Stack: {err?.stack?.split('\n').slice(0, 3).join('\n')}
          </pre>
        </div>
      );
    }
  };

  return (
    <div
      className="min-h-screen bg-gray-50 flex flex-col"
      onContextMenu={(e) => { if ((e.target as HTMLElement).tagName === 'IMG') e.preventDefault(); }}
    >
      <style>{'img { user-select: none; -webkit-user-drag: none; }'}</style>
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Organization",
                "@id": "https://www.itukarua.co.ke/#organization",
                "name": "Itukarua",
                "url": "https://www.itukarua.co.ke/",
                "logo": {
                  "@type": "ImageObject",
                  "url": "https://www.itukarua.co.ke/og.jpg"
                }
              },
              {
                "@type": "WebSite",
                "@id": "https://www.itukarua.co.ke/#website",
                "url": "https://www.itukarua.co.ke/",
                "name": "Itukarua",
                "description": "Local marketplace for jobs, services, and business listings in Itukarua County, Kenya.",
                "potentialAction": {
                  "@type": "SearchAction",
                  "target": {
                    "@type": "EntryPoint",
                    "urlTemplate": "https://www.itukarua.co.ke/?q={search_term_string}"
                  },
                  "query-input": "required name=search_term_string"
                }
              }
            ]
          })}
        </script>
      </Helmet>
      <Header
        currentPage={currentPage}
        onNavigate={handleNavigate}
        onOpenAuth={handleOpenAuth}
        user={simpleUser}
        onLogout={handleLogout}
      />

      {subNotice && !subNoticeDismissed && (
        <div className={`border-b px-4 py-2.5 flex items-center justify-between gap-3 text-sm ${subNotice.status === 'active' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          <div className="flex flex-wrap items-center gap-2 font-medium">
            {subNotice.status === 'active' ? (
              <>
                <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                <span>
                  Your <span className="capitalize font-semibold">{subNotice.role}</span> subscription is active — <span className="font-bold">{subNotice.days} day{subNotice.days === 1 ? '' : 's'} remaining</span>.
                </span>
              </>
            ) : (
              <>
                <CalendarX2 className="w-4 h-4 text-red-600 flex-shrink-0" />
                <span>
                  Your subscription has {subNotice.expiredAt ? <>expired on <span className="font-bold">{new Date(subNotice.expiredAt!).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}</span></> : 'expired'}. Renew to continue accessing your <span className="capitalize">{subNotice.role}</span> features.
                </span>
                <button
                  onClick={() => {
                    const spec = rolePaymentSpec(subNotice.role);
                    if (spec.employerChooser) handleOpenEmployerPayment();
                    else handleOpenMpesa(spec.amount, spec.description, spec.accountRef, spec.paymentType, undefined, undefined, undefined, undefined, false, true, subNotice.expiredAt);
                  }}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  Renew now
                </button>
              </>
            )}
          </div>
          <button onClick={() => setSubNoticeDismissed(true)} className="flex-shrink-0 p-1 hover:opacity-70 transition-opacity" aria-label="Dismiss">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <main className="flex-1">
        {authLoading ? (
          <div className="flex items-center justify-center py-32">
            <div className="w-12 h-12 border-4 border-green-200 border-t-green-600 rounded-full animate-spin" />
          </div>
        ) : (
          renderPage()
        )}
      </main>

      <Footer onNavigate={handleNavigate} onOpenAuth={handleOpenAuth} />

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialTab={authTab}
        onAuth={handleAuthComplete}
        onOpenMpesa={(amount, description, accountRef, paymentType) => handleOpenMpesa(amount, description, accountRef, paymentType)}
      />

      <MpesaModal
        isOpen={mpesaModal.open}
        onClose={handleCloseMpesa}
        amount={mpesaModal.amount}
        description={mpesaModal.description}
        accountRef={mpesaModal.accountRef}
        paymentType={mpesaModal.paymentType}
        relatedAdId={mpesaModal.relatedAdId}
        relatedJobId={mpesaModal.relatedJobId}
        relatedJobTitle={mpesaModal.relatedJobTitle}
        relatedProfileId={mpesaModal.relatedProfileId}
        employerPlans={mpesaModal.employerPlans}
        employerExpired={mpesaModal.employerExpired}
        employerExpiredAt={mpesaModal.employerExpiredAt}
        user={user}
        onPaymentComplete={() => {
          handleCloseMpesa();
          if (mpesaModal.paymentType === 'featured_boost' && mpesaModal.relatedAdId) {
            boostAd('advertisements', mpesaModal.relatedAdId).catch(() => {
              boostAd('service_ads', mpesaModal.relatedAdId!).catch(() => {});
            });
          }
          if (user) {
            const refreshProfile = () => {
              getProfile(user.id).then(p => {
                if (p) setUser(prev => prev ? { ...prev, profile: p } : prev);
                syncSubscriptionNotice(p);
              });
            };
            if (mpesaModal.paymentType === 'registration') {
              // A completed registration payment marks the account as paid so the
              // employer/jobseeker gate passes even for self-service signups.
              supabase.from('profiles').update({ registration_paid: true }).eq('id', user.id)
                .then(refreshProfile)
                .catch(refreshProfile);
            } else {
              refreshProfile();
            }
          }
          mpesaModal.onComplete?.();
        }}
      />
      <ChatBot />
    </div>
  );
};

export default AppLayout;
