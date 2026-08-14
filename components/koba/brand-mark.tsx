import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

type BrandMarkProps = {
  href?: string;
  className?: string;
  showWordmark?: boolean;
};

export function BrandMark({ href = "/", className, showWordmark = true }: BrandMarkProps) {
  const content = (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Image
        src="/brand/koba-logo.png"
        alt="KOBA"
        width={32}
        height={32}
        priority
        className="h-8 w-8 object-contain"
      />
      {showWordmark ? (
        <span className="font-sans text-lg font-bold tracking-[0.08em] text-foreground">KOBA</span>
      ) : null}
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="rounded-md focus-visible:outline-none">
        {content}
      </Link>
    );
  }

  return content;
}
