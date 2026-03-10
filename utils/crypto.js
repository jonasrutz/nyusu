const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';

function getKey() {
    const hex = process.env.ENCRYPTION_KEY;
    if (!hex || hex.length !== 64) {
        throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
    }
    return Buffer.from(hex, 'hex');
}

/**§
 * Encrypts plaintext → "ivHex:tagHex:cipherHex"
 */
function encrypt(plaintext) {
    const key    = getKey();
    const iv     = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted.toString('hex');
}

/**
 * Decrypts "ivHex:tagHex:cipherHex" → plaintext
 * Returns null if decryption fails (e.g. old unencrypted message)
 */
function decrypt(payload) {
    try {
        const parts = payload.split(':');
        if (parts.length !== 3) return payload; // not encrypted → return as-is
        const [ivHex, tagHex, encHex] = parts;
        const key      = getKey();
        const iv       = Buffer.from(ivHex, 'hex');
        const tag      = Buffer.from(tagHex, 'hex');
        const encBuf   = Buffer.from(encHex, 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(encBuf), decipher.final()]).toString('utf8');
    } catch {
        return '[Nachricht konnte nicht entschlüsselt werden]';
    }
}

module.exports = { encrypt, decrypt };

