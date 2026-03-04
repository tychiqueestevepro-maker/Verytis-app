/**
 * VERYTIS PII SCRUBBER
 * 
 * Logic to detect and redact PII (Emails, Credit Cards, API Keys) from 
 * unstructured text before it reaches immutable WORM storage.
 */

const PII_PATTERNS = {
    // 1. Emails
    EMAIL: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,

    // 2. API Keys (Common prefixes)
    STRIPE_KEY: /sk_(test|live)_[0-9a-zA-Z]{24,}/g,
    AWS_KEY: /(A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g,
    GITHUB_TOKEN: /gh[p|o|r|s|b|e]_[a-zA-Z0-9]{36,}/g,
    GENERIC_BEARER: /Bearer\s+[a-zA-Z0-9\-._~+/]+=*/gi,

    // 3. Credit Cards (Generic 13-19 digits, will be validated by Luhn)
    CREDIT_CARD: /\b(?:\d[ -]*?){13,19}\b/g,

    // 4. Phone Numbers (International + European formats)
    // Matches: +33 6 12 34 56 78, +1-555-123-4567, 06 12 34 56 78, (555) 123-4567, etc.
    PHONE: /(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{1,4}\)?[\s.-]?)?(?:\d[\s.-]?){6,14}\d/g,

    // 5. IBANs (International Bank Account Numbers — 2 letters + 2 digits + up to 30 alphanumeric)
    IBAN: /\b[A-Z]{2}\d{2}[\s]?[A-Z0-9]{4}[\s]?(?:[A-Z0-9]{4}[\s]?){1,7}[A-Z0-9]{1,4}\b/g
};

/**
 * Luhn Algorithm validation for Credit Card numbers
 * @param {string} number 
 * @returns {boolean}
 */
function isValidLuhn(number) {
    const sanitized = number.replace(/[^\d]/g, '');
    if (sanitized.length < 13 || sanitized.length > 19) return false;

    let sum = 0;
    let shouldDouble = false;
    for (let i = sanitized.length - 1; i >= 0; i--) {
        let digit = parseInt(sanitized.charAt(i));
        if (shouldDouble) {
            digit *= 2;
            if (digit > 9) digit -= 9;
        }
        sum += digit;
        shouldDouble = !shouldDouble;
    }
    return (sum % 10) === 0;
}

/**
 * Redacts PII from a string of text
 * @param {string} text 
 * @param {string[]} dynamicBannedWords - Per-tenant custom words to redact (case-insensitive)
 * @returns {string}
 */
export function scrubText(text, dynamicBannedWords = []) {
    if (!text || typeof text !== 'string') return text;

    let scrubbed = text;

    // Redact predefined patterns
    scrubbed = scrubbed.replace(PII_PATTERNS.EMAIL, '[EMAIL_REDACTED]');
    scrubbed = scrubbed.replace(PII_PATTERNS.STRIPE_KEY, '[STRIPE_KEY_REDACTED]');
    scrubbed = scrubbed.replace(PII_PATTERNS.AWS_KEY, '[AWS_KEY_REDACTED]');
    scrubbed = scrubbed.replace(PII_PATTERNS.GITHUB_TOKEN, '[GITHUB_TOKEN_REDACTED]');
    scrubbed = scrubbed.replace(PII_PATTERNS.GENERIC_BEARER, 'Bearer [REDACTED]');
    scrubbed = scrubbed.replace(PII_PATTERNS.PHONE, '[PHONE_REDACTED]');
    scrubbed = scrubbed.replace(PII_PATTERNS.IBAN, '[IBAN_REDACTED]');

    // Intelligent Credit Card scrubbing
    scrubbed = scrubbed.replace(PII_PATTERNS.CREDIT_CARD, (match) => {
        if (isValidLuhn(match)) {
            return '[CREDIT_CARD_REDACTED]';
        }
        return match; // Keep it if it doesn't pass Luhn (avoid false positives on IDs)
    });

    // Dynamic per-tenant banned words redaction (case-insensitive)
    for (const word of dynamicBannedWords) {
        if (!word || typeof word !== 'string') continue;
        const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escaped, 'gi');
        scrubbed = scrubbed.replace(regex, '[REDACTED]');
    }

    return scrubbed;
}

/**
 * Recursively scrubs specific fields in an object
 * @param {Object} obj 
 * @param {string[]} targetFields 
 * @returns {Object}
 */
export function scrubObject(obj, targetFields = ['summary', 'message', 'text', 'body', 'content']) {
    if (!obj || typeof obj !== 'object') return obj;

    const newObj = Array.isArray(obj) ? [] : {};

    for (const key in obj) {
        let value = obj[key];

        if (targetFields.includes(key.toLowerCase()) && typeof value === 'string') {
            newObj[key] = scrubText(value);
        } else if (typeof value === 'object' && value !== null) {
            newObj[key] = scrubObject(value, targetFields);
        } else {
            newObj[key] = value;
        }
    }

    return newObj;
}
