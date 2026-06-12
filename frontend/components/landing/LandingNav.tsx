"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Misc";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/Dropdown";
import { cn } from "@/lib/cn";
import { fetchUser } from "@/lib/api";
import { useAuthStore } from "@/lib/authstore";

const NAV_LINKS = [
  { href: "#features", label: "Product" },
  { href: "#pricing", label: "Pricing" },
  { href: "/docs", label: "Docs" },
  { href: "/blog", label: "Blog" },
];

export function LandingNav() {
  const router = useRouter();
  const { user, isHydrated, hydrate, logout } = useAuthStore();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!isHydrated) hydrate(fetchUser);
  }, [hydrate, isHydrated]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  async function handleSignOut() {
    try {
      const { default: api } = await import("@/lib/api");
      await api.post("/api/v1/user/signout");
    } catch {
      // Local session state should clear even when the network request fails.
    } finally {
      logout();
      router.push("/");
    }
  }

  const initials = user?.username?.slice(0, 2).toUpperCase() ?? "CB";

  return (
    <nav className="fixed inset-x-0 top-0 z-50 h-16">
      <div
        className={cn(
          "absolute inset-0 theme-chrome backdrop-blur-md transition-colors",
          scrolled ? "border-b border-cb" : "border-b border-transparent"
        )}
      />
      <div className="landing-container relative flex h-full items-center justify-between">
        <Link href="/" className="group flex items-center gap-2.5">
          <CloudBlocksMark />
          <span className="font-sans text-lg font-bold text-cb-primary">
            CloudBlocks
          </span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="relative text-sm font-medium text-cb-primary/90 transition hover:text-white after:absolute after:-bottom-2 after:left-0 after:h-px after:w-0 after:bg-brand after:transition-all after:duration-200 hover:after:w-full"
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <a
            href="https://github.com/Deepanshumishra2004/cloud-blocks"
            target="_blank"
            rel="noreferrer"
            className="shine-border hidden items-center gap-2 rounded-full border border-transparent px-3 py-1 text-sm text-cb-secondary transition hover:border-cb hover:text-cb-primary sm:flex"
          >
            <GitHubIcon />
            <span>GitHub</span>
          </a>

          <ThemeToggle className="hidden sm:flex" />

          {!isHydrated && <div className="h-9 w-[154px]" aria-hidden />}

          {isHydrated && !user && (
            <>
              <Button variant="outline" size="sm" asChild className="rounded-full">
                <Link href="/signin">Log in</Link>
              </Button>
              <Button variant="primary" size="sm" asChild className="rounded-full">
                <Link href="/signup">Sign up</Link>
              </Button>
            </>
          )}

          {isHydrated && user && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/dashboard")}
                className="rounded-full"
              >
                Dashboard
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <button
                    aria-label="User menu"
                    className="flex items-center gap-2 rounded-full border border-cb bg-cb-surface py-1 pl-1 pr-2 text-xs text-cb-primary transition hover:border-cb-strong"
                  >
                    <Avatar initials={initials} src={user.avatar ?? undefined} size="sm" />
                    <ChevronDownIcon />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <div className="mb-1 border-b border-cb px-3 py-2.5">
                    <p className="truncate text-xs font-semibold text-cb-primary">
                      {user.username}
                    </p>
                    <p className="mt-0.5 truncate text-2xs text-cb-muted">
                      {user.email}
                    </p>
                  </div>
                  <DropdownMenuItem onSelect={() => router.push("/dashboard")}>
                    Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => router.push("/dashboard/settings")}>
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="danger" onSelect={handleSignOut}>
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

function CloudBlocksMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:text-brand">
      <path d="M6 20.5 14 5l8 15.5h-4.6L14 13.7l-3.4 6.8H6Z" fill="currentColor" />
      <path d="M5.5 22.5h17" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.69c-2.78.61-3.37-1.18-3.37-1.18-.45-1.15-1.11-1.46-1.11-1.46-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.36 1.08 2.94.83.09-.65.35-1.08.63-1.33-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.58 9.58 0 0 1 12 6.03c.85 0 1.7.11 2.5.33 1.9-1.29 2.74-1.02 2.74-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85v2.74c0 .26.18.57.69.48A10 10 0 0 0 12 2Z" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path d="m3 4.5 3 3 3-3" />
    </svg>
  );
}
