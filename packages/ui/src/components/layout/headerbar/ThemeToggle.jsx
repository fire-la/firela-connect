import React from 'react';
import { Button } from '@/components/ui/button';
import { Sun, Moon } from 'lucide-react';
import { useActualTheme } from '../../../context/Theme';

const ThemeToggle = ({ theme: _theme, onThemeToggle, t }) => {
  const actualTheme = useActualTheme();

  const handleToggle = () => {
    // Toggle between light and dark
    const newTheme = actualTheme === 'dark' ? 'light' : 'dark';
    onThemeToggle(newTheme);
  };

  return (
    <Button
      variant='ghost'
      size='icon-sm'
      aria-label={t('Switch Theme')}
      className='text-current hover:bg-accent size-7'
      onClick={handleToggle}
    >
      {actualTheme === 'dark' ? (
        <Moon size={16} strokeWidth={1.5} />
      ) : (
        <Sun size={16} strokeWidth={1.5} />
      )}
    </Button>
  );
};

export default ThemeToggle;
