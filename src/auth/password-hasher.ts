import { randomBytes, scrypt, timingSafeEqual } from 'crypto';

const HASH_BYTES = 32;
const SALT_BYTES = 16;
const PARAMS = 'N=16384,r=8,p=1';
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 };

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = await derivePasswordKey(password, salt, HASH_BYTES);
  return `scrypt$v1$${PARAMS}$${salt.toString('base64url')}$${derived.toString(
    'base64url',
  )}`;
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const parts = storedHash.split('$');
  if (
    parts.length !== 5 ||
    parts[0] !== 'scrypt' ||
    parts[1] !== 'v1' ||
    parts[2] !== PARAMS
  ) {
    return false;
  }

  const salt = Buffer.from(parts[3], 'base64url');
  const expected = Buffer.from(parts[4], 'base64url');
  if (salt.length !== SALT_BYTES || expected.length !== HASH_BYTES) {
    return false;
  }

  const actual = await derivePasswordKey(password, salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function derivePasswordKey(
  password: string,
  salt: Buffer,
  keyLength: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, SCRYPT_OPTIONS, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(Buffer.from(derivedKey));
    });
  });
}
