'use client';

import * as React from 'react';
import { AlertDialog as AlertDialogPrimitive } from 'radix-ui';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

function AlertDialog({ ...props }) {
  return <AlertDialogPrimitive.Root data-slot='alert-dialog' {...props} />;
}

const AlertDialogTrigger = React.forwardRef(({ ...props }, ref) => {
  return (
    <AlertDialogPrimitive.Trigger
      ref={ref}
      data-slot='alert-dialog-trigger'
      {...props}
    />
  );
});
AlertDialogTrigger.displayName = 'AlertDialogTrigger';

function AlertDialogPortal({ ...props }) {
  return (
    <AlertDialogPrimitive.Portal data-slot='alert-dialog-portal' {...props} />
  );
}

const AlertDialogOverlay = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <AlertDialogPrimitive.Overlay
      ref={ref}
      data-slot='alert-dialog-overlay'
      className={cn(
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50',
        className,
      )}
      {...props}
    />
  );
});
AlertDialogOverlay.displayName = 'AlertDialogOverlay';

const AlertDialogContent = React.forwardRef(
  ({ className, size = 'default', ...props }, ref) => {
    return (
      <AlertDialogPortal>
        <AlertDialogOverlay />
        <AlertDialogPrimitive.Content
          ref={ref}
          data-slot='alert-dialog-content'
          data-size={size}
          className={cn(
            'bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 group/alert-dialog-content fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 data-[size=sm]:max-w-xs data-[size=default]:sm:max-w-lg',
            className,
          )}
          {...props}
        />
      </AlertDialogPortal>
    );
  },
);
AlertDialogContent.displayName = 'AlertDialogContent';

function AlertDialogHeader({ className, ...props }) {
  return (
    <div
      data-slot='alert-dialog-header'
      className={cn(
        'grid grid-rows-[auto_1fr] place-items-center gap-1.5 text-center has-data-[slot=alert-dialog-media]:grid-rows-[auto_auto_1fr] has-data-[slot=alert-dialog-media]:gap-x-6 sm:group-data-[size=default]/alert-dialog-content:place-items-start sm:group-data-[size=default]/alert-dialog-content:text-left sm:group-data-[size=default]/alert-dialog-content:has-data-[slot=alert-dialog-media]:grid-rows-[auto_1fr]',
        className,
      )}
      {...props}
    />
  );
}

function AlertDialogFooter({ className, ...props }) {
  return (
    <div
      data-slot='alert-dialog-footer'
      className={cn(
        'flex flex-col-reverse gap-2 group-data-[size=sm]/alert-dialog-content:grid group-data-[size=sm]/alert-dialog-content:grid-cols-2 sm:flex-row sm:justify-end',
        className,
      )}
      {...props}
    />
  );
}

const AlertDialogTitle = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <AlertDialogPrimitive.Title
      ref={ref}
      data-slot='alert-dialog-title'
      className={cn(
        'text-lg font-semibold sm:group-data-[size=default]/alert-dialog-content:group-has-data-[slot=alert-dialog-media]/alert-dialog-content:col-start-2',
        className,
      )}
      {...props}
    />
  );
});
AlertDialogTitle.displayName = 'AlertDialogTitle';

const AlertDialogDescription = React.forwardRef(
  ({ className, ...props }, ref) => {
    return (
      <AlertDialogPrimitive.Description
        ref={ref}
        data-slot='alert-dialog-description'
        className={cn('text-muted-foreground text-sm', className)}
        {...props}
      />
    );
  },
);
AlertDialogDescription.displayName = 'AlertDialogDescription';

function AlertDialogMedia({ className, ...props }) {
  return (
    <div
      data-slot='alert-dialog-media'
      className={cn(
        "bg-muted mb-2 inline-flex size-16 items-center justify-center rounded-md sm:group-data-[size=default]/alert-dialog-content:row-span-2 *:[svg:not([class*='size-'])]:size-8",
        className,
      )}
      {...props}
    />
  );
}

const AlertDialogAction = React.forwardRef(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <Button variant={variant} size={size} asChild>
        <AlertDialogPrimitive.Action
          ref={ref}
          data-slot='alert-dialog-action'
          className={cn(className)}
          {...props}
        />
      </Button>
    );
  },
);
AlertDialogAction.displayName = 'AlertDialogAction';

const AlertDialogCancel = React.forwardRef(
  ({ className, variant = 'outline', size = 'default', ...props }, ref) => {
    return (
      <Button variant={variant} size={size} asChild>
        <AlertDialogPrimitive.Cancel
          ref={ref}
          data-slot='alert-dialog-cancel'
          className={cn(className)}
          {...props}
        />
      </Button>
    );
  },
);
AlertDialogCancel.displayName = 'AlertDialogCancel';

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
};
