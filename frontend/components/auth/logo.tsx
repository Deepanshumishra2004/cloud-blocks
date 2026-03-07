// src/components/shared/Logo.tsx
import Link from "next/link";

interface LogoProps {
  size?: "sm" | "md" | "lg";
}

const sizes = {
  sm: { mark: 24, text: "12px" },
  md: { mark: 30, text: "14px" },
  lg: { mark: 36, text: "17px" },
};

export default function Logo({ size = "md" }: LogoProps) {
  const { mark, text } = sizes[size];
  return (
    <Link
      href="/"
      style={{
        display:    "flex",
        alignItems: "center",
        gap:        "9px",
        textDecoration: "none",
      }}
    >
      <div
        style={{
          width:          mark,
          height:         mark,
          background:     "#facc15",
          borderRadius:   "7px",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          fontFamily:     "var(--font-mono)",
          fontWeight:     700,
          fontSize:       mark * 0.38,
          color:          "#111",
          flexShrink:     0,
          letterSpacing:  "-0.02em",
        }}
      >
        CB
      </div>
      <span
        style={{
          fontFamily:    "var(--font-mono)",
          fontSize:      text,
          fontWeight:    700,
          color:         "var(--text-1)",
          letterSpacing: "-0.02em",
        }}
      >
        cloudblocks
      </span>
    </Link>
  );
}