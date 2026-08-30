export interface MeasurementRow {
  date: string;
  /** Raw scale reading, pre-formatted. */
  reading?: string;
  /** Model estimate for that day. */
  trend?: string;
  /** Signed residual, e.g. "+0.7". Neutral grey — never coloured by sign. */
  residual?: string;
}

export interface MeasurementTableProps {
  rows: MeasurementRow[];
  unit?: string;
  columns?: Array<'date' | 'reading' | 'trend' | 'residual'>;
  dense?: boolean;
}
export declare function MeasurementTable(props: MeasurementTableProps): JSX.Element;
