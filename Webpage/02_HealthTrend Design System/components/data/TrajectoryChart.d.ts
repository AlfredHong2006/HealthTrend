export interface TrendPoint {
  y: number;
  lo68?: number; hi68?: number;
  lo95?: number; hi95?: number;
  /** Date string shown in the hover readout. */
  label?: string;
  /** The raw measurement on that day, if any. */
  rawY?: number;
}
export interface RawPoint { i: number; y: number; /** Down-weighted by the filter — drawn as a hollow ring, never hidden. */ outlier?: boolean }
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
  /**
   * From HTFormat.confidence(). `wide` gives the band presence and takes it from
   * the line; `insufficient` draws the raw readings ONLY — no trend, no bands,
   * no projection, no crosshair, because the model produced no trajectory.
   */
  confidence?: 'ok' | 'wide' | 'stale' | 'insufficient';
  /**
   * Index of the last real reading. Everything after it is hatched and the
   * boundary is ruled in amber: the estimate is ageing, not wrong.
   */
  staleAfterIndex?: number;
  /** Indices (into `raw`) the filter down-weighted. Alternative to RawPoint.outlier. */
  outlierIndices?: number[];
  /** Axis + flag decimals. 1 for kg and lb; match HTFormat's unit table. */
  decimals?: number;
  /** Crosshair readout decimals — 2 by default, the one place fuller precision earns its place. */
  readoutDecimals?: number;
}
export declare function TrajectoryChart(props: TrajectoryChartProps): JSX.Element;
