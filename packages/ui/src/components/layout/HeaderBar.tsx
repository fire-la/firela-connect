import React, { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Moon, Sun, Menu, X } from 'lucide-react';
import { useSidebar } from '@/components/ui/sidebar';

interface HeaderBarProps {
  systemName?: string;
  onMenuClick?: () => void;
}

/**
 * HeaderBar - Terminal style header bar with theme toggle and sidebar controls
 *
 * Design goals:
 * - Minimalist terminal style
 * - Theme toggle (light/dark/system)
 * - Sidebar toggle for mobile
 * - Clean integration with shadcn/ui components
 */
export function HeaderBar({
  systemName = 'firela',
  onMenuClick
}: HeaderBarProps) {
  const { state, isMobile, toggleSidebar, openMobile, setOpenMobile } = useSidebar();

  // Theme toggle - simplified without external context
  const handleThemeToggle = () => {
    const currentTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.classList.remove(currentTheme);
    document.documentElement.classList.add(nextTheme);
    localStorage.setItem('theme', nextTheme);
  };

  // Initialize theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(savedTheme);
    }
  }, []);

  // Mobile menu toggle
  const handleMenuToggle = () => {
    if (isMobile) {
      setOpenMobile(!openMobile);
    } else {
      toggleSidebar();
    }
    onMenuClick?.();
  };

  return (
    <header className={cn(
      'sticky top-0 z-50',
      'h-14',
      'flex items-center justify-between',
      'px-4',
      'bg-sidebar border-b border-border',
      'text-sidebar-foreground'
    )}>
      {/* Left side - Menu button + Logo */}
      <div className='flex items-center gap-2'>
        {/* Mobile menu button */}
        {isMobile && (
          <Button
            variant='ghost'
            size='icon-sm'
            onClick={handleMenuToggle}
            className='text-sidebar-foreground hover:bg-sidebar-accent'
          >
            {openMobile ? <X className='h-4 w-4' /> : <Menu className='h-4 w-4' />}
          </Button>
        )}

        {/* Logo/Brand */}
        <span className='font-mono text-sm font-semibold tracking-tight'>
          {systemName}_
        </span>
      </div>

      {/* Right side - Theme toggle */}
      <div className='flex items-center gap-2'>
        <Button
          variant='ghost'
          size='icon-sm'
          onClick={handleThemeToggle}
          className='text-sidebar-foreground hover:bg-sidebar-accent'
          aria-label='Toggle theme'
        >
          <Sun className='h-4 w-4 rotate-0 scale-100 dark:scale-0' />
          <Moon className='absolute h-4 w-4 rotate-90 scale-0 dark:scale-100' />
        </Button>
      </div>
    </header>
  );
}

export default HeaderBar;
