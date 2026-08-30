import { TrendPoint } from './TrajectoryChart';

export interface SparklineProps {
  trend: TrendPoint[];
  width?: number;
  height?: number;
  /** Draws the 68% band behind the line when the points carry lo68/hi68. */
  showBand?: boolean;
  strokeWidth?: number;
}
export declare function Sparkline(props: SparklineProps): JSX.Element;
