/** شعار LinkUp الرسمي — من assets التطبيق */
export const BRAND_LOGO_SRC = '/linkup-id-logo.png';

interface BrandLogoProps {
  size?: number;
  className?: string;
  alt?: string;
}

export function BrandLogo({ size = 44, className = '', alt = 'LinkUp' }: BrandLogoProps) {
  return (
    <img
      src={BRAND_LOGO_SRC}
      alt={alt}
      width={size}
      height={size}
      className={`brand-logo-img ${className}`.trim()}
      draggable={false}
    />
  );
}
