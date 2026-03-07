import { Progress } from "@/components/ui/Misc";

export function UsageMeter({
  label,
  used,
  max,
  unit,
  unlimited,
}: {
  label: string;
  used: number;
  max: number;
  unit: string;
  unlimited?: boolean;
}) {
  const percentage = unlimited || max <= 0 ? 0 : Math.min(100, Math.round((used / max) * 100));
  const variant = percentage >= 90 ? "danger" : percentage >= 70 ? "warning" : "brand";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-cb-secondary">{label}</span>
        <span className="text-xs font-mono text-cb-muted">{unlimited ? `${used} / unlimited` : `${used} / ${max} ${unit}`}</span>
      </div>
      {!unlimited && <Progress value={used} max={max} variant={variant} size="md" />}
      {percentage >= 90 && !unlimited && <p className="text-2xs text-[var(--danger)]">Near limit. Consider upgrading.</p>}
    </div>
  );
}
