import { isIP } from 'node:net';

export const SSRF_PRIVATE_IPV4_CIDRS: readonly string[] = [
  '0.0.0.0/8',
  '10.0.0.0/8',
  '100.64.0.0/10',
  '127.0.0.0/8',
  '169.254.0.0/16',
  '172.16.0.0/12',
  '192.0.0.0/24',
  '192.0.2.0/24',
  '192.168.0.0/16',
  '198.18.0.0/15',
  '198.51.100.0/24',
  '203.0.113.0/24',
  '224.0.0.0/4',
  '240.0.0.0/4',
  '255.255.255.255/32',
];

export const SSRF_PRIVATE_HOSTNAMES: ReadonlySet<string> = new Set<string>([
  'localhost',
  'metadata.google.internal',
  'metadata',
  'instance-data',
]);

export class SsrfBlockedHostError extends Error {
  readonly name = 'SsrfBlockedHostError';
  readonly code = 'SSRF_BLOCKED_HOST';
  readonly status = 422;
  readonly details: Readonly<{ host: string; reason: string }>;
  constructor(host: string, reason: string) {
    super(`Destination host is blocked by SSRF policy: ${host} (${reason}).`);
    this.details = Object.freeze({ host, reason });
  }
}

export type SsrfPolicy = Readonly<{
  allowPrivateNetworks: boolean;
  allowedHostnames?: ReadonlySet<string>;
}>;

const DEFAULT_POLICY: SsrfPolicy = { allowPrivateNetworks: false };

function parseCidr(cidr: string): { base: bigint; bits: number } {
  const [address, prefixLength] = cidr.split('/');
  if (!address || !prefixLength) {
    throw new Error(`Invalid CIDR: ${cidr}`);
  }
  const base = ipToBigInt(address);
  const bits = Number.parseInt(prefixLength, 10);
  if (!Number.isFinite(bits) || bits < 0 || bits > 32) {
    throw new Error(`Invalid prefix length: ${cidr}`);
  }
  return { base, bits };
}

function ipToBigInt(ip: string): bigint {
  if (!isIP(ip)) {
    throw new Error(`Invalid IP: ${ip}`);
  }
  if (ip.includes(':')) {
    return ipv6ToBigInt(ip);
  }
  return ipv4ToBigInt(ip);
}

function ipv4ToBigInt(ip: string): bigint {
  const parts = ip.split('.').map((p) => Number.parseInt(p, 10));
  let result = 0n;
  for (const part of parts) {
    result = (result << 8n) | BigInt(part);
  }
  return result;
}

function ipv6ToBigInt(ip: string): bigint {
  const [head, tail] = ip.split('::');
  const headParts = head ? head.split(':') : [];
  const tailParts = tail ? tail.split(':') : [];
  const total = 8;
  const missing = total - (headParts.length + tailParts.length);
  const parts = [
    ...headParts,
    ...Array.from({ length: Math.max(missing, 0) }, () => '0'),
    ...tailParts,
  ];
  let result = 0n;
  for (const part of parts) {
    const value = BigInt(parseInt(part || '0', 16));
    result = (result << 16n) | value;
  }
  return result;
}

const PARSED_CIDRS = SSRF_PRIVATE_IPV4_CIDRS.map(parseCidr);

function isPrivateIPv4(ip: string): boolean {
  if (!isIP(ip) || ip.includes(':')) return false;
  const value = ipv4ToBigInt(ip);
  return PARSED_CIDRS.some(({ base, bits }) => {
    if (bits === 0) return true;
    const mask = bits === 32 ? 0xffffffffn : ((1n << BigInt(bits)) - 1n) << BigInt(32 - bits);
    return (value & mask) === (base & mask);
  });
}

function isPrivateIPv6(ip: string): boolean {
  if (!isIP(ip) || !ip.includes(':')) return false;
  const value = ipv6ToBigInt(ip);
  const lower = value & 0xffffffffffffffffffffffffffffffffn;
  // ::1 loopback
  if (lower === 1n) return true;
  // ::ffff:0:0/96 mapped IPv4 (handled by the IPv4 check earlier in the guard)
  // fc00::/7 unique local — top 7 bits must be 1111110
  if (((value >> 121n) & 0x7fn) === 0x7en) return true;
  // fe80::/10 link-local — top 10 bits must be 1111111010
  if (((value >> 118n) & 0x3ffn) === 0x3fan) return true;
  // ff00::/8 multicast — top 8 bits must be 11111111
  if (((value >> 120n) & 0xffn) === 0xffn) return true;
  return false;
}

export type SsrfCheck = Readonly<{
  ok: boolean;
  reason?: string;
}>;

export function checkUrlForSsrf(rawUrl: string, policy: SsrfPolicy = DEFAULT_POLICY): SsrfCheck {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: 'invalid_url' };
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, reason: 'unsupported_protocol' };
  }
  if (policy.allowPrivateNetworks) {
    return { ok: true };
  }
  if (policy.allowedHostnames?.has(parsed.hostname)) {
    return { ok: true };
  }
  const hostname = parsed.hostname.toLowerCase();
  if (SSRF_PRIVATE_HOSTNAMES.has(hostname)) {
    return { ok: false, reason: 'private_hostname' };
  }
  const unwrapped = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
  if (isIP(unwrapped) === 4 && isPrivateIPv4(unwrapped)) {
    return { ok: false, reason: 'private_ipv4' };
  }
  if (isIP(unwrapped) === 6 && isPrivateIPv6(unwrapped)) {
    return { ok: false, reason: 'private_ipv6' };
  }
  return { ok: true };
}

export function assertUrlIsSafe(rawUrl: string, policy: SsrfPolicy = DEFAULT_POLICY): URL {
  const check = checkUrlForSsrf(rawUrl, policy);
  if (!check.ok) {
    throw new SsrfBlockedHostError(rawUrl, check.reason ?? 'blocked');
  }
  return new URL(rawUrl);
}
