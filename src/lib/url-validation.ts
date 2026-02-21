import { promises as dns } from "dns";

// Private/internal IP ranges to block (SSRF protection)
const BLOCKED_CIDRS = [
  { start: ip4ToInt("127.0.0.0"), end: ip4ToInt("127.255.255.255") },   // 127.0.0.0/8 loopback
  { start: ip4ToInt("10.0.0.0"), end: ip4ToInt("10.255.255.255") },     // 10.0.0.0/8 private
  { start: ip4ToInt("172.16.0.0"), end: ip4ToInt("172.31.255.255") },   // 172.16.0.0/12 private
  { start: ip4ToInt("192.168.0.0"), end: ip4ToInt("192.168.255.255") }, // 192.168.0.0/16 private
  { start: ip4ToInt("169.254.0.0"), end: ip4ToInt("169.254.255.255") }, // 169.254.0.0/16 link-local / AWS metadata
  { start: ip4ToInt("0.0.0.0"), end: ip4ToInt("0.255.255.255") },       // 0.0.0.0/8 unspecified
  { start: ip4ToInt("100.64.0.0"), end: ip4ToInt("100.127.255.255") },  // 100.64.0.0/10 shared address space
];

const BLOCKED_IPV6_PREFIXES = [
  "::1",        // loopback
  "fc",         // fc00::/7 unique local
  "fd",         // fd00::/8 unique local
  "fe80",       // fe80::/10 link-local
  "::",         // unspecified
];

function ip4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc << 8) | parseInt(octet, 10), 0) >>> 0;
}

function isBlockedIPv4(ip: string): boolean {
  const intIp = ip4ToInt(ip);
  return BLOCKED_CIDRS.some(({ start, end }) => intIp >= start && intIp <= end);
}

function isBlockedIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase().replace(/^\[|\]$/g, "");
  return BLOCKED_IPV6_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

/**
 * Validate a gateway URL to prevent SSRF attacks.
 * - Only allows http: and https: protocols
 * - Blocks private/internal/loopback IP ranges
 * - In production, requires HTTPS
 * - Resolves hostname via DNS and checks resolved IP against blocklist
 */
export async function validateGatewayUrl(url: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid gateway URL: "${url}"`);
  }

  const { protocol, hostname } = parsed;

  if (protocol !== "http:" && protocol !== "https:") {
    throw new Error(`Gateway URL must use http or https protocol, got: "${protocol}"`);
  }

  if (process.env.NODE_ENV === "production" && protocol !== "https:") {
    throw new Error("Gateway URL must use HTTPS in production");
  }

  // Block numeric IPv4 directly in the URL
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    if (isBlockedIPv4(hostname)) {
      throw new Error(`Gateway URL points to a blocked IP address: "${hostname}"`);
    }
    return; // Valid public IPv4, no DNS needed
  }

  // Block IPv6 directly in the URL (bracket notation stripped by URL parser)
  if (hostname.includes(":")) {
    if (isBlockedIPv6(hostname)) {
      throw new Error(`Gateway URL points to a blocked IPv6 address: "${hostname}"`);
    }
    return;
  }

  // Block localhost by name
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new Error(`Gateway URL hostname is not allowed: "${hostname}"`);
  }

  // Resolve hostname and check resolved IP
  try {
    const result = await dns.lookup(hostname);
    const resolvedIp = result.address;
    const family = result.family;

    if (family === 4 && isBlockedIPv4(resolvedIp)) {
      throw new Error(`Gateway URL hostname "${hostname}" resolves to a blocked IP: "${resolvedIp}"`);
    }
    if (family === 6 && isBlockedIPv6(resolvedIp)) {
      throw new Error(`Gateway URL hostname "${hostname}" resolves to a blocked IPv6: "${resolvedIp}"`);
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Gateway URL")) {
      throw err;
    }
    throw new Error(`Failed to resolve gateway URL hostname "${hostname}": ${err instanceof Error ? err.message : String(err)}`);
  }
}
