The reveal primitive for the progressive-scroll layer beneath the analytical surface. One element, one transition, fires once.

```jsx
<section>
  <Reveal as="h2" scale="lg" className="ht-title">What the filter is doing</Reveal>
  {points.map((p, i) => (
    <Reveal key={p.id} index={i} className="ht-body">{p.text}</Reveal>
  ))}
</section>
```

`index` steps by `--stagger-1` (40ms) and flattens after `--stagger-cap` (6), so a 30-row block never waits. `scale="lg"` uses the 24px offset and 620ms duration — section-scale compositions only, not paragraphs.

Do not wrap the hero metric, the rate, or the trajectory chart: the returning user must see their answer without scrolling, and data never animates in. Under `prefers-reduced-motion` it renders revealed with no transition; with no `IntersectionObserver` it reveals immediately. Non-React consumers can use the `.ht-reveal` / `[data-revealed]` classes directly.
