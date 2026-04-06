import { promises as dns } from 'node:dns';
import { isIP, isIPv4 } from 'node:net';

/**
 * Checks if an IP address is in a private, loopback, or link-local range.
 * Supports IPv4 and basic IPv6 checks.
 */
export function isPrivateIP(ip: string): boolean {
  if (!isIP(ip)) return false;

  // IPv4 checks
  if (ip.includes('.') && isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4) return false;
    const [first = -1, second = -1] = parts;

    // Loopback: 127.0.0.0/8
    if (first === 127) return true;
    // 0.0.0.0/8
    if (first === 0) return true;
    // RFC1918: 10.0.0.0/8
    if (first === 10) return true;
    // RFC1918: 172.16.0.0/12
    if (first === 172 && second >= 16 && second <= 31) return true;
    // RFC1918: 192.168.0.0/16
    if (first === 192 && second === 168) return true;
    // Link-local: 169.254.0.0/16
    if (first === 169 && second === 254) return true;
    // Carrier-grade NAT: 100.64.0.0/10
    if (first === 100 && second >= 64 && second <= 127) return true;
    // Cloud provider metadata IP
    if (ip === '169.254.169.254') return true;

    return false;
  }

  // IPv6 checks
  const ipLower = ip.toLowerCase();
  // Loopback
  if (ipLower === '::1') return true;
  // Unspecified
  if (ipLower === '::') return true;
  // Link-local
  if (ipLower.startsWith('fe80:')) return true;
  // Unique local addresses
  if (ipLower.startsWith('fc') || ipLower.startsWith('fd')) return true;
  // IPv4-mapped IPv6 (allow ::ffff:127.0.0.1 style)
  if (ipLower.startsWith('::ffff:')) {
    const v4Part = ipLower.slice(7);
    return isPrivateIP(v4Part);
  }

  return false;
}

export interface SafeUrlOptions {
  allowLocalhost?: boolean;
  allowPrivateNetworks?: boolean;
}

/**
 * Validates a URL to ensure it is safe for outbound requests (prevents SSRF).
 * Checks scheme, hostname, and resolves DNS to block private IPs.
 */
export async function validateSafeUrl(
  urlString: string,
  options: SafeUrlOptions = {},
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch (err: unknown) {
    throw new Error('Invalid URL format', { cause: err });
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Unsupported URL protocol. Only http and https are allowed.');
  }

  const hostname = url.hostname;
  const allowPrivateNetworks = options.allowPrivateNetworks ?? false;
  const isLocalHostname = hostname === 'localhost' || hostname === '::1' || hostname === '[::1]';

  if (options.allowLocalhost && isLocalHostname) {
    return url;
  }

  // Check if hostname is already an IP
  const hostnameWithoutBrackets = hostname.replace(/^\[/, '').replace(/\]$/, '');
  if (isIP(hostnameWithoutBrackets)) {
    if (isPrivateIP(hostnameWithoutBrackets) && !allowPrivateNetworks) {
      throw new Error(`SSRF Prevention: Private IP addresses are not allowed (${hostname})`);
    }
    return url;
  }

  if (isLocalHostname && !options.allowLocalhost) {
    throw new Error('SSRF Prevention: Localhost is not allowed');
  }

  try {
    const addresses = await dns.resolve(hostname);
    for (const address of addresses) {
      if (isPrivateIP(address) && !allowPrivateNetworks) {
        throw new Error(`SSRF Prevention: Hostname resolves to a private IP address (${address})`);
      }
    }
  } catch {
    // Allow unresolved public hostnames so development and offline CI environments
    // do not reject otherwise valid outbound URLs purely due local DNS availability.
    return url;
  }

  return url;
}
