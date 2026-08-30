"""The dependency direction is enforced, not trusted.

``tests/core/test_architecture_purity.py`` already guards the numerical core. This file
guards the layers added on top of it, by the same method and for the same reason: a
dependency that points the wrong way is cheap to add and expensive to remove once anything
relies on it.

Five rules, each with a concrete cost if broken:

1. **No production module imports ``testing`` or ``evaluation``.** Both are non-production
   packages, both are allowed randomness the application should not casually acquire, and
   shipping either in a deployment artefact is indefensible. It is also why
   :mod:`app.demo` has its own generators instead of borrowing the ones in
   ``testing/synthetic.py``.
2. **Only ``app.api`` imports FastAPI.** Everything below it stays callable from a script or
   a test with no web framework present, which is what keeps the numerical work testable
   without HTTP in the way.
3. **``app.demo`` depends on neither the HTTP schemas nor the services.** A demo scenario is
   a list of core observations, so it can be generated and inspected on its own.
4. **Nothing below ``app.api`` imports ``app.api``.** The direction is ``api -> services ->
   core``, and the moment it becomes a cycle the layers stop meaning anything.
5. **``evaluation`` sees the core and nothing else of the application.** The M6 harness
   measures the estimator, so it imports ``app.core`` and ``testing``. If it could reach
   the services or the API it could start measuring HTTP behaviour, request validation or
   the forecast-origin policy -- none of which is what the study claims to be about -- and
   an evaluation that quietly changes what it measures is worse than none. Test ``EV9``.
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).parents[1]
APP_DIR = BACKEND_DIR / "app"
EVALUATION_DIR = BACKEND_DIR / "evaluation"

APP_FILES = sorted(APP_DIR.rglob("*.py"))
EVALUATION_FILES = sorted(EVALUATION_DIR.rglob("*.py"))

WEB_FRAMEWORK_ROOTS = frozenset({"fastapi", "starlette", "uvicorn"})

NON_PRODUCTION_ROOTS = frozenset({"testing", "evaluation"})

# What the evaluation harness is allowed to import from the project. `app.core` is the
# thing being measured; `testing` supplies the synthetic series with known truth.
EVALUATION_ALLOWED_PROJECT_ROOTS = ("app.core", "testing", "evaluation")


def imported_modules(path: Path) -> list[str]:
    """Return every module name imported by ``path``."""
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    modules: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            modules.extend(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom):
            assert node.level == 0, f"{path} uses a relative import"
            modules.append(node.module or "")
    return modules


def relative(path: Path) -> str:
    return path.relative_to(BACKEND_DIR).as_posix()


def test_there_are_app_files_to_check():
    """Guard against the whole scan passing because it found nothing."""
    assert len(APP_FILES) >= 15
    packages = {path.parent.name for path in APP_FILES}
    assert {"api", "core", "demo", "ingestion", "schemas", "services"} <= packages


@pytest.mark.parametrize("path", APP_FILES, ids=relative)
def test_no_production_module_imports_a_non_production_package(path: Path):
    for module in imported_modules(path):
        root = module.split(".")[0]
        assert root not in NON_PRODUCTION_ROOTS, (
            f"{relative(path)} imports {module}: `{root}` is non-production code and must "
            f"not be reachable from the application. See app/demo/__init__.py."
        )


@pytest.mark.parametrize("path", APP_FILES, ids=relative)
def test_only_the_api_layer_imports_a_web_framework(path: Path):
    is_api_layer = path.parent.name == "api" or path.name == "main.py"
    if is_api_layer:
        return
    for module in imported_modules(path):
        assert module.split(".")[0] not in WEB_FRAMEWORK_ROOTS, (
            f"{relative(path)} imports {module}: only app/api and app/main.py may depend on "
            f"the web framework."
        )


@pytest.mark.parametrize("path", sorted((APP_DIR / "demo").rglob("*.py")), ids=relative)
def test_the_demo_package_depends_only_on_the_core(path: Path):
    for module in imported_modules(path):
        assert not module.startswith(("app.api", "app.schemas", "app.services", "app.ingestion")), (
            f"{relative(path)} imports {module}: a demo scenario is a list of core "
            f"observations and must not know about HTTP or the service layer."
        )


@pytest.mark.parametrize("path", APP_FILES, ids=relative)
def test_nothing_below_the_api_layer_imports_the_api_layer(path: Path):
    if path.parent.name == "api" or path.name == "main.py":
        return
    for module in imported_modules(path):
        assert not module.startswith("app.api"), (
            f"{relative(path)} imports {module}: the dependency direction is "
            f"api -> services -> core."
        )


# --- EV9: the evaluation harness ------------------------------------------------


def test_there_are_evaluation_files_to_check():
    """Guard against the evaluation scan passing because it found nothing."""
    assert len(EVALUATION_FILES) >= 5
    names = {path.name for path in EVALUATION_FILES}
    assert {"common.py", "constants.py", "run.py"} <= names


@pytest.mark.parametrize("path", EVALUATION_FILES, ids=relative)
def test_ev9_the_evaluation_package_never_imports_a_web_framework(path: Path):
    for module in imported_modules(path):
        assert module.split(".")[0] not in WEB_FRAMEWORK_ROOTS, (
            f"{relative(path)} imports {module}: the evaluation harness measures the "
            f"numerical core, and has no business holding an HTTP dependency."
        )


@pytest.mark.parametrize("path", EVALUATION_FILES, ids=relative)
def test_ev9_the_evaluation_package_reaches_only_the_core(path: Path):
    for module in imported_modules(path):
        if not module.startswith(("app.", "tests.")):
            continue
        assert module.startswith(EVALUATION_ALLOWED_PROJECT_ROOTS), (
            f"{relative(path)} imports {module}: the evaluation harness may import "
            f"app.core and testing only. Measuring the services or the API layer would "
            f"change what the study is about without changing what it claims."
        )


@pytest.mark.parametrize("path", sorted((APP_DIR / "schemas").rglob("*.py")), ids=relative)
def test_the_schema_package_never_looks_upward(path: Path):
    """Schemas adapt core and demo value objects, and depend on nothing above themselves.

    That is what lets both ingestion and services import them without a cycle. The
    dependency on :mod:`app.demo` is one-way and deliberate: the demo package owns the
    scenario value objects, and the schema package publishes them.
    """
    for module in imported_modules(path):
        if not module.startswith("app."):
            continue
        assert module.startswith(("app.core", "app.schemas", "app.demo")), (
            f"{relative(path)} imports {module}: the schema package must not depend on "
            f"ingestion, services or the API."
        )
