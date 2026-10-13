import json,shutil
from pathlib import Path
root=Path(__file__).resolve().parent;source=root/'curriculum';output=root/'dist'
output.mkdir(exist_ok=True)
shutil.copyfile(source/'portal.html',output/'index.html')
for name in ['architecture-guides.md','partner-certification.md','syllabus.md']:
    shutil.copyfile(source/name,output/name)
assert len(json.loads((source/'curriculum.json').read_text()))==16
print('Static preview built; no learner code executed')
