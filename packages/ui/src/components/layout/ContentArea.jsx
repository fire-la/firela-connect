import { cn } from '@/lib/utils';

/**
 * ContentArea - Main content area with responsive padding and max-width variants
 */
export function ContentArea({
  children,
  className,
  variant = 'wide',
  ...props
}) {
  const maxWidthClass =
    variant === 'narrow' ? 'max-w-[1400px]' : 'max-w-[2000px]';

  return (
    <main className={cn('flex-1', 'overflow-auto', className)} {...props}>
      <div
        className={cn(
          'mx-auto w-full pt-6 pb-4 px-6 md:px-8 lg:px-10',
          maxWidthClass,
        )}
      >
        {children}
      </div>
    </main>
  );
}

/**
 * ContentHeader - Content area header
 *
 * Used for page top title area
 */
export function ContentHeader({ title, description, actions, className }) {
  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-center sm:justify-between',
        'gap-2 sm:gap-4',
        'mb-4 sm:mb-6',
        'pb-3 sm:pb-4',
        'border-b border-border',
        className,
      )}
    >
      <div className='flex-1 min-w-0'>
        <h1 className='text-lg sm:text-xl font-bold font-mono tracking-tight truncate'>
          {title}
        </h1>
        {description && (
          <p className='text-sm text-muted-foreground font-mono mt-1'>
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className='flex items-center gap-2 shrink-0'>{actions}</div>
      )}
    </div>
  );
}

/**
 * ContentGrid - Content grid layout
 *
 * Used for card and list grid layouts
 */
export function ContentGrid({ children, className, columns = 3 }) {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div
      className={cn(
        'grid gap-4 sm:gap-6', // Vercel style: increased spacing
        gridCols[columns] || gridCols[3],
        className,
      )}
    >
      {children}
    </div>
  );
}
