import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';


function GoogleAnalytics() {
  const location = useLocation();
  const measurementId = import.meta.env.VITE_GOOGLE_ANALYTICS_ID;

  useEffect(() => {
    // Only initialize if measurement ID is provided
    if (!measurementId) {
      return; // Silent fail - don't log warning in production
    }

    // Load Google Analytics script dynamically
    if (!document.querySelector(`script[src*="googletagmanager.com/gtag/js"]`)) {
      // Initialize dataLayer
      window.dataLayer = window.dataLayer || [];
      window.gtag = function() {
        window.dataLayer.push(arguments);
      };
      window.gtag('js', new Date());
      window.gtag('config', measurementId, {
        send_page_view: false, // We'll handle page views manually with React Router
      });

      // Load the GA script
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
      document.head.appendChild(script);
    }
  }, [measurementId]);

  // Track page views on route changes
  useEffect(() => {
    if (!measurementId || typeof window.gtag === 'undefined') return;

    // Track page view when route changes
    window.gtag('event', 'page_view', {
      page_path: location.pathname + location.search,
      page_title: document.title,
    });
  }, [location, measurementId]);

  return null; // This component doesn't render anything
}

export default GoogleAnalytics;

