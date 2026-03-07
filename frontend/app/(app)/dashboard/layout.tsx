"use client";
// src/app/dashboard/layout.tsx
import { useEffect, useState }        from "react";
import { usePathname, useRouter }     from "next/navigation";
import Link                           from "next/link";
import { useRequireAuth }             from "@/hooks/useAuth";
import { useTheme }                   from "@/components/layout/ThemeProvider";
import { Avatar, Skeleton }           from "@/components/ui/Misc";
import { fetchAllPlans, fetchSubscription, fetchUsage, type Plan, type PlanName, type Subscription, type Usage } from "@/lib/api";
import {
  Sidebar, SidebarHeader, SidebarActions,
  SidebarNav, SidebarNavSection, SidebarNavItem, SidebarFooter,
} from "@/components/layout/Sidebar";
import { Topbar }  from "@/components/layout/Topbar";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/Dropdown";

const NAV_MAIN = [
  { href: "/dashboard",         icon: <HomeIcon />,  label: "Home"     },
  { href: "/dashboard/repls",   icon: <CodeIcon />,  label: "My Repls" },
  { href: "/dashboard/explore", icon: <GridIcon />,  label: "Explore"  },
];
const NAV_ACCOUNT = [
  { href: "/dashboard/settings", icon: <GearIcon />, label: "Settings" },
  { href: "/dashboard/billing",  icon: <CardIcon />, label: "Billing"  },
];
const PLAN_ORDER: PlanName[] = ["FREE", "PRO", "TEAMS"];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isHydrated, signout } = useRequireAuth();
  const pathname   = usePathname();
  const { toggle, isDark } = useTheme();
  const router     = useRouter();

  const [sub,   setSub]   = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);

  useEffect(() => {
    if (!user) return;
    Promise.all([fetchSubscription(), fetchUsage(), fetchAllPlans()])
      .then(([s, u, p]) => { setSub(s); setUsage(u); setPlans(p); })
      .catch(() => {}); // non-critical
  }, [user]);

  if (!isHydrated) return <DashboardSkeleton />;
  if (!user) return null;

  const initials = user.username.slice(0, 2).toUpperCase();
  const crumbs   = buildCrumbs(pathname);

  function isActive(href: string) {
    return href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
  }

  // Sidebar footer stats derived from live data
  const currentPlanName = sub?.plan.name ?? "FREE";
  const replsUsed = usage?.repls.used ?? 0;
  const replsMax  = usage?.repls.max ?? sub?.plan.maxRepls ?? 3;
  const storageMb = usage?.storage.usedMb ?? 0;
  const storageMax = usage?.storage.maxMb ?? sub?.plan.maxStorageMB ?? 500;
  const orderedPlanNames = Array.from(new Set(plans.map((plan) => plan.name))).sort(
    (a, b) => PLAN_ORDER.indexOf(a) - PLAN_ORDER.indexOf(b)
  );
  const nextPlanName = orderedPlanNames.find(
    (name) => PLAN_ORDER.indexOf(name) > PLAN_ORDER.indexOf(currentPlanName)
  );
  const upgradeLabel = nextPlanName ? `Upgrade to ${nextPlanName.charAt(0) + nextPlanName.slice(1).toLowerCase()}` : undefined;

  return (
    <div className="min-h-screen bg-[var(--cb-bg-page)] flex">

      <Sidebar>
        <SidebarHeader />

        <SidebarActions>
          <Link
            href="/dashboard/repls?new=1"
            className="flex items-center justify-center gap-2 w-full h-8 rounded-md bg-brand text-[#111] text-xs font-bold hover:bg-brand-hover active:scale-[0.98] transition-all duration-100 select-none"
          >
            <span className="text-sm leading-none font-bold">+</span>
            New Repl
          </Link>
        </SidebarActions>

        <SidebarNav>
          <SidebarNavSection>
            {NAV_MAIN.map((item) => (
              <SidebarNavItem key={item.href} href={item.href} icon={item.icon} active={isActive(item.href)}>
                {item.label}
              </SidebarNavItem>
            ))}
          </SidebarNavSection>
          <SidebarNavSection label="Account">
            {NAV_ACCOUNT.map((item) => (
              <SidebarNavItem key={item.href} href={item.href} icon={item.icon} active={isActive(item.href)}>
                {item.label}
              </SidebarNavItem>
            ))}
          </SidebarNavSection>
        </SidebarNav>

        <SidebarFooter
          plan={{
            name:  `${currentPlanName.charAt(0) + currentPlanName.slice(1).toLowerCase()} Plan`,
            stats: [
              {
                icon:  <CodeIcon />,
                label: "Repls",
                sub:   replsMax === -1 ? `${replsUsed} / unlimited used` : `${replsUsed} / ${replsMax} used`,
                value: replsMax === -1 ? 0 : replsUsed,
                max:   replsMax === -1 ? 1 : replsMax,
              },
              {
                icon:  <StorageIcon />,
                label: "Storage",
                sub:   `${storageMb} MB / ${storageMax} MB`,
                value: storageMb,
                max:   storageMax,
              },
            ],
          }}
          onUpgrade={nextPlanName ? () => router.push("/dashboard/billing") : undefined}
          upgradeLabel={upgradeLabel}
        />
      </Sidebar>

      <div className="flex-1 flex flex-col min-h-screen" style={{ marginLeft: "var(--sidebar-width)" }}>
        <Topbar
          breadcrumbs={crumbs}
          isDark={isDark}
          onThemeToggle={toggle}
          actions={
            <UserMenu
              user={user}
              initials={initials}
              onSignout={signout}
              onSettings={() => router.push("/dashboard/settings")}
              onBilling={() => router.push("/dashboard/billing")}
            />
          }
        />
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

function UserMenu({ user, initials, onSignout, onSettings, onBilling }: {
  user: { username: string; email: string; avatar?: string | null };
  initials: string; onSignout: () => void; onSettings: () => void; onBilling: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <button
          className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-[var(--cb-bg-hover)] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand"
          aria-label="User menu"
        >
          <Avatar initials={initials} src={user.avatar ?? undefined} size="sm" />
          <span className="hidden sm:block text-xs font-medium text-cb-primary max-w-[100px] truncate">{user.username}</span>
          <ChevronDownIcon />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <div className="px-3 py-2.5 border-b border-cb mb-1">
          <p className="text-xs font-semibold text-cb-primary truncate">{user.username}</p>
          <p className="text-2xs text-cb-muted truncate mt-0.5">{user.email}</p>
        </div>
        <DropdownMenuItem icon={<ProfileIcon />} onSelect={onSettings}>Profile & Settings</DropdownMenuItem>
        <DropdownMenuItem icon={<CardIcon />}    onSelect={onBilling}>Billing</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={<SignOutIcon />} variant="danger" onSelect={onSignout}>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--cb-bg-page)] flex">
      <div className="fixed left-0 top-0 bottom-0 w-[228px] bg-[var(--cb-bg-surface)] border-r border-cb flex flex-col gap-3 p-3">
        <Skeleton height={36} />
        <Skeleton height={32} />
        {[0,1,2,3,4].map((i) => <Skeleton key={i} height={30} className="opacity-50" />)}
      </div>
      <div className="flex-1 ml-[228px]">
        <div className="h-[52px] bg-[var(--cb-bg-surface)] border-b border-cb" />
        <div className="p-6 flex flex-col gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[0,1,2,3].map((i) => <Skeleton key={i} height={88} />)}
          </div>
          <Skeleton height={240} />
        </div>
      </div>
    </div>
  );
}

function buildCrumbs(pathname: string) {
  const MAP: Record<string, string> = {
    "/dashboard":          "Home",
    "/dashboard/repls":    "My Repls",
    "/dashboard/explore":  "Explore",
    "/dashboard/settings": "Settings",
    "/dashboard/billing":  "Billing",
  };
  if (pathname === "/dashboard") return [{ label: "Home" }];
  return [{ label: "Dashboard", href: "/dashboard" }, { label: MAP[pathname] ?? "Page" }];
}

function HomeIcon()      { return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M1 6.5L8 1l7 5.5V14a1 1 0 01-1 1H2a1 1 0 01-1-1V6.5z"/><path d="M6 15V9h4v6"/></svg>; }
function CodeIcon()      { return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M5 4L1 8l4 4M11 4l4 4-4 4M9 2l-2 12"/></svg>; }
function GridIcon()      { return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>; }
function GearIcon()      { return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="8" cy="8" r="2.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M3 13l1.5-1.5M11.5 4.5L13 3"/></svg>; }
function CardIcon()      { return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="1" y="3" width="14" height="10" rx="1.5"/><path d="M1 7h14"/></svg>; }
function StorageIcon()   { return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7"><ellipse cx="8" cy="4" rx="6" ry="2.5"/><path d="M2 4v4c0 1.38 2.69 2.5 6 2.5S14 9.38 14 8V4M2 8v4c0 1.38 2.69 2.5 6 2.5S14 13.38 14 12V8"/></svg>; }
function ChevronDownIcon(){ return <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 4.5L6 7.5l3-3"/></svg>; }
function ProfileIcon()   { return <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="8" cy="5" r="3"/><path d="M2 14c0-3 2.69-5 6-5s6 2 6 5"/></svg>; }
function SignOutIcon()   { return <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M10 11l4-3-4-3M14 8H6"/></svg>; }

