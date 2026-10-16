import json,sys,re
inp=json.load(open(sys.argv[1]));out=json.load(open(sys.argv[2]))
err=[]
if len(inp)!=len(out):err.append(f'count {len(out)} != {len(inp)}')
for i,(a,b) in enumerate(zip(inp,out)):
    if b.get('w')!=a['w']:err.append(f'{i}: w mismatch {b.get("w")} vs {a["w"]}');continue
    for k in ['ipa','pos','vi','ex','exvi']:
        if not str(b.get(k,'')).strip():err.append(f'{a["w"]}: empty {k}')
    if not isinstance(b.get('col'),list) or len(b['col'])<2:err.append(f'{a["w"]}: col needs 2-3 items')
    for k in ['fam','em']:
        if k not in b:err.append(f'{a["w"]}: missing {k}')
    if not str(b.get('ipa','')).startswith('/'):err.append(f'{a["w"]}: ipa must be in slashes')
    stem=a['w'].lower()[:max(3,min(len(a['w'])-2,5))]
    if stem not in b.get('ex','').lower():err.append(f'{a["w"]}: example may not use the word')
    for k in ['vi','exvi','fam']:
        s=str(b.get(k,''))
        if '—' in s or re.search('[←-⇿]',s):err.append(f'{a["w"]}: dash/arrow in {k}')
print('OK' if not err else '\n'.join(err[:60]+([f'... {len(err)} problems'] if len(err)>60 else [])))
