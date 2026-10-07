import { SiteLogo } from "@/components/brand/site-logo";

export function LogoLoader({ size = 56 }: { size?: number }) {
  return (
    <div className="flex justify-center py-5" role="status" aria-label="Carregando">
      <SiteLogo size={size} className="animate-logo-spin" />
    </div>
  );
}
