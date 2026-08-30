/**
 * Headless scroll-linked reveal: opacity + a short upward translate, once, on
 * enter. The primitive a progressive-reveal sequence is built from — it holds no
 * layout and adds no markup beyond the element you name in `as`.
 *
 * Never wrap a metric the user came to read. Reveals belong to the sections
 * BELOW the analytical surface (brief §4.2): nothing important may be gated on
 * scroll, and there is no cinematic introduction on a repeat visit.
 */
export interface RevealProps {
  children?: React.ReactNode;
  /** Element to render. Use the semantic tag the content needs. */
  as?: keyof JSX.IntrinsicElements;
  /** Position in its group; multiplies the stagger step. Capped at --stagger-cap. */
  index?: number;
  /** `md` = --reveal-offset-y (14px). `lg` = 24px + the longer duration, section scale only. */
  scale?: 'md' | 'lg';
  /** Which stagger token to step by. `stagger-1` for siblings, `stagger-2` for sections. */
  stagger?: 'stagger-1' | 'stagger-2';
  /** Extra ms before this element's own delay. Use sparingly. */
  delay?: number;
  /** Override --reveal-threshold (0.28) for an unusually tall element. */
  threshold?: number;
  /** Default true. false re-hides on exit — almost always wrong; it replays. */
  once?: boolean;
  className?: string;
  style?: React.CSSProperties;
}
export declare function Reveal(props: RevealProps): JSX.Element;
