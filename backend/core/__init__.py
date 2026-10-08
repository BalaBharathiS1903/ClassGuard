import sys

# Python 3.14+ compatibility patch:
# In Python 3.14, copy(super()) copies the super proxy object itself instead of
# delegating to the instance, causing Django's BaseContext.__copy__ to fail with:
# AttributeError: 'super' object has no attribute 'dicts' and no __dict__ for setting new attributes
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
