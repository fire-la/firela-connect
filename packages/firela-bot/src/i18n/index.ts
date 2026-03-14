/**
 * Lightweight i18n module for Firela-Bot
 *
 * Provides simple key-value message lookup with locale support.
 * Designed for Cloudflare Workers - no external dependencies.
 */

import en from './translations/en.js';
import zhCN from './translations/zh-CN.js';

/**
 * Supported locales
 */
export type SupportedLocale = 'en' | 'en-US' | 'en-GB' | 'zh-CN' | 'zh-TW';

/**
 * Translation dictionary type
 */
type TranslationDict = typeof en;

/**
 * All translations keyed by locale
 */
const translations: Record<string, TranslationDict> = {
  en,
  'en-US': en,
  'en-GB': en,
  'zh-CN': zhCN,
  'zh-TW': zhCN, // Fall back to simplified Chinese for traditional
};

/**
 * Default locale (English)
 */
const DEFAULT_LOCALE = 'en';

/**
 * Normalize locale string to supported format
 */
function normalizeLocale(locale: string | undefined): string {
  if (!locale) return DEFAULT_LOCALE;

  // Direct match
  if (translations[locale]) return locale;

  // Try base locale (e.g., 'en' from 'en-CA')
  const baseLocale = locale.split('-')[0];
  if (translations[baseLocale]) return baseLocale;

  return DEFAULT_LOCALE;
}

/**
 * Message key paths (dot notation)
 * e.g., 'errors.invalid_api_key', 'buttons.continue_chat'
 */
export type MessageKey =
  | `errors.${keyof typeof en.errors}`
  | `buttons.${keyof typeof en.buttons}`
  | `modals.${keyof typeof en.modals}`
  | `validation.${keyof typeof en.validation}`
  | `responses.${keyof typeof en.responses}`
  | `commands.${keyof typeof en.commands}`;

/**
 * Get a localized message by key
 *
 * @param key - Message key in dot notation (e.g., 'errors.invalid_api_key')
 * @param locale - Discord locale string (e.g., 'en-US', 'zh-CN')
 * @param params - Optional parameters for template interpolation
 * @returns Localized message string
 *
 * @example
 * getMessage('errors.invalid_api_key', 'zh-CN')
 * // Returns: 'API Key 无效，请检查配置'
 *
 * getMessage('errors.internal_error', 'en', { message: 'Timeout' })
 * // Returns: 'Service error: Timeout'
 */
export function getMessage(
  key: MessageKey,
  locale?: string,
  params?: Record<string, string>
): string {
  const normalizedLocale = normalizeLocale(locale);
  const dict = translations[normalizedLocale] || translations[DEFAULT_LOCALE];

  // Split key into parts (e.g., 'errors.invalid_api_key' -> ['errors', 'invalid_api_key'])
  const parts = key.split('.');
  if (parts.length !== 2) {
    console.warn(`Invalid message key format: ${key}`);
    return key;
  }

  const [category, messageKey] = parts;
  const categoryDict = dict[category as keyof TranslationDict];
  if (!categoryDict) {
    console.warn(`Unknown message category: ${category}`);
    return key;
  }

  // Get message from category
  const message = (categoryDict as Record<string, string>)[messageKey];
  if (!message) {
    // Fall back to English if key not found in locale
    const enDict = translations[DEFAULT_LOCALE];
    const enCategory = enDict[category as keyof TranslationDict];
    const enMessage = (enCategory as Record<string, string>)[messageKey];
    if (!enMessage) {
      console.warn(`Unknown message key: ${key}`);
      return key;
    }
    return interpolate(enMessage, params);
  }

  return interpolate(message, params);
}

/**
 * Interpolate parameters into message template
 *
 * Supports {param} style placeholders
 */
function interpolate(message: string, params?: Record<string, string>): string {
  if (!params) return message;

  return message.replace(/\{(\w+)\}/g, (match, key) => {
    return params[key] !== undefined ? params[key] : match;
  });
}

/**
 * Extract locale from Discord interaction
 *
 * Discord provides two locale fields:
 * - interaction.locale: User's client locale (preferred)
 * - interaction.guild_locale: Guild's preferred locale (fallback)
 *
 * @param interaction - Discord interaction object
 * @returns Normalized locale string
 */
export function getLocaleFromInteraction(interaction: {
  locale?: string;
  guild_locale?: string;
}): string {
  // Prefer user's client locale over guild locale
  const locale = interaction.locale || interaction.guild_locale;
  return normalizeLocale(locale);
}

/**
 * Get all available locales
 */
export function getAvailableLocales(): string[] {
  return Object.keys(translations);
}
