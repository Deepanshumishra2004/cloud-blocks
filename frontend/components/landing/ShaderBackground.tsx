"use client";
// src/components/landing/ShaderBackground.tsx

export function ShaderBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {/* Base */}
      <div className="absolute inset-0 bg-cb-page" />

      {/* Grid lines */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `
            linear-gradient(var(--cb-border-strong) 1px, transparent 1px),
            linear-gradient(90deg, var(--cb-border-strong) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
        }}
      />

      {/* Gradient orbs */}
      <div
        className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full opacity-[0.12]"
        style={{
          background:
            "radial-gradient(circle, var(--brand) 0%, transparent 70%)",
          animation: "orbDrift1 22s ease-in-out infinite alternate",
        }}
      />
      <div
        className="absolute top-1/3 -right-48 w-[500px] h-[500px] rounded-full opacity-[0.07]"
        style={{
          background:
            "radial-gradient(circle, #3b82f6 0%, transparent 70%)",
          animation: "orbDrift2 28s ease-in-out infinite alternate",
        }}
      />
      <div
        className="absolute -bottom-48 left-1/3 w-[400px] h-[400px] rounded-full opacity-[0.06]"
        style={{
          background:
            "radial-gradient(circle, #a78bfa 0%, transparent 70%)",
          animation: "orbDrift1 34s ease-in-out infinite alternate-reverse",
        }}
      />

      {/* Grain overlay */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.025]">
        <filter id="grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.65"
            numOctaves="3"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>

      <style jsx>{`
        @keyframes orbDrift1 {
          from { transform: translate(0, 0) scale(1); }
          to   { transform: translate(60px, 40px) scale(1.12); }
        }
        @keyframes orbDrift2 {
          from { transform: translate(0, 0) scale(1.05); }
          to   { transform: translate(-50px, 60px) scale(0.95); }
        }
      `}</style>
    </div>
  );
}