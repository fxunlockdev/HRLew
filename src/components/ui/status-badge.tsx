import { cn } from "@/lib/utils";
import { STATUS_COLOR_MAP } from "@/lib/constants";

interface StatusBadgeProps {
  label: string;
  color?: string | null;
  className?: string;
}

export function StatusBadge({ label, color, className }: StatusBadgeProps) {
  const palette = STATUS_COLOR_MAP[color ?? "slate"] ?? STATUS_COLOR_MAP.slate;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        palette,
        className,
      )}
    >
      {label}
    </span>
  );
}
