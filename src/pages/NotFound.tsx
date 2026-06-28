import { useLocation } from "react-router-dom";
import { Helmet } from 'react-helmet-async';
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Helmet>
        <title>Page Not Found - Itukarua</title>
        <meta name="description" content="The page you are looking for does not exist." />
        <link rel="canonical" href="https://www.itukarua.co.ke/404" />
        <meta property="og:title" content="Page Not Found - Itukarua" />
        <meta property="og:description" content="The page you are looking for does not exist." />
        <meta property="og:site_name" content="Itukarua" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Page Not Found - Itukarua" />
        <meta name="twitter:description" content="The page you are looking for does not exist." />
        <meta name="twitter:image" content="https://www.itukarua.co.ke/og.jpg" />
      </Helmet>
      <div className="text-center p-8 rounded-lg border border-border bg-card shadow-md animate-slide-in">
        <h1 className="text-5xl font-bold mb-6 text-primary">404</h1>
        <p className="text-xl text-card-foreground mb-6">Page not found</p>
        <a href="/" className="text-primary hover:text-primary/80 underline transition-colors">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
