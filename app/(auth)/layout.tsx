import Link from "next/link";
import { BrandMark } from "@/components/koba/brand-mark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-12">
      <div className="mb-8">
        <BrandMark href="/" />
      </div>
      <div className="w-full max-w-md">{children}</div>
      <p className="mt-8 max-w-md text-center text-xs leading-relaxed text-muted">
        By continuing you agree to KOBA&apos;s terms.{" "}
        <Link href="/" className="text-neon-lime hover:underline">
          Back to home
        </Link>
      </p>
    </div>
  );
}
