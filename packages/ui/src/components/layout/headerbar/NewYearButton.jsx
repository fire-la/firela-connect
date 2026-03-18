import React from 'react';
import { Button } from '@/components/ui/button';
import fireworks from 'react-fireworks';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const NewYearButton = ({ isNewYear }) => {
  if (!isNewYear) {
    return null;
  }

  const handleNewYearClick = () => {
    fireworks.init('root', {});
    fireworks.start();
    setTimeout(() => {
      fireworks.stop();
    }, 3000);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant='ghost'
          size='icon-sm'
          aria-label='New Year'
          className='text-current hover:bg-accent rounded-full'
        >
          <span className='text-xl'>🎉</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        <DropdownMenuItem onClick={handleNewYearClick}>
          Happy New Year!!! 🎉
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NewYearButton;
