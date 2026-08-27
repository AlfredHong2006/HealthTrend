# AGENTS.md

Operating procedure for coding agents in this repository. Project context is in
[CLAUDE.md](CLAUDE.md); read it first.

## Workflow

**inspect → understand scope → implement bounded change → validate → report → stop**

### 1. Inspect

Read the files you are about to change and the documents they cite — module docstrings,
[docs/architecture.md](docs/architecture.md), [docs/mathematics.md](docs/mathematics.md),
[docs/privacy.md](docs/privacy.md), and the relevant ADR in [docs/decisions/](docs/decisions/).
Nearly everything unusual here is deliberate and recorded. Do not infer intent from file names.

### 2. Understand scope

State to yourself what the requested slice is and what it is not. If the request could reasonably
mean two different changes, and the two would produce materially different work, ask before
building.

### 3. Implement a bounded change

- Make **only** the requested change.
- **No unrelated refactors**, renames, reformatting, dependency additions, or drive-by "improvements"
  to code you happened to read.
- **Preserve the existing architecture** — layer boundaries, purity rules, module seams, naming
  conventions — unless changing it is explicitly the task.
- Match the surrounding code: its comment density, its docstring style, its idiom.
- **Do not silently make consequential product or design decisions.** Copy that classifies a trend,
  a new metric, a chosen threshold, a default a user will see — these are Alfred's calls. Implement
  what was specified; surface what was not.
- **Do not change estimator or model mathematics** — `app/core/**`, `ModelParams` priors,
  initialisation, covariance handling, forecast propagation — unless that is explicitly in scope. A
  golden-fixture failure means the change was wrong until proven otherwise; never regenerate a golden
  fixture to make a test pass.
- **Do not fake product intelligence.** Never render a classification, probability, confidence label,
  plateau claim, change-point marker, goal ETA or per-point rate that the backend does not actually
  compute. If a capability is not implemented, **omit it** — do not render an "unknown / not enough
  evidence" state, which tells the user an analysis ran. That phrasing is legitimate only once the
  capability exists and genuinely cannot conclude. Transparent presentation arithmetic — formatting,
  unit conversion, range slicing, goal distance, rate-versus-target comparison — is allowed;
  manufactured inference is not. See the honesty ledger in
  [docs/design/V2_DESIGN.md](docs/design/V2_DESIGN.md).
- Respect the privacy invariants without exception: no persistence, no measurement in a log or an
  error message, no real data committed, hedged non-medical language.
- If the change touches a Pydantic model or a route, regenerate the contract in both places
  (`uv run python -m tests.api.regenerate_openapi`, then `npm run gen:api`). Never hand-edit
  `frontend/src/lib/api/schema.d.ts`.

### 4. Validate

Run the smallest check that actually exercises the change, then widen when the change warrants it.

- Backend, narrow → broad: the specific test file → `uv run pytest -q` → `uv run mypy app` →
  `uv run ruff check .` and `uv run ruff format --check .`
- Frontend, narrow → broad: the specific test file → `npm run test` → `npm run typecheck` →
  `npm run lint` → `npm run build`

Run the full suite for anything touching the core, a schema, a layer boundary, a privacy guard, or
shared frontend libraries. A typo fix in a comment does not need a production build.

Report what failed. Never describe a check as passing that you did not run.

### 5. Report

Every report states, concretely:

1. **Files changed** — exact paths, one line each, saying what changed in it.
2. **Checks run and their results** — the exact commands, and pass/fail. Include the failure output
   when something failed.
3. **Ambiguity, assumptions and subjective choices** — anything you decided that Alfred might have
   decided differently, and anything you could not resolve from the code or the documents.
4. **What you deliberately did not do**, if the request implied more than you delivered.

### 6. Stop

Stop when the requested slice is complete and validated. Do not continue into adjacent work, do not
start the "obvious next step", and do not expand scope because something nearby looked improvable.
Name the next logical step if there is one, and let Alfred decide.

## Git

**Alfred performs all Git writes. Agents perform none.**

Never run `git add`, `git commit`, `git push`, `git merge`, `git rebase`, `git reset`, `git restore`,
`git checkout`, `git switch`, `git stash`, `git clean`, `git revert`, `git tag`, any history
rewriting, or any remote modification. Do not stage changes, do not offer to commit, do not commit
"so the work is not lost".

Read-only inspection — `git status`, `git log`, `git diff`, `git show`, `git blame`,
`git branch --list` — is allowed.

Leave the work in the working tree and report it.
