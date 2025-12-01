/**
 * Error message translation utilities
 * Translates non-English error messages from providers to English
 */

/**
 * Z.AI (GLM) Chinese error message translations
 * Based on common API errors from zhipuai.cn
 */
const ZAI_ERROR_TRANSLATIONS: Record<string, string> = {
  // Authentication errors
  '令牌已过期或验证不正确': 'Token expired or verification incorrect',
  '认证失败': 'Authentication failed',
  '无效的API密钥': 'Invalid API key',
  'API密钥不存在': 'API key does not exist',

  // Rate limiting
  '请求过于频繁': 'Request rate limit exceeded',
  '超出速率限制': 'Rate limit exceeded',
  '请稍后重试': 'Please retry later',

  // Quota errors
  '余额不足': 'Insufficient balance',
  '配额已用尽': 'Quota exhausted',
  '账户已欠费': 'Account is overdue',

  // Model errors
  '模型不存在': 'Model does not exist',
  '模型不可用': 'Model not available',
  '不支持该模型': 'Model not supported',

  // Request errors
  '参数错误': 'Invalid parameters',
  '请求体过大': 'Request body too large',
  '无效的请求': 'Invalid request',
  '缺少必需参数': 'Missing required parameters',

  // Server errors
  '服务器错误': 'Server error',
  '内部错误': 'Internal error',
  '服务暂时不可用': 'Service temporarily unavailable',
  '网关超时': 'Gateway timeout',
};

/**
 * Detects if text contains Chinese characters
 */
function containsChinese(text: string): boolean {
  return /[\u4e00-\u9fa5]/.test(text);
}

/**
 * Attempts to translate Chinese error message to English
 * Returns original message if no translation found
 */
function translateChineseError(message: string): string {
  // Try exact match first
  if (ZAI_ERROR_TRANSLATIONS[message]) {
    return ZAI_ERROR_TRANSLATIONS[message];
  }

  // Try partial match (in case message contains additional context)
  // Use replaceAll to handle messages with repeated error phrases
  for (const [chinese, english] of Object.entries(ZAI_ERROR_TRANSLATIONS)) {
    if (message.includes(chinese)) {
      // Replace all occurrences of the Chinese part with English
      return message.replaceAll(chinese, english);
    }
  }

  // No translation found, return original
  return message;
}

/**
 * Translates provider error messages to English
 * If message contains Chinese, attempts translation and adds context
 *
 * @param errorMessage - The error message from API
 * @param statusCode - HTTP status code (optional)
 * @returns Translated error message with helpful context
 *
 * @example
 * translateErrorMessage('401 令牌已过期或验证不正确')
 * // Returns: '401 Token expired or verification incorrect'
 *
 * translateErrorMessage('429 请求过于频繁', 429)
 * // Returns: '429 Request rate limit exceeded - please wait before retrying'
 */
export function translateErrorMessage(
  errorMessage: string,
  statusCode?: number
): string {
  // If no Chinese characters, return as-is
  if (!containsChinese(errorMessage)) {
    return errorMessage;
  }

  // Attempt translation
  const translated = translateChineseError(errorMessage);

  // If translation found, use it
  if (translated !== errorMessage) {
    // Add helpful context based on status code
    const context = getErrorContext(statusCode);
    return context ? `${translated} - ${context}` : translated;
  }

  // If no translation found, provide both languages with warning
  return `${errorMessage} (Chinese error message - ${getGenericHint(statusCode)})`;
}

/**
 * Get helpful context based on HTTP status code
 */
function getErrorContext(statusCode?: number): string | null {
  switch (statusCode) {
    case 401:
      return 'please check your API key';
    case 403:
      return 'access denied, verify your permissions';
    case 429:
      return 'please wait before retrying';
    case 500:
    case 502:
    case 503:
    case 504:
      return 'provider experiencing issues, try again later';
    default:
      return null;
  }
}

/**
 * Get generic hint for untranslated errors
 */
function getGenericHint(statusCode?: number): string {
  switch (statusCode) {
    case 401:
    case 403:
      return 'authentication issue, check API key';
    case 429:
      return 'rate limit, wait before retry';
    case 500:
    case 502:
    case 503:
    case 504:
      return 'server error, try later';
    default:
      return 'check provider documentation';
  }
}

/**
 * Check if an error is an abort error (user cancellation or signal abort)
 */
function isAbortError(error: unknown): boolean {
  if (error instanceof Error) {
    // Check error name (DOMException AbortError)
    if (error.name === 'AbortError') {
      return true;
    }
    // Check message patterns
    const msg = error.message.toLowerCase();
    if (msg.includes('abort') || msg.includes('cancelled') || msg.includes('canceled')) {
      return true;
    }
  }
  return false;
}

/**
 * Enhanced error message extractor that handles translation
 * Used as a drop-in replacement for the basic extractErrorMessage
 */
export function extractAndTranslateError(error: unknown): string {
  // Handle abort errors specially - provide a clearer message
  if (isAbortError(error)) {
    const err = error as Error;
    const msg = err.message?.toLowerCase() || '';

    // Provide context-specific abort messages
    if (msg.includes('timeout')) {
      if (msg.includes('first chunk')) {
        return 'Connection timeout - server took too long to respond. Try again or check your network.';
      }
      if (msg.includes('idle')) {
        return 'Stream timeout - server stopped responding. The response may be too long or the server is overloaded.';
      }
      return 'Request timeout - try again with a shorter prompt or check your connection.';
    }

    // Generic abort (user cancellation or upstream signal)
    return 'Request cancelled.';
  }

  let message: string;

  // Extract base message
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'object' && error !== null) {
    // Handle OpenAI-style error objects
    const err = error as any;
    if (err.error?.message) {
      message = err.error.message;
    } else if (err.message) {
      message = err.message;
    } else {
      message = JSON.stringify(error);
    }
  } else {
    message = String(error);
  }

  // Extract status code if available
  let statusCode: number | undefined;
  if (typeof error === 'object' && error !== null) {
    const err = error as any;
    statusCode = err.status || err.statusCode || err.error?.status;
  }

  // Translate if needed
  return translateErrorMessage(message, statusCode);
}
