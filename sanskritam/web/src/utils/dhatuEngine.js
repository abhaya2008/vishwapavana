// Live Sanskrit verb-form generation via Vidyut (https://github.com/ambuda-org/vidyut),
// loaded lazily as WASM. Used only for upasarga (prefix) composition — combinations that
// aren't feasible to precompute and ship as static data (see dhatuforms/*.json for the
// no-prefix base tables, which come from ashtadhyayi-com/data directly).
let modulePromise;
let grammarInstance;

async function loadEngine() {
    if (!modulePromise) {
        modulePromise = import('@siva-sh/vidyut').then(async (vidyut) => {
            await vidyut.default();
            return vidyut;
        }).catch((err) => { modulePromise = undefined; throw err; });
    }
    const vidyut = await modulePromise;
    if (!grammarInstance) grammarInstance = new vidyut.Vyakarana();
    return { vidyut, grammar: grammarInstance };
}

const GANA_ENUM = {
    1: 'Bhvadi', 2: 'Adadi', 3: 'Juhotyadi', 4: 'Divadi', 5: 'Svadi',
    6: 'Tudadi', 7: 'Rudhadi', 8: 'Tanadi', 9: 'Kryadi', 10: 'Curadi',
};

const SANADI_ENUM = { san: 'san', nich: 'Ric', yang: 'yaN', yangluk: 'yaNluk' };

// Same 10 lakaras used by the static tables (see dhatuEngine's counterpart, LAKARA_NAMES,
// in DhatuRupaPage.jsx), mapped to Vidyut's Lakara enum values.
export const LAKARA_ENUM = {
    plat: 'Lat', plit: 'Lit', plut: 'Lut', plrut: 'Lrt', plot: 'Lot',
    plang: 'Lan', pvidhiling: 'VidhiLin', pashirling: 'AshirLin', plung: 'Lun', plrung: 'Lrn',
};

// shuddha_krut key (Devanagari, matching dhatuforms_krut.txt) → Vidyut BaseKrt enum value.
// (ktvA covers both क्त्वा and ल्यप् — Vidyut switches automatically once a prefix is present.)
export const KRUT_ENUM = {
    'ल्युट्': 'lyuw', 'अनीयर्': 'anIyar', 'ण्वुल्': 'Rvul', 'तुमुन्': 'tumun',
    'तव्य': 'tavya', 'तृच्': 'tfc', 'क्त्वा': 'ktvA', 'ल्यप्': 'ktvA',
    'क्तवतुँ': 'ktavatu', 'क्त': 'kta', 'शतृँ': 'Satf',
};

// Traditional upasargas, displayed in Devanagari; converted to SLP1 on demand via
// Vidyut's own transliterate() so there's no separately-maintained SLP1 spelling to
// get wrong.
export const UPASARGA_LIST = [
    'प्र', 'परा', 'अप', 'सम्', 'अनु', 'अव', 'निस्', 'निर्', 'दुस्', 'दुर्',
    'वि', 'आ', 'नि', 'अधि', 'अपि', 'अति', 'सु', 'उद्', 'अभि', 'प्रति', 'परि', 'उप',
];

function toSlp1(vidyut, deva) {
    return vidyut.transliterate(deva, vidyut.Scheme.Devanagari, vidyut.Scheme.Slp1);
}
function toDeva(vidyut, slp1) {
    return vidyut.transliterate(slp1, vidyut.Scheme.Slp1, vidyut.Scheme.Devanagari);
}

/**
 * Generate one lakara's 3x3 (purusha x vacana) table for a dhatu, with optional
 * upasargas/sanadi, live via Vidyut. Returns the same shape as the precomputed
 * dhatuforms/*.json tables: { plat: [9 strings], ... } for a single lakara key.
 */
export async function generateLakaraForms({ aupadeshikaDeva, ganaNumber, upasargasDeva, sanadiKey }, lakaraKey, prayoga) {
    const { vidyut, grammar } = await loadEngine();
    const dhatu = {
        aupadeshika: toSlp1(vidyut, aupadeshikaDeva),
        gana: GANA_ENUM[ganaNumber],
        prefixes: (upasargasDeva || []).map((u) => toSlp1(vidyut, u)),
        sanadi: sanadiKey ? [SANADI_ENUM[sanadiKey]] : [],
    };
    const lakara = LAKARA_ENUM[lakaraKey];
    const purushas = ['Prathama', 'Madhyama', 'Uttama'];
    const vacanas = ['Eka', 'Dvi', 'Bahu'];

    async function derive(pry) {
        const cells = [];
        for (const purusha of purushas) {
            for (const vacana of vacanas) {
                const forms = grammar.deriveTinantas({ dhatu, lakara, prayoga: pry, purusha, vacana, skip_at_agama: false });
                cells.push(forms.map((f) => toDeva(vidyut, f.text)).join(','));
            }
        }
        return cells;
    }

    if (prayoga !== 'Karmani') return derive(prayoga);
    // भावकर्मणोः (combined table, matching the static data's category): an
    // intransitive root has no कर्मणि voice, only भावे — fall back automatically.
    const karmani = await derive('Karmani');
    if (karmani.some((c) => c)) return karmani;
    return derive('Bhave');
}

/** Generate all available krut (participle) forms live, matching the shuddha_krut shape. */
export async function generateKrutForms({ aupadeshikaDeva, ganaNumber, upasargasDeva, sanadiKey }, krutKeys) {
    const { vidyut, grammar } = await loadEngine();
    const dhatu = {
        aupadeshika: toSlp1(vidyut, aupadeshikaDeva),
        gana: GANA_ENUM[ganaNumber],
        prefixes: (upasargasDeva || []).map((u) => toSlp1(vidyut, u)),
        sanadi: sanadiKey ? [SANADI_ENUM[sanadiKey]] : [],
    };
    const out = {};
    for (const key of krutKeys) {
        const krt = KRUT_ENUM[key];
        if (!krt) continue;
        try {
            const forms = grammar.deriveKrdantas({ dhatu, krt });
            const text = forms.map((f) => toDeva(vidyut, f.text)).join(',');
            if (text) out[key] = text;
        } catch (_) { /* this krt doesn't apply to this root/prefix combo */ }
    }
    return out;
}
