"""pytest configuration for etda-sync tests."""
import os
import sys

_TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
_WORKER_DIR = os.path.dirname(_TESTS_DIR)
_WORKERS_ROOT = os.path.dirname(_WORKER_DIR)

for _p in (_WORKER_DIR, _WORKERS_ROOT):
    if _p not in sys.path:
        sys.path.insert(0, _p)
