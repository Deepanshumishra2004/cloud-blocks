import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { DASHBOARD_TEMPLATES } from "./constants";
import { ReplTypeIcon } from "./icons";
import { Section } from "./Section";

export function QuickStartSection() {
  const router = useRouter();

  return (
    <Section title="Quick Start">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {DASHBOARD_TEMPLATES.map((template) => (
          <button
            key={template.type}
            type="button"
            onClick={() => router.push(`/dashboard/repls?new=1&type=${template.type}`)}
            className={cn(
              "flex flex-col items-start gap-2 p-4 rounded-xl border text-left",
              "hover:scale-[1.02] active:scale-[0.99] transition-transform duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
              template.className
            )}
          >
            <span className="text-cb-primary">
              <ReplTypeIcon type={template.type} />
            </span>
            <div>
              <p className="text-sm font-semibold text-cb-primary">{template.label}</p>
              <p className="text-2xs text-cb-muted mt-0.5">{template.description}</p>
            </div>
          </button>
        ))}
      </div>
    </Section>
  );
}
