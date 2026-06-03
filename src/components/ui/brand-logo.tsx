import { cn } from "@/lib/utils";

interface BrandLogoProps {
  className?: string;
  alt?: string;
}

export function BrandLogo({ className, alt = "HROS logo" }: BrandLogoProps) {
  return <img src="/hrlew-logo.svg" alt={alt} className={cn("h-auto w-auto object-contain", className)} />;
}
