/**
 * Qualifier-tier statement of what confidence is doing to the estimate, with
 * canonical copy per level so the same state reads identically product-wide.
 * Always adjacent to the number it qualifies — uncertainty is not a disclaimer.
 */
export interface ConfidenceNoteProps {
  /**
   * Take this from `HTFormat.confidence(...)` rather than deciding locally.
   * `ok` renders nothing unless you pass children.
   */
  level?: 'ok' | 'wide' | 'stale' | 'insufficient';
  /** Overrides the canonical copy. Must still trace to a model quantity. */
  children?: React.ReactNode;
  /** Lucide glyph override; `null` for none. */
  icon?: string | null;
  showIcon?: boolean;
  style?: React.CSSProperties;
}
export declare function ConfidenceNote(props: ConfidenceNoteProps): JSX.Element | null;
