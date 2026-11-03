"""Include the repository-local Tripo skill tests in the normal asset-tool suite."""
import importlib.util
from pathlib import Path
import sys
import unittest


def load_tests(loader, standard_tests, pattern):
    scripts = Path(__file__).resolve().parents[1] / '.agents' / 'skills' / 'tripo' / 'scripts'
    sys.path.insert(0, str(scripts))
    suite = unittest.TestSuite()
    for path in sorted(scripts.glob('test_*.py')):
        spec = importlib.util.spec_from_file_location('_tripo_skill_' + path.stem, path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        suite.addTests(loader.loadTestsFromModule(module))
    return suite
