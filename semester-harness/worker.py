import importlib.util,json,sys
spec=importlib.util.spec_from_file_location("learner","/submission/starter.py")
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
request=json.loads(sys.stdin.read());results=[]
for case in request['cases']:
    try: results.append({'value':getattr(module,request['function'])(case['input'])})
    except ValueError: results.append({'exception':'ValueError'})
    except BaseException: results.append({'exception':'ExecutionError'})
print(json.dumps(results,allow_nan=False))
