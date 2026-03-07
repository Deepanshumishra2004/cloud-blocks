// app/page.tsx
import type { Metadata } from "next";
import { ShaderBackground } from "@/components/landing/ShaderBackground";
import { LandingNav }       from "@/components/landing/LandingNav";
import { HeroSection }      from "@/components/landing/HeroSection";
import { FeaturesSection }  from "@/components/landing/FeaturesSection";
import { PricingSection }   from "@/components/landing/PricingSection";
import { LandingFooter }    from "@/components/landing/LandingFooter";

export const metadata: Metadata = {
  title: "CloudBlocks - Instant Cloud Development Environments",
};

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-cb-page">
      <ShaderBackground />
      <LandingNav />

      <main className="relative z-10">
        <HeroSection />
        <FeaturesSection />
        <PricingSection />
      </main>

      <LandingFooter />
    </div>
  );
}