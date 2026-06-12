import type { Metadata } from "next";
import Link from "next/link";
import {
  MarketingCard,
  MarketingPageShell,
  PageHero,
} from "@/components/marketing/MarketingPageShell";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "CloudBlocks Docs - Build, Run, and Ship Cloud Apps",
  description:
    "Learn how to create CloudBlocks sandboxes, run projects, share previews, manage snapshots, and prepare deployments.",
};

const GUIDES = [
  {
    title: "Create your first sandbox",
    description:
      "Start a cloud workspace, open the browser IDE, and get a live preview URL in seconds.",
  },
  {
    title: "Use the runtime API",
    description:
      "Connect terminal commands, preview URLs, environment variables, snapshots, and deployment metadata.",
  },
  {
    title: "Ship with teams",
    description:
      "Organize projects, invite collaborators, audit activity, and keep shared environments reproducible.",
  },
];

const QUICKSTART = [
  "Create a project from the dashboard.",
  "Choose a runtime such as Bun, Node.js, React, or Next.js.",
  "Open the terminal and run your development command.",
  "Share the live preview URL or save a snapshot before deploying.",
];

export default function DocsPage() {
  return (
    <MarketingPageShell>
      <PageHero
        eyebrow="Documentation"
        title="Build in CloudBlocks with a clean, repeatable workflow"
        description="Everything you need to understand the product: sandboxes, previews, runtime commands, snapshots, deployment flow, and team controls."
      />

      <section className="landing-container grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="premium-panel sticky top-24 hidden h-fit border border-cb p-5 lg:block">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-cb-muted">
            On this page
          </p>
          <nav className="mt-5 space-y-3 text-sm">
            {["Quickstart", "Core concepts", "Product guides", "Launch checklist"].map((item) => (
              <a key={item} href={`#${item.toLowerCase().replaceAll(" ", "-")}`} className="block text-cb-secondary transition hover:text-brand">
                {item}
              </a>
            ))}
          </nav>
        </aside>

        <div className="space-y-6">
          <MarketingCard
            title="Quickstart"
            description="CloudBlocks is designed for the path most builders actually follow: create, run, preview, share, and ship."
          >
            <ol id="quickstart" className="mt-6 grid gap-3">
              {QUICKSTART.map((step, index) => (
                <li key={step} className="flex gap-4 border border-cb bg-cb-surface/70 p-4">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand font-mono text-xs font-bold text-black">
                    {index + 1}
                  </span>
                  <span className="pt-1 text-sm text-cb-secondary">{step}</span>
                </li>
              ))}
            </ol>
          </MarketingCard>

          <div id="core-concepts" className="grid gap-6 md:grid-cols-2">
            <MarketingCard
              title="Sandbox"
              description="An isolated cloud runtime with code, dependencies, terminal access, and a live preview endpoint."
            />
            <MarketingCard
              title="Snapshot"
              description="A saved state of your project that helps you preserve progress, rollback experiments, or hand work to a teammate."
            />
            <MarketingCard
              title="Preview URL"
              description="A shareable HTTPS endpoint connected to the running app, useful for reviews, demos, and testing."
            />
            <MarketingCard
              title="Launch"
              description="The deployment path from a working sandbox to a reliable cloud app without managing local tooling drift."
            />
          </div>

          <section id="product-guides" className="grid gap-6 md:grid-cols-3">
            {GUIDES.map((guide) => (
              <MarketingCard key={guide.title} title={guide.title} description={guide.description} />
            ))}
          </section>

          <MarketingCard
            title="Launch checklist"
            description="Before shipping, confirm your environment variables, preview URL, runtime command, snapshot state, and team access are correct."
          >
            <div id="launch-checklist" className="mt-6 flex flex-wrap gap-3">
              <Button variant="primary" asChild className="rounded-full">
                <Link href="/signup">Start building</Link>
              </Button>
              <Button variant="outline" asChild className="rounded-full">
                <Link href="/blog">Read product notes</Link>
              </Button>
            </div>
          </MarketingCard>
        </div>
      </section>
    </MarketingPageShell>
  );
}
