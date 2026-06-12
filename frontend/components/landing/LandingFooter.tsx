import Link from "next/link";

const LINKS = {
  Product: [
    { href: "#features", label: "Features" },
    { href: "#pricing", label: "Pricing" },
    { href: "/docs", label: "Docs" },
  ],
  Company: [
    { href: "/about", label: "About" },
    { href: "/blog", label: "Blog" },
    { href: "/contact", label: "Contact" },
  ],
  Legal: [
    { href: "/privacy", label: "Privacy" },
    { href: "/terms", label: "Terms" },
  ],
};

export function LandingFooter() {
  return (
    <footer className="relative border-t border-cb px-4 py-14">
      <div className="landing-container grid gap-10 md:grid-cols-[1.4fr_2fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
              <path d="M6 20.5 14 5l8 15.5h-4.6L14 13.7l-3.4 6.8H6Z" fill="currentColor" />
              <path d="M5.5 22.5h17" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
            <span className="text-lg font-bold text-cb-primary">CloudBlocks</span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-6 text-cb-secondary">
            Cloud development environments with instant sandboxes, live URLs,
            snapshots, terminals, and team-ready deployment flows.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {Object.entries(LINKS).map(([group, links]) => (
            <div key={group}>
              <p className="font-mono text-xs font-bold uppercase text-cb-muted">{group}</p>
              <ul className="mt-4 space-y-3">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-cb-secondary transition hover:text-white">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="landing-container mt-10 border-t border-cb pt-6">
        <p className="font-mono text-xs text-cb-muted">
          Copyright {new Date().getFullYear()} CloudBlocks, Inc. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
