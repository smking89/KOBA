import { z } from "zod";

const publicEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default("KOBA"),
});

const serverEnvSchema = publicEnvSchema.extend({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(32),
  AUTH_URL: z.string().url().optional(),
});

export type PublicEnv = {
  appUrl: string;
  appName: string;
  nodeEnv: "development" | "test" | "production";
};

export type ServerEnv = PublicEnv & {
  databaseUrl: string;
  authSecret: string;
  authUrl: string;
};

function formatIssues(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n");
}

/** Public env — safe for layouts and client bundles. */
export function getPublicEnv(): PublicEnv {
  const parsed = publicEnvSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  });

  if (!parsed.success) {
    throw new Error(`Invalid environment configuration:\n${formatIssues(parsed.error)}`);
  }

  return {
    appUrl: parsed.data.NEXT_PUBLIC_APP_URL,
    appName: parsed.data.NEXT_PUBLIC_APP_NAME,
    nodeEnv: parsed.data.NODE_ENV,
  };
}

/** Server-only secrets and database configuration. */
export function getServerEnv(): ServerEnv {
  const publicEnv = getPublicEnv();
  const parsed = serverEnvSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_URL: process.env.AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL,
  });

  if (!parsed.success) {
    throw new Error(`Invalid server environment configuration:\n${formatIssues(parsed.error)}`);
  }

  return {
    ...publicEnv,
    databaseUrl: parsed.data.DATABASE_URL,
    authSecret: parsed.data.AUTH_SECRET,
    authUrl: parsed.data.AUTH_URL ?? parsed.data.NEXT_PUBLIC_APP_URL,
  };
}

/** Lenient server env for CI unit tests and builds without a live database. */
export function getServerEnvOrThrow(requireDatabase = true): ServerEnv {
  if (!requireDatabase && process.env.NODE_ENV === "test") {
    return {
      ...getPublicEnv(),
      databaseUrl: process.env.DATABASE_URL ?? "postgresql://koba:koba@localhost:5432/koba",
      authSecret: process.env.AUTH_SECRET ?? "test-secret-minimum-32-characters-long",
      authUrl: process.env.AUTH_URL ?? getPublicEnv().appUrl,
    };
  }

  return getServerEnv();
}
