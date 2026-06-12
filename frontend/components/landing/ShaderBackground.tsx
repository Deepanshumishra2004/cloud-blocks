"use client";
// src/components/landing/ShaderBackground.tsx

export function ShaderBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <div className="absolute inset-0 bg-cb-page" />
      <div className="absolute inset-0 landing-dot-grid opacity-[0.18]" />
      <div className="shader-glow absolute inset-0" />
      <div className="absolute inset-x-0 top-0 h-px bg-cb-border" />
    </div>
  );
}
