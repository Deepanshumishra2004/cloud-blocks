import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { getGreeting } from "./constants";
import { PlusIcon } from "./icons";

export function DashboardHeader({ username }: { username?: string }) {
  const router = useRouter();
  const greeting = getGreeting();

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold text-cb-primary tracking-tight">
          {greeting}, {username?.toUpperCase()}
        </h1>
        <p className="text-sm text-cb-secondary mt-1">Here&apos;s what&apos;s happening with your environments.</p>
      </div>
      <Button
        variant="primary"
        size="sm"
        leftIcon={<PlusIcon />}
        onClick={() => router.push("/dashboard/repls?new=1")}
      >
        New Repl
      </Button>
    </div>
  );
}
