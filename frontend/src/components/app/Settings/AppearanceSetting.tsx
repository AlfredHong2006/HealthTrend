"use client";

import { useId, useSyncExternalStore } from "react";
import {
  chooseTheme,
  currentTheme,
  serverTheme,
  subscribeToTheme,
  THEMES,
  type Theme,
} from "@/lib/theme/theme";
import styles from "./Settings.module.css";

const LABELS: Record<Theme, string> = { light: "Light", dark: "Dark" };

/**
 * Light or dark, for the whole site: the signed-in app and the public pages alike.
 *
 * Unlike the display unit this is not an account setting -- nothing is sent to the backend. The
 * choice is applied to the page at once and remembered in this browser only
 * (`@/lib/theme/theme`), so it holds on the public pages too, where there is no account.
 */
export function AppearanceSetting() {
  const headingId = useId();
  const current = useSyncExternalStore(subscribeToTheme, currentTheme, serverTheme);

  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.heading}>
        Appearance
      </h2>
      <div role="radiogroup" aria-label="Appearance" className={styles.unitGroup}>
        {THEMES.map((option) => (
          <label
            key={option}
            className={
              option === current ? `${styles.unitOption} ${styles.unitOptionOn}` : styles.unitOption
            }
          >
            <input
              type="radio"
              name="appearance"
              value={option}
              checked={current === option}
              onChange={() => chooseTheme(option)}
              className={styles.visuallyHiddenInput}
            />
            {LABELS[option]}
          </label>
        ))}
      </div>
      <p className={styles.note}>
        Applies to the whole site, and is remembered in this browser only. It is not part of your
        account, so another device or browser keeps its own choice.
      </p>
    </section>
  );
}
