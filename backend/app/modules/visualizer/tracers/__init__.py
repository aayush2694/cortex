"""Importing this package registers every algorithm in the visualizer registry.

Import order = the order algorithms are listed in the UI.
"""

from app.modules.visualizer.tracers import sorting  # isort: skip
from app.modules.visualizer.tracers import searching  # isort: skip
from app.modules.visualizer.tracers import graphs  # isort: skip
from app.modules.visualizer.tracers import patterns_arrays  # isort: skip
from app.modules.visualizer.tracers import patterns_lists  # isort: skip
from app.modules.visualizer.tracers import patterns_trees  # isort: skip
from app.modules.visualizer.tracers import patterns_recursion  # isort: skip

__all__ = [
    "graphs",
    "patterns_arrays",
    "patterns_lists",
    "patterns_recursion",
    "patterns_trees",
    "searching",
    "sorting",
]
