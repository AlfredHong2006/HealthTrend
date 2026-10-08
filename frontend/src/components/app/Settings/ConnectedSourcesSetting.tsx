"use client";

import { useCallback, useEffect, useId, useState } from "react";
import Link from "next/link";
import { getSyncConnections, revokeSyncConnection } from "@/lib/api/accountClient";
import { ApiError, NetworkError } from "@/lib/api/errors";
import type { SyncConnectionOut } from "@/lib/api/types";
import { formatFullDate } from "@/lib/chart/format";
import { formatTimeOfDay } from "@/lib/v2/format";
import styles from "./Settings.module.css";

type ListState =
  | { status: "loading" }
  | { status: "ready"; connections: SyncConnectionOut[] }
  | { status: "error"; message: string };

const CONNECT_HREF = "/app/connect/apple-health";
const GENERIC_LOAD_ERROR = "Something went wrong loading your connected sources.";
const GENERIC_REVOKE_ERROR = "Something went wrong revoking that connection.";

function lastUsed(connection: SyncConnectionOut): string {
  if (connection.last_used_at === null) {
    return "Never";
  }
  const date = new Date(connection.last_used_at);
  return `${formatFullDate(date)}, ${formatTimeOfDay(date)}`;
}

/**
 * Connected sources: the account's Apple Health sync connections (`GET
 * /api/me/sync/connections`), with revoke. Creating one is not done here -- it yields a token
 * that is shown once, which belongs beside the instructions for using it, on
 * `/app/connect/apple-health`.
 *
 * The list is metadata only. The backend never returns a token or a token hash from it, so a
 * connection that already exists can be named and revoked here but its token cannot be shown
 * again.
 *
 * An account may hold more than one connection (one per device, say), so this renders however
 * many the backend lists rather than assuming one. Revoke confirms inline, the same way a
 * History row confirms a delete; it ends the token and touches no measurement.
 */
export function ConnectedSourcesSetting() {
  const headingId = useId();
  const [state, setState] = useState<ListState>({ status: "loading" });
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [revoked, setRevoked] = useState(false);

  const load = useCallback(() => {
    getSyncConnections()
      .then((list) => setState({ status: "ready", connections: list.connections }))
      .catch((error: unknown) => {
        setState({
          status: "error",
          message:
            error instanceof ApiError || error instanceof NetworkError
              ? error.message
              : GENERIC_LOAD_ERROR,
        });
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function startRevoke(id: string) {
    setConfirmingId(id);
    setRevokeError(null);
    setRevoked(false);
  }

  function cancelRevoke() {
    if (pending) {
      return;
    }
    setConfirmingId(null);
    setRevokeError(null);
  }

  async function confirmRevoke(id: string) {
    if (pending) {
      return;
    }
    setPending(true);
    setRevokeError(null);
    try {
      await revokeSyncConnection(id);
    } catch (error) {
      // A 404 means the connection is already gone -- a repeated click, or revoked elsewhere --
      // which is the outcome the reader wanted. Anything else is a real failure.
      if (!(error instanceof ApiError && error.status === 404)) {
        setRevokeError(
          error instanceof ApiError || error instanceof NetworkError
            ? error.message
            : GENERIC_REVOKE_ERROR,
        );
        setPending(false);
        return;
      }
    }
    setState((current) =>
      current.status === "ready"
        ? {
            status: "ready",
            connections: current.connections.filter((connection) => connection.id !== id),
          }
        : current,
    );
    setConfirmingId(null);
    setPending(false);
    setRevoked(true);
  }

  const connections = state.status === "ready" ? state.connections : [];

  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.heading}>
        Connected Sources
      </h2>

      {state.status === "loading" ? (
        <p className={styles.status} aria-busy="true">
          Loading connected sources…
        </p>
      ) : null}

      {state.status === "error" ? (
        <p role="alert" className={styles.error}>
          {state.message}
        </p>
      ) : null}

      {state.status === "ready" && connections.length === 0 ? (
        <div className={styles.source}>
          <p className={styles.sourceName}>Apple Health</p>
          <p className={styles.status}>Not connected</p>
          <p className={styles.note}>
            Automatically import weight measurements using an iPhone Shortcut.
          </p>
          <Link href={CONNECT_HREF} className={styles.primary} style={{ alignSelf: "flex-start" }}>
            Connect Apple Health
          </Link>
        </div>
      ) : null}

      {connections.length > 0 ? (
        <>
          <ul className={styles.sourceList}>
            {connections.map((connection) => (
              <li key={connection.id} className={styles.source}>
                <p className={styles.sourceName}>{connection.label}</p>
                <p className={styles.status}>Connected</p>
                <p className={styles.status}>Last used: {lastUsed(connection)}</p>

                {confirmingId === connection.id ? (
                  <>
                    <p className={styles.note}>
                      Revoke this connection? The Shortcut using its token will stop syncing.
                      Measurements already imported stay in your history.
                    </p>
                    {revokeError ? (
                      <p role="alert" className={styles.error}>
                        {revokeError}
                      </p>
                    ) : null}
                    <div className={styles.actions}>
                      <button
                        type="button"
                        className={styles.secondary}
                        onClick={cancelRevoke}
                        disabled={pending}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className={styles.danger}
                        onClick={() => void confirmRevoke(connection.id)}
                        disabled={pending}
                      >
                        {pending ? "Revoking…" : "Revoke connection"}
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    className={styles.secondary}
                    style={{ alignSelf: "flex-start" }}
                    onClick={() => startRevoke(connection.id)}
                    aria-label={
                      connections.length > 1
                        ? `Revoke ${connection.label}, last used: ${lastUsed(connection)}`
                        : undefined
                    }
                  >
                    Revoke
                  </button>
                )}
              </li>
            ))}
          </ul>
          <Link href={CONNECT_HREF} className={styles.secondary} style={{ alignSelf: "flex-start" }}>
            Setup instructions
          </Link>
        </>
      ) : null}

      {revoked ? (
        <p role="status" className={styles.note}>
          Connection revoked. Its token no longer works, so a Shortcut still using it will stop
          syncing. Measurements already imported were not deleted.
        </p>
      ) : null}
    </section>
  );
}
