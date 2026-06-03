import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, initials } from "@/lib/utils";

interface CompanyLogoProps {
  name: string;
  logoUrl?: string | null;
  className?: string;
  fallbackClassName?: string;
}

export function CompanyLogo({ name, logoUrl, className, fallbackClassName }: CompanyLogoProps) {
  return (
    <Avatar className={cn("rounded-2xl border border-border/70 bg-white shadow-xs", className)}>
      {logoUrl ? <AvatarImage src={logoUrl} alt={`${name} logo`} className="object-cover" /> : null}
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
