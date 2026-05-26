'use client';

import { useEffect } from 'react';
import { useLoading } from '../context/LoadingContext';
import { usePathname } from 'next/navigation';

export function useRouteChangeLoader() {
  const { setLoading } = useLoading();
  const pathname = usePathname();

  useEffect(() => {
    // Show loader when route changes
    setLoading(true);

    // Hide loader after a short delay to simulate loading
    const timer = setTimeout(() => {
      setLoading(false);
    }, 800);

    return () => clearTimeout(timer);
  }, [pathname, setLoading]);
}
