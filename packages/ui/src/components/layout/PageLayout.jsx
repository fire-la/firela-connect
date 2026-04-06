import React, { useState } from 'react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { Toaster } from '@/components/ui/sonner';
import { AppSidebar } from './AppSidebar';
import HeaderBar from './headerbar';
import { useIsMobile } from '../../hooks/common/useIsMobile';

/**
 * PageLayout - Main layout component with responsive sidebar
 *
 * Design goals:
 * - Unified SidebarProvider-based layout for ALL routes
 * - Mobile-responsive with collapsible sidebar
 * - Clean separation between sidebar and content
 *
 * Usage:
 * <PageLayout menuItems={menuItems} user={user} onLogout={onLogout}>
 *   <App />
 * </PageLayout>
 */
const PageLayout = ({
  children,
  menuItems = [],
  user,
  onLogout,
  systemName = 'connect',
  logo,
}) => {
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // All routes use unified sidebar layout
  return (
    <SidebarProvider defaultOpen={true}>
      <div className='flex min-h-screen w-full'>
        <AppSidebar
          menuItems={menuItems}
          user={user}
          onLogout={onLogout}
          systemName={systemName}
          logo={logo}
          onNavigate={() => {
            if (isMobile) setDrawerOpen(false);
          }}
        />
        <SidebarInset>
          <HeaderBar
            onMobileMenuToggle={() => setDrawerOpen((prev) => !prev)}
            drawerOpen={drawerOpen}
          />
          <main className='flex-1 relative overflow-auto'>
            {/* Inner container with responsive padding */}
            <div className='mx-auto max-w-[2000px] w-full pt-6 pb-4 px-6 md:px-8 lg:px-10'>
              {children}
            </div>
          </main>
        </SidebarInset>
      </div>
      <Toaster />
    </SidebarProvider>
  );
};

export { PageLayout };
export default PageLayout;
