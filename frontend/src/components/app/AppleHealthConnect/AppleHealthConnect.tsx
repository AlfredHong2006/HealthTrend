"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { createSyncConnection } from "@/lib/api/accountClient";
import { ApiError, NetworkError } from "@/lib/api/errors";
import {
  APPLE_HEALTH_CONNECTION_LABEL,
  APPLE_HEALTH_HISTORY_SHORTCUT_URL,
  APPLE_HEALTH_SYNC_SHORTCUT_URL,
} from "@/lib/sync/appleHealthShortcut";
import styles from "./AppleHealthConnect.module.css";

type CopyState = "idle" | "copied" | "failed";

const GENERIC_CREATE_ERROR = "Something went wrong creating the connection.";

/**
 * `/app/connect/apple-health`: the setup walk-through for syncing weight from Apple Health.
 *
 * HealthTrend never reads Apple Health itself -- a website cannot. An Apple Shortcut on the
 * reader's own iPhone reads Weight and sends it to `PUT /api/me/sync/apple_health` with a bearer
 * token; this page creates that token (`POST /api/me/sync/connections`) and explains where it
 * goes. The copy says so throughout rather than implying the site has Health access.
 *
 * The token is returned once and held only in this component's state: not in a URL, not in any
 * browser storage, not logged. Leaving or reloading the page drops it, which is why the page
 * says to copy it first; an existing connection's token cannot be shown again, so the remedy for
 * a lost one is a new connection. Listing and revoking connections is Settings' job
 * (`ConnectedSourcesSetting`), not repeated here.
 */
export function AppleHealthConnect() {
  const tokenId = useId();
  const [token, setToken] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<CopyState>("idle");

  async function handleCreate() {
    if (creating) {
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const created = await createSyncConnection(APPLE_HEALTH_CONNECTION_LABEL);
      setToken(created.token);
    } catch (error) {
      setCreateError(
        error instanceof ApiError || error instanceof NetworkError
          ? error.message
          : GENERIC_CREATE_ERROR,
      );
    } finally {
      setCreating(false);
    }
  }

  async function handleCopy() {
    if (token === null) {
      return;
    }
    try {
      await navigator.clipboard.writeText(token);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Connect Apple Health</h1>
      <p className={styles.intro}>
        HealthTrend cannot read Apple Health directly. Instead, Apple Shortcuts on your iPhone
        read your Weight measurements from Apple Health and send them securely to your HealthTrend
        account. They read Weight only, and never write anything back to Apple Health.
      </p>

      <ol className={styles.steps}>
        <li className={styles.step}>
          <h2 className={styles.heading}>Step 1 — Create a connection</h2>
          {token === null ? (
            <>
              <p className={styles.text}>
                Create your HealthTrend connection and copy the token shown below. You&rsquo;ll
                use the same token in both Shortcuts.
              </p>
              <button
                type="button"
                className={styles.primary}
                onClick={() => void handleCreate()}
                disabled={creating}
              >
                {creating ? "Creating…" : "Create connection"}
              </button>
              <p className={styles.aside}>
                Already set up? Creating another connection gives you a new token. You can see
                and revoke existing connections in <Link href="/app/settings">Settings</Link>.
              </p>
              {createError ? (
                <p role="alert" className={styles.error}>
                  {createError}
                </p>
              ) : null}
            </>
          ) : (
            <>
              <p className={styles.text}>
                This token is shown only once. You&rsquo;ll use the same token in both
                Shortcuts. Copy it before leaving or reloading this page.
              </p>
              <div className={styles.tokenField}>
                <label htmlFor={tokenId} className={styles.fieldLabel}>
                  Connection token
                </label>
                <input
                  id={tokenId}
                  type="text"
                  readOnly
                  value={token}
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  onFocus={(event) => event.target.select()}
                  className={styles.token}
                />
              </div>
              <button type="button" className={styles.primary} onClick={() => void handleCopy()}>
                Copy token
              </button>
              {copyState === "copied" ? (
                <p role="status" className={styles.aside}>
                  Token copied.
                </p>
              ) : null}
              {copyState === "failed" ? (
                <p role="alert" className={styles.error}>
                  Could not copy automatically. Select the token above and copy it yourself.
                </p>
              ) : null}
              <p className={styles.aside}>
                Keep this token private. Anyone with it can sync weight readings to your
                HealthTrend account. You can revoke it at any time in{" "}
                <Link href="/app/settings">Settings</Link>.
              </p>
            </>
          )}
        </li>

        <li className={styles.step}>
          <h2 className={styles.heading}>Step 2 — Import existing history</h2>
          <ol className={styles.numbered}>
            <li>Add the 3-year history Shortcut.</li>
            <li>Open the Shortcut in the Shortcuts app.</li>
            <li>
              At the very top, find the Text action containing <code>PASTE_TOKEN_HERE</code>.
            </li>
            <li>
              Replace <code>PASTE_TOKEN_HERE</code> with your HealthTrend connection token.
            </li>
            <li>Run the Shortcut once.</li>
          </ol>
          <a
            href={APPLE_HEALTH_HISTORY_SHORTCUT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.primary}
          >
            Get the history import Shortcut
          </a>
          <p className={styles.aside}>
            The first time it runs, iOS asks whether the Shortcut may read Health data and contact
            HealthTrend — allow both. Afterwards, your readings appear in{" "}
            <Link href="/app/measurements">History</Link>, marked Apple Health.
          </p>
        </li>

        <li className={styles.step}>
          <h2 className={styles.heading}>Step 3 — Set up automatic sync</h2>
          <ol className={styles.numbered}>
            <li>Add the 14-day sync Shortcut.</li>
            <li>
              Open it and replace <code>PASTE_TOKEN_HERE</code> at the top with the same
              HealthTrend connection token.
            </li>
            <li>Run it once to confirm it works.</li>
            <li>
              In Shortcuts → Automation, create a daily Time of Day automation for this Shortcut
              and choose Run Immediately.
            </li>
          </ol>
          <a
            href={APPLE_HEALTH_SYNC_SHORTCUT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.primary}
          >
            Get the automatic sync Shortcut
          </a>
          <p className={styles.aside}>
            Apple may restrict Health data access while your iPhone has been locked for some
            time. If a sync cannot read Health data, the next successful run will catch up, since
            each run covers the last 14 days.
          </p>
        </li>
      </ol>

      <section className={styles.semantics} aria-labelledby={`${tokenId}-semantics`}>
        <h2 id={`${tokenId}-semantics`} className={styles.heading}>
          How syncing works
        </h2>
        <ul className={styles.bullets}>
          <li>Syncing currently only adds readings. It never deletes one automatically.</li>
          <li>
            If you remove or correct a reading in Apple Health, you may need to remove the
            HealthTrend copy yourself, in History.
          </li>
          <li>
            If you delete a reading in HealthTrend but it is still in Apple Health, a later sync
            may add it again.
          </li>
        </ul>
      </section>
    </div>
  );
}
