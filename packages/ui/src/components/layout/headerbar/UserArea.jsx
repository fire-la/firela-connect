import React from 'react';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ChevronDown, LogOut, UserCog, CreditCard, Key } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { stringToColor } from '../../../helpers';
import SkeletonWrapper from '../components/SkeletonWrapper';

const UserArea = ({
  userState,
  isLoading,
  isMobile,
  isSelfUseMode,
  logout,
  navigate,
  t,
}) => {
  if (isLoading) {
    return (
      <SkeletonWrapper
        loading={true}
        type='userArea'
        width={50}
        isMobile={isMobile}
      />
    );
  }

  if (userState.user) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant='ghost'
            className='flex items-center gap-1.5 p-1 hover:bg-accent'
          >
            <Avatar
              size='sm'
              className='mr-1 size-6'
              style={{
                backgroundColor: `hsl(var(--color-${stringToColor(userState.user.username)}))`,
              }}
            >
              <AvatarFallback>
                {userState.user.username[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className='hidden md:inline'>
              <span className='text-xs font-medium text-foreground mr-1'>
                {userState.user.username}
              </span>
            </span>
            <ChevronDown size={14} className='text-xs text-muted-foreground' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='w-48'>
          <DropdownMenuItem
            onClick={() => {
              navigate('/console/personal');
            }}
          >
            <UserCog className='size-4 text-secondary dark:text-tertiary' />
            <span>{t('Personal Settings')}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              navigate('/console/token');
            }}
          >
            <Key className='size-4 text-secondary dark:text-tertiary' />
            <span>{t('Token Management')}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              navigate('/console/topup');
            }}
          >
            <CreditCard className='size-4 text-secondary dark:text-tertiary' />
            <span>{t('Wallet Management')}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={logout} variant='destructive'>
            <LogOut className='size-4' />
            <span>{t('Quit')}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  } else {
    const showRegisterButton = !isSelfUseMode;

    return (
      <div className='flex items-center'>
        <Link to='/login' className='flex'>
          <Button
            variant='ghost'
            size='sm'
            className={`flex items-center justify-center py-2.5 px-1.5 text-xs font-medium ${showRegisterButton && !isMobile ? 'rounded-l-full rounded-r-none' : 'rounded-lg'}`}
          >
            {t('Sign in')}
          </Button>
        </Link>
        {showRegisterButton && (
          <div className='hidden md:block'>
            <Link to='/register' className='flex -ml-px'>
              <Button
                variant='default'
                size='sm'
                className='rounded-r-full rounded-l-none flex items-center justify-center py-2.5 px-1.5 text-xs font-medium'
              >
                {t('Sign up')}
              </Button>
            </Link>
          </div>
        )}
      </div>
    );
  }
};

export default UserArea;
