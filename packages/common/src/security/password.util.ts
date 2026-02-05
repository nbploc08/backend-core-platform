import * as argon2 from 'argon2';

/**
 * Hash password using argon2id algorithm
 * @param password - Plain text password
 * @returns Hashed password string
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 4,
  });
}

/**
 * Verify password against hash
 * @param hash - Stored password hash
 * @param password - Plain text password to verify
 * @returns True if password matches
 */
export async function verifyPassword(
  hash: string,
  password: string,
): Promise<boolean> {
  return argon2.verify(hash, password);
}
