// app/(auth)/layout.tsx
import { ShaderBackground } from "@/components/landing/ShaderBackground";
import { ThemeToggle }      from "@/components/ui/ThemeToggle";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen bg-cb-page flex items-center justify-center p-5">
      <ShaderBackground />

      {/* Theme toggle — top right */}
      <div className="fixed top-4 right-5 z-50">
        <ThemeToggle />
      </div>

      <div className="relative z-10 w-full max-w-[400px]">
        {children}
      </div>
    </div>
  );
}