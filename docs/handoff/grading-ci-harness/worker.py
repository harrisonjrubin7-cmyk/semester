import importlib.util, json, os, sys
# Learner output must not reach the result channel: keep the real stdout, point sys.stdout at stderr for learner code.
out = os.fdopen(os.dup(1), "w")
sys.stdout = sys.stderr
spec = importlib.util.spec_from_file_location("learner", "/submission/starter.py")
module = importlib.util.module_from_spec(spec)
try:
    spec.loader.exec_module(module)
except BaseException:
    out.write(json.dumps({"load_error": True})); out.flush(); os._exit(3)
request = json.loads(sys.stdin.read())
fn = getattr(module, request["function"], None)
results = []
for value in request["inputs"]:          # inputs only — expected values never enter the sandbox
    try:
        results.append({"value": fn(value)})
    except ValueError:
        results.append({"exception": "ValueError"})
    except BaseException:
        results.append({"exception": "ExecutionError"})
try:
    out.write(json.dumps(results, allow_nan=False))
except (TypeError, ValueError):
    out.write(json.dumps({"unserializable": True}))
out.flush(); os._exit(0)
