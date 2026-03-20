import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

const SkeletonWrapper = ({
  loading = false,
  type = 'text',
  count = 1,
  width = 60,
  height = 16,
  isMobile = false,
  className = '',
  collapsed = false,
  showAdmin = true,
  children,
  ..._props
}) => {
  if (!loading) {
    return children;
  }

  // Navigation link skeleton
  const renderNavigationSkeleton = () => {
    const skeletonLinkClasses = isMobile
      ? 'flex items-center gap-1 p-1 w-full rounded-md'
      : 'flex items-center gap-1 p-2 rounded-md';

    return Array(count)
      .fill(null)
      .map((_, index) => (
        <div key={index} className={skeletonLinkClasses}>
          <Skeleton
            className='rounded-md'
            style={{ width: isMobile ? 40 : width, height }}
          />
        </div>
      ));
  };

  // User area skeleton (avatar + text)
  const renderUserAreaSkeleton = () => {
    return (
      <div
        className={`flex items-center p-1 rounded-full bg-muted dark:bg-fill-1 ${className}`}
      >
        <Skeleton className='w-6 h-6 rounded-full shadow-sm' />
        <div className='ml-1.5 mr-1'>
          <Skeleton
            className='rounded-md'
            style={{ width: isMobile ? 15 : width, height: 12 }}
          />
        </div>
      </div>
    );
  };

  // Logo image skeleton
  const renderImageSkeleton = () => {
    return (
      <Skeleton
        className={`absolute inset-0 ${className}`}
        style={{ width: '100%', height: '100%' }}
      />
    );
  };

  // System name skeleton
  const renderTitleSkeleton = () => {
    return <Skeleton className='rounded-md' style={{ width, height: 24 }} />;
  };

  // Generic text skeleton
  const renderTextSkeleton = () => {
    return (
      <div className={className}>
        <Skeleton className='rounded-md' style={{ width, height }} />
      </div>
    );
  };

  // Button skeleton (supports rounded)
  const renderButtonSkeleton = () => {
    return (
      <div className={className}>
        <Skeleton
          className='rounded-full'
          style={{ width, height, borderRadius: 9999 }}
        />
      </div>
    );
  };

  // Sidebar nav item skeleton (icon + text)
  const renderSidebarNavItemSkeleton = () => {
    return Array(count)
      .fill(null)
      .map((_, index) => (
        <div
          key={index}
          className={`flex items-center p-2 mb-1 rounded-md ${className}`}
        >
          {/* Icon skeleton */}
          <div className='sidebar-icon-container flex-shrink-0'>
            <Skeleton className='w-4 h-4 rounded' />
          </div>
          {/* Text skeleton */}
          <Skeleton
            className='ml-2 rounded-md'
            style={{ width: width || 80, height: height || 14 }}
          />
        </div>
      ));
  };

  // Sidebar group title skeleton
  const renderSidebarGroupTitleSkeleton = () => {
    return (
      <div className={`mb-2 ${className}`}>
        <Skeleton
          className='rounded-md'
          style={{ width: width || 60, height: height || 12 }}
        />
      </div>
    );
  };

  // Full sidebar skeleton - 1:1 restoration
  const renderSidebarSkeleton = () => {
    const NAV_WIDTH = 164;
    const NAV_HEIGHT = 30;
    const COLLAPSED_WIDTH = 44;
    const COLLAPSED_HEIGHT = 44;
    const ICON_SIZE = 16;
    const TITLE_HEIGHT = 12;
    const TEXT_HEIGHT = 16;

    const renderIcon = () => (
      <Skeleton
        className='rounded'
        style={{ width: ICON_SIZE, height: ICON_SIZE }}
      />
    );

    const renderLabel = (labelWidth) => (
      <Skeleton
        className='rounded-md'
        style={{ width: labelWidth, height: TEXT_HEIGHT }}
      />
    );

    const NavRow = ({ labelWidth }) => (
      <div
        className='flex items-center p-2 mb-1 rounded-md'
        style={{
          width: `${NAV_WIDTH}px`,
          height: `${NAV_HEIGHT}px`,
          margin: '3px 8px',
        }}
      >
        <div className='sidebar-icon-container flex-shrink-0'>
          {renderIcon()}
        </div>
        {renderLabel(labelWidth)}
      </div>
    );

    const CollapsedRow = ({ keyPrefix, index }) => (
      <div
        key={`${keyPrefix}-${index}`}
        className='flex items-center justify-center'
        style={{
          width: `${COLLAPSED_WIDTH}px`,
          height: `${COLLAPSED_HEIGHT}px`,
          margin: '0 8px 4px 8px',
        }}
      >
        <Skeleton
          className='rounded'
          style={{ width: ICON_SIZE, height: ICON_SIZE }}
        />
      </div>
    );

    if (collapsed) {
      return (
        <div className={`w-full ${className}`} style={{ paddingTop: '12px' }}>
          {Array(2)
            .fill(null)
            .map((_, i) => (
              <CollapsedRow key={`c-chat-${i}`} keyPrefix='c-chat' index={i} />
            ))}
          {Array(5)
            .fill(null)
            .map((_, i) => (
              <CollapsedRow key={`c-console-${i}`} keyPrefix='c-console' index={i} />
            ))}
          {Array(2)
            .fill(null)
            .map((_, i) => (
              <CollapsedRow key={`c-personal-${i}`} keyPrefix='c-personal' index={i} />
            ))}
          {Array(5)
            .fill(null)
            .map((_, i) => (
              <CollapsedRow key={`c-admin-${i}`} keyPrefix='c-admin' index={i} />
            ))}
        </div>
      );
    }

    const sections = [
      { key: 'chat', titleWidth: 32, itemWidths: [54, 32], wrapper: 'section' },
      { key: 'console', titleWidth: 48, itemWidths: [64, 64, 64, 64, 64] },
      { key: 'personal', titleWidth: 64, itemWidths: [64, 64] },
      ...(showAdmin
        ? [{ key: 'admin', titleWidth: 48, itemWidths: [64, 64, 80, 64, 64] }]
        : []),
    ];

    return (
      <div className={`w-full ${className}`} style={{ paddingTop: '12px' }}>
        {sections.map((sec, _idx) => (
          <React.Fragment key={sec.key}>
            {sec.wrapper === 'section' ? (
              <div className='sidebar-section'>
                <div
                  className='sidebar-group-label'
                  style={{ padding: '4px 15px 8px' }}
                >
                  <Skeleton
                    className='rounded-md'
                    style={{ width: sec.titleWidth, height: TITLE_HEIGHT }}
                  />
                </div>
                {sec.itemWidths.map((w, i) => (
                  <NavRow key={`${sec.key}-${i}`} labelWidth={w} />
                ))}
              </div>
            ) : (
              <div>
                <div
                  className='sidebar-group-label'
                  style={{ padding: '4px 15px 8px' }}
                >
                  <Skeleton
                    className='rounded-md'
                    style={{ width: sec.titleWidth, height: TITLE_HEIGHT }}
                  />
                </div>
                {sec.itemWidths.map((w, i) => (
                  <NavRow key={`${sec.key}-${i}`} labelWidth={w} />
                ))}
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  // Render different skeleton types based on type
  switch (type) {
    case 'navigation':
      return renderNavigationSkeleton();
    case 'userArea':
      return renderUserAreaSkeleton();
    case 'image':
      return renderImageSkeleton();
    case 'title':
      return renderTitleSkeleton();
    case 'sidebarNavItem':
      return renderSidebarNavItemSkeleton();
    case 'sidebarGroupTitle':
      return renderSidebarGroupTitleSkeleton();
    case 'sidebar':
      return renderSidebarSkeleton();
    case 'button':
      return renderButtonSkeleton();
    case 'text':
    default:
      return renderTextSkeleton();
  }
};

export default SkeletonWrapper;
