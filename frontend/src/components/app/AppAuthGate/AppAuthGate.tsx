"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "@/components/app/AccountProvider/AccountProvider";
import { AppShell } from "@/components/app/AppShell/AppShell";
import styles from "./AppAuthGate.module.css";

/**
 * The client-side boundary every authenticated `/app` page sits behind: no Next middleware and
 * no server-side cookie inspection (docs/privacy.md -- the backend is the only thing that ever
 * reads `ht_session`), reading the same `AccountProvider` check `/app/sign-in` reads rather than
 * issuing a second `GET /api/me`.
 *
 * Four states, one per `AccountStatus`: a loading placeholder while the initial check is in
 * flight, a redirect to `/app/sign-in` once it resolves unauthenticated, a recoverable error
 * screen (with retry) if the backend could not be reached at all, and -- only once
 * authenticated -- the real shell and page content. Redirecting only ever happens in this one
 * direction (unauthenticated -> sign-in); `/app/sign-in` redirects only the other way
 * (authenticated -> here), so the two cannot loop.
 */
export function AppAuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { status, errorMessage, refresh } = useAccount();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/app/sign-in");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className={styles.state} aria-busy="true">
        <p>Checking your session…</p>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  if (status === "error") {
    return (
      <div className={styles.state}>
        <h1>HealthTrend is unavailable</h1>
        <p>{errorMessage ?? "Something went wrong checking your session."}</p>
        <button type="button" className={styles.retry} onClick={refresh}>
          Try again
        </button>
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
