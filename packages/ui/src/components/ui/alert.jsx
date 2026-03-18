import * as React from 'react';
import { cva } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const alertVariants = cva(
  'relative w-full rounded-lg border px-4 py-3 text-sm grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current',
  {
    variants: {
      variant: {
        default: 'bg-background text-foreground',
        destructive:
          'border-destructive bg-background [&>svg]:text-destructive [&_h5]:text-destructive',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

const Alert = React.forwardRef(({ className, variant, ...props }, ref) => {
  return (
    <div
      ref={ref}
      role='alert'
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
});
Alert.displayName = 'Alert';

const AlertTitle = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <h5
      ref={ref}
      className={cn('mb-1 font-medium leading-none tracking-tight', className)}
      {...props}
    />
  );
});
AlertTitle.displayName = 'AlertTitle';

const AlertDescription = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        'text-sm text-muted-foreground [&_p]:leading-relaxed',
        className,
      )}
      {...props}
    />
  );
});
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertTitle, AlertDescription };
