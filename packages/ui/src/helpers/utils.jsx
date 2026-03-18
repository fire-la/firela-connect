import { toastConstants } from '../constants';
import React from 'react';
import { toast as toastifyToast } from 'react-toastify';
import { toast } from 'sonner';
import {
  THINK_TAG_REGEX,
  MESSAGE_ROLES,
} from '../constants/playground.constants';
import { TABLE_COMPACT_MODES_KEY } from '../constants';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationFirst,
  PaginationItem,
  PaginationLast,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { cn } from '@/lib/utils';

const HTMLToastContent = ({ htmlContent }) => {
  return <div dangerouslySetInnerHTML={{ __html: htmlContent }} />;
};

// Sonner-based toast options with mobile-friendly position
const getSonnerOptions = (duration = 4000) => ({
  duration,
  position: 'top-center',
});

// Semi UI style options converted to sonner
let showErrorOptions = { duration: toastConstants.ERROR_TIMEOUT };
let showWarningOptions = { duration: toastConstants.WARNING_TIMEOUT };
let showSuccessOptions = { duration: toastConstants.SUCCESS_TIMEOUT };
let showInfoOptions = { duration: toastConstants.INFO_TIMEOUT };
let showNoticeOptions = { duration: Infinity }; // No auto-close for notices

export default HTMLToastContent;
export function isAdmin() {
  let user = localStorage.getItem('user');
  if (!user) return false;
  user = JSON.parse(user);
  return user.role >= 10;
}

export function isRoot() {
  let user = localStorage.getItem('user');
  if (!user) return false;
  user = JSON.parse(user);
  return user.role >= 100;
}

export function getSystemName() {
  return 'relay';
}

export function getLogo() {
  let logo = localStorage.getItem('logo');
  if (!logo)
    return 'https://avatars.githubusercontent.com/u/235206218?s=400&u=fe70db81e306cbd0028ebba4ef1bfee04794d3d9&v=4';
  return logo;
}

export function getUserIdFromLocalStorage() {
  let user = localStorage.getItem('user');
  if (!user) return -1;
  user = JSON.parse(user);
  return user.id;
}

export function getFooterHTML() {
  return localStorage.getItem('footer_html');
}

export async function copy(text) {
  let okay = true;
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    try {
      // Create textarea to execute copy command, preserving multiline text format
      const textarea = window.document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '-9999px';
      window.document.body.appendChild(textarea);
      textarea.select();
      window.document.execCommand('copy');
      window.document.body.removeChild(textarea);
    } catch (e) {
      okay = false;
      console.error(e);
    }
  }
  return okay;
}

// isMobile function removed, use useIsMobile Hook instead

// Note: Position is now handled globally by the Toaster component in PageLayout

export function showError(error) {
  console.error(error);
  if (error.message) {
    if (error.name === 'AxiosError') {
      switch (error.response.status) {
        case 401:
          // Clear user state
          localStorage.removeItem('user');
          // toast.error('Error: Not logged in or login expired, please login again!', showErrorOptions);
          window.location.href = '/login?expired=true';
          break;
        case 429:
          toast.error(
            'Error: Too many requests, please try again later!',
            showErrorOptions,
          );
          break;
        case 500:
          toast.error(
            'Error: Internal server error, please contact administrator!',
            showErrorOptions,
          );
          break;
        case 405:
          toast.info(
            'This site is for demo only, no backend!',
            showInfoOptions,
          );
          break;
        default:
          toast.error('Error: ' + error.message, showErrorOptions);
      }
      return;
    }
    toast.error('Error: ' + error.message, showErrorOptions);
  } else {
    toast.error('Error: ' + error, showErrorOptions);
  }
}

export function showWarning(message) {
  toast.warning(message, showWarningOptions);
}

export function showSuccess(message) {
  toast.success(message, showSuccessOptions);
}

export function showInfo(message) {
  toast.info(message, showInfoOptions);
}

export function showNotice(message, isHTML = false) {
  if (isHTML) {
    toastifyToast(
      <HTMLToastContent htmlContent={message} />,
      showNoticeOptions,
    );
  } else {
    toast.info(message, showInfoOptions);
  }
}

export function openPage(url) {
  window.open(url);
}

export function removeTrailingSlash(url) {
  if (!url) return '';
  if (url.endsWith('/')) {
    return url.slice(0, -1);
  } else {
    return url;
  }
}

export function getTodayStartTimestamp() {
  var now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.floor(now.getTime() / 1000);
}

export function timestamp2string(timestamp) {
  let date = new Date(timestamp * 1000);
  let year = date.getFullYear().toString();
  let month = (date.getMonth() + 1).toString();
  let day = date.getDate().toString();
  let hour = date.getHours().toString();
  let minute = date.getMinutes().toString();
  let second = date.getSeconds().toString();
  if (month.length === 1) {
    month = '0' + month;
  }
  if (day.length === 1) {
    day = '0' + day;
  }
  if (hour.length === 1) {
    hour = '0' + hour;
  }
  if (minute.length === 1) {
    minute = '0' + minute;
  }
  if (second.length === 1) {
    second = '0' + second;
  }
  return (
    year + '-' + month + '-' + day + ' ' + hour + ':' + minute + ':' + second
  );
}

export function timestamp2string1(
  timestamp,
  dataExportDefaultTime = 'hour',
  showYear = false,
) {
  let date = new Date(timestamp * 1000);
  let year = date.getFullYear();
  let month = (date.getMonth() + 1).toString();
  let day = date.getDate().toString();
  let hour = date.getHours().toString();
  if (month.length === 1) {
    month = '0' + month;
  }
  if (day.length === 1) {
    day = '0' + day;
  }
  if (hour.length === 1) {
    hour = '0' + hour;
  }
  // Show year only when data spans across years
  let str = showYear ? year + '-' + month + '-' + day : month + '-' + day;
  if (dataExportDefaultTime === 'hour') {
    str += ' ' + hour + ':00';
  } else if (dataExportDefaultTime === 'week') {
    let nextWeek = new Date(timestamp * 1000 + 6 * 24 * 60 * 60 * 1000);
    let nextWeekYear = nextWeek.getFullYear();
    let nextMonth = (nextWeek.getMonth() + 1).toString();
    let nextDay = nextWeek.getDate().toString();
    if (nextMonth.length === 1) {
      nextMonth = '0' + nextMonth;
    }
    if (nextDay.length === 1) {
      nextDay = '0' + nextDay;
    }
    // Week view end date also shows year only when spanning years
    let nextStr = showYear
      ? nextWeekYear + '-' + nextMonth + '-' + nextDay
      : nextMonth + '-' + nextDay;
    str += ' - ' + nextStr;
  }
  return str;
}

// Check if timestamp array spans across years
export function isDataCrossYear(timestamps) {
  if (!timestamps || timestamps.length === 0) return false;
  const years = new Set(
    timestamps.map((ts) => new Date(ts * 1000).getFullYear()),
  );
  return years.size > 1;
}

export function downloadTextAsFile(text, filename) {
  let blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  let url = URL.createObjectURL(blob);
  let a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}

export const verifyJSON = (str) => {
  try {
    JSON.parse(str);
  } catch (e) {
    return false;
  }
  return true;
};

export function verifyJSONPromise(value) {
  try {
    JSON.parse(value);
    return Promise.resolve();
  } catch (e) {
    return Promise.reject('Not a valid JSON string');
  }
}

export function shouldShowPrompt(id) {
  let prompt = localStorage.getItem(`prompt-${id}`);
  return !prompt;
}

export function setPromptShown(id) {
  localStorage.setItem(`prompt-${id}`, 'true');
}

/**
 * Compare properties of two objects, find changed properties, return array of changed property info
 * @param {Object} oldObject - Old object
 * @param {Object} newObject - New object
 * @return {Array} Array of changed property info, each element contains key, oldValue and newValue
 */
export function compareObjects(oldObject, newObject) {
  const changedProperties = [];

  // Compare properties of two objects
  for (const key in oldObject) {
    if (oldObject.hasOwnProperty(key) && newObject.hasOwnProperty(key)) {
      if (oldObject[key] !== newObject[key]) {
        changedProperties.push({
          key: key,
          oldValue: oldObject[key],
          newValue: newObject[key],
        });
      }
    }
  }

  return changedProperties;
}

// playground message

// Generate unique ID
let messageId = 4;
export const generateMessageId = () => `${messageId++}`;

// Extract text content from message
export const getTextContent = (message) => {
  if (!message || !message.content) return '';

  if (Array.isArray(message.content)) {
    const textContent = message.content.find((item) => item.type === 'text');
    return textContent?.text || '';
  }
  return typeof message.content === 'string' ? message.content : '';
};

// Process think tags
export const processThinkTags = (content, reasoningContent = '') => {
  if (!content || !content.includes('<think>')) {
    return { content, reasoningContent };
  }

  const thoughts = [];
  const replyParts = [];
  let lastIndex = 0;
  let match;

  THINK_TAG_REGEX.lastIndex = 0;
  while ((match = THINK_TAG_REGEX.exec(content)) !== null) {
    replyParts.push(content.substring(lastIndex, match.index));
    thoughts.push(match[1]);
    lastIndex = match.index + match[0].length;
  }
  replyParts.push(content.substring(lastIndex));

  const processedContent = replyParts
    .join('')
    .replace(/<\/?think>/g, '')
    .trim();
  const thoughtsStr = thoughts.join('\n\n---\n\n');
  const processedReasoningContent =
    reasoningContent && thoughtsStr
      ? `${reasoningContent}\n\n---\n\n${thoughtsStr}`
      : reasoningContent || thoughtsStr;

  return {
    content: processedContent,
    reasoningContent: processedReasoningContent,
  };
};

// Process incomplete think tags
export const processIncompleteThinkTags = (content, reasoningContent = '') => {
  if (!content) return { content: '', reasoningContent };

  const lastOpenThinkIndex = content.lastIndexOf('<think>');
  if (lastOpenThinkIndex === -1) {
    return processThinkTags(content, reasoningContent);
  }

  const fragmentAfterLastOpen = content.substring(lastOpenThinkIndex);
  if (!fragmentAfterLastOpen.includes('</think>')) {
    const unclosedThought = fragmentAfterLastOpen
      .substring('<think>'.length)
      .trim();
    const cleanContent = content.substring(0, lastOpenThinkIndex);
    const processedReasoningContent = unclosedThought
      ? reasoningContent
        ? `${reasoningContent}\n\n---\n\n${unclosedThought}`
        : unclosedThought
      : reasoningContent;

    return processThinkTags(cleanContent, processedReasoningContent);
  }

  return processThinkTags(content, reasoningContent);
};

// Build message content (including images)
export const buildMessageContent = (
  textContent,
  imageUrls = [],
  imageEnabled = false,
) => {
  if (!textContent && (!imageUrls || imageUrls.length === 0)) {
    return '';
  }

  const validImageUrls = imageUrls.filter((url) => url && url.trim() !== '');

  if (imageEnabled && validImageUrls.length > 0) {
    return [
      { type: 'text', text: textContent || '' },
      ...validImageUrls.map((url) => ({
        type: 'image_url',
        image_url: { url: url.trim() },
      })),
    ];
  }

  return textContent || '';
};

// Create new message
export const createMessage = (role, content, options = {}) => ({
  role,
  content,
  createAt: Date.now(),
  id: generateMessageId(),
  ...options,
});

// Create loading assistant message
export const createLoadingAssistantMessage = () =>
  createMessage(MESSAGE_ROLES.ASSISTANT, '', {
    reasoningContent: '',
    isReasoningExpanded: true,
    isThinkingComplete: false,
    hasAutoCollapsed: false,
    status: 'loading',
  });

// Check if message contains images
export const hasImageContent = (message) => {
  return (
    message &&
    Array.isArray(message.content) &&
    message.content.some((item) => item.type === 'image_url')
  );
};

// Format message for API request
export const formatMessageForAPI = (message) => {
  if (!message) return null;

  return {
    role: message.role,
    content: message.content,
  };
};

// Validate if message is valid
export const isValidMessage = (message) => {
  return message && message.role && (message.content || message.content === '');
};

// Get last user message
export const getLastUserMessage = (messages) => {
  if (!Array.isArray(messages)) return null;

  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === MESSAGE_ROLES.USER) {
      return messages[i];
    }
  }
  return null;
};

// Get last assistant message
export const getLastAssistantMessage = (messages) => {
  if (!Array.isArray(messages)) return null;

  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === MESSAGE_ROLES.ASSISTANT) {
      return messages[i];
    }
  }
  return null;
};

// Calculate relative time (days ago, hours ago, etc.)
export const getRelativeTime = (publishDate) => {
  if (!publishDate) return '';

  const now = new Date();
  const pubDate = new Date(publishDate);

  // If date is invalid, return original string
  if (isNaN(pubDate.getTime())) return publishDate;

  const diffMs = now.getTime() - pubDate.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  // If future time, show specific date
  if (diffMs < 0) {
    return formatDateString(pubDate);
  }

  // Return appropriate description based on time difference
  if (diffSeconds < 60) {
    return 'just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes} minutes ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hours ago`;
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else if (diffWeeks < 4) {
    return `${diffWeeks} weeks ago`;
  } else if (diffMonths < 12) {
    return `${diffMonths} months ago`;
  } else if (diffYears < 2) {
    return '1 year ago';
  } else {
    // More than 2 years, show specific date
    return formatDateString(pubDate);
  }
};

// Format date string
export const formatDateString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Format datetime string (including time)
export const formatDateTimeString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

function readTableCompactModes() {
  try {
    const json = localStorage.getItem(TABLE_COMPACT_MODES_KEY);
    return json ? JSON.parse(json) : {};
  } catch {
    return {};
  }
}

function writeTableCompactModes(modes) {
  try {
    localStorage.setItem(TABLE_COMPACT_MODES_KEY, JSON.stringify(modes));
  } catch {
    // ignore
  }
}

export function getTableCompactMode(tableKey = 'global') {
  const modes = readTableCompactModes();
  return !!modes[tableKey];
}

export function setTableCompactMode(compact, tableKey = 'global') {
  const modes = readTableCompactModes();
  modes[tableKey] = compact;
  writeTableCompactModes(modes);
}

// -------------------------------
// Select component unified filter logic
// Usage: <Select filter={selectFilter} ... />
// Unified Select search filter logic -- supports matching both option.value and option.label
export const selectFilter = (input, option) => {
  if (!input) return true;

  const keyword = input.trim().toLowerCase();
  const valueText = (option?.value ?? '').toString().toLowerCase();
  const labelText = (option?.label ?? '').toString().toLowerCase();

  return valueText.includes(keyword) || labelText.includes(keyword);
};

// -------------------------------
// Model pricing calculation utility functions
export const calculateModelPrice = ({
  record,
  selectedGroup,
  groupRatio,
  tokenUnit,
  displayPrice,
  currency,
  precision = 4,
}) => {
  // 1. Select the actual group to use
  let usedGroup = selectedGroup;
  let usedGroupRatio = groupRatio[selectedGroup];

  if (selectedGroup === 'all' || usedGroupRatio === undefined) {
    // Select group with minimum ratio from model's available groups, fallback to 1 if none
    let minRatio = Number.POSITIVE_INFINITY;
    if (
      Array.isArray(record.enable_groups) &&
      record.enable_groups.length > 0
    ) {
      record.enable_groups.forEach((g) => {
        const r = groupRatio[g];
        if (r !== undefined && r < minRatio) {
          minRatio = r;
          usedGroup = g;
          usedGroupRatio = r;
        }
      });
    }

    // If no suitable group ratio found, fallback to 1
    if (usedGroupRatio === undefined) {
      usedGroupRatio = 1;
    }
  }

  // 2. Calculate price based on billing type
  if (record.quota_type === 0) {
    // Pay per token
    const inputRatioPriceUSD = record.model_ratio * 2 * usedGroupRatio;
    const completionRatioPriceUSD =
      record.model_ratio * record.completion_ratio * 2 * usedGroupRatio;

    const unitDivisor = tokenUnit === 'K' ? 1000 : 1;
    const unitLabel = tokenUnit === 'K' ? 'K' : 'M';

    const rawDisplayInput = displayPrice(inputRatioPriceUSD);
    const rawDisplayCompletion = displayPrice(completionRatioPriceUSD);

    const numInput =
      parseFloat(rawDisplayInput.replace(/[^0-9.]/g, '')) / unitDivisor;
    const numCompletion =
      parseFloat(rawDisplayCompletion.replace(/[^0-9.]/g, '')) / unitDivisor;

    let symbol = '$';
    if (currency === 'CNY') {
      symbol = '¥';
    } else if (currency === 'CUSTOM') {
      try {
        const statusStr = localStorage.getItem('status');
        if (statusStr) {
          const s = JSON.parse(statusStr);
          symbol = s?.custom_currency_symbol || '¤';
        } else {
          symbol = '¤';
        }
      } catch (e) {
        symbol = '¤';
      }
    }
    return {
      inputPrice: `${symbol}${numInput.toFixed(precision)}`,
      completionPrice: `${symbol}${numCompletion.toFixed(precision)}`,
      unitLabel,
      isPerToken: true,
      usedGroup,
      usedGroupRatio,
    };
  }

  if (record.quota_type === 1) {
    // Pay per request
    const priceUSD = parseFloat(record.model_price) * usedGroupRatio;
    const displayVal = displayPrice(priceUSD);

    return {
      price: displayVal,
      isPerToken: false,
      usedGroup,
      usedGroupRatio,
    };
  }

  // Unknown billing type, return placeholder info
  return {
    price: '-',
    isPerToken: false,
    usedGroup,
    usedGroupRatio,
  };
};

// Format price info (for card view)
export const formatPriceInfo = (priceData, t) => {
  if (priceData.isPerToken) {
    return (
      <>
        <span style={{ color: 'var(--muted-foreground)' }}>
          {t('Input')} {priceData.inputPrice}/{priceData.unitLabel}
        </span>
        <span style={{ color: 'var(--muted-foreground)' }}>
          {t('Output')} {priceData.completionPrice}/{priceData.unitLabel}
        </span>
      </>
    );
  }

  return (
    <>
      <span style={{ color: 'var(--muted-foreground)' }}>
        {t('Model price')} {priceData.price}
      </span>
    </>
  );
};

// -------------------------------
// TablePagination - Using Shadcn native components
const TablePagination = ({
  currentPage,
  totalPages,
  onPageChange,
  pageSize,
  pageSizeOptions = [10, 20, 50, 100],
  onPageSizeChange,
  totalItems,
  showPageSize = true,
  showTotal = true,
  className,
}) => {
  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      onPageChange(page);
    }
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      if (currentPage > 3) {
        pages.push('ellipsis-start');
      }
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) {
        pages.push('ellipsis-end');
      }
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row items-center justify-between gap-4 py-2',
        className,
      )}
    >
      {showTotal && totalItems !== undefined && (
        <div className='text-sm text-muted-foreground'>
          Total {totalItems} items
        </div>
      )}

      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationFirst
              onClick={() => canGoPrevious && handlePageChange(1)}
              className={!canGoPrevious ? 'pointer-events-none opacity-50' : ''}
            />
          </PaginationItem>
          <PaginationItem>
            <PaginationPrevious
              onClick={() => canGoPrevious && handlePageChange(currentPage - 1)}
              className={!canGoPrevious ? 'pointer-events-none opacity-50' : ''}
            />
          </PaginationItem>
          {getPageNumbers().map((page, index) => (
            <PaginationItem key={index}>
              {typeof page === 'string' ? (
                <PaginationEllipsis />
              ) : (
                <PaginationLink
                  isActive={currentPage === page}
                  onClick={() => handlePageChange(page)}
                >
                  {page}
                </PaginationLink>
              )}
            </PaginationItem>
          ))}
          <PaginationItem>
            <PaginationNext
              onClick={() => canGoNext && handlePageChange(currentPage + 1)}
              className={!canGoNext ? 'pointer-events-none opacity-50' : ''}
            />
          </PaginationItem>
          <PaginationItem>
            <PaginationLast
              onClick={() => canGoNext && handlePageChange(totalPages)}
              className={!canGoNext ? 'pointer-events-none opacity-50' : ''}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>

      {showPageSize && onPageSizeChange && (
        <div className='flex items-center gap-2'>
          <span className='text-sm text-muted-foreground'>Show</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className='h-8 rounded-md border border-input bg-background px-2 text-sm'
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <span className='text-sm text-muted-foreground'>/ page</span>
        </div>
      )}
    </div>
  );
};

// -------------------------------
// CardPro pagination config function
// Used to create CardPro's paginationArea configuration
export const createCardProPagination = ({
  currentPage,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  isMobile = false,
  pageSizeOpts = [10, 20, 50, 100],
  showSizeChanger = true,
  t = (key) => key,
}) => {
  if (!total || total <= 0) return null;

  const totalPages = Math.ceil(total / pageSize);

  return (
    <TablePagination
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={onPageChange}
      pageSize={pageSize}
      pageSizeOptions={pageSizeOpts}
      onPageSizeChange={onPageSizeChange}
      totalItems={total}
      showPageSize={showSizeChanger}
      showTotal={true}
      className={isMobile ? 'text-sm' : ''}
    />
  );
};

// Model pricing filter default values
const DEFAULT_PRICING_FILTERS = {
  search: '',
  showWithRecharge: false,
  currency: 'USD',
  showRatio: false,
  viewMode: 'card',
  tokenUnit: 'M',
  filterGroup: 'all',
  filterQuotaType: 'all',
  filterEndpointType: 'all',
  filterVendor: 'all',
  filterTag: 'all',
  currentPage: 1,
};

// Reset model pricing filter conditions
export const resetPricingFilters = ({
  handleChange,
  setShowWithRecharge,
  setCurrency,
  setShowRatio,
  setViewMode,
  setFilterGroup,
  setFilterQuotaType,
  setFilterEndpointType,
  setFilterVendor,
  setFilterTag,
  setCurrentPage,
  setTokenUnit,
}) => {
  handleChange?.(DEFAULT_PRICING_FILTERS.search);
  setShowWithRecharge?.(DEFAULT_PRICING_FILTERS.showWithRecharge);
  setCurrency?.(DEFAULT_PRICING_FILTERS.currency);
  setShowRatio?.(DEFAULT_PRICING_FILTERS.showRatio);
  setViewMode?.(DEFAULT_PRICING_FILTERS.viewMode);
  setTokenUnit?.(DEFAULT_PRICING_FILTERS.tokenUnit);
  setFilterGroup?.(DEFAULT_PRICING_FILTERS.filterGroup);
  setFilterQuotaType?.(DEFAULT_PRICING_FILTERS.filterQuotaType);
  setFilterEndpointType?.(DEFAULT_PRICING_FILTERS.filterEndpointType);
  setFilterVendor?.(DEFAULT_PRICING_FILTERS.filterVendor);
  setFilterTag?.(DEFAULT_PRICING_FILTERS.filterTag);
  setCurrentPage?.(DEFAULT_PRICING_FILTERS.currentPage);
};
