"""The dependency direction is enforced, not trusted.

``tests/core/test_architecture_purity.py`` already guards the numerical core. This file
guards the layers added on top of it, by the same method and for the same reason: a
dependency that points the wrong way is cheap to add and expensive to remove once anything
relies on it.

Eight rules, each with a concrete cost if broken:

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
6. **Only ``app.persistence`` imports the database toolkit.** SQLAlchemy and Alembic stay
   behind the repositories, so no service or route can build a query, hold an ORM object or
   bypass the ``user_id`` scoping every repository method applies.
7. **Only the services, the API layer and ``app/main.py`` import ``app.persistence`` or
   ``app.auth``.** The core, the schemas, ingestion and the demo package stay usable -- and
   testable -- with no database, no secret and no mailer anywhere in reach.
8. **``app.persistence`` and ``app.auth`` never look upward.** Storage may read the error
   types and the name of its configuration variable; the sign-in primitives depend on nothing
   of the application at all. Neither reaches the services, the schemas or the API.
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

DATABASE_TOOLKIT_ROOTS = frozenset({"sqlalchemy", "alembic", "psycopg"})

# The packages that may use storage and the sign-in primitives: the orchestration layer and
# the HTTP boundary above it.
ACCOUNT_CONSUMER_PACKAGES = frozenset({"services", "api"})

# What each account package may import from the application.
PERSISTENCE_ALLOWED_APP_IMPORTS = ("app.persistence", "app.errors", "app.config")
AUTH_ALLOWED_APP_IMPORTS = ("app.auth",)

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
    assert {
        "api",
        "auth",
        "core",
        "demo",
        "ingestion",
        "persistence",
        "schemas",
        "services",
    } <= packages


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
        assert not module.startswith(
            (
                "app.api",
                "app.schemas",
                "app.services",
                "app.ingestion",
                "app.persistence",
                "app.auth",
            )
        ), (
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


# --- accounts: storage and sign-in --------------------------------------------------


def app_package(path: Path) -> str:
    """Return the first-level ``app`` package a file belongs to, or its module name."""
    parts = path.relative_to(APP_DIR).parts
    return parts[0] if len(parts) > 1 else path.stem


@pytest.mark.parametrize("path", APP_FILES, ids=relative)
def test_only_the_persistence_package_imports_the_database_toolkit(path: Path):
    if app_package(path) == "persistence":
        return
    for module in imported_modules(path):
        assert module.split(".")[0] not in DATABASE_TOOLKIT_ROOTS, (
            f"{relative(path)} imports {module}: only app/persistence may use the database "
            f"toolkit. Go through a repository on app.persistence.Store instead."
        )


@pytest.mark.parametrize("path", APP_FILES, ids=relative)
def test_only_services_api_and_main_import_storage_or_sign_in(path: Path):
    package = app_package(path)
    if package in ACCOUNT_CONSUMER_PACKAGES or path.name == "main.py":
        return
    for module in imported_modules(path):
        if module.startswith("app.persistence"):
            assert package == "persistence", (
                f"{relative(path)} imports {module}: only app/services, app/api and "
                f"app/main.py may use account storage."
            )
        if module.startswith("app.auth"):
            assert package == "auth", (
                f"{relative(path)} imports {module}: only app/services, app/api and "
                f"app/main.py may use the sign-in primitives."
            )


@pytest.mark.parametrize("path", sorted((APP_DIR / "persistence").rglob("*.py")), ids=relative)
def test_the_persistence_package_never_looks_upward(path: Path):
    for module in imported_modules(path):
        if module.startswith("app."):
            assert module.startswith(PERSISTENCE_ALLOWED_APP_IMPORTS), (
                f"{relative(path)} imports {module}: account storage may depend only on "
                f"itself, app.errors and app.config."
            )


@pytest.mark.parametrize("path", sorted((APP_DIR / "auth").rglob("*.py")), ids=relative)
def test_the_auth_package_depends_on_nothing_else_in_the_application(path: Path):
    for module in imported_modules(path):
        if module.startswith("app."):
            assert module.startswith(AUTH_ALLOWED_APP_IMPORTS), (
                f"{relative(path)} imports {module}: the sign-in primitives are "
                f"self-contained; policy belongs in app/services/auth.py."
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
