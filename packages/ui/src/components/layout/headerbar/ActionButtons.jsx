import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ThemeToggle from './ThemeToggle';

const ActionButtons = ({ theme, onThemeToggle, navigate: _navigate, t }) => {
  return (
    <div className='flex items-center gap-4'>
      {/* GitHub Link - matches Pencil: 14px, normal, muted-foreground */}
      <a
        href='https://github.com/fire-la'
        target='_blank'
        rel='noopener noreferrer'
        className='text-[13px] font-light text-muted-foreground hover:text-foreground transition-colors'
      >
        GitHub
      </a>

      {/* Get Started Button - matches Pencil: text + arrow icon, padding [8,16] */}
      <a
        href='https://docs.firela.io/quickstart'
        target='_blank'
        rel='noopener noreferrer'
      >
        <Button
          size='sm'
          className='bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 h-7 text-[13px] font-light'
        >
          {t('Get started')}
          <ChevronRight className='ml-1 h-4 w-4' />
        </Button>
      </a>

      {/* Theme Toggle */}
      <ThemeToggle theme={theme} onThemeToggle={onThemeToggle} t={t} />
    </div>
  );
};

export default ActionButtons;
