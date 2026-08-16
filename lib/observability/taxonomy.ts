export const ERROR_CATEGORIES = [
  "validation",
  "authentication",
  "authorization",
  "not_found",
  "conflict",
  "rate_limited",
  "database",
  "redis",
  "storage",
  "payment",
  "external_provider",
  "queue",
  "worker",
  "security_rejection",
  "unexpected",
] as const;

export type ErrorCategory = (typeof ERROR_CATEGORIES)[number];

const EXPECTED_NOISE: ReadonlySet<ErrorCategory> = new Set([
  "validation",
  "authentication",
  "authorization",
  "not_found",
  "conflict",
  "rate_limited",
  "security_rejection",
]);

export class AppError extends Error {
  readonly category: ErrorCategory;
  readonly expose: boolean;
  readonly status: number;

  constructor(
    message: string,
    category: ErrorCategory,
    options?: { expose?: boolean; status?: number; cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "AppError";
    this.category = category;
    this.expose = options?.expose ?? EXPECTED_NOISE.has(category);
    this.status = options?.status ?? defaultStatus(category);
  }
}

function defaultStatus(category: ErrorCategory): number {
  switch (category) {
    case "validation":
      return 400;
    case "authentication":
      return 401;
    case "authorization":
    case "security_rejection":
      return 403;
    case "not_found":
      return 404;
    case "conflict":
      return 409;
    case "rate_limited":
      return 429;
    case "database":
    case "redis":
    case "storage":
    case "payment":
    case "external_provider":
    case "queue":
    case "worker":
    case "unexpected":
    default:
      return 500;
  }
}

export function isExpectedNoise(error: unknown): boolean {
  if (error instanceof AppError) return EXPECTED_NOISE.has(error.category);
  if (error && typeof error === "object" && "name" in error) {
    const name = String((error as { name?: string }).name);
    if (name === "ZodError") return true;
  }
  return false;
}

export function classifyError(error: unknown): ErrorCategory {
  if (error instanceof AppError) return error.category;
  if (error && typeof error === "object") {
    const name = "name" in error ? String(error.name) : "";
    const code = "code" in error ? String(error.code) : "";
    if (name === "ZodError") return "validation";
    if (name === "PaymentError") {
      if (code === "INVALID_SIGNATURE") return "security_rejection";
      if (code === "NOT_CONFIGURED") return "payment";
      if (code === "NOT_FOUND") return "not_found";
      if (code === "FORBIDDEN" || code === "SELF_BUY") return "authorization";
      return "payment";
    }
    if (name === "StaffMfaError") {
      if (code === "UNAUTHENTICATED") return "authentication";
      if (code === "FORBIDDEN" || code === "STEP_UP_REQUIRED") return "authorization";
      if (code === "RATE_LIMITED") return "rate_limited";
      if (code === "INVALID_CODE" || code === "INVALID") return "validation";
      return "authentication";
    }
    if (name === "WalletError") {
      if (code === "UNBALANCED") return "unexpected";
      if (code === "NOT_FOUND") return "not_found";
      if (code === "FORBIDDEN") return "authorization";
      return "validation";
    }
    if (code === "ECONNREFUSED" || code === "28P01" || name.includes("Prisma")) return "database";
  }
  return "unexpected";
}
