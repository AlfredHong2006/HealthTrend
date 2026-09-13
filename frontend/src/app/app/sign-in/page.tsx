"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "@/components/app/AccountProvider/AccountProvider";
import { SignInForm } from "@/components/app/SignInForm/SignInForm";
import styles from "./page.module.css";

/**
 * `/app/sign-in`: the only `/app` route reachable while signed out.
 *
 * Reads the same `AccountProvider` check the protected boundary reads (`AppAuthGate`) rather
 * than issuing its own `GET /api/me`, and redirects only the one direction -- already
 * authenticated -> `/app` -- which is why this cannot loop against `AppAuthGate`'s own
 * unauthenticated -> here redirect.
 */
export default function AppSignInPage() {
  const router = useRouter();
  const { status } = useAccount();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/app");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <main id="main-content" className={styles.page}>
        <p className={styles.checking}>Checking your session…</p>
      </main>
    );
  }

  if (status === "authenticated") {
    return null;
  }

  return (
    <main id="main-content" className={styles.page}>
      <h1 className={styles.title}>Sign in to HealthTrend</h1>
      <p className={styles.intro}>
        Enter your email address and we will send you a six-digit code to sign in.
      </p>
      <SignInForm />
    </main>
  );
}
