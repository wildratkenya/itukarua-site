import React, { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getProfile, type DbProfile } from '@/lib/database';
import Header, { type Page } from './itukarua/Header';
import Footer from './itukarua/Footer';
import HomePage from './itukarua/HomePage';
import JobsPage from './itukarua/JobsPage';
import JobDetailPage from './itukarua/JobDetailPage';
import ServicesPage from './itukarua/ServicesPage';
import PricingPage from './itukarua/PricingPage';
import AboutPage from './itukarua/AboutPage';
import ContactPage from './itukarua/ContactPage';
import PostJobPage from './itukarua/PostJobPage';
import PostAdvertPage from './itukarua/PostAdvertPage';
import DashboardPage from './itukarua/DashboardPage';
import AuthModal from './itukarua/AuthModal';
import MpesaModal from './itukarua/MpesaModal';
import AdminPage from './itukarua/AdminPage';

export interface UserState {
  id: string;
  name: string;
  email: string;
  role: string;
  profile?: DbProfile | null;
}

const AppLayout: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [user, setUser] = useState<UserState | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'signup'>('login');
  const [mpesaModal, setMpesaModal] = useState<{
    open: boolean;
    amount: number;
    description: string;
    accountRef: string;
  }>({ open: false, amount: 0, description: '', accountRef: '' });
  const [selectedJobId, setSelectedJobId] = useState<string>('');
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
          const profile = await getProfile(session.user.id);
          if (!mounted) return;

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

    loadUser();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      if (event === 'SIGNED_IN' && session?.user) {
        // Check if user just confirmed their email
        const justConfirmed = session.user.email_confirmed_at && 
          (Date.now() - new Date(session.user.email_confirmed_at).getTime()) < 60000; // Within last minute
        const profile = await getProfile(session.user.id);
        if (!mounted) return;

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
          // Update profile with email confirmation status
          if (justConfirmed && session.user.confirmed_at) {
            await supabase.from('profiles').update({ 
              email_confirmed: true,
              updated_at: new Date().toISOString()
            }).eq('id', session.user.id);
          }
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
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
    // Auth state change listener will handle setting the user
  }, []);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setCurrentPage('home');
  }, []);

  const handleViewJob = useCallback((jobId: string) => {
    setSelectedJobId(jobId);
    setCurrentPage('job-detail');
  }, []);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setCurrentPage('jobs');
  }, []);

  const handleOpenMpesa = useCallback((amount: number, description: string, accountRef: string) => {
    setMpesaModal({ open: true, amount, description, accountRef });
  }, []);

  const handleCloseMpesa = useCallback(() => {
    setMpesaModal(prev => ({ ...prev, open: false }));
  }, []);

  // Simplified user object for components that don't need full profile
  const simpleUser = user ? { name: user.name, email: user.email, role: user.role } : null;

  useEffect(() => {
    console.log('AppLayout State:', { currentPage, user: !!user, authLoading });
  }, [currentPage, user, authLoading]);

  const renderPage = () => {
    try {
      switch (currentPage) {
        case 'home':
          return <HomePage onNavigate={handleNavigate} onSearch={handleSearch} onViewJob={handleViewJob} />;
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
            />
          );
        case 'services':
          return <ServicesPage onNavigate={handleNavigate} />;
        case 'pricing':
          return <PricingPage onOpenMpesa={handleOpenMpesa} />;
        case 'about':
          return <AboutPage />;
        case 'contact':
          return <ContactPage />;
        case 'post-job':
          return <PostJobPage onNavigate={handleNavigate} user={user} onOpenAuth={handleOpenAuth} />;
        case 'post-advert':
          return <PostAdvertPage onNavigate={handleNavigate} user={user} onOpenAuth={handleOpenAuth} onOpenMpesa={handleOpenMpesa} />;
        case 'dashboard':
          if (!user) {
            return <HomePage onNavigate={handleNavigate} onSearch={handleSearch} onViewJob={handleViewJob} />;
          }
          return <DashboardPage user={user} onNavigate={handleNavigate} onViewJob={handleViewJob} onOpenMpesa={handleOpenMpesa} />;
        case 'admin':
          if (!user || user.role !== 'super_admin') {
            return <HomePage onNavigate={handleNavigate} onSearch={handleSearch} onViewJob={handleViewJob} />;
          }
          return <AdminPage />;
        default:
          return <HomePage onNavigate={handleNavigate} onSearch={handleSearch} onViewJob={handleViewJob} />;
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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header
        currentPage={currentPage}
        onNavigate={handleNavigate}
        onOpenAuth={handleOpenAuth}
        user={simpleUser}
        onLogout={handleLogout}
      />

      <main className="flex-1">
        {authLoading ? (
          <div className="flex items-center justify-center py-32">
            <div className="w-12 h-12 border-4 border-green-200 border-t-green-600 rounded-full animate-spin" />
          </div>
        ) : (
          renderPage()
        )}
      </main>

      <Footer onNavigate={handleNavigate} />

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialTab={authTab}
        onAuth={handleAuthComplete}
      />

      <MpesaModal
        isOpen={mpesaModal.open}
        onClose={handleCloseMpesa}
        amount={mpesaModal.amount}
        description={mpesaModal.description}
        accountRef={mpesaModal.accountRef}
        user={user}
        onPaymentComplete={() => {
          handleCloseMpesa();
          if (user) getProfile(user.id).then(p => {
            if (p) setUser(prev => prev ? { ...prev, profile: p } : prev);
          });
        }}
      />
    </div>
  );
};

export default AppLayout;
