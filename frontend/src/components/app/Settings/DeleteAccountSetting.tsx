"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "@/components/app/AccountProvider/AccountProvider";
import { ApiError, NetworkError } from "@/lib/api/errors";
import styles from "./Settings.module.css";

const GENERIC_ERROR = "Something went wrong deleting your account.";

/**
 * Permanent account deletion (`DELETE /api/me`), deliberately two steps: reveal the form, then
 * retype the account's email address. The typed address must match before the button enables --
 * a convenience only; the backend compares `confirm_email` itself and is the authority.
 *
 * On success the in-memory account is cleared (`AccountProvider.deleteAccount`) and the reader is
 * sent to sign-in. The backend has already cleared the session cookie, so nothing here tries to
 * use it again.
 */
export function DeleteAccountSetting() {
  const router = useRouter();
  const { account, deleteAccount } = useAccount();
  const headingId = useId();
  const emailId = useId();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accountEmail = account?.user.email ?? "";
  const matches = accountEmail !== "" && typed.trim().toLowerCase() === accountEmail;

  async function handleDelete(event: FormEvent) {
    event.preventDefault();
    if (pending || !matches) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      await deleteAccount(typed.trim());
      router.replace("/app/sign-in");
    } catch (caught) {
      setError(
        caught instanceof ApiError || caught instanceof NetworkError ? caught.message : GENERIC_ERROR,
      );
      setPending(false);
    }
  }

  function cancel() {
    setOpen(false);
    setTyped("");
    setError(null);
  }

  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.heading}>
        Delete account
      </h2>
      <p className={styles.note}>
        Deleting your account permanently removes the data HealthTrend stores for it: your
        measurements, display preference, goal and sign-in sessions. This cannot be undone. Download
        an export first if you want to keep a copy.
      </p>

      {open ? (
        <form onSubmit={(event) => void handleDelete(event)} noValidate>
          <div className={styles.field}>
            <label htmlFor={emailId} className={styles.fieldLabel}>
              Type your email address to confirm
            </label>
            <input
              id={emailId}
              type="email"
              inputMode="email"
              autoComplete="off"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              className={styles.input}
            />
          </div>
          <div className={styles.actions} style={{ marginTop: "var(--v2-space-5)" }}>
            <button type="button" className={styles.secondary} onClick={cancel} disabled={pending}>
              Cancel
            </button>
            <button type="submit" className={styles.danger} disabled={!matches || pending}>
              {pending ? "Deleting…" : "Permanently delete account"}
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          className={styles.secondary}
          style={{ alignSelf: "flex-start" }}
          onClick={() => setOpen(true)}
        >
          Delete account…
        </button>
      )}

      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
    </section>
  );
}
