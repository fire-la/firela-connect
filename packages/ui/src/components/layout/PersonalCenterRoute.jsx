import { Outlet, useLocation } from 'react-router-dom';
import { PersonalCenterLayout } from './PersonalCenterLayout';
import { PageWrapper } from './PageWrapper';

/**
 * PersonalCenterRoute - Personal Center route wrapper
 *
 * Wraps all Personal Center pages with PersonalCenterLayout
 * Child routes are rendered via Outlet
 * PageWrapper forces page remount on route change
 */
export function PersonalCenterRoute() {
  const location = useLocation();

  return (
    <PersonalCenterLayout>
      <PageWrapper>
        <Outlet />
      </PageWrapper>
    </PersonalCenterLayout>
  );
}
