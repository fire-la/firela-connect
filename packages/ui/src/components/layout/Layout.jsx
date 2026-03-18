import { cn } from '@/lib/utils';

/**
 * Stack - Vertical stack layout
 *
 * Design spec (12-DESIGN-SPEC.md):
 * - Used for vertically arranging child elements
 * - gap controls element spacing
 *
 * Usage:
 * <Stack gap={4}>
 *   <div>Item 1</div>
 *   <div>Item 2</div>
 * </Stack>
 */
export function Stack({ children, gap = 4, className, ...props }) {
  const gapClass = `gap-${gap}`;
  return (
    <div className={cn('flex flex-col', gapClass, className)} {...props}>
      {children}
    </div>
  );
}

/**
 * Grid - Grid layout
 *
 * Design spec (12-DESIGN-SPEC.md):
 * - Responsive grid layout
 * - cols controls the number of columns
 * - gap controls spacing
 *
 * Usage:
 * <Grid cols={4} gap={4}>
 *   <StatsCard />
 *   <StatsCard />
 *   <StatsCard />
 *   <StatsCard />
 * </Grid>
 */
export function Grid({ children, cols = 3, gap = 4, className, ...props }) {
  // Responsive column mapping
  const colsMap = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-5',
    6: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6',
  };

  const gapClass = `gap-${gap}`;

  return (
    <div
      className={cn('grid', colsMap[cols] || colsMap[3], gapClass, className)}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Flex - Flexbox layout
 *
 * Design spec (12-DESIGN-SPEC.md):
 * - Generic flexbox container
 * - justify: horizontal alignment
 * - align: vertical alignment
 * - gap: element spacing
 *
 * Usage:
 * <Flex justify="between" align="center" gap={2}>
 *   <div>Left</div>
 *   <div>Right</div>
 * </Flex>
 */
export function Flex({
  children,
  justify,
  align,
  gap = 2,
  wrap = false,
  className,
  ...props
}) {
  const justifyMap = {
    start: 'justify-start',
    end: 'justify-end',
    center: 'justify-center',
    between: 'justify-between',
    around: 'justify-around',
    evenly: 'justify-evenly',
  };

  const alignMap = {
    start: 'items-start',
    end: 'items-end',
    center: 'items-center',
    baseline: 'items-baseline',
    stretch: 'items-stretch',
  };

  const gapClass = `gap-${gap}`;

  return (
    <div
      className={cn(
        'flex',
        justify && justifyMap[justify],
        align && alignMap[align],
        gapClass,
        wrap && 'flex-wrap',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
