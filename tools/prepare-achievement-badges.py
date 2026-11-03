"""Package the eighteen reviewed ImageGen badges; never synthesize artwork."""
from pathlib import Path
from PIL import Image
import hashlib,json,re,shutil

ROOT=Path(__file__).resolve().parents[1]
draft=ROOT/'assets/generated/achievements-20261029'
references=json.loads((draft/'references.json').read_text(encoding='utf8'))
catalog=(ROOT/'src/journal.inc').read_text(encoding='utf8').split('lifetimeGoals{{',1)[1].split('}};',1)[0]
goals=re.findall(r'\{"([^"]+)","([^"]+)",(\d+)\}',catalog)
assert len(references)==len(goals)==18
out=ROOT/'assets/ui/achievements';out.mkdir(parents=True,exist_ok=True)
entries=[]
for entry in references:
    source=Path(entry['source']);master=draft/(entry['name']+'.png')
    if not master.exists():shutil.copyfile(source,master)
    target=out/f"badge-{entry['id']}.webp"
    if target.exists():raise RuntimeError(f'Preserve reviewed output before repackaging: {target}')
    image=Image.open(master).convert('RGBA')
    assert image.getextrema()[3][0]==0,'Expected generated transparency'
    image.thumbnail((384,384),Image.Resampling.LANCZOS)
    image.save(target,'WEBP',quality=93,method=6)
    entries.append({**entry,'goalName':goals[entry['id']][0],'path':str(target.relative_to(ROOT/'assets')).replace('\\','/'),
        'master':str(master.relative_to(ROOT)).replace('\\','/'),'source_sha256':hashlib.sha256(master.read_bytes()).hexdigest(),
        'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'bytes':target.stat().st_size,'dimensions':list(image.size)})
report={'provider':'OpenAI built-in ImageGen','date':'2026-10-29',
    'processing':'Separate generated badge per achievement. Proportional Lanczos resize to 384px maximum, WebP quality 93; generated alpha preserved. No painted or procedural artwork.',
    'files':entries}
(out/'provenance.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
print(json.dumps({'badges':len(entries),'totalBytes':sum(e['bytes'] for e in entries)}))
