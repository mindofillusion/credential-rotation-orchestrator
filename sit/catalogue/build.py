#!/usr/bin/env python3
"""Deterministic offline catalogue compiler. Never starts or installs a service."""
import collections
import csv
import html
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent

def read(name):
    return json.loads((ROOT / name).read_text())

def normalize(tag, product):
    if product == 'dokuwiki':
        m = re.fullmatch(r'release-(\d{4}-\d{2}-\d{2}[a-z]?)', tag)
        return m[1] if m else None
    if product == 'photoprism':
        return tag if re.fullmatch(r'\d{6}-[a-f0-9]{7,12}', tag) else None
    tag = re.sub(r'^(?:version/|release-|v|jenkins-|xwiki-platform-|fluxbb-|n8n@|SOGo-)', '', tag)
    if product == 'nexus':
        return tag if re.fullmatch(r'\d+\.\d+\.\d+-\d+', tag) else None
    return tag if re.fullmatch(r'\d+(?:\.\d+){1,3}(?:-p\d+)?(?:\+\d+)?', tag) else None

def key(v):
    return tuple(int(n) for n in re.findall(r'\d+', v))

def select(releases):
    ordered = sorted(releases, key=lambda r: key(r['version']), reverse=True)
    selected, majors, branches = [], set(), set()
    for r in ordered:
        major = key(r['version'])[0]
        if major not in majors:
            selected.append(r); majors.add(major)
            branches.add(tuple(key(r['version'])[:2]))
        if len(selected) == 3: break
    for r in ordered:
        if len(selected) == 3: break
        branch = tuple(key(r['version'])[:2])
        if branch not in branches:
            selected.append(r); branches.add(branch)

    # For one visible branch, also retain an older observed patch. This is a
    # regression candidate, not evidence that the older version is popular.
    if len(selected) == 1 and len(ordered) > 1:
        selected.append(ordered[-1])
    return sorted(selected, key=lambda r: key(r['version']), reverse=True)

FAMILIES = {'forums':'Forums et communautés','cms':'CMS et contenu','wiki':'Wikis et documentation',
 'commerce':'Commerce','lms':'Formation','collaboration':'Collaboration et médias',
 'dev':'Développement et projets','support':'Support et inventaire','business':'Gestion et CRM',
 'identity':'Identité et annuaire','security':'Coffres et secrets','ops':'Exploitation et données',
 'mail':'Webmails','lab':'Auxiliaires de laboratoire'}

HEAVY = set('discourse magento openedx canvas gitlab openproject rocketchat zulip erpnext zammad harbor immich superset'.split())
SPECIAL = set('dnn portainer gitea-act'.split())


def build():
    config = read('selection.json')
    observations = {x['id']:x for x in map(json.loads,(ROOT/'release-observations.jsonl').read_text().splitlines())}
    rows = list(csv.DictReader((ROOT/'candidates.tsv').open(), delimiter='\t'))
    assert len({r['id'] for r in rows}) == len(rows)
    applications = []
    for raw in rows:
        row = {k:v.strip() for k,v in raw.items()}
        ident = row['id']
        observation = observations[ident]
        versions = {}
        for r in observation['releases']:
            v = normalize(r['tag'], ident)
            if v:
                versions[v] = {'version':v, 'source':r['url'], 'tag':r['tag'], 'evidence':'publisher-release-feed', 'quarantine':False}
        for r in config['manual_releases']:
            if r['id'] == ident:
                versions[r['version']] = dict(r, evidence=r.get('evidence','publisher-page'), quarantine=r.get('quarantine',False))
        override = config['overrides'].get(ident)
        chosen = [versions[v] for v in override['versions']] if override else select(list(versions.values()))
        lab = config['qualified'].get(ident)
        for version in chosen:
            version.pop('id',None)
            version['state'] = 'historically-qualified' if lab and version['version'] == lab['version'] else 'catalogued'
            version['support'] = 'historical-quarantine' if version['quarantine'] else 'not-audited'
            version['artifact_sha256'] = None
            version['image_digest'] = None
            version['installation_ready'] = False
        row.update(priority=int(row['priority']), mechanisms_to_investigate=row.pop('mechanisms').split(','),
                   mechanism_evidence='hypotheses-to-qualify-per-version-and-edition', versions=chosen,
                   version_observation_status=observation['status'],
                   selection_reason=override['reason'] if override else 'Échantillon du flux: branches distinctes, sinon patch ancien. Diffusion non établie.',
                   installation_status='existing-lab-recipe' if lab else 'recipe-required',
                   deployment_class='special-isolation' if ident in SPECIAL else 'heavy-batch' if ident in HEAVY else 'standard-batch',
                   adoption_status='measured-sample' if ident in ['wordpress','drupal','joomla','moodle'] else 'not-established',
                   source='https://github.com/'+row['repository'] if row['repository'] else 'https://forgejo.org/releases/',
                   observed_at=observation['observed_at'],
                   qualification=lab)
        if ident == 'gitea-act': row['name'] = 'act (auxiliaire CI, pas serveur web)'
        row['role'] = 'lab-companion' if row['family']=='lab' or ident=='gitea-act' else 'web-target'
        applications.append(row)
    targets = [(a,v) for a in applications for v in a['versions']]
    summary = {'products':len(applications),'web_targets':sum(a['role']=='web-target' for a in applications),
               'companions':sum(a['role']=='lab-companion' for a in applications),
               'selected_versions':len(targets),'products_multiversion':sum(len(a['versions'])>=2 for a in applications),
               'products_without_selected_version':sum(not a['versions'] for a in applications),
               'historically_qualified_versions':sum(v['state']=='historically-qualified' for a,v in targets),
               'new_installations_this_inventory':0}
    output = {'schema_version':1,'catalogue_version':config['catalogue_version'],'as_of':config['date'],
              'summary':summary,'applications':applications}
    (ROOT/'catalogue.json').write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n')
    with (ROOT/'catalogue.csv').open('w',newline='') as f:
        w=csv.writer(f); w.writerow(['id','famille','outil','version','priorite','statut','quarantaine','usage_mesure','source','mecanismes_a_qualifier','pile','motif'])
        for a in applications:
            for v in a['versions'] or [{'version':'A_RESoudre','state':'unresolved','quarantine':False,'source':a['source']}]:
                w.writerow([a['id'],a['family'],a['name'],v['version'],a['priority'],v['state'],v['quarantine'],a['adoption_status'],v['source'],','.join(a['mechanisms_to_investigate']),a['stack'],a['selection_reason']])
    scenarios = read('scenarios.json')['scenarios']
    campaign = []
    for a,v in targets:
        if a['role'] != 'web-target': continue
        campaign.append({'id':a['id']+'@'+v['version'],'product':a['id'],'version':v['version'],
            'priority':a['priority'],'isolation':'quarantine-vm-no-egress' if v['quarantine'] else 'dedicated-sit-network',
            'scenarios':[s['id'] for s in scenarios if s['mechanism']=='all-targets' or s['mechanism'] in a['mechanisms_to_investigate']],
            'state':'planned','execution_enabled':False,
            'gates':['publisher-artifact-and-runtime-lock','license-and-architecture-review','isolated-install-recipe',
                     'dedicated-account-and-vault-entry','healthcheck-and-restore-proof','signed-template-review']})
    (ROOT/'campaign.json').write_text(json.dumps({'schema_version':1,'note':'Plan uniquement; aucune exécution déclenchée. Ne pas retirer les gates sans preuves.', 'instances':campaign},ensure_ascii=False,indent=2)+'\n')
    intro=(ROOT/'introduction.md').read_text()
    md=intro+'\n## Chiffres du registre\n\n'+ '\n'.join(f'- `{k}` : {v}' for k,v in summary.items())+'\n\n'
    for family,label in FAMILIES.items():
        md+='## '+label+'\n\n| Outil | Versions sélectionnées (source) | P | Pile | Mécanismes à qualifier |\n|---|---|---|---|---|\n'
        for a in applications:
            if a['family']!=family: continue
            vs=', '.join('['+v['version']+(' †' if v['quarantine'] else '')+']('+v['source']+')' for v in a['versions']) or '**À résoudre**'
            md+=f"| [{a['name']}]({a['source']}) | {vs} | {a['priority']} | {a['stack']} | {', '.join(a['mechanisms_to_investigate'])} |\n"
        md+='\n'
    md+='## Sélections particulières et limites\n\n'
    for a in applications:
        if a['id'] in config['overrides'] or len(a['versions'])<2:
            md+=f"- **{a['name']}** : {a['selection_reason']}"+(' Moins de deux versions sélectionnées; résolution complémentaire nécessaire.' if len(a['versions'])<2 else '')+'\n'
    (ROOT/'README.md').write_text(md)
    print(json.dumps(summary))

if __name__ == '__main__': build()
