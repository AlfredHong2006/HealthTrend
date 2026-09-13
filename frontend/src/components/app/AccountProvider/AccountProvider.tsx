"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  deleteAccount as deleteAccountRequest,
  getCurrentAccount,
  logout as logoutRequest,
} from "@/lib/api/accountClient";
import { NetworkError, UnauthorizedError } from "@/lib/api/errors";
import type { MeOut } from "@/lib/api/types";

export type AccountStatus = "loading" | "authenticated" | "unauthenticated" | "error";

interface AccountContextValue {
  status: AccountStatus;
  account: MeOut | null;
  /** Set only when `status` is `"error"`: a recoverable network/server failure, distinct from
   * `"unauthenticated"` (no session) and worth showing to the reader (docs/privacy.md -- never
   * a raw exception, but this is already the sanitised message `NetworkError`/`ApiError` carry). */
  errorMessage: string | null;
  /** Re-run the initial `GET /api/me` check, e.g. after a transient network error. */
  refresh: () => void;
  /** Record the account a sign-in already fetched, instead of a second `GET /api/me`. */
  signedIn: (account: MeOut) => void;
  /** End the session and clear in-memory account state. Does not navigate -- the caller does. */
  logout: () => Promise<void>;
  /** Bumped every time {@link notifyMeasurementsChanged} runs. `AppDashboard` depends on this
   * (alongside `account.measurement_count`) so a mutation that leaves the count unchanged --
   * an edit, or a delete immediately followed by a re-add -- still forces a fresh
   * `GET /api/me/analysis` rather than reusing whatever it last fetched. */
  dataVersion: number;
  /**
   * Tell every `/app` consumer that stored measurements just changed: a create, edit or
   * delete on `/app/log` or `/app/measurements`. Re-fetches `GET /api/me` (the only source of
   * `measurement_count`) and bumps {@link dataVersion}, so `AppDashboard`'s next render -- a
   * fresh mount after navigating back to `/app`, or a re-render while already mounted -- fetches
   * a genuinely current analysis rather than a stale one.
   *
   * Deliberately silent on failure: a mutation already succeeded by the time this runs, so a
   * transient failure here should not be reported as though the mutation itself failed. The
   * next visit to `/app` re-derives everything from scratch regardless.
   */
  notifyMeasurementsChanged: () => Promise<void>;
  /**
   * Re-fetch `GET /api/me` after a change that is not a measurement -- the display unit or the
   * goal -- without bumping {@link dataVersion}. Neither can change the analysis (the goal never
   * reaches it; the unit is presentation only), so neither triggers an analysis refetch. Silent
   * on failure except a 401, for the same reason as {@link notifyMeasurementsChanged}.
   */
  reloadAccount: () => Promise<void>;
  /** Permanently delete the account, then clear in-memory account state. Does not navigate --
   * the caller does. The backend clears the session cookie itself. */
  deleteAccount: (confirmEmail: string) => Promise<void>;
}

const AccountContext = createContext<AccountContextValue | null>(null);

/**
 * The one place `/app/**` learns whether its visitor is signed in.
 *
 * Runs the initial `GET /api/me` exactly once per mount (or on `refresh()`), and is the sole
 * owner of that result: both `/app/sign-in` (redirect away if already authenticated) and the
 * protected `/app` boundary (`AppAuthGate`; redirect to sign-in if not) read this same check
 * rather than each issuing their own. Holds only in-memory React state -- nothing here persists
 * across a reload; the `ht_session` cookie is what makes a reload survive signed in, and this
 * provider re-asks the backend every time precisely because it remembers nothing itself
 * (docs/privacy.md).
 */
export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AccountStatus>("loading");
  const [account, setAccount] = useState<MeOut | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0);
  const [dataVersion, setDataVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;

    getCurrentAccount()
      .then((me) => {
        if (cancelled) return;
        setAccount(me);
        setStatus("authenticated");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof UnauthorizedError) {
          setAccount(null);
          setStatus("unauthenticated");
          return;
        }
        setAccount(null);
        setStatus("error");
        setErrorMessage(
          error instanceof NetworkError
            ? error.message
            : "Something went wrong checking your session.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [generation]);

  // `setStatus`/`setErrorMessage` happen here, in the event handler that requests a fresh
  // check, rather than at the top of the effect above -- a synchronous `setState` at the start
  // of an effect body forces an extra render on every run for no benefit here, since the
  // initial "loading" already comes from `useState`'s own initial value.
  const refresh = useCallback(() => {
    setStatus("loading");
    setErrorMessage(null);
    setGeneration((g) => g + 1);
  }, []);

  const signedIn = useCallback((me: MeOut) => {
    setAccount(me);
    setStatus("authenticated");
    setErrorMessage(null);
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    setAccount(null);
    setStatus("unauthenticated");
  }, []);

  const deleteAccount = useCallback(async (confirmEmail: string) => {
    await deleteAccountRequest(confirmEmail);
    setAccount(null);
    setStatus("unauthenticated");
  }, []);

  const reloadAccount = useCallback(async () => {
    try {
      const me = await getCurrentAccount();
      setAccount(me);
    } catch (error: unknown) {
      // A stale field after a successful change is a display nuisance the next fetch corrects;
      // misreporting the reader as signed out is not. Only that one case is worth reflecting
      // immediately -- anything else (offline, a server hiccup) is left for a later `refresh()`
      // or the next natural `/app` visit.
      if (error instanceof UnauthorizedError) {
        setAccount(null);
        setStatus("unauthenticated");
      }
    }
  }, []);

  const notifyMeasurementsChanged = useCallback(async () => {
    try {
      await reloadAccount();
    } finally {
      setDataVersion((v) => v + 1);
    }
  }, [reloadAccount]);

  const value = useMemo<AccountContextValue>(
    () => ({
      status,
      account,
      errorMessage,
      refresh,
      signedIn,
      logout,
      deleteAccount,
      dataVersion,
      notifyMeasurementsChanged,
      reloadAccount,
    }),
    [
      status,
      account,
      errorMessage,
      refresh,
      signedIn,
      logout,
      deleteAccount,
      dataVersion,
      notifyMeasurementsChanged,
      reloadAccount,
    ],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

/** Read the current account-check result. Throws outside an `AccountProvider` -- every `/app`
 * route is wrapped in one by `src/app/app/layout.tsx`, so this is a programming error, not a
 * state to handle gracefully. */
export function useAccount(): AccountContextValue {
  const value = useContext(AccountContext);
  if (!value) {
    throw new Error("useAccount must be used within an AccountProvider.");
  }
  return value;
}
