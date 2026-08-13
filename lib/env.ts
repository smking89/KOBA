import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default("KOBA"),
  DATABASE_URL: z.string().min(1).optional(),
  AUTH_SECRET: z.string().min(1).optional(),
  AUTH_URL: z.string().url().optional(),
});

export type PublicEnv = {
  appUrl: string;
  appName: string;
  nodeEnv: "development" | "test" | "production";
};

/**
 * Validates public / shared env used by the foundation shell.
 * Secrets required by later phases are optional here so `next build`
 * and unit tests work before Auth/DB are wired.
 */
export function getPublicEnv(): PublicEnv {
  const parsed = envSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_URL: process.env.AUTH_URL,
  });

  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Invalid environment configuration:\n${details.join("\n")}`);
  }

  return {
    appUrl: parsed.data.NEXT_PUBLIC_APP_URL,
    appName: parsed.data.NEXT_PUBLIC_APP_NAME,
    nodeEnv: parsed.data.NODE_ENV,
  };
}
