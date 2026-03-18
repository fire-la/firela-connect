import React from 'react';
import { Button } from '@/components/ui/button';
import { X, Menu } from 'lucide-react';

const MobileMenuButton = ({
  isConsoleRoute,
  isMobile,
  openMobile,
  collapsed,
  onToggle,
  t,
}) => {
  if (!isConsoleRoute || !isMobile) {
    return null;
  }

  const isOpen = isMobile ? openMobile : !collapsed;

  return (
    <Button
      variant='ghost'
      size='icon-sm'
      aria-label={isOpen ? t('Close sidebar') : t('Open sidebar')}
      onClick={onToggle}
      className='text-current hover:bg-accent'
    >
      {isOpen ? <X className='size-5' /> : <Menu className='size-5' />}
    </Button>
  );
};

export default MobileMenuButton;
