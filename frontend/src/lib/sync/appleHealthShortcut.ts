/**
 * The one place the HealthTrend Apple Shortcut's share link lives: the published iCloud share
 * link for the HealthTrend sync Shortcut, which `/app/connect/apple-health` links to as "Get
 * HealthTrend Shortcut". Typed nullable so the page keeps its unavailable state if the link is
 * ever withdrawn (set to `null`) rather than linking somewhere stale.
 */
export const APPLE_HEALTH_SHORTCUT_URL: string | null =
  "https://www.icloud.com/shortcuts/4465aeec7f8143288db1cf6e5e249ecd";

/** The label sent when the setup flow creates its connection (`SyncConnectionIn.label`). */
export const APPLE_HEALTH_CONNECTION_LABEL = "Apple Health";
