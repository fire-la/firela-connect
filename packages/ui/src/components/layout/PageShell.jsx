import { cn } from '@/lib/utils';

/**
 * PageShell - Terminal-style fullscreen layout container
 *
 * Design goals:
 * - Fullscreen layout (min-h-screen)
 * - Terminal-style border and radius
 * - Responsive padding
 */
export function PageShell({ children, className }) {
  return (
    <div
      className={cn(
        // Fullscreen layout
        'min-h-screen bg-background',
        className,
      )}
    >
      {/* Content frame */}
      <div
        className={cn(
          // Fill available space
          'min-h-screen',
          // Background color
          'bg-card',
          // Content layout
          'flex flex-col',
        )}
      >
        {children}
      </div>
    </div>
  );
}
