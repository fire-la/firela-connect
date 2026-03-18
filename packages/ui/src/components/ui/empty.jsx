import React from 'react';
import { cn } from '@/lib/utils';

const Empty = ({ image, description, className, ...props }) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 p-8',
        className,
      )}
      {...props}
    >
      {image && <div className='flex-shrink-0'>{image}</div>}
      {description && (
        <p className='text-sm text-muted-foreground text-center'>
          {description}
        </p>
      )}
    </div>
  );
};

const EmptyState = Empty;

export { Empty, EmptyState };
