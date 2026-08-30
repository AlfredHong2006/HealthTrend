The product's hero object — give it the full page width and at least 420px of height; never shrink it into a dashboard tile.

    <TrajectoryChart trend={days} raw={readings} projection={forecast} unit="kg"
      xTicks={[{i:0,label:'Jun'},{i:30,label:'Jul'},{i:61,label:'Aug'}]}
      reference={{ y: 78, label: 'goal 78.0' }} />

Layer order is fixed: bands, then raw dots, then dashed projection, then the azure trajectory. Only pass intervals the model actually produced — omit lo95/hi95 rather than inventing them.
