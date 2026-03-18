import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell } from 'lucide-react';

const NotificationButton = ({ unreadCount, onNoticeOpen, t }) => {
  const displayCount = unreadCount > 99 ? '99+' : unreadCount;

  return (
    <div className='relative'>
      <Button
        variant='ghost'
        size='icon-sm'
        aria-label={t('System Notice')}
        onClick={onNoticeOpen}
        className='text-current hover:bg-accent'
      >
        <Bell size={18} />
      </Button>
      {unreadCount > 0 && (
        <Badge
          variant='destructive'
          className='absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-bold'
        >
          {displayCount}
        </Badge>
      )}
    </div>
  );
};

export default NotificationButton;
