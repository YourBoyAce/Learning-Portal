'use client';

import { useEffect, useRef } from 'react';
import { useLoading } from '../../context/LoadingContext';
import GlobalLoader from './GlobalLoader';
import { useRouteChangeLoader } from '../../hooks/useRouteChangeLoader';

export default function LoadingManager() {
  const { isLoading, setLoading } = useLoading();

  // Handle route changes
  useRouteChangeLoader();

  const hasInitialized = useRef(false);

  // Handle initial page load
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    // Only show initial loader if document isn't fully ready yet
    if (document.readyState !== 'complete') {
      setLoading(true);
      const handleLoad = () => {
        setTimeout(() => setLoading(false), 800);
      };
      window.addEventListener('load', handleLoad);
      return () => window.removeEventListener('load', handleLoad);
    }
  }, [setLoading]);

  return <GlobalLoader isLoading={isLoading} />;
}
