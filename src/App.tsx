
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AdminPage from "./components/itukarua/AdminPage";
import { supabase } from "@/lib/supabase";
import { getProfile } from "@/lib/database";
import React, { useState, useEffect } from "react";

const queryClient = new QueryClient();

interface UserState {
  id: string;
  name: string;
  email: string;
  role: string;
  profile?: any;
}

const AdminRoute: React.FC = () => {
  const [user, setUser] = useState<UserState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const checkAuth = async () => {
      try {
        // Add a timeout to catch stuck auth locks
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (cancelled) return;
        
        if (!session?.user) {
          console.log('🚫 No session found');
          setLoading(false);
          return;
        }

        console.log('👤 Session found:', session.user.email);

        // Get or create profile
        let profile = await getProfile(session.user.id);
        
        if (cancelled) return;

        // Auto-create admin profile if doesn't exist
        if (!profile && session.user.email === 'admin@itukarua.co.ke') {
          console.log('🔧 Creating admin profile...');
          const { data } = await supabase
            .from('profiles')
            .upsert(
              {
                id: session.user.id,
                full_name: 'Super Admin',
                role: 'super_admin',
                verified: true,
                registration_paid: true,
              },
              { onConflict: 'id' }
            )
            .select()
            .single();

          if (data) {
            profile = data;
            console.log('✅ Admin profile ready');
          }
        }

        if (cancelled) return;

        // Check if user is super_admin
        if (profile?.role === 'super_admin') {
          console.log('🎉 Super admin access granted');
          setUser({
            id: session.user.id,
            name: profile.full_name || 'Admin',
            email: session.user.email || '',
            role: 'super_admin',
            profile,
          });
        } else {
          console.log('🚫 User is not a super admin');
        }
        console.error('Auth check failed:', err);
        // Avoid infinite reload loop
        // if (err.message === 'AUTH_TIMEOUT') { ... }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    checkAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-4">
            You must be logged in as a super admin to access this page.
          </p>
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Please log in with admin credentials first, then return to this page.
            </p>
            <div className="flex gap-3 justify-center">
              <a 
                href="/" 
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
              >
                Go to Login
              </a>
              <button 
                onClick={() => window.location.reload()}
                className="px-6 py-3 border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold rounded-lg transition-colors"
              >
                Retry
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-4">
              If you're getting connection errors, try clearing your browser cache or checking your internet connection.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <AdminPage />;
};

const App = () => (
  <ThemeProvider defaultTheme="light">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/admin" element={<AdminRoute />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
