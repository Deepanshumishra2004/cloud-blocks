"use client";
// src/components/landing/FeaturesSection.tsx
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

const FEATURES = [
  {
    icon: "⚡",
    title: "Instant Environments",
    desc:  "Sandboxes spin up in under 1 second. No Docker setup, no config files. Just code.",
    accent: "var(--brand)",
  },
  {
    icon: "🔒",
    title: "gVisor Sandboxing",
    desc:  "Every repl runs in an isolated gVisor container. Your code can't affect the host.",
    accent: "var(--success)",
  },
  {
    icon: "🌐",
    title: "Live Subdomain",
    desc:  "Every repl gets a unique HTTPS URL instantly. Share your work before you finish writing it.",
    accent: "#3b82f6",
  },
  {
    icon: "📸",
    title: "S3 Snapshots",
    desc:  "Filesystem snapshots written to S3. Resume any repl from exactly where you left off.",
    accent: "#a78bfa",
  },
  {
    icon: "💤",
    title: "Smart Idle Shutdown",
    desc:  "Repls auto-suspend after inactivity. Wake up instantly. Pay only for what you use.",
    accent: "var(--warning)",
  },
  {
    icon: "🖥️",
    title: "Monaco + Xterm",
    desc:  "VS Code's editor engine with a real terminal. Full syntax highlighting, IntelliSense, and shell access.",
    accent: "#06b6d4",
  },
];

export function FeaturesSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const cards = sectionRef.current?.querySelectorAll("[data-card]");
    if (!cards) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el   = entry.target as HTMLElement;
            const idx  = Number(el.dataset.card ?? 0);
            el.style.transition = `opacity 0.5s ease ${idx * 80}ms, transform 0.5s ease ${idx * 80}ms`;
            el.style.opacity    = "1";
            el.style.transform  = "translateY(0)";
            observer.unobserve(el);
          }
        });
      },
      { threshold: 0.1 }
    );

    cards.forEach((card) => {
      const el = card as HTMLElement;
      el.style.opacity   = "0";
      el.style.transform = "translateY(28px)";
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="features"
      ref={sectionRef}
      className="relative py-28 px-6"
    >
      {/* Section header */}
      <div className="text-center mb-16">
        <p className="font-mono text-xs text-brand font-semibold uppercase tracking-widest mb-3">
          Features
        </p>
        <h2 className="font-sans font-bold text-4xl md:text-5xl text-cb-primary tracking-tight">
          Everything you need to ship.
        </h2>
        <p className="mt-4 text-cb-secondary max-w-lg mx-auto">
          CloudBlocks handles the infrastructure so you can focus on writing code.
        </p>
      </div>

      {/* Grid */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {FEATURES.map((f, i) => (
          <FeatureCard key={f.title} {...f} index={i} />
        ))}
      </div>
    </section>
  );
}

function FeatureCard({
  icon, title, desc, accent, index,
}: (typeof FEATURES)[0] & { index: number }) {
  return (
    <div
      data-card={index}
      className={cn(
        "group relative bg-cb-surface border border-cb rounded-xl p-6",
        "hover:border-cb-strong transition-all duration-200",
        "hover:shadow-cb-md cursor-default"
      )}
    >
      {/* Accent glow on hover */}
      <div
        className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 20% 20%, ${accent}10 0%, transparent 60%)`,
        }}
      />

      {/* Icon */}
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center text-xl mb-4"
        style={{ background: `${accent}15`, border: `1px solid ${accent}25` }}
      >
        {icon}
      </div>

      <h3 className="font-semibold text-sm text-cb-primary mb-2">{title}</h3>
      <p className="text-sm text-cb-secondary leading-relaxed">{desc}</p>
    </div>
  );
}