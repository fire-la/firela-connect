import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const StepsContext = React.createContext({ current: 0 });

function Steps({ current = 0, children, className, ...props }) {
  return (
    <StepsContext.Provider value={{ current }}>
      <div
        className={cn('flex items-center justify-between w-full', className)}
        {...props}
      >
        {React.Children.map(children, (child, index) => {
          return React.cloneElement(child, {
            stepIndex: index,
            isLast: index === React.Children.count(children) - 1,
          });
        })}
      </div>
    </StepsContext.Provider>
  );
}

function Step({ stepIndex, isLast, title, description, className, ...props }) {
  const { current } = React.useContext(StepsContext);
  const isCompleted = stepIndex < current;
  const isCurrent = stepIndex === current;

  return (
    <div className={cn('flex items-center flex-1', className)} {...props}>
      {/* Step content */}
      <div className='flex flex-col items-center'>
        {/* Circle indicator */}
        <div
          className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
            isCompleted && 'bg-primary text-primary-foreground',
            isCurrent &&
              'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2',
            !isCompleted &&
              !isCurrent &&
              'border-2 border-muted-foreground/30 text-muted-foreground',
          )}
        >
          {isCompleted ? (
            <Check className='w-4 h-4' />
          ) : (
            <span>{stepIndex + 1}</span>
          )}
        </div>

        {/* Title and description */}
        <div className='mt-2 text-center'>
          <div
            className={cn(
              'text-sm font-medium',
              isCurrent && 'text-primary',
              isCompleted && 'text-foreground',
              !isCompleted && !isCurrent && 'text-muted-foreground',
            )}
          >
            {title}
          </div>
          {description && (
            <div className='text-xs text-muted-foreground mt-0.5'>
              {description}
            </div>
          )}
        </div>
      </div>

      {/* Connector line */}
      {!isLast && (
        <div
          className={cn(
            'flex-1 h-0.5 mx-4 mt-[-20px] transition-colors',
            isCompleted ? 'bg-primary' : 'bg-muted-foreground/30',
          )}
        />
      )}
    </div>
  );
}

Steps.Step = Step;

export { Steps, Step };
