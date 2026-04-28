import { Suspense } from "react";
import SignInClient from "@/components/auth/SignInClient";

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInClient />
    </Suspense>
  );
}