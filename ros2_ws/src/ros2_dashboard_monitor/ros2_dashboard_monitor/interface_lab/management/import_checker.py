"""Generated ROS interface Python module import 검사."""

from __future__ import annotations

import importlib
import sys


def check_import(package_name: str, kind: str, type_name: str) -> tuple[bool, str | None]:
    module_name = f'{package_name}.{kind}'
    last_error: Exception | None = None
    for attempt in range(2):
        try:
            importlib.invalidate_caches()
            if attempt:
                purge_interface_modules(package_name)
                importlib.invalidate_caches()
            if module_name in sys.modules:
                module = importlib.reload(sys.modules[module_name])
            else:
                module = importlib.import_module(module_name)
            getattr(module, type_name)
            return True, None
        except (ImportError, AttributeError) as exc:
            last_error = exc
    return False, str(last_error)


def purge_interface_modules(package_name: str) -> None:
    for module_name in list(sys.modules):
        if module_name == package_name or module_name.startswith(f'{package_name}.'):
            sys.modules.pop(module_name, None)
