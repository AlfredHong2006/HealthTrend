"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { createSyncConnection } from "@/lib/api/accountClient";
import { ApiError, NetworkError } from "@/lib/api/errors";
import {
  APPLE_HEALTH_CONNECTION_LABEL,
  APPLE_HEALTH_SHORTCUT_URL,
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
        HealthTrend cannot read Apple Health directly. Instead, an Apple Shortcut on your iPhone
        reads your Weight measurements from Apple Health and sends them securely to your
        HealthTrend account. Setting it up takes a few minutes.
      </p>

      <ol className={styles.steps}>
        <li className={styles.step}>
          <h2 className={styles.heading}>Step 1 — Create a connection</h2>
          {token === null ? (
            <>
              <p className={styles.text}>
                A connection gives the Shortcut a private token, so it can add measurements to
                your account and nothing else.
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
                This token is shown only once. You&rsquo;ll add it to the HealthTrend Shortcut in
                the next step. Copy it before leaving or reloading this page.
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
                Treat the token like a password: anyone who has it can add measurements to your
                account. If you lose it, create a new connection and revoke the old one in{" "}
                <Link href="/app/settings">Settings</Link>.
              </p>
            </>
          )}
        </li>

        <li className={styles.step}>
          <h2 className={styles.heading}>Step 2 — Install the Shortcut</h2>
          <p className={styles.text}>On your iPhone, add the HealthTrend Shortcut. The Shortcut:</p>
          <ul className={styles.bullets}>
            <li>reads Weight measurements only</li>
            <li>reads them from Apple Health, on your iPhone</li>
            <li>sends each weight and its timestamp to HealthTrend</li>
            <li>does not write anything back to Apple Health</li>
          </ul>
          {APPLE_HEALTH_SHORTCUT_URL ? (
            <a
              href={APPLE_HEALTH_SHORTCUT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.primary}
            >
              Get HealthTrend Shortcut
            </a>
          ) : (
            <>
              <button type="button" className={styles.primary} disabled>
                Get HealthTrend Shortcut
              </button>
              <p className={styles.aside}>The Shortcut link is not available yet.</p>
            </>
          )}
        </li>

        <li className={styles.step}>
          <h2 className={styles.heading}>Step 3 — Add the token</h2>
          <p className={styles.text}>
            When you add the Shortcut, it asks for your connection token. Paste the token you
            copied in Step 1, then finish adding the Shortcut. The first time it runs, iOS asks
            whether the Shortcut may read Weight from Health and send it to HealthTrend — allow
            both.
          </p>
        </li>

        <li className={styles.step}>
          <h2 className={styles.heading}>Step 4 — Create your automation</h2>
          <p className={styles.text}>
            A shared Shortcut does not include an automation, so it will not run by itself until
            you create one:
          </p>
          <ol className={styles.numbered}>
            <li>Open the Shortcuts app.</li>
            <li>Go to Automation.</li>
            <li>Create a new Time of Day automation.</li>
            <li>
              Choose a time when you are normally using, or have recently unlocked, your iPhone.
            </li>
            <li>Choose the HealthTrend sync Shortcut.</li>
            <li>Select Run Immediately.</li>
            <li>Turn off any confirmation prompts you don&rsquo;t need, if iOS offers that.</li>
          </ol>
          <p className={styles.aside}>
            Apple may restrict Health data access while your iPhone has been locked for some
            time. If a sync cannot read Health data, the next successful run will catch up using
            the recent-history window.
          </p>
        </li>

        <li className={styles.step}>
          <h2 className={styles.heading}>Step 5 — Run it once</h2>
          <p className={styles.text}>
            Run the Shortcut yourself once to check it works, then come back here and look at
            History. Synced readings are marked Apple Health.
          </p>
          <Link href="/app/measurements" className={styles.secondary}>
            View History
          </Link>
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
