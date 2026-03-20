/**
 * BillClaw UI Helpers
 * Minimal implementation for HeaderBar and NoticeModal
 */

import { toast } from 'sonner';
import axios from 'axios';

// ============================================
// API Setup
// ============================================

export const API = axios.create({
  baseURL: import.meta.env.VITE_REACT_APP_SERVER_URL || '',
  withCredentials: true,
  headers: {
    'Cache-Control': 'no-store',
  },
});

// ============================================
// Toast Notifications
// ============================================

export const showSuccess = (message) => {
  toast.success(message);
};

export const showError = (error) => {
  const message = error?.response?.data?.message || error?.message || 'An error occurred';
  toast.error(message);
};

// ============================================
// System Configuration
// ============================================

export const getSystemName = () => {
  return import.meta.env.VITE_SYSTEM_NAME || 'connect';
};

export const getLogo = () => {
  const logo = localStorage.getItem('logo');
  if (!logo) return '/logo.png';
  return logo;
};

// ============================================
// Date/Time Utilities
// ============================================

export const getRelativeTime = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return 'just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString();
  }
};

// ============================================
// String Utilities
// ============================================

export const stringToColor = (str) => {
  if (!str) return '#10b981';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = hash % 360;
  return `hsl(${hue}, 70%, 50%)`;
};
