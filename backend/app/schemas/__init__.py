"""Pydantic request and response models: the wire contract.

This package is a leaf. It imports :mod:`app.core` to adapt core value objects into
response models, and nothing else -- no FastAPI, no services, no ingestion. That is what
lets both :mod:`app.ingestion` and :mod:`app.services` depend on it without a cycle.

The response models mirror :class:`app.core.types.AnalysisResult` deliberately and
partially. Per-observation filter diagnostics and the log-likelihood are recorded by the
core but not published: the model inspector is a later milestone,
and ``loglik`` is a parameter-fitting tool rather than a product output.
``tests/api/test_contract.py`` pins every inclusion and every exclusion so that the schema
and the core cannot drift apart silently.
"""
