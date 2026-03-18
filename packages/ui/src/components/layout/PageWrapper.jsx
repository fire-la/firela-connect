import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * PageWrapper - Forces page remount on route changes
 *
 * Uses key prop with location.pathname to force React
 * to unmount and remount the page content when navigating.
 */
export function PageWrapper({ children }) {
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);

  useEffect(() => {
    // Track path changes for debugging
    prevPathRef.current = location.pathname;
  }, [location.pathname]);

  // Use key to force remount when path changes
  return (
    <div key={location.pathname} className='page-wrapper'>
      {children}
    </div>
  );
}
