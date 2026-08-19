"""Test-support code for the HealthTrend backend.

This package is *not* part of the numerical core and is not subject to the core's purity
rule -- it is allowed to use randomness, because generating synthetic scenarios is exactly
what it is for. Every generator takes an explicit seed, so the data it produces is
reproducible.

Nothing in here may ever contain, embed or read real health data.
"""
