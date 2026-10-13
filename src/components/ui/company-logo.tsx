import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, initials } from "@/lib/utils";

/**
 * `logoUrl` holds either an external image URL or an object key in the bucket.
 * Keys are served through /api/files, which authorises the viewer and redirects
 * to a presigned URL.
 */
function resolveLogoSrc(logoUrl: string): string {
  if (/^(https?:)?\/\//i.test(logoUrl) || logoUrl.startsWith("data:")) return logoUrl;
  if (logoUrl.startsWith("/")) return logoUrl;
  return `/api/files/${logoUrl.split("/").map(encodeURIComponent).join("/")}`;
}

interface CompanyLogoProps {
  name: string;
  logoUrl?: string | null;
  className?: string;
  fallbackClassName?: string;
}

export function CompanyLogo({ name, logoUrl, className, fallbackClassName }: CompanyLogoProps) {
  return (
    <Avatar className={cn("rounded-2xl border border-border/70 bg-white shadow-xs", className)}>
      {logoUrl ? (
        <AvatarImage src={resolveLogoSrc(logoUrl)} alt={`${name} logo`} className="object-cover" />
      ) : null}
      <AvatarFallback
        className={cn(
          "rounded-2xl bg-gradient-to-br from-sky-100 via-white to-blue-100 text-[11px] font-semibold text-blue-700",
          fallbackClassName,
        )}
      >
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
