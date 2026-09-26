#!/usr/bin/env python3
"""Import Srimad Bhagavatam from Bhagavata-VaNi into the static JSON data.

    git clone https://github.com/prathoshap/bhagavatavani /tmp/bv
    python3 scrapper/bhagavatam-bhagavatavani.py /tmp/bv

Reads the site's bundled bhagavatam.db (text lent to bhagavatavani.com by Poornaprajna
Samshodhana Mandiram, Bengaluru) and writes it in the Mahabharata shape (section =
skandha, chapter = adhyaya), so it gets the same grouped index and continuous reader.

Audio is NOT downloaded: every recited row gets the URL of its per-shloka .m4a on the
site's Cloudflare R2 bucket, which the reader streams. The R2 file number is the row's
1-based rank among the adhyaya's content_type='Bhagavatam' rows (incl. "सूत उवाच"
lines), exactly as bhagavatavani's app.js computes it.

Also writes the site's five अनुक्रमणिका (stuti, vishaya, vakta, akshara, pada) under
data/anukramanika/<text_id>/, each item pointing at "skandha.adhyaya.verse"; the
manifest maps "skandha.adhyaya" to our chapter id.
"""
import collections
import json
import os
import re
import sqlite3
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'web', 'public', 'data')
SRC = sys.argv[1] if len(sys.argv) > 1 else '/tmp/bv'

CATEGORY_ID = 60
PARENT_CATEGORY_ID = 6          # पुराणम्
TEXT_ID = 181
CHAPTER_ID_BASE = 10000
VERSE_ID_BASE = 6_000_000_000   # + chapter_seq * 1000 + n; far from existing id ranges
AUDIO_BASE = 'https://pub-303f7559721c4b40bf6712eb557e350c.r2.dev/Bhagavata_Audio'

DEVA = '०१२३४५६७८९'
def deva(n): return ''.join(DEVA[int(d)] for d in str(n))


def audio_url(sk, a, nnn):
    return f'{AUDIO_BASE}/skandha_{sk:02d}/adhyaya_{a:03d}/BhP_{sk:02d}.{a:03d}.{nnn:03d}.m4a'


def rng(vs, ve):
    if vs is None: return None
    return deva(vs) if ve in (None, vs) else f'{deva(vs)}–{deva(ve)}'


def ref(sk, a, v=None):
    return f'{sk}.{a}' + (f'.{v}' if v is not None else '')


def write(rel, obj):
    path = os.path.join(DATA, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf8') as f:
        json.dump(obj, f, ensure_ascii=False)
    return os.path.getsize(path)


def main():
    db = sqlite3.connect(os.path.join(SRC, 'bhagavatam.db'))
    db.row_factory = sqlite3.Row
    q = lambda sql, *a: db.execute(sql, a).fetchall()

    skandhas = q('SELECT * FROM skandhas ORDER BY skandha')
    adhyayas = q('SELECT * FROM adhyayas ORDER BY skandha, adhyaya')
    topics = q('SELECT * FROM topics ORDER BY skandha, adhyaya, ordinal')
    topics_by_ch = collections.defaultdict(list)
    for t in topics: topics_by_ch[(t['skandha'], t['adhyaya'])].append(t)
    # skandha-level rows (adhyaya NULL): mangala + heading open the skandha, colophon closes it
    book_rows = collections.defaultdict(lambda: {'open': [], 'close': []})
    for e in q('SELECT * FROM entries WHERE adhyaya IS NULL ORDER BY id'):
        if e['content_type'] == 'Mangala':
            book_rows[e['skandha']]['open'].append(e['text_dev'])
        elif e['content_type'] == 'Colophon_Skandha':
            book_rows[e['skandha']]['close'].append(e['text_dev'])
    last_adhyaya = {s['skandha']: s['adhyaya_count'] for s in skandhas}

    meta_path = os.path.join(DATA, 'meta.json')
    meta = json.load(open(meta_path, encoding='utf8'))
    meta['categories'] = [c for c in meta['categories'] if c['id'] != CATEGORY_ID]
    meta['texts'] = [t for t in meta['texts'] if t['id'] != TEXT_ID]
    meta['chapters'] = [c for c in meta['chapters'] if c['text_id'] != TEXT_ID]
    meta['categories'].append({
        'id': CATEGORY_ID, 'name_sanskrit': 'श्रीमद्भागवतम्', 'name_english': 'Srimad Bhagavatam',
        'description': 'Bhagavata Purana (bhagavatavani.com)', 'icon': '🪈',
        'display_order': 1, 'parent_id': PARENT_CATEGORY_ID,
    })

    chapter_ids = {}
    seq = n_rows = n_audio = 0
    for ad in adhyayas:
        sk, a = ad['skandha'], ad['adhyaya']
        seq += 1
        cid = CHAPTER_ID_BASE + seq
        chapter_ids[ref(sk, a)] = cid
        ch_topics = topics_by_ch[(sk, a)]
        first_row_of_topic = {}
        ents = q('SELECT * FROM entries WHERE skandha=? AND adhyaya=? ORDER BY seq_in_adhyaya', sk, a)
        for e in ents:
            if e['topic_id'] is not None and e['content_type'] == 'Bhagavatam':
                first_row_of_topic.setdefault(e['topic_id'], e['id'])
        topic_of_row = {rid: tid for tid, rid in first_row_of_topic.items()}
        topic_by_id = {t['id']: t for t in ch_topics}
        # range-less synopsis topics have no rows of their own; they head the chapter
        unranged = [t for t in ch_topics if t['verse_start'] is None or t['id'] not in first_row_of_topic]

        rows, nnn = [], 0
        # `topics` on a row = the विषय headings that begin at it ({text, range}); the reader
        # shows them as dividers and collects them into the chapter's विषयसूची
        def add(text, number=None, audio=None, topics=()):
            row = {
                'id': VERSE_ID_BASE + seq * 1000 + len(rows), 'chapter_id': cid,
                'verse_number': number, 'content_sanskrit': text,
                'padaccheda': '', 'anvaya': '', 'meaning_sanskrit': '', 'meaning_english': '',
                'audio_url': audio, 'display_order': len(rows) + 1,
            }
            if topics:
                row['topics'] = [{'text': t['text_dev'], 'range': rng(t['verse_start'], t['verse_end'])} for t in topics]
            rows.append(row)
        if a == 1:
            for t in book_rows[sk]['open']: add(t)
        heads = [e['text_dev'] for e in ents if e['content_type'] == 'Adhyaya_Heading']
        add(heads[0] if heads else f'अध्यायः {deva(a)}', topics=unranged)
        for h in heads[1:]: add(h)
        for e in ents:
            ct = e['content_type']
            if ct in ('Adhyaya_Heading', 'Subject'):
                continue
            if ct == 'Bhagavatam':
                nnn += 1
                v, ve = e['verse'], e['verse_end']
                number = None if v is None else f'{deva(sk)}-{deva(a)}-{rng(v, ve)}'
                tid = topic_of_row.get(e['id'])
                add(e['text_dev'], number, audio_url(sk, a, nnn), [topic_by_id[tid]] if tid in topic_by_id else ())
                n_audio += 1
            else:                                  # Colophon_Bhagavatam
                add(e['text_dev'])
        if a == last_adhyaya[sk]:
            for t in book_rows[sk]['close']: add(t)
        n_rows += len(rows)
        write(f'verses/{cid}.json', rows)

        synopsis = ' · '.join(t['text_dev'] for t in ch_topics) or None
        meta['chapters'].append({
            'id': cid, 'text_id': TEXT_ID,
            'name_sanskrit': f'अध्यायः {deva(a)}', 'name_english': f'Adhyaya {a}',
            'chapter_number': a, 'display_order': seq,
            'section_sanskrit': skandhas[sk - 1]['heading_dev'], 'section_english': f'Skandha {sk}',
            'section_order': sk, 'subsection_sanskrit': None, 'synopsis_sanskrit': synopsis,
        })

    # ── अनुक्रमणिका ────────────────────────────────────────────────────────────
    base = f'anukramanika/{TEXT_ID}'
    verses = q("SELECT skandha sk, adhyaya a, verse v, text_dev t, speaker_id sp FROM entries "
               "WHERE verse IS NOT NULL AND content_type='Bhagavatam' ORDER BY skandha, adhyaya, verse")
    sk_name = {s['skandha']: s['heading_dev'] for s in skandhas}
    indexes = []

    # स्तुत्यनुक्रमणिका — the site's 37 prasiddha stotras (Devanagari titles from stotra_tr)
    titles = {r['stotra_ordinal']: r['text'] for r in q("SELECT * FROM stotra_tr WHERE lang='deva'")}
    groups = collections.OrderedDict()
    for s in q('SELECT * FROM stotras ORDER BY ordinal'):
        item = {'label': titles.get(s['ordinal']) or s['title'], 'sub': s['title']}
        if s['adhyaya'] is not None:
            item['ref'] = ref(s['skandha'], s['adhyaya'], s['verse_start'])
            item['range'] = f"{s['skandha']}.{s['adhyaya']}.{s['verse_start']}–{s['verse_end']}"
            item['count'] = s['verse_count']
        else:
            item['note'] = 'स्थानं निर्धार्यमाणम् (location pending)'
        groups.setdefault(s['skandha'], []).append(item)
    write(f'{base}/stuti.json', {'groups': [{'title': sk_name[k], 'items': v} for k, v in groups.items()]})
    indexes.append({'key': 'stuti', 'kind': 'groups', 'name_sanskrit': 'स्तुत्यनुक्रमणिका',
                    'name_english': 'Stuti index', 'count': sum(len(v) for v in groups.values()), 'unit': 'स्तुतयः'})

    # विषयानुक्रमणिका — all topics, skandha → adhyaya
    groups = collections.OrderedDict()
    for t in topics:
        item = {'label': t['text_dev'], 'ref': ref(t['skandha'], t['adhyaya'], t['verse_start'])}
        item['range'] = f"{t['skandha']}.{t['adhyaya']}" + (
            '' if t['verse_start'] is None else '.' + (str(t['verse_start']) if t['verse_end'] in (None, t['verse_start'])
                                                       else f"{t['verse_start']}–{t['verse_end']}"))
        groups.setdefault(t['skandha'], []).append(item)
    write(f'{base}/vishaya.json', {'groups': [{'title': sk_name[k], 'items': v} for k, v in groups.items()],
                                   'searchable': True})
    indexes.append({'key': 'vishaya', 'kind': 'groups', 'name_sanskrit': 'विषयानुक्रमणिका',
                    'name_english': 'Topic index', 'count': len(topics), 'unit': 'विषयाः'})

    # वक्त्रनुक्रमणिका — each speaker, the adhyayas they speak in (with the first verse there)
    speakers = {s['id']: s for s in q('SELECT * FROM speakers WHERE verse_count > 0')}
    per = collections.defaultdict(lambda: collections.OrderedDict())
    for r in verses:
        if r['sp'] in speakers:
            c = per[r['sp']].setdefault((r['sk'], r['a']), [r['v'], 0])
            c[1] += 1
    groups = []
    for sid, s in sorted(speakers.items(), key=lambda kv: -kv[1]['verse_count']):
        items = [{'label': f"{sk_name[sk]} · अध्यायः {deva(a)}", 'ref': ref(sk, a, v0), 'range': f'{sk}.{a}',
                  'count': n} for (sk, a), (v0, n) in per[sid].items()]
        groups.append({'title': s['name_dev'], 'sub': f"{deva(s['verse_count'])} श्लोकाः · {deva(len(items))} अध्यायाः",
                       'items': items})
    write(f'{base}/vakta.json', {'groups': groups, 'collapsible': True})
    indexes.append({'key': 'vakta', 'kind': 'groups', 'name_sanskrit': 'वक्त्रनुक्रमणिका',
                    'name_english': 'Speaker index', 'count': len(groups), 'unit': 'वक्तारः'})

    # अक्षरानुक्रमणिका — shlokas by their opening line, sharded by first akshara
    clean = lambda s: re.sub(r'^[^ऀ-ॿ]+', '', s or '').strip()
    buckets = collections.defaultdict(list)
    for r in verses:
        line = clean((r['t'] or '').split('\n')[0])
        if line: buckets[line[0]].append([line, ref(r['sk'], r['a'], r['v'])])
    letters = sorted(buckets, key=ord)
    for L in letters:
        write(f'{base}/akshara/{ord(L):04x}.json', sorted(buckets[L]))
    indexes.append({'key': 'akshara', 'kind': 'letters', 'name_sanskrit': 'अक्षरानुक्रमणिका',
                    'name_english': 'Shloka index (first line)', 'count': sum(len(b) for b in buckets.values()),
                    'unit': 'श्लोकाः', 'letters': [[L, f'{ord(L):04x}', len(buckets[L])] for L in letters]})

    # पदानुक्रमणिका — word concordance, avyayas dropped (same rules as the site)
    avy = set(json.load(open(os.path.join(SRC, 'avyayas.json'), encoding='utf8')))
    words = collections.defaultdict(list)
    for r in verses:
        seen = set()
        for w in re.split(r'\s+', r['t'] or ''):
            w = re.sub(r'[०-९0-9।॥/]', '', w).strip()
            if not w or not ('ऀ' <= w[0] <= 'ॿ') or w in avy or w in seen:
                continue
            seen.add(w)
            words[w].append(ref(r['sk'], r['a'], r['v']))
    pb = collections.defaultdict(list)
    for w in sorted(words): pb[w[0]].append([w, words[w]])
    pletters = sorted(pb, key=ord)
    pada_bytes = sum(write(f'{base}/pada/{ord(L):04x}.json', pb[L]) for L in pletters)
    indexes.append({'key': 'pada', 'kind': 'letters', 'name_sanskrit': 'पदानुक्रमणिका',
                    'name_english': 'Word concordance', 'count': len(words), 'unit': 'पदानि',
                    'letters': [[L, f'{ord(L):04x}', len(pb[L])] for L in pletters]})

    write(f'{base}/manifest.json', {'chapters': chapter_ids, 'indexes': indexes})

    meta['texts'].append({
        'id': TEXT_ID, 'category_id': CATEGORY_ID,
        'name_sanskrit': 'श्रीमद्भागवतम्', 'name_english': 'Srimad Bhagavatam',
        'description': 'भगवद्बादरायणप्रणीतं श्रीमद्भागवतम् (द्वादश स्कन्धाः), सस्वरपाठसहितम्। '
                       'पाठः पूर्णप्रज्ञसंशोधनमन्दिरम्, बेङ्गलूरु; bhagavatavani.com (Prof. Prathosh); '
                       'पाठस्वरः Vāgdhenu',
        'author': 'वेदव्यासः', 'display_order': 1, 'has_audio': 1,
        'search_placeholder': 'अध्यायं / स्कन्धं / विषयम् अन्विष्यतु… (search adhyaya, skandha or topic)',
        'anukramanika': [{k: i[k] for k in ('key', 'name_sanskrit', 'name_english', 'count', 'unit')} for i in indexes],
    })
    with open(meta_path, 'w', encoding='utf8') as f:
        json.dump(meta, f, ensure_ascii=False)
    print(f'Done: {len(skandhas)} skandhas, {seq} adhyayas, {n_rows} rows ({n_audio} with audio), '
          f'{len(topics)} topics, {len(words)} padas ({pada_bytes // 1024} KB)')


if __name__ == '__main__':
    main()
