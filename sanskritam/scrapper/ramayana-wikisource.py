#!/usr/bin/env python3
"""Import Valmiki Ramayana from sa.wikisource.org into the static JSON data.

    python3 scrapper/ramayana-wikisource.py [cache_dir]

Fetches raw wikitext for every sarga of the seven kandas (cached in cache_dir so
re-runs don't hit the network), parses the shlokas out of each sarga's <poem>
block, resolves each sarga's Commons recitation file to its upload.wikimedia.org
URLs (the audio itself is NOT downloaded — the reader embeds it by URL), and
writes the result into web/public/data in the same shape as the Mahabharata
(section = kanda, chapter = sarga), so it gets the same grouped index and
continuous chapter reader.
"""
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'web', 'public', 'data')
CACHE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'scrapper', 'output', 'ramayana-cache')
API = 'https://sa.wikisource.org/w/api.php'
UA = 'VandeGovindaImporter/1.0'

CATEGORY_ID = 59
TEXT_ID = 180
CHAPTER_ID_BASE = 9000
VERSE_ID_BASE = 5_000_000_000   # + sarga_seq * 1000 + n; far from existing id ranges

KANDAS = [
    ('बालकाण्डम्', 'Bala Kanda'),
    ('अयोध्याकाण्डम्', 'Ayodhya Kanda'),
    ('अरण्यकाण्डम्', 'Aranya Kanda'),
    ('किष्किन्धाकाण्डम्', 'Kishkindha Kanda'),
    ('सुन्दरकाण्डम्', 'Sundara Kanda'),
    ('युद्धकाण्डम्', 'Yuddha Kanda'),
    ('उत्तरकाण्डम्', 'Uttara Kanda'),
]

DEVA = '०१२३४५६७८९'
def deva_to_int(s): return int(''.join(str(DEVA.index(c)) if c in DEVA else c for c in s))


def api(params):
    params = {**params, 'format': 'json', 'formatversion': '2'}
    body = urllib.parse.urlencode(params).encode()
    for attempt in range(5):
        try:
            req = urllib.request.Request(API, data=body, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except Exception as e:
            print('  retry', attempt + 1, e)
            time.sleep(20 * (attempt + 1))
    raise RuntimeError('API failed: ' + params.get('titles', '')[:200])


def fetch_pages(titles):
    """title → wikitext, 50 titles per request, cached on disk."""
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, 'pages.json')
    cache = json.load(open(path, encoding='utf8')) if os.path.exists(path) else {}
    todo = [t for t in titles if t not in cache]
    for i in range(0, len(todo), 50):
        batch = todo[i:i + 50]
        res = api({'action': 'query', 'prop': 'revisions', 'rvprop': 'content',
                   'rvslots': 'main', 'redirects': '1', 'titles': '|'.join(batch)})
        q = res['query']
        back = {}
        for n in q.get('normalized', []) + q.get('redirects', []):
            back[n['to']] = back.get(n['from'], n['from'])
        for p in q['pages']:
            orig = p['title']
            while orig in back: orig = back[orig]
            cache[orig] = None if p.get('missing') else p['revisions'][0]['slots']['main']['content']
        print(f'  fetched {min(i + 50, len(todo))}/{len(todo)} pages')
        json.dump(cache, open(path, 'w', encoding='utf8'), ensure_ascii=False)
        time.sleep(0.5)
    return cache


def fetch_audio(files):
    """Commons file name → {ogg, mp3} direct upload URLs, cached on disk."""
    path = os.path.join(CACHE, 'audio.json')
    cache = json.load(open(path, encoding='utf8')) if os.path.exists(path) else {}
    todo = [f for f in files if f not in cache]
    for i in range(0, len(todo), 20):
        batch = todo[i:i + 20]
        res = api({'action': 'query', 'prop': 'imageinfo|videoinfo', 'iiprop': 'url',
                   'viprop': 'derivatives', 'titles': '|'.join('File:' + f for f in batch)})
        q = res['query']
        back = {n['to']: n['from'] for n in q.get('normalized', [])}
        for p in q['pages']:
            name = back.get(p['title'], p['title']).split(':', 1)[1]
            info = (p.get('imageinfo') or [{}])[0]
            derivs = (p.get('videoinfo') or [{}])[0].get('derivatives', [])
            strip = lambda u: u.split('?', 1)[0] if u else None
            mp3 = next((d['src'] for d in derivs if d.get('transcodekey') == 'mp3'), None)
            cache[name] = {'ogg': strip(info.get('url')), 'mp3': strip(mp3)}
        print(f'  resolved {min(i + 20, len(todo))}/{len(todo)} audio files')
        json.dump(cache, open(path, 'w', encoding='utf8'), ensure_ascii=False)
        time.sleep(3)
    return cache


SARGA_LINK_RE = re.compile(r'\[\[([^\]|]*सर्गः\s*([०-९0-9]+))\s*(?:\|[^\]]*)?\]\]')
AUDIO_RE = re.compile(r'\[\[(?:File|file|सञ्चिका|चित्रम्):([^|\]]+\.(?:ogg|oga|mp3|opus|wav|flac))', re.I)
# Closing ॥ is optional at end of line — a few sources drop it (॥१-२६-३ ↵) — and some put a
# zero-width joiner/non-joiner inside the marker (॥‌ २४ ॥).
VERSE_MARK_RE = re.compile(r'[।॥\s\u200c\u200d]*॥[\s\u200c\u200d]*([०-९0-9]+(?:\s*[-–.]\s*[०-९0-9]+)*)[\s\u200c\u200d]*(?:॥|$)')
# "इति श्रीमद्रामायणे … सर्गः" — but not ordinary shlokas that merely begin with इति
COLOPHON_RE = re.compile(r'^\s*(?:इति|इत्यार्ष)\S*\s.*(?:रामायणे|काण्डे)', re.S)
# e.g. "५६अ प्रक्षिप्तः" — an interpolated sarga appended on its parent sarga's page
PRAKSHIPTA_RE = re.compile(r'^\s*[०-९0-9]+\s*(अ|आ|इ|ब)\s*प्रक्षिप्तः\s*$', re.M)


def sarga_titles(kanda, wikitext):
    base = f'रामायणम्/{kanda}'
    seen = {}
    for target, num in SARGA_LINK_RE.findall(wikitext):
        target = re.sub(r'\s+', ' ', target.strip())
        title = base + target if target.startswith('/') else target
        seen.setdefault(deva_to_int(num), title)
    return [seen[k] for k in sorted(seen)]


def clean_line(s):
    s = re.sub(r'<ref[^>]*/>|<ref[^>]*>.*?</ref>', '', s)
    s = re.sub(r'\{\{[^{}]*\}\}', '', s)
    s = re.sub(r'\[\[(?:[^|\]]*\|)?([^\]]*)\]\]', r'\1', s)
    s = re.sub(r'<[^>]+>', '', s)
    s = s.replace('[[', '').replace(']]', '')
    s = s.replace("'''", '').replace("''", '')
    s = re.sub(r'^[”’“‘"\']+', '', s.strip())   # mis-typed bold markup (”’इत्यार्षे …)
    return re.sub(r'[ \t ]+', ' ', s).strip()


def deva_digits(n): return ''.join(DEVA[int(d)] for d in str(n))


def parse_sarga(wikitext):
    """→ ([(suffix, verses [{n, text}])], audio file names).

    Sources mix three shloka-end markers: ॥१-१-१॥, ।। ७.१.१ ।। and a bare ॥१०॥;
    n is the marker's last component (the shloka number), None for headings and
    colophons. suffix is '' for the sarga itself, or e.g. 'अ' for a प्रक्षिप्त sarga
    that follows it on the same page.
    """
    audio = [a.strip() for a in AUDIO_RE.findall(wikitext)]
    body = re.sub(r'\{\{\s*header.*?\}\}', '', wikitext, flags=re.S | re.I)
    # Everything after the first ==section== (स्रोतः, संबंधित कड़ियाँ, …) is apparatus, not text
    body = re.split(r'^\s*==', body, flags=re.M)[0]
    body = re.sub(r'\[\[(?:File|file|सञ्चिका|चित्रम्):[^\]]*\]\]', '', body)
    body = re.sub(r'\[\[(?:वर्गः|Category):[^\]]*\]\]', '', body)
    body = re.sub(r'<inputbox>.*?</inputbox>', '', body, flags=re.S)

    pieces = PRAKSHIPTA_RE.split(body)   # [main, suffix1, body1, …]
    segments = [('', pieces[0])] + list(zip(pieces[1::2], pieces[2::2]))
    return [(suffix, parse_verses(text)) for suffix, text in segments], audio


def parse_verses(body):
    verses, cur = [], []
    def flush(n=None):
        if cur:
            text = '\n'.join(cur)
            verses.append({'n': None if COLOPHON_RE.match(text) else n, 'text': text})
            cur.clear()
    for raw in body.split('\n'):
        line = clean_line(raw).replace('।।', '॥')
        # Only a verse marker ends a shloka: several sargas have stray blank lines
        # splitting a shloka's half-lines apart, which must not become separate verses.
        if not line or re.fullmatch(r'[=\-_*#|{}]+', line):
            continue
        pos = 0
        for m in VERSE_MARK_RE.finditer(line):
            seg = line[pos:m.start()].strip()
            if seg:
                cur.append(seg + ' ॥')
            parts = re.split(r'\s*[-–.]\s*', m.group(1).strip())
            # ॥१-१॥ (kanda-sarga only) marks the heading / colophon, not a numbered shloka
            flush(deva_to_int(parts[-1]) if len(parts) != 2 else None)
            pos = m.end()
        rest = line[pos:].strip()
        if rest:
            cur.append(rest)
    flush()
    return verses


def repair_numbers(verses):
    """Fix typo'd shloka numbers without renumbering blindly.

    Numbers that sit in a run of consecutive values (…, 12, 13, …) are trusted, as is
    any lone number at the same offset from its position as such a run. The longest
    chain of trusted numbers whose offset never decreases becomes the anchors — so a
    real gap (a shloka missing from the source, numbering jumps and stays jumped) is
    kept, while stray values (a ॥१३॥ typed for ॥३॥, a repeated ॥२५॥, a duplicate) are
    re-filled counting on from the previous anchor.
    """
    idx = [i for i, v in enumerate(verses) if v['n']]
    n = [verses[i]['n'] for i in idx]
    L = len(n)
    if L == 0:
        return verses
    off = [n[k] - k for k in range(L)]
    in_run = [(k > 0 and n[k] == n[k - 1] + 1) or (k < L - 1 and n[k + 1] == n[k] + 1) for k in range(L)]
    run_offs = {off[k] for k in range(L) if in_run[k]}
    cand = [k for k in range(L) if in_run[k] or off[k] in run_offs] if run_offs else list(range(L))

    # longest non-decreasing-offset chain over the candidates (O(L²), L ≤ a few hundred)
    best, prev = [1] * len(cand), [-1] * len(cand)
    for j in range(len(cand)):
        for i in range(j):
            if off[cand[i]] <= off[cand[j]] and best[i] + 1 > best[j]:
                best[j], prev[j] = best[i] + 1, i
    j = max(range(len(cand)), key=lambda x: best[x])
    anchors = set()
    while j != -1:
        anchors.add(cand[j])
        j = prev[j]

    first = min(anchors)
    fixed = list(n)
    for k in range(L):
        if k in anchors:
            continue
        before = [a for a in anchors if a < k]
        fixed[k] = n[max(before)] + (k - max(before)) if before else max(1, n[first] - (first - k))
    out = [dict(v) for v in verses]
    for k, i in enumerate(idx):
        out[i]['n'] = fixed[k]
    return out


def main():
    print('Fetching kanda index pages…')
    kpages = fetch_pages([f'रामायणम्/{k}' for k, _ in KANDAS])
    plan = []
    for k, _ in KANDAS:
        titles = sarga_titles(k, kpages[f'रामायणम्/{k}'] or '')
        print(f'  {k}: {len(titles)} sargas')
        plan.append(titles)

    print('Fetching sarga pages…')
    pages = fetch_pages([t for ts in plan for t in ts])

    parsed = {}
    for kno, ts in enumerate(plan, 1):
        for t in ts:
            if pages.get(t):
                parsed[t] = parse_sarga(pages[t])
            else:
                print('  MISSING', t)

    print('Resolving audio…')
    audio_files = sorted({a for _, auds in parsed.values() for a in auds})
    audio = fetch_audio(audio_files)

    meta_path = os.path.join(DATA, 'meta.json')
    meta = json.load(open(meta_path, encoding='utf8'))
    meta['categories'] = [c for c in meta['categories'] if c['id'] != CATEGORY_ID]
    meta['texts'] = [t for t in meta['texts'] if t['id'] != TEXT_ID]
    meta['chapters'] = [c for c in meta['chapters'] if c['text_id'] != TEXT_ID]

    meta['categories'].append({
        'id': CATEGORY_ID, 'name_sanskrit': 'रामायणम्', 'name_english': 'Ramayana',
        'description': 'Valmiki Ramayana (sa.wikisource)', 'icon': '🏹',
        'display_order': 2, 'parent_id': 5,
    })
    meta['texts'].append({
        'id': TEXT_ID, 'category_id': CATEGORY_ID,
        'name_sanskrit': 'वाल्मीकिरामायणम्', 'name_english': 'Valmiki Ramayana',
        'description': 'श्रीमद्वाल्मीकीयं रामायणम् आदिकाव्यम् (बालकाण्डादि सप्त काण्डानि), सस्वरपाठसहितम्',
        'author': 'वाल्मीकिः', 'display_order': 1, 'has_audio': 1,
        'chapter_unit': 'सर्गः', 'chapter_unit_plural': 'सर्गाः',
    })

    os.makedirs(os.path.join(DATA, 'verses'), exist_ok=True)
    seq, total_verses, with_audio = 0, 0, 0
    for (kanda, kanda_en), titles in zip(KANDAS, plan):
        for t in titles:
            if t not in parsed:
                continue
            snum = deva_to_int(re.search(r'सर्गः\s*([०-९0-9]+)', t).group(1))
            segments, auds = parsed[t]
            kno = KANDAS.index((kanda, kanda_en)) + 1
            for suffix, verses in segments:
                seq += 1
                cid = CHAPTER_ID_BASE + seq
                label = deva_digits(snum) + suffix
                a = audio.get(auds[0]) if auds and not suffix else None
                chapter = {
                    'id': cid, 'text_id': TEXT_ID,
                    'name_sanskrit': f'सर्गः {label}' + (' (प्रक्षिप्तः)' if suffix else ''),
                    'name_english': f'Sarga {snum}' + (f'{suffix} (interpolated)' if suffix else ''),
                    'chapter_number': snum, 'display_order': seq,
                    'section_sanskrit': kanda, 'section_english': kanda_en, 'section_order': kno,
                    'subsection_sanskrit': None, 'synopsis_sanskrit': None,
                    'audio_url': a and a['ogg'], 'audio_url_mp3': a and a['mp3'],
                    'source_url': 'https://sa.wikisource.org/wiki/' + urllib.parse.quote(t.replace(' ', '_')),
                }
                if chapter['audio_url']: with_audio += 1
                meta['chapters'].append(chapter)
                verses = repair_numbers(verses)
                rows = [{
                    'id': VERSE_ID_BASE + seq * 1000 + i, 'chapter_id': cid,
                    'verse_number': f'{deva_digits(kno)}-{label}-{deva_digits(v["n"])}' if v['n'] else None,
                    'content_sanskrit': v['text'],
                    'padaccheda': '', 'anvaya': '', 'meaning_sanskrit': '', 'meaning_english': '',
                    'audio_url': None, 'display_order': i + 1,
                } for i, v in enumerate(verses)]
                total_verses += len(rows)
                with open(os.path.join(DATA, 'verses', f'{cid}.json'), 'w', encoding='utf8') as f:
                    json.dump(rows, f, ensure_ascii=False)

    with open(meta_path, 'w', encoding='utf8') as f:
        json.dump(meta, f, ensure_ascii=False)
    print(f'Done: {seq} sargas, {total_verses} verses, {with_audio} with audio')


if __name__ == '__main__':
    main()
