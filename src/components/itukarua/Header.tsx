import React, { useEffect, useState } from 'react';
import { Menu, X, User, LogOut, ChevronDown, Send, Briefcase, Building2, Megaphone, PanelsTopLeft, Zap, Crown, ArrowRight } from 'lucide-react';
import { setPendingScrollTarget } from '@/lib/pricingScroll';

export type Page = 'home' | 'jobs' | 'services' | 'pricing' | 'about' | 'contact' | 'dashboard' | 'job-detail' | 'service-detail' | 'post-job' | 'post-advert' | 'admin' | 'inbox' | 'advertise' | 'corporate' | 'corporate-signup';

interface HeaderProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  onOpenAuth: (tab: 'login' | 'signup', role?: 'advertiser' | 'employer' | 'jobseeker') => void;
  user: { name: string; email: string; role: string } | null;
  onLogout: () => void;
}

interface ProductItem {
  id: string;
  label: string;
  blurb: string;
  gradient: string;
  icon: React.ComponentType<{ className?: string }>;
}

const PRODUCTS: ProductItem[] = [
  { id: 'jobseekers', label: 'Find Your Dream Job', blurb: 'Free & Premium plans for jobseekers hunting full-time, part-time or freelance work.', gradient: 'from-green-500 to-emerald-600', icon: Briefcase },
  { id: 'employers', label: 'Hire the Best Talent', blurb: 'Post single jobs or subscribe for unlimited access to vetted jobseekers.', gradient: 'from-sky-500 to-blue-600', icon: Building2 },
  { id: 'advert-plans', label: 'Promote Your Business', blurb: 'Pay-as-you-go advert listings with standout visibility across categories.', gradient: 'from-purple-500 to-indigo-600', icon: Megaphone },
  { id: 'job-listings-banner', label: 'Job Listings Banner', blurb: 'Full-width banner atop every Jobs page — 3× the audience intent.', gradient: 'from-emerald-500 to-teal-600', icon: PanelsTopLeft },
  { id: 'featured-boost', label: 'Featured Boost', blurb: 'Top of search, prime carousel and up to 5 images for 7 days.', gradient: 'from-amber-400 to-orange-500', icon: Zap },
  { id: 'corporate-placements', label: 'Corporate & Community Placements', blurb: 'Steady monthly presence for co-ops, churches, SACCOs & institutions.', gradient: 'from-gray-700 to-gray-900', icon: Crown },
];

const Header: React.FC<HeaderProps> = ({ currentPage, onNavigate, onOpenAuth, user, onLogout }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const [mobileProductsOpen, setMobileProductsOpen] = useState(false);

  const navItems: { label: string; page: Page }[] = [
    { label: 'Home', page: 'home' },
    { label: 'Jobs', page: 'jobs' },
    { label: 'Services', page: 'services' },
    { label: 'Contact', page: 'contact' },
  ];

  useEffect(() => {
    if (!productsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setProductsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [productsOpen]);

  const handleNav = (page: Page) => {
    onNavigate(page);
    setMobileMenuOpen(false);
    setProductsOpen(false);
  };

  const openProduct = (sectionId: string) => {
    setPendingScrollTarget(sectionId);
    handleNav('pricing');
    setMobileProductsOpen(false);
    // Job Listings Banner is an advertiser product — prompt advertiser sign-in
    // for anyone not already signed in as an advertiser before landing on rates.
    if (sectionId === 'job-listings-banner' && (!user || user.role !== 'advertiser')) {
      onOpenAuth('login', 'advertiser');
    }
  };

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-18">
          {/* Logo */}
          <button onClick={() => handleNav('home')} className="flex items-center gap-2 group">
            <img
              src="/images/logo.png"
                alt="Itukarua Solutions"
                className="h-12 w-auto object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <div className="hidden sm:block">
              <span className="text-lg font-bold text-gray-900 tracking-tight">ITUKARUA</span>
              <span className="text-[10px] block -mt-1 text-green-600 font-medium tracking-wider">SOLUTIONS</span>
            </div>
          </button>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map(item => (
              <button
                key={item.page}
                onClick={() => handleNav(item.page)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentPage === item.page
                    ? 'bg-green-50 text-green-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {item.label}
              </button>
            ))}

            {/* Our Products Mega Menu */}
            <div
              className="relative"
              onMouseEnter={() => setProductsOpen(true)}
              onMouseLeave={() => setProductsOpen(false)}
            >
              <button
                onClick={() => handleNav('pricing')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1 ${
                  currentPage === 'pricing'
                    ? 'bg-green-50 text-green-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Our Products
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${productsOpen ? 'rotate-180' : ''}`} />
              </button>

              {productsOpen && (
                <div className="absolute left-0 top-full pt-2 z-50">
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden w-[600px] max-w-[calc(100vw-2rem)]">
                    <div className="p-3 grid grid-cols-2 gap-1">
                      {PRODUCTS.map(p => (
                        <button
                          key={p.id}
                          onClick={() => openProduct(p.id)}
                          className="flex items-start gap-3 rounded-xl p-3 text-left hover:bg-green-50 group transition-colors"
                        >
                          <span className={`w-10 h-10 rounded-xl bg-gradient-to-br ${p.gradient} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                            <p.icon className="w-5 h-5 text-white" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-gray-900 group-hover:text-green-700 transition-colors">{p.label}</span>
                            <span className="block text-xs text-gray-500 mt-0.5 leading-snug">{p.blurb}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                    <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between bg-gray-50/70">
                      <span className="text-xs text-gray-500">Not sure what fits your goals?</span>
                      <button
                        onClick={() => handleNav('pricing')}
                        className="inline-flex items-center gap-1 text-sm font-semibold text-green-700 hover:text-green-800 transition-colors"
                      >
                        Browse all products & rates <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-green-700" />
                  </div>
                  <span className="hidden sm:block text-sm font-medium text-gray-700">{user.name}</span>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900">{user.name}</p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium capitalize">{user.role}</span>
                    </div>
                    <button
                      onClick={() => { handleNav(user.role === 'corporate' ? 'corporate' : 'dashboard'); setUserMenuOpen(false); }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <User className="w-4 h-4" /> {user.role === 'corporate' ? 'Corporate Panel' : 'Dashboard'}
                    </button>
                    <button
                      onClick={() => { handleNav('inbox'); setUserMenuOpen(false); }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <Send className="w-4 h-4" /> Messages
                    </button>
                    {user.role === 'super_admin' && (
                      <button
                        onClick={() => { handleNav('admin'); setUserMenuOpen(false); }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <User className="w-4 h-4" /> Admin Panel
                      </button>
                    )}
                    <button
                      onClick={() => { onLogout(); setUserMenuOpen(false); }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <button
                  onClick={() => onOpenAuth('login')}
                  className="hidden sm:block px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                >
                  Sign In
                </button>
                <button
                  onClick={() => onOpenAuth('signup')}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
                >
                  Get Started
                </button>
              </>
            )}

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-gray-100 bg-white shadow-lg">
          <div className="px-4 py-3 space-y-1">
            {navItems.map(item => (
              <button
                key={item.page}
                onClick={() => handleNav(item.page)}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  currentPage === item.page
                    ? 'bg-green-50 text-green-700'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {item.label}
              </button>
            ))}

            {/* Our Products (mobile) */}
            <div>
              <button
                onClick={() => setMobileProductsOpen(!mobileProductsOpen)}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors inline-flex items-center justify-between ${
                  currentPage === 'pricing'
                    ? 'bg-green-50 text-green-700'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                Our Products
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${mobileProductsOpen ? 'rotate-180' : ''}`} />
              </button>
              {mobileProductsOpen && (
                <div className="pl-4 space-y-1 pb-1">
                  {PRODUCTS.map(p => (
                    <button
                      key={p.id}
                      onClick={() => openProduct(p.id)}
                      className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-green-50 transition-colors"
                    >
                      <span className={`w-7 h-7 rounded-lg bg-gradient-to-br ${p.gradient} flex items-center justify-center flex-shrink-0`}>
                        <p.icon className="w-3.5 h-3.5 text-white" />
                      </span>
                      {p.label}
                    </button>
                  ))}
                  <button
                    onClick={() => handleNav('pricing')}
                    className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-semibold text-green-700 hover:bg-green-50 transition-colors"
                  >
                    Browse all products & rates →
                  </button>
                </div>
              )}
            </div>

            {user && (
              <button
                onClick={() => handleNav(user.role === 'corporate' ? 'corporate' : 'dashboard')}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  currentPage === 'dashboard' || currentPage === 'corporate' ? 'bg-green-50 text-green-700' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {user.role === 'corporate' ? 'Corporate Panel' : 'Dashboard'}
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;