import { useState, useEffect, useRef } from 'react';

/**
 * Custom Hook: Ensure skeleton screen is displayed for at least the specified time
 * @param {boolean} loading - Actual loading state
 * @param {number} minimumTime - Minimum display time (milliseconds), default 1000ms
 * @returns {boolean} showSkeleton - Whether to show skeleton screen
 */
export const useMinimumLoadingTime = (loading, minimumTime = 1000) => {
  const [showSkeleton, setShowSkeleton] = useState(loading);
  const loadingStartRef = useRef(Date.now());

  useEffect(() => {
    if (loading) {
      loadingStartRef.current = Date.now();
      setShowSkeleton(true);
    } else {
      const elapsed = Date.now() - loadingStartRef.current;
      const remaining = Math.max(0, minimumTime - elapsed);

      if (remaining === 0) {
        setShowSkeleton(false);
      } else {
        const timer = setTimeout(() => setShowSkeleton(false), remaining);
        return () => clearTimeout(timer);
      }
    }
  }, [loading, minimumTime]);

  return showSkeleton;
};
