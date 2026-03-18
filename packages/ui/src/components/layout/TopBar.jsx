import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Menu, X } from 'lucide-react';

/**
 * TopBar - Terminal style top bar
 *
 * Design goals:
 * - Minimalist design: Logo + Navigation + User menu
 * - Responsive: Mobile collapsible navigation
 * - Monospace font
 */
export function TopBar({ user, onLogout, onMenuClick, isMobileMenuOpen, systemName = 'firela' }) {
  return (
    <header
      className={cn(
        // Layout
        'flex items-center justify-between',
        // Height
        'h-12 sm:h-14',
        // Padding
        'px-3 sm:px-4 md:px-6',
        // Terminal style: bottom border separator
        'border-b border-border',
      )}
    >
      {/* Logo area + Mobile menu button */}
      <div className='flex items-center gap-2 sm:gap-3'>
        {/* Mobile menu button */}
        <button
          onClick={onMenuClick}
          className={cn(
            'sm:hidden', // Mobile only
            'flex items-center justify-center',
            'w-8 h-8',
            'rounded-lg',
            'hover:bg-accent transition-colors',
            'text-muted-foreground hover:text-foreground',
          )}
          aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
        >
          {isMobileMenuOpen ? (
            <X className='w-5 h-5' />
          ) : (
            <Menu className='w-5 h-5' />
          )}
        </button>
        <span className='font-mono text-sm sm:text-base font-semibold tracking-tight'>
          {systemName}_
        </span>
      </div>

      {/* Navigation links */}
      <nav className='hidden sm:flex items-center gap-1'>
        <NavLink href='/console'>Console</NavLink>
        <NavLink href='/personal'>Personal</NavLink>
        <NavLink href='https://docs.firela.io' external>
          Docs
        </NavLink>
      </nav>

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              'flex items-center gap-2',
              'px-2 py-1',
              'rounded-md',
              'hover:bg-accent',
              'transition-colors',
            )}
          >
            <Avatar className='h-6 w-6'>
              <AvatarFallback className='text-xs bg-primary text-primary-foreground'>
                {user?.username?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <span className='hidden md:inline text-sm font-mono'>
              {user?.username || 'user'}
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='w-40'>
          <DropdownMenuItem asChild>
            <a href='/personal' className='font-mono text-sm'>
              Profile
            </a>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onLogout} className='font-mono text-sm'>
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

function NavLink({ href, children, external }) {
  const linkProps = external
    ? { target: '_blank', rel: 'noopener noreferrer' }
    : {};

  return (
    <a
      href={href}
      {...linkProps}
      className={cn(
        'px-2 sm:px-3 py-1',
        'text-sm font-mono',
        'text-muted-foreground hover:text-foreground',
        'rounded-md hover:bg-accent',
        'transition-colors',
      )}
    >
      {children}
    </a>
  );
}
