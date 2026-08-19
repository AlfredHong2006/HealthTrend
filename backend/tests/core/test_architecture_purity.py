"""The core is pure, and this proves it rather than trusting it. Test ID A4.

Two independent checks:

1. A subprocess imports ``app.core`` in a fresh interpreter and reports whether any
   framework module ended up loaded. Done out of process because the pytest interpreter
   has all sorts of things imported already.
2. An AST scan of every file in ``app/core`` against an *allowlist* of importable
   modules, plus a blocklist of calls that reach for the clock, the filesystem, the
   environment or a random number generator.

The allowlist is deliberately the stronger direction: a new dependency has to be added
here consciously, which is the moment to ask whether the core should really have it.

Why this matters beyond tidiness: a core that consults the clock or the environment is
not deterministically testable, and the golden regression test in
``test_analyse_golden.py`` would quietly stop meaning anything.
"""

from __future__ import annotations

import ast
import os
import subprocess
import sys
from pathlib import Path

import pytest

import app.core

CORE_DIR = Path(app.core.__file__).parent
BACKEND_DIR = Path(__file__).parents[2]

CORE_FILES = sorted(CORE_DIR.glob("*.py"))

FORBIDDEN_RUNTIME_MODULES = (
    "fastapi",
    "pydantic",
    "starlette",
    "pandas",
    "requests",
    "httpx",
    "scipy",
    "sklearn",
    "flask",
    "django",
    "sqlalchemy",
)

ALLOWED_IMPORT_ROOTS = frozenset(
    {
        "__future__",
        "collections",  # collections.abc only, for Sequence
        "dataclasses",
        "datetime",
        "math",
        "numpy",
        "typing",
    }
)

FORBIDDEN_ATTRIBUTE_PATHS = frozenset(
    {
        "datetime.now",
        "datetime.utcnow",
        "datetime.today",
        "date.today",
        "time.time",
        "time.monotonic",
        "time.perf_counter",
        "os.environ",
        "os.getenv",
        "np.random",
        "numpy.random",
        "sys.argv",
    }
)

FORBIDDEN_BUILTIN_CALLS = frozenset({"open", "input", "eval", "exec", "compile", "print"})


def test_a4_the_core_has_files_to_check():
    """Guard against the scan silently passing because it found nothing."""
    assert len(CORE_FILES) >= 8
    names = {path.name for path in CORE_FILES}
    assert {
        "analyse.py",
        "filter.py",
        "forecast.py",
        "kalman.py",
        "model.py",
        "time_axis.py",
        "types.py",
        "units.py",
    } <= names


def test_a4_importing_the_core_loads_no_framework_module():
    probe = (
        "import sys, app.core;"
        f"names={FORBIDDEN_RUNTIME_MODULES!r};"
        "print(','.join(sorted(n for n in names if n in sys.modules)))"
    )
    completed = subprocess.run(
        [sys.executable, "-c", probe],
        cwd=BACKEND_DIR,
        env={**os.environ, "PYTHONPATH": str(BACKEND_DIR)},
        capture_output=True,
        text=True,
        check=True,
    )
    assert completed.stdout.strip() == "", (
        f"app.core pulled in framework modules: {completed.stdout.strip()}"
    )


def _parse(path: Path) -> ast.Module:
    return ast.parse(path.read_text(encoding="utf-8"), filename=str(path))


@pytest.mark.parametrize("path", CORE_FILES, ids=lambda p: p.name)
def test_a4_every_import_is_on_the_allowlist(path: Path):
    for node in ast.walk(_parse(path)):
        if isinstance(node, ast.Import):
            modules = [alias.name for alias in node.names]
        elif isinstance(node, ast.ImportFrom):
            # A relative import has no module name; the core uses absolute imports only.
            assert node.level == 0, f"{path.name} uses a relative import"
            modules = [node.module or ""]
        else:
            continue

        for module in modules:
            root = module.split(".")[0]
            if root == "app":
                assert module.startswith("app.core"), (
                    f"{path.name} imports {module}: the core may not depend on layers above it"
                )
                continue
            assert root in ALLOWED_IMPORT_ROOTS, (
                f"{path.name} imports {module}, which is not on the core allowlist in "
                f"{Path(__file__).name}. Add it there deliberately, or keep it out of the core."
            )


def _dotted_name(node: ast.AST) -> str | None:
    """Reconstruct a dotted path such as ``datetime.now`` from an attribute chain."""
    parts: list[str] = []
    current: ast.AST = node
    while isinstance(current, ast.Attribute):
        parts.append(current.attr)
        current = current.value
    if not isinstance(current, ast.Name):
        return None
    parts.append(current.id)
    return ".".join(reversed(parts))


@pytest.mark.parametrize("path", CORE_FILES, ids=lambda p: p.name)
def test_a4_the_core_never_reaches_for_the_clock_or_the_environment(path: Path):
    for node in ast.walk(_parse(path)):
        if not isinstance(node, ast.Attribute):
            continue
        dotted = _dotted_name(node)
        if dotted is None:
            continue
        assert dotted not in FORBIDDEN_ATTRIBUTE_PATHS, f"{path.name} uses {dotted}"
        assert not dotted.startswith(("random.", "np.random.", "numpy.random.")), (
            f"{path.name} uses {dotted}: the core must be deterministic"
        )


@pytest.mark.parametrize("path", CORE_FILES, ids=lambda p: p.name)
def test_a4_the_core_performs_no_io(path: Path):
    for node in ast.walk(_parse(path)):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
            assert node.func.id not in FORBIDDEN_BUILTIN_CALLS, (
                f"{path.name} calls {node.func.id}(): the core does no I/O and never logs, "
                f"because anything it printed could be health data"
            )


def test_a4_the_core_defines_no_module_level_mutable_state():
    """Determinism also requires that nothing accumulates between calls.

    Dunder names such as ``__all__`` are exempt: they are export declarations read at
    import time, not state the estimator could write into.
    """
    for path in CORE_FILES:
        for node in _parse(path).body:
            if not isinstance(node, ast.Assign):
                continue
            for target in node.targets:
                if not isinstance(target, ast.Name) or target.id.startswith("__"):
                    continue
                assert not isinstance(node.value, ast.Dict | ast.List | ast.Set), (
                    f"{path.name} defines mutable module-level state {target.id}"
                )
