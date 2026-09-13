"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "@/components/app/AccountProvider/AccountProvider";
import { requestSignInCode, verifySignInCode } from "@/lib/api/accountClient";
import { ApiError, NetworkError } from "@/lib/api/errors";
import styles from "./SignInForm.module.css";

type Step = "email" | "code";

const GENERIC_REQUEST_ERROR = "Something went wrong requesting a sign-in code.";
const GENERIC_VERIFY_ERROR = "Something went wrong verifying that code.";

/** Trimmed and lower-cased, matching the backend's own `EmailAddress` normalisation
 * (`backend/app/schemas/auth.py`) so what is shown and resubmitted here always agrees with what
 * the account is keyed by. */
function normaliseEmail(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * The passwordless sign-in flow: email in, a six-digit code emailed, code in, a session.
 *
 * Two steps in one component, since the second needs the email the first collected and neither
 * is worth its own route -- both live under `/app/sign-in`. Whether the address may sign in, or
 * exists at all, is never surfaced beyond what `POST /api/auth/code/request` itself reveals,
 * which is nothing (`CodeRequestAcceptedOut` is deliberately empty): the code-entry step is
 * shown unconditionally on a successful request rather than branching on anything this
 * component cannot actually know. "Send a new code" returns to the email step and resubmits
 * the same request rather than inventing a resend countdown the server does not expose.
 */
export function SignInForm() {
  const router = useRouter();
  const { signedIn } = useAccount();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  async function handleRequestCode(event: FormEvent) {
    event.preventDefault();
    const normalised = normaliseEmail(email);
    if (normalised === "") {
      setRequestError("Enter your email address.");
      return;
    }

    setRequesting(true);
    setRequestError(null);
    try {
      await requestSignInCode(normalised);
      setEmail(normalised);
      setCode("");
      setVerifyError(null);
      setStep("code");
    } catch (error) {
      setRequestError(
        error instanceof ApiError || error instanceof NetworkError
          ? error.message
          : GENERIC_REQUEST_ERROR,
      );
    } finally {
      setRequesting(false);
    }
  }

  async function handleVerifyCode(event: FormEvent) {
    event.preventDefault();
    const digits = code.trim();
    if (!/^\d{6}$/.test(digits)) {
      setVerifyError("Enter the six-digit code from the email.");
      return;
    }

    setVerifying(true);
    setVerifyError(null);
    try {
      const account = await verifySignInCode(email, digits);
      signedIn(account);
      router.replace("/app");
    } catch (error) {
      setVerifyError(
        error instanceof ApiError || error instanceof NetworkError
          ? error.message
          : GENERIC_VERIFY_ERROR,
      );
    } finally {
      setVerifying(false);
    }
  }

  function requestAgain() {
    setStep("email");
    setCode("");
    setVerifyError(null);
  }

  if (step === "email") {
    return (
      <form className={styles.form} onSubmit={(e) => void handleRequestCode(e)} noValidate>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Email address</span>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={styles.input}
          />
        </label>
        <button type="submit" className={styles.submit} disabled={requesting}>
          {requesting ? "Sending…" : "Send sign-in code"}
        </button>
        {requestError ? (
          <p role="alert" className={styles.error}>
            {requestError}
          </p>
        ) : null}
      </form>
    );
  }

  return (
    <form className={styles.form} onSubmit={(e) => void handleVerifyCode(e)} noValidate>
      <p className={styles.hint}>
        If {email} may sign in, a six-digit code was just sent to it. Enter it below.
      </p>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Sign-in code</span>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
          className={styles.input}
        />
      </label>
      <button type="submit" className={styles.submit} disabled={verifying}>
        {verifying ? "Verifying…" : "Verify code"}
      </button>
      {verifyError ? (
        <p role="alert" className={styles.error}>
          {verifyError}
        </p>
      ) : null}
      <button type="button" className={styles.secondary} onClick={requestAgain}>
        Use a different email or send a new code
      </button>
    </form>
  );
}
