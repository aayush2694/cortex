"""Importing this package registers every algorithm in the visualizer registry.

Import order = the order algorithms are listed in the UI.
"""

from app.modules.visualizer.tracers import sorting  # isort: skip
from app.modules.visualizer.tracers import searching  # isort: skip
from app.modules.visualizer.tracers import graphs  # isort: skip

__all__ = ["graphs", "searching", "sorting"]
