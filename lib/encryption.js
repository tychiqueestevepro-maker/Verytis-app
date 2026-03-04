import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

// ─── STEP 1: Robust Key Derivation ─────────────────────────────
// Use SHA-256 to derive a perfect 32-byte key from any-length env var.
// FATAL in production if env key is missing.
const rawKey = process.env.VERYTIS_ENCRYPTION_KEY;

if (!rawKey && process.env.NODE_ENV === 'production') {
    throw new Error(
        '🛑 FATAL: VERYTIS_ENCRYPTION_KEY is missing in production. ' +
        'AES-256-GCM requires a secret key. Set it in your environment.'
    );
}

const ENCRYPTION_KEY = crypto
    .createHash('sha256')
    .update(rawKey || 'verytis-ai-ops-dev-fallback-key')
    .digest(); // Returns a 32-byte Buffer, guaranteed.

export function encrypt(text) {
    if (!text) return null;
    try {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
        let encrypted = cipher.update(text);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        const authTag = cipher.getAuthTag();
        return `${iv.toString('hex')}:${encrypted.toString('hex')}:${authTag.toString('hex')}`;
    } catch (e) {
        console.error("Encryption failed:", e);
        return null;
    }
}

export function decrypt(text) {
    if (!text) return null;
    try {
        const textParts = text.split(':');
        if (textParts.length !== 3) return null;
        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = Buffer.from(textParts.shift(), 'hex');
        const authTag = Buffer.from(textParts.shift(), 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (e) {
        console.error("Decryption failed:", e);
        return null;
    }
}
