"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "@/components/app/AccountProvider/AccountProvider";
import { DeleteAccountSetting } from "./DeleteAccountSetting";
import { DisplayUnitSetting } from "./DisplayUnitSetting";
import { ExportSetting } from "./ExportSetting";
import { GoalSetting } from "./GoalSetting";
import styles from "./Settings.module.css";

/**
 * `/app/settings`: exactly the account settings the backend already stores -- display unit and
 * goal -- plus the two exports, sign-out and account deletion. Not a general preferences system.
 *
 * Sign-out here is the same `AccountProvider.logout()` the shell's own action uses, not a second
 * implementation.
 */
export function Settings() {
  const router = useRouter();
  const { account, logout } = useAccount();
  const signOutHeadingId = useId();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const unit = account?.preferences.display_unit ?? "kg";

  async function handleSignOut() {
    setSigningOut(true);
    setSignOutError(null);
    try {
      await logout();
      router.replace("/app/sign-in");
    } catch {
      setSignOutError("Could not sign out just now. Try again.");
      setSigningOut(false);
    }
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Settings</h1>

      <DisplayUnitSetting />
      <GoalSetting key={unit} unit={unit} />
      <ExportSetting />

      <section className={styles.section} aria-labelledby={signOutHeadingId}>
        <h2 id={signOutHeadingId} className={styles.heading}>
          Sign out
        </h2>
        {account ? <p className={styles.note}>Signed in as {account.user.email}.</p> : null}
        <button
          type="button"
          className={styles.secondary}
          style={{ alignSelf: "flex-start" }}
          onClick={() => void handleSignOut()}
          disabled={signingOut}
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
        {signOutError ? (
          <p role="alert" className={styles.error}>
            {signOutError}
          </p>
        ) : null}
      </section>

      <DeleteAccountSetting />
    </div>
  );
}
