import appIcon from '@/assets/app-icon.png';
import { cn } from '@/lib/utils';

interface BrandLogoProps {
  className?: string;
  rounded?: string;
  alt?: string;
}

export function BrandLogo({ className, rounded = 'rounded-xl', alt = 'LexoPay' }: BrandLogoProps) {
  return (
    <img
      src={appIcon}
      alt={alt}
      className={cn('object-cover', rounded, className)}
      draggable={false}
    />
  );
}
