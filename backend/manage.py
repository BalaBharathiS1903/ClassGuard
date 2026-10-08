#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys

# Python 3.14+ compatibility patch for Django BaseContext.__copy__
if sys.version_info >= (3, 14):
    try:
        import django.template.context as _django_context

        def _patched_base_context_copy(self):
            duplicate = object.__new__(self.__class__)
            duplicate.__dict__.update(self.__dict__)
            duplicate.dicts = self.dicts[:]
            return duplicate

        _django_context.BaseContext.__copy__ = _patched_base_context_copy
    except Exception:
        pass

def main():
    """Run administrative tasks."""
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)

if __name__ == '__main__':
    main()
