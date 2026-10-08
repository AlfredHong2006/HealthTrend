/**
 * The one place the HealthTrend Apple Shortcuts' share links live: the published iCloud share
 * links `/app/connect/apple-health` sends the reader to. There are two Shortcuts, both using the
 * same connection token against the same insert-only sync endpoint; they differ only in how much
 * Apple Health history each run reads.
 */

/** Run once: reads up to three years of Weight history. */
export const APPLE_HEALTH_HISTORY_SHORTCUT_URL =
  "https://www.icloud.com/shortcuts/72fa8474101b4691be9832211ec31a18";

/** Run daily by the reader's own automation: reads the last 14 days of Weight. */
export const APPLE_HEALTH_SYNC_SHORTCUT_URL =
  "https://www.icloud.com/shortcuts/af93d96b4062489897131e345594eb98";

/** The label sent when the setup flow creates its connection (`SyncConnectionIn.label`). */
export const APPLE_HEALTH_CONNECTION_LABEL = "Apple Health";
