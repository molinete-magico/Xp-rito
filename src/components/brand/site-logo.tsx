import Image from "next/image";

export function SiteLogo({ size = 48, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      role="img"
      aria-label="Xpírito"
      className={`inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src="/LogoXpitrito.png"
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        priority
        className="h-full w-full object-contain dark:hidden"
      />
      <Image
        src="/LogoXpitrito2.png"
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        priority
        className="hidden h-full w-full object-contain dark:block"
      />
    </span>
  );
}
