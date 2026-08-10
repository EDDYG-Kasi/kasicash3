import { hashPassword, verifyPassword } from './password-hasher';

describe('password hasher', () => {
  it('stores only a salted scrypt hash and verifies the correct password', async () => {
    const hash = await hashPassword('correct horse battery');

    expect(hash).toMatch(/^scrypt\$v1\$N=16384,r=8,p=1\$/);
    expect(hash).not.toContain('correct horse battery');
    await expect(verifyPassword('correct horse battery', hash)).resolves.toBe(
      true,
    );
    await expect(verifyPassword('wrong horse battery', hash)).resolves.toBe(
      false,
    );
  });

  it('fails closed on malformed hashes', async () => {
    await expect(
      verifyPassword('correct horse battery', 'plain-text-password'),
    ).resolves.toBe(false);
  });
});
