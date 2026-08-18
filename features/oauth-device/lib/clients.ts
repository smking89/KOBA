/**
 * First-party device-flow clients (client, 2026-08-18: Phase 21's "OAuth
 * device-authorization-style flow" — the plugin has no browser to hold a
 * NextAuth session cookie in). KOBA doesn't support third-party OAuth
 * apps, so this is a small hardcoded registry, not a DB-backed client
 * table — adding Phase 22's Discord bot later is a code change here,
 * not a migration.
 */
export type OAuthDeviceScope = "inventory:read" | "inventory:write";

export type OAuthDeviceClientKey = "pc-plugin";

export type OAuthDeviceClient = {
  key: OAuthDeviceClientKey;
  label: string;
  defaultScopes: OAuthDeviceScope[];
};

export const OAUTH_DEVICE_CLIENTS: Record<OAuthDeviceClientKey, OAuthDeviceClient> = {
  "pc-plugin": {
    key: "pc-plugin",
    label: "KOBA PC Plugin",
    defaultScopes: ["inventory:read", "inventory:write"],
  },
};

export function isValidDeviceClientKey(value: string): value is OAuthDeviceClientKey {
  return value in OAUTH_DEVICE_CLIENTS;
}

const ALL_SCOPES: readonly OAuthDeviceScope[] = ["inventory:read", "inventory:write"];

export function isValidScope(value: string): value is OAuthDeviceScope {
  return (ALL_SCOPES as readonly string[]).includes(value);
}
