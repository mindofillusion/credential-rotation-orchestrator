#!/usr/bin/env python3
"""Read official GitHub release feeds. Inventory only: no downloads/installations.
Input: candidates.tsv on stdin. Output: JSONL, including failures; standard library.
Feed order is not an assertion of support, adoption or latest stable release.
"""
import concurrent.futures
import csv
import datetime
import io
import json
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

NS = {'a': 'http://www.w3.org/2005/Atom'}

def observe(row):
    repo = row['repository'].strip()
    result = {'id': row['id'], 'observed_at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'releases': []}
    if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', repo):
        return dict(result, status='manual-source-required')
    url = f'https://github.com/{repo}/releases.atom'
    result['source'] = url
    try:
        request = urllib.request.Request(url, headers={'User-Agent': 'CRO-SIT-catalogue/1.0'})
        with urllib.request.urlopen(request, timeout=25) as response:
            result['resolved_source'] = response.url
            data = response.read(2 * 1024 * 1024 + 1)
        if len(data) > 2 * 1024 * 1024:
            raise ValueError('feed too large')
        root = ET.fromstring(data)
        for entry in root.findall('a:entry', NS):
            link = entry.find('a:link', NS)
            href = link.attrib.get('href', '') if link is not None else ''
            if '/releases/tag/' not in href:
                continue
            tag = urllib.parse.unquote(href.split('/releases/tag/', 1)[1])
            # A candidate filter, not a substitute for publisher stability declarations.
            if re.search(r'(?i)alpha|beta|preview|nightly|snapshot|dev|(?:^|[.\-_])rc\d*|candidate|pre-release', tag):
                continue
            if not re.search(r'\d+[.\-_]\d+', tag):
                continue
            result['releases'].append({'tag': tag, 'url': href, 'updated': entry.findtext('a:updated', default='', namespaces=NS)})
        result['status'] = 'observed' if result['releases'] else 'no-stable-candidate-in-feed'
    except Exception as error:
        result['status'] = 'unresolved'
        result['error'] = f'{type(error).__name__}: {error}'
    return result

def main():
    rows = list(csv.DictReader(sys.stdin, delimiter='\t'))
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for result in pool.map(observe, rows):
            print(json.dumps(result, ensure_ascii=False), flush=True)

if __name__ == '__main__':
    main()
