"use client";
// src/components/landing/LandingNav.tsx
import { useEffect, useState } from "react";
import Link                    from "next/link";
import { useRouter }           from "next/navigation";
import { Button }              from "@/components/ui/Button";
import { Avatar }              from "@/components/ui/Misc";
import { ThemeToggle }         from "@/components/ui/ThemeToggle";
import { useAuthStore }        from "@/lib/authstore";
import { fetchUser }           from "@/lib/api";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/Dropdown";
import { cn } from "@/lib/cn";

export function LandingNav() {
  const router  = useRouter();
  const { user, isHydrated, hydrate, logout } = useAuthStore();
  const [scrolled, setScrolled] = useState(false);

  // Hydrate auth from cookie once on mount — no redirect, just check
  useEffect(() => {
    if (!isHydrated) hydrate(fetchUser);
  }, [isHydrated, hydrate]);

  // Subtle border appears after scrolling 8px
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  async function handleSignOut() {
    try {
      const { default: api } = await import("@/lib/api");
      await api.post("/api/v1/user/signout");
    } catch { /* clear locally regardless */ } finally {
      logout();
      router.push("/");
    }
  }

  const initials = user?.username?.slice(0, 2).toUpperCase() ?? "??";

  return (
    <nav className={cn(
      "fixed top-0 left-0 right-0 z-50 h-16",
      "flex items-center justify-between px-6 md:px-12",
    )}>
      {/* Frosted glass backdrop */}
      <div className={cn(
        "absolute inset-0 bg-[var(--cb-bg-page)]/80 backdrop-blur-md",
        "border-b transition-colors duration-200",
        scrolled ? "border-cb" : "border-transparent",
        "pointer-events-none"
      )} />

      {/* ── Logo ─────────────────────────────────────────── */}
      <Link href="/" className="relative flex items-center gap-2.5 shrink-0">
        <div className="w-7 h-7 bg-brand rounded-md flex items-center justify-center">
          <span className="font-mono font-bold text-xs text-[#111]">CB</span>
        </div>
        <span className="font-mono font-bold text-sm text-cb-primary tracking-tight">
          cloudblocks
        </span>
      </Link>

      {/* ── Nav links ────────────────────────────────────── */}
      <div className="relative hidden md:flex items-center gap-6">
        {[
          { href: "#features", label: "Features" },
          { href: "#pricing",  label: "Pricing"  },
          { href: "/docs",     label: "Docs"      },
        ].map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className="text-sm text-cb-secondary hover:text-cb-primary transition-colors duration-100"
          >
            {label}
          </Link>
        ))}
      </div>

      {/* ── Right side ───────────────────────────────────── */}
      <div className="relative flex items-center gap-2">

        {/* Theme toggle — always visible */}
        <ThemeToggle />

        {/* Reserve width while hydrating to prevent layout shift */}
        {!isHydrated && <div className="w-[148px] h-8" aria-hidden />}

        {/* ── Logged OUT ── */}
        {isHydrated && !user && (
          <>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/signin">Sign in</Link>
            </Button>
            <Button variant="primary" size="sm" asChild>
              <Link href="/signup">Get started →</Link>
            </Button>
          </>
        )}

        {/* ── Logged IN ── */}
        {isHydrated && user && (
          <>
            {/* Dashboard shortcut button */}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push("/dashboard")}
              leftIcon={<GridIcon />}
            >
              Dashboard
            </Button>

            {/* User avatar dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger>
                <button
                  aria-label="User menu"
                  className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-md hover:bg-[var(--cb-bg-hover)] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand"
                >
                  <Avatar
                    initials={initials}
                    src={user.avatar ?? undefined}
                    size="sm"
                  />
                  <span className="hidden sm:block text-xs font-medium text-cb-primary max-w-[80px] truncate">
                    {user.username}
                  </span>
                  <ChevronDownIcon />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-52">
                {/* Identity */}
                <div className="px-3 py-2.5 border-b border-cb mb-1">
                  <p className="text-xs font-semibold text-cb-primary truncate">{user.username}</p>
                  <p className="text-2xs text-cb-muted truncate mt-0.5">{user.email}</p>
                </div>
                <DropdownMenuItem icon={<GridIcon />} onSelect={() => router.push("/dashboard")}>
                  Dashboard
                </DropdownMenuItem>
                <DropdownMenuItem icon={<GearIcon />} onSelect={() => router.push("/dashboard/settings")}>
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem icon={<SignOutIcon />} variant="danger" onSelect={handleSignOut}>
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
    </nav>
  );
}

/* ── Icons ── */
function GridIcon()       { return <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>; }
function GearIcon()       { return <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="8" cy="8" r="2.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M3 13l1.5-1.5M11.5 4.5L13 3"/></svg>; }
function SignOutIcon()    { return <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M10 11l4-3-4-3M14 8H6"/></svg>; }
function ChevronDownIcon(){ return <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 4.5L6 7.5l3-3"/></svg>; }