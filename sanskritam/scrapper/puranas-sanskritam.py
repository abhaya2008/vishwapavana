#!/usr/bin/env python3
"""Import the Mahapuranas from sanskritam.world into the static JSON data.

    python3 scrapper/puranas-sanskritam.py [src_dir]

src_dir holds one JSON tree per purana as extracted from sanskritam.world/puranas
(purana → [section →] [chapter →] adhyay → verses). Each purana becomes a text
directly under पुराणम्, written in the Mahabharata shape so it gets the same grouped
index and continuous chapter reader: the top-level division (खण्डः/अंशः/संहिता …)
is the section, a second level (e.g. Skanda's केदारखण्डः) is the subsection, and a
purana with no divisions at all is grouped into runs of 50 adhyayas.

The Srimad Bhagavatam is skipped (text 181, from bhagavatavani, already has audio and
anukramanika). shabda_chheda is not imported — it's machine segmentation in SLP1 that
the reader doesn't show.
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'web', 'public', 'data')
SRC = sys.argv[1] if len(sys.argv) > 1 else '/Users/apple/Documents/dvaitavedanta-playwrite/output/puranas'

CATEGORY_ID = 6                 # पुराणम्
TEXT_ID_BASE = 300              # + position in PURANAS
CHAPTER_ID_BASE = 20000         # + global adhyaya seq; far from existing id ranges
VERSE_ID_BASE = 7_000_000_000   # + chapter_seq * 1000 + n
FLAT_GROUP = 50

# traditional Mahapurana order (Vishnu Purana 3.6), then Harivamsha
PURANAS = [
    ('brahmapuranam', 'ब्रह्मपुराणम्', 'Brahma Purana'),
    ('padmapuranam', 'पद्मपुराणम्', 'Padma Purana'),
    ('vishnupuranam', 'विष्णुपुराणम्', 'Vishnu Purana'),
    ('shivapuraanam', 'शिवपुराणम्', 'Shiva Purana'),
    ('vaayupuraanam', 'वायुपुराणम्', 'Vayu Purana'),
    ('naradapuranam', 'नारदपुराणम्', 'Narada Purana'),
    ('markandeypuranam', 'मार्कण्डेयपुराणम्', 'Markandeya Purana'),
    ('agnipuranam', 'अग्निपुराणम्', 'Agni Purana'),
    ('bhavishyapuranam', 'भविष्यपुराणम्', 'Bhavishya Purana'),
    ('brahmavaivarthapurana', 'ब्रह्मवैवर्तपुराणम्', 'Brahmavaivarta Purana'),
    ('lingapuranam', 'लिङ्गपुराणम्', 'Linga Purana'),
    ('varahapuranam', 'वराहपुराणम्', 'Varaha Purana'),
    ('skandapuranam', 'स्कन्दपुराणम्', 'Skanda Purana'),
    ('vaamanapuraanam', 'वामनपुराणम्', 'Vamana Purana'),
    ('kurmapuranam', 'कूर्मपुराणम्', 'Kurma Purana'),
    ('matsyapuranam', 'मत्स्यपुराणम्', 'Matsya Purana'),
    ('garudapuranam', 'गरुडपुराणम्', 'Garuda Purana'),
    ('brahmandpuranam', 'ब्रह्माण्डपुराणम्', 'Brahmanda Purana'),
    ('harivanshapuraanam', 'हरिवंशपुराणम्', 'Harivamsha'),
]

DEVA = '०१२३४५६७८९'
def deva(n): return ''.join(DEVA[int(d)] for d in str(n))


def clean_title(t):
    return re.sub(r'\s+', ' ', (t or '').replace('॥', '')).strip()


# lines that are only punctuation — the source's "-----" separators, stray "।" lines, a cut "<br" tail
JUNK_LINE_RE = re.compile(r'^(?:[\s।॥!`\-–—_*.]|r>)*$')


def clean_text(t):
    t = re.sub(r'<br\s*/?>', '\n', t or '')
    t = re.sub(r'<[^>]+>', '', t)
    return '\n'.join(line.strip() for line in t.split('\n') if not JUNK_LINE_RE.match(line))


def write(rel, obj):
    path = os.path.join(DATA, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf8') as f:
        json.dump(obj, f, ensure_ascii=False)
    return os.path.getsize(path)


def adhyaya_no(a, pos):
    # Harivamsha's विष्णुपर्व nodes carry no index; the title always has it
    if a.get('index') is not None: return a['index']
    m = re.search(r'[०-९0-9]+', a.get('title') or '')
    return int(''.join(str(DEVA.index(c)) if c in DEVA else c for c in m.group())) if m else pos


def adhyayas(root):
    """Yield (section, subsection, path, adhyay) in reading order; path = the 1-based
    indices of the enclosing divisions, used as the verse-number prefix."""
    kids = root.get('children') or []
    for parent in [root] + kids + [c for k in kids for c in k.get('children') or []]:
        for pos, a in enumerate(parent.get('children') or [], 1):
            if a['type'] == 'adhyay': a['index'] = adhyaya_no(a, pos)
    if all(k['type'] == 'adhyay' for k in kids):
        for a in kids:
            lo = (a['index'] - 1) // FLAT_GROUP * FLAT_GROUP + 1
            hi = min(lo + FLAT_GROUP - 1, kids[-1]['index'])
            sec = {'sanskrit': f'अध्यायाः {deva(lo)}–{deva(hi)}', 'english': f'Adhyayas {lo}–{hi}',
                   'order': (lo - 1) // FLAT_GROUP + 1}
            yield sec, None, [], a
        return
    for si, s in enumerate(kids, 1):
        sec = {'sanskrit': clean_title(s['title']), 'english': f'Part {si}', 'order': si}
        if s['type'] == 'adhyay':          # stray adhyaya beside divisions — not seen in the data
            yield sec, None, [], s
            continue
        for ci, c in enumerate(s.get('children') or [], 1):
            if c['type'] == 'adhyay':
                yield sec, None, [si], c
            else:
                for a in c.get('children') or []:
                    yield sec, clean_title(c['title']), [si, ci], a


def main():
    meta_path = os.path.join(DATA, 'meta.json')
    meta = json.load(open(meta_path, encoding='utf8'))
    text_ids = {TEXT_ID_BASE + i + 1 for i in range(len(PURANAS))}
    meta['texts'] = [t for t in meta['texts'] if t['id'] not in text_ids]
    meta['chapters'] = [c for c in meta['chapters'] if c['text_id'] not in text_ids]

    seq = 0
    totals = []
    for pi, (slug, name, name_en) in enumerate(PURANAS, 1):
        text_id = TEXT_ID_BASE + pi
        root = json.load(open(os.path.join(SRC, f'{slug}.json'), encoding='utf8'))
        n_ch = n_rows = 0
        skipped = []
        for sec, sub, path, a in adhyayas(root):
            verses = [v for v in a.get('verses') or [] if clean_text(v['text'])]
            if not verses:
                skipped.append(clean_title(a['title']))
                continue
            seq += 1
            n_ch += 1
            cid = CHAPTER_ID_BASE + seq
            prefix = ''.join(f'{deva(p)}-' for p in path) + f"{deva(a['index'])}-"
            rows = []
            for v in verses:
                num = (v.get('number') or '').strip()
                rows.append({
                    'id': VERSE_ID_BASE + seq * 1000 + len(rows), 'chapter_id': cid,
                    'verse_number': prefix + deva(num) if num.isdigit() else (num or None),
                    'content_sanskrit': clean_text(v['text']),
                    'padaccheda': '', 'anvaya': '', 'meaning_sanskrit': '', 'meaning_english': '',
                    'audio_url': None, 'display_order': len(rows) + 1,
                })
            n_rows += len(rows)
            write(f'verses/{cid}.json', rows)
            meta['chapters'].append({
                'id': cid, 'text_id': text_id,
                'name_sanskrit': clean_title(a['title']) or f"अध्यायः {deva(a['index'])}",
                'name_english': f"Adhyaya {a['index']}",
                'chapter_number': a['index'], 'display_order': n_ch,
                'section_sanskrit': sec['sanskrit'], 'section_english': sec['english'],
                'section_order': sec['order'], 'subsection_sanskrit': sub,
                'synopsis_sanskrit': None, 'source_url': a.get('url'),
            })

        meta['texts'].append({
            'id': text_id, 'category_id': CATEGORY_ID,
            'name_sanskrit': name, 'name_english': name_en,
            'description': f'{name} — पाठः sanskritam.world',
            'author': 'वेदव्यासः', 'display_order': pi + 1,
            'search_placeholder': 'अध्यायं / खण्डम् अन्विष्यतु… (search adhyaya or khanda)',
        })
        totals.append((name, n_ch, n_rows))
        print(f'{name}: {n_ch} adhyayas, {n_rows} shlokas' + (f' (no verses in source: {", ".join(skipped)})' if skipped else ''))

    with open(meta_path, 'w', encoding='utf8') as f:
        json.dump(meta, f, ensure_ascii=False)
    print(f'Done: {len(totals)} puranas, {sum(t[1] for t in totals)} adhyayas, {sum(t[2] for t in totals)} shlokas')


if __name__ == '__main__':
    main()
