import React, { useEffect, useState, useContext, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { API, showError, getRelativeTime } from '../../helpers';
import { marked } from 'marked';
import { StatusContext } from '../../context/Status';
import { Bell, Megaphone, FileText, Inbox, Circle } from 'lucide-react';
import { Empty } from '@/components/ui/empty';

const NoticeModal = ({
  visible,
  onClose,
  isMobile,
  defaultTab = 'inApp',
  unreadKeys = [],
}) => {
  const { t } = useTranslation();
  const [noticeContent, setNoticeContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(defaultTab);

  const [statusState] = useContext(StatusContext);

  const announcements = statusState?.status?.announcements || [];

  const unreadSet = useMemo(() => new Set(unreadKeys), [unreadKeys]);

  const getKeyForItem = (item) =>
    `${item?.publishDate || ''}-${(item?.content || '').slice(0, 30)}`;

  const processedAnnouncements = useMemo(() => {
    return (announcements || []).slice(0, 20).map((item) => {
      const pubDate = item?.publishDate ? new Date(item.publishDate) : null;
      const absoluteTime =
        pubDate && !isNaN(pubDate.getTime())
          ? `${pubDate.getFullYear()}-${String(pubDate.getMonth() + 1).padStart(2, '0')}-${String(pubDate.getDate()).padStart(2, '0')} ${String(pubDate.getHours()).padStart(2, '0')}:${String(pubDate.getMinutes()).padStart(2, '0')}`
          : item?.publishDate || '';
      return {
        key: getKeyForItem(item),
        type: item.type || 'default',
        time: absoluteTime,
        content: item.content,
        extra: item.extra,
        relative: getRelativeTime(item.publishDate),
        isUnread: unreadSet.has(getKeyForItem(item)),
      };
    });
  }, [announcements, unreadSet]);

  const handleCloseTodayNotice = () => {
    const today = new Date().toDateString();
    localStorage.setItem('notice_close_date', today);
    onClose();
  };

  const displayNotice = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/notice');
      const { success, message, data } = res.data;
      if (success) {
        if (data !== '') {
          const htmlNotice = marked.parse(data);
          setNoticeContent(htmlNotice);
        } else {
          setNoticeContent('');
        }
      } else {
        showError(message);
      }
    } catch (error) {
      showError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      displayNotice();
    }
  }, [visible]);

  useEffect(() => {
    if (visible) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab, visible]);

  const renderMarkdownNotice = () => {
    if (loading) {
      return (
        <div className='py-12'>
          <Empty description={t('Loading...')} />
        </div>
      );
    }

    if (!noticeContent) {
      return (
        <div className='py-12'>
          <Empty
            image={<Inbox className='h-24 w-24 text-muted-foreground/50' />}
            description={t('No Notice')}
          />
        </div>
      );
    }

    return (
      <div
        dangerouslySetInnerHTML={{ __html: noticeContent }}
        className='notice-content-scroll max-h-[55vh] overflow-y-auto pr-2'
      />
    );
  };

  const renderAnnouncementTimeline = () => {
    if (processedAnnouncements.length === 0) {
      return (
        <div className='py-12'>
          <Empty
            image={<Inbox className='h-24 w-24 text-muted-foreground/50' />}
            description={t('No system notice')}
          />
        </div>
      );
    }

    // Get timeline dot color based on type
    const getDotColor = (type) => {
      switch (type) {
        case 'success':
          return 'bg-green-500';
        case 'warning':
          return 'bg-yellow-500';
        case 'error':
          return 'bg-red-500';
        case 'info':
          return 'bg-blue-500';
        default:
          return 'bg-primary';
      }
    };

    return (
      <div className='max-h-[55vh] overflow-y-auto pr-2 card-content-scroll'>
        <div className='relative'>
          {/* Timeline vertical line */}
          <div className='absolute left-2 top-2 bottom-2 w-0.5 bg-border' />

          {/* Timeline items */}
          <div className='space-y-4'>
            {processedAnnouncements.map((item, idx) => {
              const htmlContent = marked.parse(item.content || '');
              const htmlExtra = item.extra ? marked.parse(item.extra) : '';
              return (
                <div key={idx} className='relative flex gap-4 pl-8'>
                  {/* Timeline dot */}
                  <div
                    className={`absolute left-0 top-2 size-4 rounded-full border-2 border-background ${getDotColor(item.type)} ${item.isUnread ? 'ring-2 ring-primary/50' : ''}`}
                  />

                  {/* Content */}
                  <div className='flex-1 min-w-0 pb-4'>
                    {/* Time */}
                    <div className='text-xs text-muted-foreground mb-1'>
                      {item.relative ? `${item.relative} ` : ''}
                      {item.time}
                    </div>

                    {/* Main content */}
                    <div
                      className={item.isUnread ? 'shine-text' : ''}
                      dangerouslySetInnerHTML={{ __html: htmlContent }}
                    />

                    {/* Extra info */}
                    {item.extra && (
                      <div
                        className='text-xs text-secondary mt-1'
                        dangerouslySetInnerHTML={{ __html: htmlExtra }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderBody = () => {
    if (activeTab === 'inApp') {
      return renderMarkdownNotice();
    }
    return renderAnnouncementTimeline();
  };

  return (
    <Dialog open={visible} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={isMobile ? 'max-w-[95vw]' : 'max-w-[700px]'}>
        <DialogHeader>
          <div className='flex items-center justify-between w-full'>
            <DialogTitle>{t('System Notice')}</DialogTitle>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value='inApp' className='flex items-center gap-1'>
                  <Bell size={14} />
                  <span className='hidden sm:inline'>{t('Notice')}</span>
                </TabsTrigger>
                <TabsTrigger value='system' className='flex items-center gap-1'>
                  <Megaphone size={14} />
                  <span className='hidden sm:inline'>{t('System Notice')}</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </DialogHeader>

        <div className='py-2'>{renderBody()}</div>

        <DialogFooter>
          <Button variant='outline' onClick={handleCloseTodayNotice}>
            {t('Close Today')}
          </Button>
          <Button onClick={onClose}>{t('Close Notice')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NoticeModal;
