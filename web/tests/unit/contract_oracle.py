"""The contract's own pure helpers, answering for the site's tests.

tests/unit/*.test.mjs run this with `python3 -I` and a JSON list of calls on stdin, so the TypeScript
copies of the contract's readers (lib/rules.ts), the in-memory contract's rules() and the demo posts'
fingerprints are compared with contracts/sponsored.py itself, not with a description of it. A stub
stands in for the GenLayer runtime: nothing here touches a network or a model.
"""

import importlib.util
import json
import pathlib
import sys
import types


def _stub():
    stub = types.ModuleType("genlayer")

    class _Any:
        def __getattr__(self, n):
            return _Any()

        def __call__(self, *a, **k):
            return _Any()

        def __getitem__(self, n):
            return _Any()

    class _UserError(Exception):
        pass

    class _VM:
        UserError = _UserError
        Return = object
        Result = object

    class _Public:
        view = staticmethod(lambda f: f)

        class _Write:
            def __call__(self, f):
                return f

            payable = staticmethod(lambda f: f)

        write = _Write()

    class _EVM:
        @staticmethod
        def contract_interface(c):
            return c

    class _GL:
        vm = _VM()
        public = _Public()
        evm = _EVM()

        class Contract:
            pass

        def __getattr__(self, n):
            return _Any()

    class _T:
        def __init__(self, *a, **k):
            pass

        def __class_getitem__(cls, item):
            return cls

    stub.gl = _GL()
    stub.allow_storage = lambda c: c
    stub.Address = str
    stub.DynArray = _T
    stub.TreeMap = _T
    stub.u256 = int
    stub.u32 = int
    stub.u64 = int
    stub.i64 = int
    stub.__all__ = ["gl", "allow_storage", "Address", "DynArray", "TreeMap", "u256", "u32", "u64", "i64"]
    sys.modules["genlayer"] = stub


def _load():
    _stub()
    path = pathlib.Path(__file__).resolve().parents[3] / "contracts" / "sponsored.py"
    spec = importlib.util.spec_from_file_location("sponsored", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


sp = _load()

ALLOWED = {"_text_problem", "_url_problem", "_prefix_problem", "_number_arg", "_address_text", "_under"}


def answer(call):
    fn = call["fn"]
    args = call.get("args", [])
    if fn == "rules":
        return json.loads(sp.Sponsored.rules(None))
    if fn == "const":
        value = getattr(sp, args[0])
        return str(value) if isinstance(value, int) and not isinstance(value, bool) else value
    if fn == "_requirements_of":
        lines, problem = sp._requirements_of(args[0])
        return [lines, problem]
    if fn == "fingerprint":
        # what every validator fingerprints of a fetched page: its body as bytes, the tags removed, the
        # spacing collapsed, at most MAX_PAGE_TEXT characters
        return sp._fingerprint(sp._page_text(sp._visible(sp._decoded(args[0].encode("utf-8")))))
    if fn not in ALLOWED:
        raise ValueError("not an allowed helper: " + fn)
    out = getattr(sp, fn)(*args)
    if fn == "_number_arg":
        return str(out)  # an integer of 40 digits does not survive a JavaScript number
    return list(out) if isinstance(out, tuple) else out


def main():
    calls = json.loads(sys.stdin.read())
    results = []
    for call in calls:
        try:
            results.append({"ok": answer(call)})
        except Exception as e:  # a helper that raises is an answer too
            results.append({"error": type(e).__name__ + ": " + str(e)})
    sys.stdout.write(json.dumps(results))


main()
