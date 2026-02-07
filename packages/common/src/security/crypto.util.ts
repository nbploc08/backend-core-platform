import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGO = 'aes-256-gcm';
const KEY_LEN = 32;

const ENV_KEY = 'ENCRYPT_KEY';

/**
 * Returns ENCRYPT_KEY from env. Throws if missing or empty (use in auth-service & notification-service).
 */
export function getEncryptKey(): string {
  const key = process.env[ENV_KEY]?.trim();
  if (!key) {
    throw new Error(
      `[getEncryptKey] Missing ${ENV_KEY}: not set or empty. ` +
        `Check (1) .env file exists and is loaded (root .env or app .env, ConfigModule envFilePath) ` +
        `and (2) ${ENV_KEY}=<your-secret> is defined in that file.`,
    );
  }
  return key;
}

export function encrypt(plainText: string, password: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, KEY_LEN);
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([salt, iv, authTag, enc]).toString('base64');
}

export function decrypt(cipherText: string, password: string): string {
  const buf = Buffer.from(cipherText, 'base64');
  if (buf.length < 48) {
    throw new Error('Invalid cipher text: too short (expected salt+iv+authTag+enc)');
  }
  const salt = buf.subarray(0, 16);
  const iv = buf.subarray(16, 32);
  const authTag = buf.subarray(32, 48);
  const enc = buf.subarray(48);
  const key = scryptSync(password, salt, KEY_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}
