/** Facepunch defaults: game 28015, rcon 28016, query uses server.port unless overridden. */
export const RUST_DEFAULT_GAME_PORT = 28015;
export const RUST_DEFAULT_RCON_PORT = 28016;
export const RUST_DEFAULT_QUERY_PORT = 28015;

const RUST_PORT_RANGES = [
  { min: 27015, max: 27020 },
  { min: 28000, max: 28200 },
] as const;

export function isApprovedRustPort(port: number): boolean {
  if (!Number.isInteger(port) || port < 1 || port > 65535) return false;
  return RUST_PORT_RANGES.some((range) => port >= range.min && port <= range.max);
}

export function rustAllowedPorts(): readonly number[] {
  const ports: number[] = [];
  for (const range of RUST_PORT_RANGES) {
    for (let port = range.min; port <= range.max; port += 1) {
      ports.push(port);
    }
  }
  return ports;
}
