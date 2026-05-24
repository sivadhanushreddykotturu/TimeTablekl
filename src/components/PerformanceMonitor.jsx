import React, { useEffect } from 'react';

const PerformanceMonitor = () => {
  useEffect(() => {
    // Monitor PWA installation performance
    const startTime = performance.now();
    
    // Track when the app becomes interactive
    const trackInteractive = () => {
      const interactiveTime = performance.now() - startTime;
      console.log(`🚀 App became interactive in: ${interactiveTime.toFixed(2)}ms`);
      
      // Send to analytics if available
      if (window.gtag) {
        window.gtag('event', 'timing_complete', {
          name: 'app_interactive',
          value: Math.round(interactiveTime)
        });
      }
    };

    // Track when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        const domReadyTime = performance.now() - startTime;
        console.log(`📄 DOM ready in: ${domReadyTime.toFixed(2)}ms`);
      });
    } else {
      const domReadyTime = performance.now() - startTime;
      console.log(`📄 DOM ready in: ${domReadyTime.toFixed(2)}ms`);
    }

    // Track when window is loaded
    if (document.readyState === 'complete') {
      const loadTime = performance.now() - startTime;
      console.log(`🌐 Window loaded in: ${loadTime.toFixed(2)}ms`);
    } else {
      window.addEventListener('load', () => {
        const loadTime = performance.now() - startTime;
        console.log(`🌐 Window loaded in: ${loadTime.toFixed(2)}ms`);
      });
    }

    // Track service worker registration
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(() => {
        const swReadyTime = performance.now() - startTime;
        console.log(`⚙️ Service Worker ready in: ${swReadyTime.toFixed(2)}ms`);
      });
    }

    // Track PWA install prompt
    window.addEventListener('beforeinstallprompt', () => {
      const promptTime = performance.now() - startTime;
      console.log(`📱 PWA install prompt ready in: ${promptTime.toFixed(2)}ms`);
    });

    // Track successful installation
    window.addEventListener('appinstalled', () => {
      const installTime = performance.now() - startTime;
      console.log(`✅ PWA installed successfully in: ${installTime.toFixed(2)}ms`);
    });

    // Track when app becomes interactive
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
      trackInteractive();
    } else {
      document.addEventListener('readystatechange', () => {
        if (document.readyState === 'interactive' || document.readyState === 'complete') {
          trackInteractive();
        }
      });
    }

    // Monitor bundle sizes
    const scripts = document.querySelectorAll('script[src]');
    let totalScriptSize = 0;
    
    scripts.forEach(script => {
      const src = script.src;
      if (src.includes('assets/js/')) {
        console.log(`📦 Script loaded: ${src.split('/').pop()}`);
      }
    });

    // Monitor network performance
    if ('connection' in navigator) {
      const connection = navigator.connection;
      console.log(`🌐 Network: ${connection.effectiveType} (${connection.downlink}Mbps)`);
    }

  }, []);

  return null; // This component doesn't render anything
};

export default PerformanceMonitor; 