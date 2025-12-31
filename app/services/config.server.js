/**
 * Configuration Service
 * Centralizes all configuration values for the chat service
 */

// Validate required environment variables on startup
const requiredEnvVars = ['SHOPIFY_API_KEY'];
const missingEnvVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingEnvVars.length > 0 && process.env.NODE_ENV === 'production') {
  console.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

export const AppConfig = {
  // Environment
  env: {
    nodeEnv: process.env.NODE_ENV || 'development',
    isDev: process.env.NODE_ENV !== 'production',
    isProd: process.env.NODE_ENV === 'production',
  },

  // App URLs
  urls: {
    appUrl: process.env.APP_URL || 'https://localhost:3458',
    redirectUrl: process.env.REDIRECT_URL || 'https://localhost:3458/auth/callback',
  },

  // API Configuration
  api: {
    provider: process.env.AI_PROVIDER || 'gemini', // 'gemini' or 'claude'
    defaultModel: process.env.AI_MODEL || 'gemini-2.0-flash-exp',
    maxTokens: 2000,
    defaultPromptType: 'standardAssistant',
  },

  // Rate Limiting
  rateLimit: {
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  },

  // CORS Configuration
  cors: {
    allowedOrigins: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
      : [], // Empty means dynamic origin validation
  },

  // Error Message Templates
  errorMessages: {
    missingMessage: "Message is required",
    apiUnsupported: "This endpoint only supports server-sent events (SSE) requests or history requests.",
    authFailed: "Authentication failed with Claude API",
    apiKeyError: "Please check your API key in environment variables",
    rateLimitExceeded: "Rate limit exceeded",
    rateLimitDetails: "Please try again later",
    genericError: "Failed to get response from Claude",
    invalidInput: "Invalid input provided",
    tooManyRequests: "Too many requests. Please wait a moment and try again.",
  },

  // Tool Configuration
  tools: {
    productSearchName: "search_shop_catalog",
    maxProductsToDisplay: 3
  },

  // Handoff Configuration (Phase 4)
  handoff: {
    whatsapp: {
      enabled: !!process.env.WHATSAPP_ACCESS_TOKEN,
      businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    },
    triggerTopics: [
      'complaint',
      'refund',
      'return',
      'cancel order',
      'speak to human',
      'talk to agent',
      'custom order',
      'bulk order',
    ],
  },

  // Analytics Configuration (Phase 3)
  analytics: {
    enabled: process.env.ANALYTICS_ENABLED === 'true',
  },

  // Compliance Configuration (Phase 5)
  compliance: {
    dataRetentionDays: parseInt(process.env.DATA_RETENTION_DAYS || '365', 10),
    gdprEnabled: process.env.GDPR_ENABLED === 'true',
    ccpaEnabled: process.env.CCPA_ENABLED === 'true',
  },

  // Input Validation
  validation: {
    maxMessageLength: 2000,
    maxConversationIdLength: 100,
  },
};

export default AppConfig;
