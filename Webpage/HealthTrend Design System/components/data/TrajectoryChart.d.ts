export interface TrendPoint {
  y: number;
  lo68?: number; hi68?: number;
  lo95?: number; hi95?: number;
  /** Date string shown in the hover readout. */
  label?: string;
  /** The raw measurement on that day, if any. */
  rawY?: number;
}
export interface RawPoint { i: number; y: number }
export interface ProjectionPoint { y: number; lo?: number; hi?: number }

/**
 * The hero object: estimated trajectory, its uncertainty bands, the raw measurements behind it, and the forward projection.
 */
export interface TrajectoryChartProps {
  /** Raw scale readings, index-positioned against the trend array. */
  raw?: RawPoint[];
  /** Posterior mean per day, with intervals. Index order = time order. */
  trend: TrendPoint[];
  /** Forward projection; continues from the last trend point. */
  projection?: ProjectionPoint[];
  unit?: string;
  /** 420 hero, 168 inline. */
  height?: number;
  showRaw?: boolean;
  showBands?: boolean;
  showProjection?: boolean;
  /** Dashed neutral reference the model did NOT produce (a user goal). */
  reference?: { y: number; label: string };
  /** Sparse mono x-axis ticks. */
  xTicks?: Array<{ i: number; label: string }>;
  onHoverIndex?: (index: number | null) => void;
}
export declare function TrajectoryChart(props: TrajectoryChartProps): JSX.Element;
