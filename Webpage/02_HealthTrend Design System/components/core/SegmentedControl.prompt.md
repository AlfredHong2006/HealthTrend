Mutually exclusive switch — chart ranges (pill) and page-level sections (underline).

\`\`\`jsx
<SegmentedControl options={['30d','90d','1y','All']} value="90d" onChange={setRange} />
<SegmentedControl variant="underline" options={['Trend','Measurements','Method']} value="Trend" />
\`\`\`

Two to five options. More than five means a Select.
