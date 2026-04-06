import { describe, it, expect } from 'vitest';
import { isPrivateIP, validateSafeUrl } from '../src/security/url.js';

describe('isPrivateIP', () => {
  it('correctly identifies private IPv4 addresses', () => {
    expect(isPrivateIP('127.0.0.1')).toBe(true);
    expect(isPrivateIP('10.0.0.1')).toBe(true);
    expect(isPrivateIP('172.16.0.1')).toBe(true);
    expect(isPrivateIP('192.168.1.1')).toBe(true);
    expect(isPrivateIP('169.254.169.254')).toBe(true);
  });

  it('correctly identifies public IPv4 addresses', () => {
    expect(isPrivateIP('8.8.8.8')).toBe(false);
    expect(isPrivateIP('1.1.1.1')).toBe(false);
    expect(isPrivateIP('93.184.216.34')).toBe(false);
  });

  it('correctly identifies private IPv6 addresses', () => {
    expect(isPrivateIP('::1')).toBe(true);
    expect(isPrivateIP('fc00::1')).toBe(true);
    expect(isPrivateIP('fe80::1')).toBe(true);
    expect(isPrivateIP('::ffff:127.0.0.1')).toBe(true);
  });

  it('returns false for invalid IPs', () => {
    expect(isPrivateIP('not-an-ip')).toBe(false);
  });
});

describe('validateSafeUrl', () => {
  it('allows standard https URLs', async () => {
    const url = await validateSafeUrl('https://example.com');
    expect(url.hostname).toBe('example.com');
  });

  it('blocks unknown protocols', async () => {
    await expect(validateSafeUrl('file:///etc/passwd')).rejects.toThrow('Unsupported URL protocol');
    await expect(validateSafeUrl('ftp://example.com')).rejects.toThrow('Unsupported URL protocol');
  });

  it('blocks local IPs when allowLocalhost is false', async () => {
    await expect(validateSafeUrl('http://127.0.0.1')).rejects.toThrow(
      'SSRF Prevention: Private IP addresses are not allowed',
    );
    await expect(validateSafeUrl('http://169.254.169.254')).rejects.toThrow(
      'SSRF Prevention: Private IP addresses are not allowed',
    );
  });

  it('blocks localhost when allowLocalhost is false', async () => {
    await expect(validateSafeUrl('http://localhost')).rejects.toThrow(
      'SSRF Prevention: Localhost is not allowed',
    );
  });

  it('allows localhost when allowLocalhost is true', async () => {
    const url = await validateSafeUrl('http://localhost', { allowLocalhost: true });
    expect(url.hostname).toBe('localhost');
  });
});
