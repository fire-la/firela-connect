import React from 'react';
import { useHeaderBar } from '../../../hooks/common/useHeaderBar';
import { useNotifications } from '../../../hooks/common/useNotifications';
import NoticeModal from '../NoticeModal';
import MobileMenuButton from './MobileMenuButton';
import ActionButtons from './ActionButtons';

const HeaderBar = ({ onMobileMenuToggle, drawerOpen }) => {
  const {
    statusState,
    isMobile,
    collapsed,
    openMobile,
    isConsoleRoute,
    theme,
    handleThemeToggle,
    handleMobileMenuToggle,
    navigate,
    t,
  } = useHeaderBar({ onMobileMenuToggle, drawerOpen });

  const { noticeVisible, unreadCount, handleNoticeClose, getUnreadKeys } =
    useNotifications(statusState);

  return (
    <header className='text-foreground sticky top-0 z-50 bg-sidebar border-b border-border'>
      <NoticeModal
        visible={noticeVisible}
        onClose={handleNoticeClose}
        isMobile={isMobile}
        defaultTab={unreadCount > 0 ? 'system' : 'inApp'}
        unreadKeys={getUnreadKeys()}
      />

      <div className='w-full px-4'>
        <div className='flex items-center justify-between h-14'>
          {/* Left: Mobile Menu Button */}
          <div className='flex items-center'>
            <MobileMenuButton
              isConsoleRoute={isConsoleRoute}
              isMobile={isMobile}
              openMobile={openMobile}
              collapsed={collapsed}
              onToggle={handleMobileMenuToggle}
              t={t}
            />
          </div>

          {/* Right: GitHub + Get started + Theme toggle */}
          <ActionButtons
            theme={theme}
            onThemeToggle={handleThemeToggle}
            navigate={navigate}
            t={t}
          />
        </div>
      </div>
    </header>
  );
};

export default HeaderBar;
