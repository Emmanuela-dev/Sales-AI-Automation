import dns from 'dns/promises';
import net from 'net';

/**
 * Guards the website analyzer against being used as an internal port scanner.
 *
 * The analyzer fetches whatever URL it is handed with a real browser, so without
 * this check an authenticated caller could point it at cloud metadata endpoints
 * or services on the private network the server sits in.
 */
export class UnsafeUrlError extends Error {
  readonly statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeUrlError';
  }
}

/** Ranges that must never be reachable through a user-supplied URL. */
function isPrivateAddress(address: string): boolean {
  const version = net.isIP(address);

  if (version === 4) {
    const octets = address.split('.').map(Number);
    const [a, b] = octets;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
    if (a >= 224) return true; // multicast and reserved
    return false;
  }

  if (version === 6) {
    const normalized = address.toLowerCase();
    if (normalized === '::' || normalized === '::1') return true;
    if (normalized.startsWith('fe80')) return true; // link-local
    if (/^f[cd]/.test(normalized)) return true; // unique local
    // IPv4-mapped, e.g. ::ffff:127.0.0.1
    const mapped = normalized.match(/^::ffff:(.+)$/);
    if (mapped && net.isIP(mapped[1]) === 4) return isPrivateAddress(mapped[1]);
    return false;
  }

  return false;
}

/**
 * Normalizes a target URL and rejects anything that isn't a public http(s) host.
 * Returns the URL with a scheme guaranteed to be present.
 */
export async function assertPublicHttpUrl(rawUrl: string): Promise<string> {
  const withScheme = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new UnsafeUrlError(`"${rawUrl}" is not a valid URL.`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new UnsafeUrlError('Only http and https URLs can be analyzed.');
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');

  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.internal')) {
    throw new UnsafeUrlError('Internal hostnames cannot be analyzed.');
  }

  if (net.isIP(hostname)) {
    if (isPrivateAddress(hostname)) {
      throw new UnsafeUrlError('Private and loopback addresses cannot be analyzed.');
    }
    return parsed.toString();
  }

  // Resolve the name so a public hostname pointing at a private address is
  // caught too.
  let addresses: { address: string }[];
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch {
    // A name that doesn't resolve is not a security problem — there is nothing
    // to connect to. Prospects with dead domains are common and worth knowing
    // about, so let the analyzer report it as unreachable instead of rejecting.
    return parsed.toString();
  }

  if (addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new UnsafeUrlError('That hostname resolves to a private address and cannot be analyzed.');
  }

  return parsed.toString();
}
