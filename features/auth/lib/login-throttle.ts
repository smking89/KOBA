import { rateLimit } from "@/lib/security/rate-limit";

/**
 * Login brute-force throttle (KOBA-SEC-005).
 *
 * Counts credential attempts per client IP and per target email so a single
 * host cannot spray passwords and a distributed attacker cannot hammer one
 * account. Callers must fail with the same generic error as bad credentials
 * so throttling does not enable account enumeration.
 */
export const LOGIN_IP_LIMIT = 20;
export const LOGIN_EMAIL_LIMIT = 10;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export async function isLoginThrottled(ip: string, email: string): Promise<boolean> {
  const [byIp, byEmail] = await Promise.all([
    rateLimit(`login:ip:${ip}`, LOGIN_IP_LIMIT, LOGIN_WINDOW_MS),
    rateLimit(`login:email:${email.toLowerCase()}`, LOGIN_EMAIL_LIMIT, LOGIN_WINDOW_MS),
  ]);
  return !byIp.success || !byEmail.success;
}
