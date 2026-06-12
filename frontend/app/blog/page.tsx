import type { Metadata } from "next";
import Link from "next/link";
import {
  MarketingCard,
  MarketingPageShell,
  PageHero,
} from "@/components/marketing/MarketingPageShell";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "CloudBlocks Blog - Product Notes and Engineering Guides",
  description:
    "Read CloudBlocks product updates, engineering notes, and practical guides for building cloud applications faster.",
};

const POSTS = [
  {
    tag: "Product",
    title: "Why CloudBlocks starts with instant sandboxes",
    excerpt:
      "Local setup slows teams down. CloudBlocks gives every project a ready runtime, terminal, preview URL, and snapshot flow from the first minute.",
    date: "May 31, 2026",
  },
  {
    tag: "Engineering",
    title: "Designing reproducible app environments",
    excerpt:
      "A reliable workspace needs predictable runtime commands, isolated dependencies, saved state, and a clear handoff path for teammates.",
    date: "May 24, 2026",
  },
  {
    tag: "Teams",
    title: "How shared previews speed up product review",
    excerpt:
      "A live URL turns work-in-progress into something designers, founders, and engineers can inspect without pulling code locally.",
    date: "May 17, 2026",
  },
];

export default function BlogPage() {
  return (
    <MarketingPageShell>
      <PageHero
        eyebrow="Blog"
        title="Product notes for teams building cloud apps"
        description="Updates, architecture notes, launch workflows, and practical ideas from the CloudBlocks product and engineering team."
      />

      <section className="landing-container">
        <article className="premium-panel grid overflow-hidden border border-cb lg:grid-cols-[1.1fr_0.9fr]">
          <div className="p-8 sm:p-10">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-brand">
              Featured
            </p>
            <h2 className="mt-5 max-w-2xl text-4xl font-bold leading-tight text-cb-primary">
              From blank project to live cloud preview in one workflow
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-7 text-cb-secondary">
              CloudBlocks combines a browser IDE, real terminal, isolated runtime,
              preview URL, snapshots, and deploy path so teams can move from
              idea to running app without the usual setup drag.
            </p>
            <div className="mt-8">
              <Button variant="primary" asChild className="rounded-full">
                <Link href="/docs">Read the workflow</Link>
              </Button>
            </div>
          </div>
          <div className="theme-visual-dark relative min-h-[320px] overflow-hidden border-t border-cb lg:border-l lg:border-t-0">
            <div className="theme-code-card absolute left-10 top-10 w-[78%] border border-white/15 p-4 shadow-2xl">
              <div className="mb-4 flex gap-2">
                <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                <span className="h-3 w-3 rounded-full bg-[#ffbd2e]" />
                <span className="h-3 w-3 rounded-full bg-[#28c840]" />
              </div>
              {["cloudblocks create api", "runtime ready", "preview deployed", "snapshot saved"].map((line) => (
                <p key={line} className="mb-3 font-mono text-sm text-cb-secondary">
                  <span className="text-brand">$</span> {line}
                </p>
              ))}
            </div>
          </div>
        </article>

        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {POSTS.map((post) => (
            <MarketingCard key={post.title} title={post.title} description={post.excerpt}>
              <div className="mt-6 flex items-center justify-between border-t border-cb pt-4">
                <span className="font-mono text-xs font-bold uppercase text-brand">{post.tag}</span>
                <span className="font-mono text-xs text-cb-muted">{post.date}</span>
              </div>
            </MarketingCard>
          ))}
        </div>
      </section>
    </MarketingPageShell>
  );
}
