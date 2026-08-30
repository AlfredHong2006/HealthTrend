# UI kit — Method section

The product's second surface: a long-form, Distill-style explanation of the model. Same tokens and
components as the app; different rhythm — serif prose at 34em, figures escaping to the 1000px page
column, notation in mono, sidenotes in the outer gutter.

| File | Contents |
| --- | --- |
| `index.html` | Entry. Open this. |
| `MethodHeader.jsx` | Sticky hairline header + Distill-style title block (model / estimator / revision / reading time). |
| `MethodBody.jsx` | Four sections, two displayed equations, two figures (one interactive: window length vs lag), margin notes, reference list. |

The interactive figure recomputes a moving average at 7/14/28 days over the same series, which is the
section's argument made operable rather than asserted.

Data comes from `../app/fixtures.js` so both surfaces show the same person.
