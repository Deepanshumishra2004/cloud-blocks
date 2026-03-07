// src/components/landing/LandingFooter.tsx
import Link from "next/link";

const LINKS = {
  Product: [
    { href: "#features", label: "Features" },
    { href: "#pricing",  label: "Pricing"  },
    { href: "/changelog",label: "Changelog"},
    { href: "/docs",     label: "Docs"     },
  ],
  Company: [
    { href: "/about",   label: "About"   },
    { href: "/blog",    label: "Blog"    },
    { href: "/careers", label: "Careers" },
    { href: "/contact", label: "Contact" },
  ],
  Legal: [
    { href: "/privacy", label: "Privacy" },
    { href: "/terms",   label: "Terms"   },
    { href: "/cookies", label: "Cookies" },
  ],
};

export function LandingFooter() {
  return (
    <footer className="relative border-t border-cb py-16 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-6 h-6 bg-brand rounded flex items-center justify-center">
                <span className="font-mono font-bold text-xs text-[#111]">CB</span>
              </div>
              <span className="font-mono font-bold text-sm text-cb-primary">
                cloudblocks
              </span>
            </div>
            <p className="text-xs text-cb-muted leading-relaxed max-w-[180px]">
              Cloud development environments for everyone.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(LINKS).map(([col, links]) => (
            <div key={col}>
              <p className="text-xs font-semibold font-mono text-cb-muted uppercase tracking-widest mb-4">
                {col}
              </p>
              <ul className="flex flex-col gap-2.5">
                {links.map(({ href, label }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="text-sm text-cb-secondary hover:text-cb-primary transition-colors"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-cb flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-xs text-cb-muted font-mono">
            © {new Date().getFullYear()} CloudBlocks, Inc. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            {/* GitHub */}
            <a
              href="https://github.com/cloudblocks"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cb-muted hover:text-cb-primary transition-colors"
              aria-label="GitHub"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2A10 10 0 002 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z"/>
              </svg>
            </a>
            {/* Twitter/X */}
            <a
              href="https://twitter.com/cloudblocks"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cb-muted hover:text-cb-primary transition-colors"
              aria-label="X / Twitter"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}