export type DataRole = 'trend' | 'band' | 'projection' | 'raw' | 'reference';

export interface ChartLegendProps {
  /** One entry per role actually drawn — never list a role the chart does not show. */
  items: Array<{ role: DataRole; label: string }>;
  layout?: 'row' | 'column';
}
export declare function ChartLegend(props: ChartLegendProps): JSX.Element;
