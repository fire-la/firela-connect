import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { Toaster } from '@/components/ui/sonner';
import { AppSidebar } from './AppSidebar';
import { TopBar } from './TopBar';

/**
 * PageLayout - Main layout component with responsive sidebar
 *
 * Design goals:
 * - SidebarProvider-based layout for console routes
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
  systemName = 'firela',
  logo,
}) => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Check if current route uses sidebar layout
  const isConsoleRoute = location.pathname.startsWith('/console');

  // For /console routes, use Shadcn SidebarProvider layout
  if (isConsoleRoute) {
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
            <header className='sticky top-0 z-50'>
              <TopBar
                user={user}
                onLogout={onLogout}
                onMenuClick={() => setDrawerOpen((prev) => !prev)}
                isMobileMenuOpen={drawerOpen}
              />
            </header>
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
  }

  // Legacy layout for non-console routes
  return (
    <div
      className='flex flex-col h-screen'
      style={{
        overflow: isMobile ? 'visible' : 'hidden',
      }}
    >
      <header
        className='fixed top-0 left-0 right-0 z-[100] w-full'
        style={{ height: 'auto', lineHeight: 'normal', padding: 0 }}
      >
        <TopBar
          user={user}
          onLogout={onLogout}
          onMenuClick={() => setDrawerOpen((prev) => !prev)}
          isMobileMenuOpen={drawerOpen}
        />
      </header>

      <div
        className='flex flex-1'
        style={{
          overflow: isMobile ? 'visible' : 'auto',
          marginTop: '56px',
        }}
      >
        <div
          className='flex flex-col flex-1'
          style={{
            marginLeft: '0',
          }}
        >
          <main
            className='flex-1 relative'
            style={{
              overflowY: isMobile ? 'visible' : 'hidden',
              WebkitOverflowScrolling: 'touch',
              padding: '0',
            }}
          >
            {children}
          </main>
        </div>
      </div>

      <Toaster />
    </div>
  );
};

/**
 * Simple hook to detect mobile viewport
 */
function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

export { PageLayout };
export default PageLayout;
