import { cn } from "@/lib/utils";

interface ZoneChipProps {
  zone: string;
  className?: string;
}

export function ZoneChip({ zone, className }: ZoneChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10",
        className
      )}
    >
      {zone}
    </span>
  );
}
