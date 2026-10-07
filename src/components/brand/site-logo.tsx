import Image from "next/image";

export function SiteLogo({ size = 48, className = "" }: { size?: number; className?: string }) {
  return (
    <Image
      src="/xpirito-logo.svg"
      alt="Xpírito"
      width={size}
      height={size}
      priority
      className={`invert dark:invert-0 ${className}`}
    />
  );
}
