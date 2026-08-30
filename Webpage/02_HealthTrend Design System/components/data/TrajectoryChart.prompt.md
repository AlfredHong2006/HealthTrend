The product's hero object — give it the full page width and at least 420px of height; never shrink it into a dashboard tile.

    <TrajectoryChart trend={days} raw={readings} projection={forecast} unit="kg"
      xTicks={[{i:0,label:'Jun'},{i:30,label:'Jul'},{i:61,label:'Aug'}]}
      reference={{ y: 78, label: 'goal 78.0' }} />

Layer order is fixed: bands, then raw dots, then dashed projection, then the azure trajectory. Only pass intervals the model actually produced — omit lo95/hi95 rather than inventing them.

Low-confidence states are props, not variants to rebuild:

    <TrajectoryChart trend={days} raw={readings} confidence="wide" />
    <TrajectoryChart trend={days} raw={readings} staleAfterIndex={96} />
    <TrajectoryChart trend={[]} raw={readings} confidence="insufficient" />
    <TrajectoryChart trend={days} raw={readings} outlierIndices={[41, 88]} />

`wide` thins the line to 1.75px at 62% alpha and strengthens the bands — the band becomes the headline, which is the honest reading. `insufficient` plots the readings and draws no trajectory at all. `staleAfterIndex` hatches the region past the last reading and rules the boundary in amber. Outliers draw as hollow ink rings, matching `OutlierFlag` in the ledger.
