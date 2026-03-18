/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      // Shadcn/UI CSS variable mapping (synced with index.css and Pencil templates)
      colors: {
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        // Sidebar colors (Shadcn official)
        sidebar: {
          DEFAULT: 'var(--sidebar)',
          foreground: 'var(--sidebar-foreground)',
          primary: 'var(--sidebar-primary)',
          'primary-foreground': 'var(--sidebar-primary-foreground)',
          accent: 'var(--sidebar-accent)',
          'accent-foreground': 'var(--sidebar-accent-foreground)',
          border: 'var(--sidebar-border)',
          ring: 'var(--sidebar-ring)',
        },
        // Chart colors (Shadcn official)
        chart: {
          1: 'var(--chart-1)',
          2: 'var(--chart-2)',
          3: 'var(--chart-3)',
          4: 'var(--chart-4)',
          5: 'var(--chart-5)',
        },
        // Text colors
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-tertiary': 'var(--text-tertiary)',
      },
      borderRadius: {
        lg: '0.5rem', // 8px
        md: '0.375rem', // 6px
        sm: '0.25rem', // 4px
        xl: '0.75rem', // 12px
        '2xl': '1rem', // 16px
        '3xl': '1.25rem', // 20px
      },
      // Font system (synced with CSS variables in index.css and Pencil design)
      // Pencil uses Inter font, sizes 12/14/16/18/24px
      fontFamily: {
        // Synced with --font-sans variable
        sans: [
          'Inter Variable',
          'Inter',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'Noto Sans',
          'sans-serif',
        ],
      },
      // Font size system (synced with --text-* and --leading-* variables)
      // Pencil hardcoded: 12px(1.333), 14px(1.429), 16px(1.5), 18px(1.5), 24px(1.333)
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1.333' }], // 12px - small labels, helper text
        sm: ['0.875rem', { lineHeight: '1.429' }], // 14px - body text, labels
        base: ['1rem', { lineHeight: '1.5' }], // 16px - body text, buttons
        lg: ['1.125rem', { lineHeight: '1.5' }], // 18px - small headings
        xl: ['1.25rem', { lineHeight: '1.4' }], // 20px - headings
        '2xl': ['1.5rem', { lineHeight: '1.333' }], // 24px - large headings
        '3xl': ['1.875rem', { lineHeight: '1.2' }], // 30px - page titles
      },
      // Spacing system (synced with --spacing-* variables)
      spacing: {
        1: '4px',
        2: '8px',
        3: '12px',
        4: '16px',
        5: '20px',
        6: '24px',
        8: '32px',
        10: '40px',
        12: '48px',
      },
      // Font weight system
      fontWeight: {
        light: '300',
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
      },
    },
  },
  plugins: [],
};
