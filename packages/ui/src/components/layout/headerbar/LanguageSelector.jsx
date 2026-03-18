import React from 'react';
import { Button } from '@/components/ui/button';
import { Languages } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const LanguageSelector = ({ currentLang, onLanguageChange, t }) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant='ghost'
          size='icon-sm'
          aria-label={t('Change Language')}
          className='text-current hover:bg-accent focus-visible:outline-none'
        >
          <Languages size={18} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-40'>
        <DropdownMenuItem
          onClick={() => onLanguageChange('en')}
          className={cn(
            'text-[13px] text-sidebar-foreground',
            currentLang === 'en' &&
              'bg-accent font-medium text-sidebar-accent-foreground',
          )}
        >
          <span>{t('Lang English')}</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onLanguageChange('zh')}
          className={cn(
            'text-[13px] text-sidebar-foreground',
            currentLang === 'zh' &&
              'bg-accent font-medium text-sidebar-accent-foreground',
          )}
        >
          <span>{t('Lang Chinese')}</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onLanguageChange('fr')}
          className={cn(
            'text-[13px] text-sidebar-foreground',
            currentLang === 'fr' &&
              'bg-accent font-medium text-sidebar-accent-foreground',
          )}
        >
          <span>{t('Lang French')}</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onLanguageChange('ja')}
          className={cn(
            'text-[13px] text-sidebar-foreground',
            currentLang === 'ja' &&
              'bg-accent font-medium text-sidebar-accent-foreground',
          )}
        >
          <span>{t('Lang Japanese')}</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onLanguageChange('ru')}
          className={cn(
            'text-[13px] text-sidebar-foreground',
            currentLang === 'ru' &&
              'bg-accent font-medium text-sidebar-accent-foreground',
          )}
        >
          <span>{t('Lang Russian')}</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onLanguageChange('vi')}
          className={cn(
            'text-[13px] text-sidebar-foreground',
            currentLang === 'vi' &&
              'bg-accent font-medium text-sidebar-accent-foreground',
          )}
        >
          <span>{t('Lang Vietnamese')}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LanguageSelector;
