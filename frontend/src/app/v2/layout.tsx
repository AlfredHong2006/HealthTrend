import "./v2-tokens.css";

/**
 * The V2 prototype's own shell.
 *
 * Its whole job is to open a token scope: `v2-tokens.css` defines every `--v2-*` custom
 * property on `.htV2`, and everything below inherits them. V1's global tokens, its 760px
 * shell and its routes are untouched -- the prototype is isolated by construction rather
 * than by convention (docs/design/V2_DESIGN.md, locked decisions).
 */
export default function V2Layout({ children }: LayoutProps<"/v2">) {
  return <div className="htV2">{children}</div>;
}
