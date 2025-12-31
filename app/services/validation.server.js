/**
 * Validation Service
 * Provides input validation and sanitization utilities
 */
import AppConfig from "./config.server";

/**
 * Sanitize a string to prevent XSS attacks
 * @param {string} input - The input string to sanitize
 * @returns {string} Sanitized string
 */
export function sanitizeString(input) {
  if (typeof input !== 'string') return '';

  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validate and sanitize a chat message
 * @param {string} message - The message to validate
 * @returns {{ valid: boolean, message: string, error?: string }}
 */
export function validateMessage(message) {
  if (!message || typeof message !== 'string') {
    return { valid: false, message: '', error: AppConfig.errorMessages.missingMessage };
  }

  const trimmed = message.trim();

  if (trimmed.length === 0) {
    return { valid: false, message: '', error: AppConfig.errorMessages.missingMessage };
  }

  if (trimmed.length > AppConfig.validation.maxMessageLength) {
    return {
      valid: false,
      message: '',
      error: `Message too long. Maximum ${AppConfig.validation.maxMessageLength} characters allowed.`
    };
  }

  // Basic sanitization - remove control characters but preserve normal text
  const sanitized = trimmed
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // eslint-disable-line no-control-regex
    .trim();

  return { valid: true, message: sanitized };
}

/**
 * Validate a conversation ID
 * @param {string} conversationId - The conversation ID to validate
 * @returns {{ valid: boolean, id: string, error?: string }}
 */
export function validateConversationId(conversationId) {
  if (!conversationId) {
    // Generate a new ID if not provided
    return { valid: true, id: Date.now().toString() };
  }

  if (typeof conversationId !== 'string') {
    return { valid: false, id: '', error: 'Invalid conversation ID format' };
  }

  if (conversationId.length > AppConfig.validation.maxConversationIdLength) {
    return { valid: false, id: '', error: 'Conversation ID too long' };
  }

  // Only allow alphanumeric, hyphens, and underscores
  const sanitizedId = conversationId.replace(/[^a-zA-Z0-9\-_]/g, '');

  if (sanitizedId !== conversationId) {
    return { valid: false, id: '', error: 'Invalid characters in conversation ID' };
  }

  return { valid: true, id: sanitizedId };
}

/**
 * Validate prompt type
 * @param {string} promptType - The prompt type to validate
 * @returns {string} Valid prompt type or default
 */
export function validatePromptType(promptType) {
  const validTypes = ['standardAssistant', 'enthusiasticAssistant'];

  if (promptType && validTypes.includes(promptType)) {
    return promptType;
  }

  return AppConfig.api.defaultPromptType;
}

/**
 * Validate origin for CORS
 * @param {string} origin - The origin to validate
 * @returns {boolean} Whether the origin is allowed
 */
export function validateOrigin(origin) {
  if (!origin) return false;

  // In development, allow localhost
  if (AppConfig.env.isDev) {
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return true;
    }
  }

  // If allowed origins are configured, check against them
  if (AppConfig.cors.allowedOrigins.length > 0) {
    return AppConfig.cors.allowedOrigins.some(allowed => {
      // Support wildcard subdomains
      if (allowed.startsWith('*.')) {
        const domain = allowed.slice(2);
        return origin.endsWith(domain) || origin.endsWith('.' + domain);
      }
      return origin === allowed || origin === `https://${allowed}` || origin === `http://${allowed}`;
    });
  }

  // For Shopify apps, validate it's a myshopify.com domain or common Shopify domains
  const shopifyPatterns = [
    /\.myshopify\.com$/,
    /\.shopify\.com$/,
    /\.myshopify\.io$/,
  ];

  return shopifyPatterns.some(pattern => pattern.test(new URL(origin).hostname));
}

export default {
  sanitizeString,
  validateMessage,
  validateConversationId,
  validatePromptType,
  validateOrigin,
};
