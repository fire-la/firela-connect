import * as React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoreHorizontal,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

function Pagination({ className, ...props }) {
  return (
    <nav
      role='navigation'
      aria-label='pagination'
      className={cn('mx-auto flex w-full justify-center', className)}
      {...props}
    />
  );
}
Pagination.displayName = 'Pagination';

function PaginationContent({ className, ...props }) {
  return (
    <ul
      className={cn('flex flex-row items-center gap-1', className)}
      {...props}
    />
  );
}
PaginationContent.displayName = 'PaginationContent';

function PaginationItem({ className, ...props }) {
  return <li className={cn('', className)} {...props} />;
}
PaginationItem.displayName = 'PaginationItem';

function PaginationLink({ className, isActive, size = 'icon', ...props }) {
  return (
    <a
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        buttonVariants({
          variant: isActive ? 'outline' : 'ghost',
          size,
        }),
        'cursor-pointer',
        isActive && 'border-orange-500 bg-orange-500/10',
        className,
      )}
      {...props}
    />
  );
}
PaginationLink.displayName = 'PaginationLink';

function PaginationPrevious({ className, ...props }) {
  return (
    <PaginationLink
      aria-label='Go to previous page'
      size='default'
      className={cn('gap-1 pl-2.5', className)}
      {...props}
    >
      <ChevronLeft className='h-4 w-4' />
      <span className='hidden sm:inline'>Previous</span>
    </PaginationLink>
  );
}
PaginationPrevious.displayName = 'PaginationPrevious';

function PaginationNext({ className, ...props }) {
  return (
    <PaginationLink
      aria-label='Go to next page'
      size='default'
      className={cn('gap-1 pr-2.5', className)}
      {...props}
    >
      <span className='hidden sm:inline'>Next</span>
      <ChevronRight className='h-4 w-4' />
    </PaginationLink>
  );
}
PaginationNext.displayName = 'PaginationNext';

function PaginationFirst({ className, ...props }) {
  return (
    <PaginationLink
      aria-label='Go to first page'
      size='default'
      className={cn('gap-1 pl-2.5', className)}
      {...props}
    >
      <ChevronsLeft className='h-4 w-4' />
      <span className='hidden sm:inline'>First</span>
    </PaginationLink>
  );
}
PaginationFirst.displayName = 'PaginationFirst';

function PaginationLast({ className, ...props }) {
  return (
    <PaginationLink
      aria-label='Go to last page'
      size='default'
      className={cn('gap-1 pr-2.5', className)}
      {...props}
    >
      <span className='hidden sm:inline'>Last</span>
      <ChevronsRight className='h-4 w-4' />
    </PaginationLink>
  );
}
PaginationLast.displayName = 'PaginationLast';

function PaginationEllipsis({ className, ...props }) {
  return (
    <span
      aria-hidden
      className={cn('flex h-9 w-9 items-center justify-center', className)}
      {...props}
    >
      <MoreHorizontal className='h-4 w-4' />
      <span className='sr-only'>More pages</span>
    </span>
  );
}
PaginationEllipsis.displayName = 'PaginationEllipsis';

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationFirst,
  PaginationItem,
  PaginationLast,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
};
