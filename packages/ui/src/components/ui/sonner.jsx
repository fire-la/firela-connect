import { Toaster as SonnerToaster, toast } from 'sonner';

/**
 * Firela Toaster Component
 * Uses sonner for toast notifications with Firela brand styling
 *
 * Usage:
 * import { Toaster, toast } from '@/components/ui/sonner';
 *
 * // In your app root:
 * <Toaster />
 *
 * // In components:
 * toast.success('Success message');
 * toast.error('Error message');
 * toast.info('Info message');
 * toast.warning('Warning message');
 */

export function Toaster() {
  return (
    <SonnerToaster
      position='top-center'
      toastOptions={{
        style: {
          background: 'hsl(var(--background))',
          color: 'hsl(var(--foreground))',
          border: '1px solid hsl(var(--border))',
        },
        classNames: {
          error: 'bg-destructive text-destructive-foreground',
          success: 'bg-green-50 text-green-800 border-green-200',
          warning: 'bg-yellow-50 text-yellow-800 border-yellow-200',
          info: 'bg-blue-50 text-blue-800 border-blue-200',
        },
      }}
      richColors
      closeButton
    />
  );
}

export { toast };
