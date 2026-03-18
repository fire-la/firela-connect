import { cn } from '@/lib/utils';

/**
 * PageHeader - Page title area component
 *
 * Design spec (12-DESIGN-SPEC.md):
 * - Title: text-2xl font-semibold text-neutral-900
 * - Description: text-sm text-neutral-500 mt-1
 * - Container: flex justify-between items-start mb-6
 * - Actions: flex items-center gap-2
 *
 * Structure:
 * +------------------------------------------+
 * | Title                        [Actions] |
 * | Description text                          |
 * +------------------------------------------+
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
  ...props
}) {
  return (
    <div
      className={cn('flex justify-between items-start mb-6', className)}
      {...props}
    >
      <div className='flex-1 min-w-0'>
        <h1 className='text-2xl font-semibold text-neutral-900 font-mono tracking-tight'>
          {title}
        </h1>
        {description && (
          <p className='text-sm text-neutral-500 mt-1 font-mono'>
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className='flex items-center gap-2 shrink-0 ml-4'>{actions}</div>
      )}
    </div>
  );
}
