import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";

import NotFound from "./pages/NotFound";
import AppLayout from "./components/AppLayout";
import { AppProvider } from "./contexts/AppContext";
import AdminPage from "./components/itukarua/AdminPage";
import { supabase, restoreSession } from "@/lib/supabase";
import { getProfile } from "@/lib/database";
import CookieConsent from "@/components/CookieConsent";
import React, { useState, useEffect } from "react";
import AboutPage from "./pages/AboutPage";
import ContactPage from "./pages/ContactPage";
import CorporatePage from "./pages/CorporatePage";
import DashboardPage from "./pages/DashboardPage";
import InboxPage from "./pages/InboxPage";
import JobsPage from "./pages/JobsPage";
import ServicesPage from "./pages/ServicesPage";
import ServiceDetailPage from "./pages/ServiceDetailPage";
import PricingPage from "./pages/PricingPage";
import JobDetailPage from "./pages/JobDetailPage";
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: false, // Don't retry on abort errors
    },
  },
});

const AdminRoute: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      try {
        await restoreSession();
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;

        if (session?.user) {
          const profile = await getProfile(session.user.id);
          if (mounted && profile?.role === 'super_admin') {
            setUser({ ...session.user, role: 'super_admin', profile });
          }
        }
      } catch (e) {
        console.error('Auth error:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    checkAuth();
    return () => { mounted = false; };
  }, []);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-10 h-10 border-4 border-green-200 border-t-green-600 rounded-full animate-spin" />
    </div>
  );

  if (!user) return <Navigate to="/" replace />;

  return <AdminPage />;
};

const App = () => (
  <ThemeProvider defaultTheme="light">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppProvider>
            <Routes>
              <Route path="/" element={<AppLayout />} />
              <Route path="/advertise" element={<AppLayout initialPage="advertise" />} />
              <Route path="/dashboard" element={<AppLayout />} />
              <Route path="/day-pass" element={<AppLayout initialPage="day-pass" />} />
              <Route path="/admin" element={<AdminRoute />} />
              <Route path="/jobs" element={<AppLayout initialPage="jobs" />} />
              <Route path="/jobs/:id" element={<AppLayout initialPage="job-detail" />} />
              <Route path="/services" element={<AppLayout initialPage="services" />} />
              <Route path="/services/:id" element={<AppLayout initialPage="service-detail" />} />
              <Route path="/pricing" element={<AppLayout initialPage="pricing" />} />
              <Route path="/about" element={<AppLayout initialPage="about" />} />
              <Route path="/contact" element={<AppLayout initialPage="contact" />} />
              <Route path="/corporate" element={<AppLayout initialPage="corporate" />} />
              <Route path="/inbox" element={<AppLayout initialPage="inbox" />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            {/* Cookie/privacy consent bar - covers the site and /admin alike. */}
            <CookieConsent />
          </AppProvider>
          {/* Cookie/privacy consent bar - covers the site and /admin alike. */}
          <CookieConsent />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

// Dummy commit for push
export default App;
