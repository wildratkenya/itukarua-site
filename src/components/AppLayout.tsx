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
    const loadUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const profile = await getProfile(session.user.id);
          setUser({
            id: session.user.id,
            name: profile?.full_name || session.user.email?.split('@')[0] || '',
            email: session.user.email || '',
            role: profile?.role || 'employer',
            profile,
          });
        }
      } catch (err) {
        console.error('Error loading user:', err);
      } finally {
        setAuthLoading(false);
      }
    };
    loadUser();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const profile = await getProfile(session.user.id);
        setUser({
          id: session.user.id,
          name: profile?.full_name || session.user.email?.split('@')[0] || '',
          email: session.user.email || '',
          role: profile?.role || 'employer',
          profile,
        });
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
      }
    });

    return () => { subscription.unsubscribe(); };
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
    setCurrentPage(page);
  }, []);

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

  const renderPage = () => {
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
      default:
        return <HomePage onNavigate={handleNavigate} onSearch={handleSearch} onViewJob={handleViewJob} />;
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
            <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin" />
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
      />
    </div>
  );
};

export default AppLayout;
