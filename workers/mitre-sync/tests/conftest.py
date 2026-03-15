"""pytest configuration for mitre-sync tests.

Adds the worker directory and shared packages root to sys.path so that
`from sync import ...` and `from shared import ...` resolve correctly.
"""
import os
import sys

_TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
_WORKER_DIR = os.path.dirname(_TESTS_DIR)   # mitre-sync/
_WORKERS_ROOT = os.path.dirname(_WORKER_DIR)  # workers/

for _p in (_WORKER_DIR, _WORKERS_ROOT):
    if _p not in sys.path:
        sys.path.insert(0, _p)
