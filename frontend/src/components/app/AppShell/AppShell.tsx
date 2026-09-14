"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAccount } from "@/components/app/AccountProvider/AccountProvider";
import styles from "./AppShell.module.css";

const NAV = [
  { id: "trend", label: "Trend", href: "/app" },
  { id: "log", label: "Log", href: "/app/log" },
  { id: "history", label: "History", href: "/app/measurements" },
  { id: "import", label: "Import", href: "/app/import" },
  { id: "settings", label: "Settings", href: "/app/settings" },
  { id: "method", label: "Method", href: "/v2/method" },
  { id: "demo", label: "Demo", href: "/v2/gradual-loss" },
] as const;

/**
 * The authenticated shell: a mobile-first masthead in the same `.htV2` register as the public
 * V2 header, reused rather than re-themed, with only the destinations that actually exist --
 * each item was added in the stage that made its route real, never before (a nav item pointing
 * nowhere is worse than a short nav; docs/design/IMPLEMENTATION_NOTES.md, "ship only real
 * destinations"). This is a new, app-specific component rather than a reuse of `V2Header`,
 * whose `current` prop and nav list are fixed to the four public V2 destinations.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { account, logout } = useAccount();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  async function handleSignOut() {
    setSigningOut(true);
    setSignOutError(null);
    try {
      await logout();
      router.replace("/app/sign-in");
    } catch {
      setSignOutError("Could not sign out just now. Try again.");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <>
      <header className={styles.header}>
        <span className={styles.wordmark}>HealthTrend</span>

        <nav aria-label="HealthTrend" className={styles.nav}>
          <ul className={styles.navList}>
            {NAV.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  aria-current={item.href === pathname ? "page" : undefined}
                  className={
                    item.href === pathname
                      ? `${styles.navLink} ${styles.navLinkActive}`
                      : styles.navLink
                  }
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.trailing}>
          {account ? <span className={styles.email}>{account.user.email}</span> : null}
          <button
            type="button"
            className={styles.signOut}
            onClick={() => void handleSignOut()}
            disabled={signingOut}
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </header>

      {signOutError ? (
        <p role="alert" className={styles.signOutError}>
          {signOutError}
        </p>
      ) : null}

      {children}
    </>
  );
}
