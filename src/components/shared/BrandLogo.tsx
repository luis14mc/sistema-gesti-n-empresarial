import { cn } from '@/lib/utils';
import { BRAND_LOGO_PATH, BRAND_ORG_SHORT } from '@/lib/brand';

interface BrandLogoProps {
  height?: number;
  className?: string;
  /** Oculta el texto alternativo visualmente (mantiene accesibilidad) */
  hideAlt?: boolean;
}

export function BrandLogo({ height = 40, className, hideAlt }: BrandLogoProps) {
  return (
    <img
      src={BRAND_LOGO_PATH}
      alt={hideAlt ? '' : BRAND_ORG_SHORT}
      aria-hidden={hideAlt ? true : undefined}
      height={height}
      className={cn('w-auto max-w-full object-contain', className)}
      style={{ height }}
    />
  );
}
