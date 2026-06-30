const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'database.sqlite'));

db.exec(`
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY,
    name_sanskrit TEXT NOT NULL,
    name_english TEXT,
    description TEXT,
    icon TEXT,
    display_order INTEGER DEFAULT 0,
    parent_id INTEGER
);

CREATE TABLE IF NOT EXISTS texts (
    id INTEGER PRIMARY KEY,
    category_id INTEGER NOT NULL,
    name_sanskrit TEXT NOT NULL,
    name_english TEXT,
    description TEXT,
    author TEXT,
    display_order INTEGER DEFAULT 0,
    has_audio INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS chapters (
    id INTEGER PRIMARY KEY,
    text_id INTEGER NOT NULL,
    name_sanskrit TEXT NOT NULL,
    name_english TEXT,
    chapter_number INTEGER,
    display_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS verses (
    id INTEGER PRIMARY KEY,
    chapter_id INTEGER NOT NULL,
    verse_number TEXT NOT NULL,
    content_sanskrit TEXT NOT NULL,
    padaccheda TEXT,
    anvaya TEXT,
    meaning_sanskrit TEXT,
    meaning_english TEXT,
    audio_url TEXT,
    display_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS commentaries (
    id INTEGER PRIMARY KEY,
    verse_id INTEGER NOT NULL,
    commentary_type TEXT NOT NULL,
    author TEXT,
    content TEXT NOT NULL
);
`);

// ── Categories ────────────────────────────────────────────────────────────────
const insertCategory = db.prepare(
    'INSERT OR REPLACE INTO categories VALUES (?,?,?,?,?,?,?)'
);
[
    [1,'वेदः','Vedas','The four Vedas and related texts','🕉',1,null],
    [2,'व्याकरणम्','Grammar','Sanskrit grammar texts','📖',2,null],
    [3,'दर्शनम्','Philosophy','Philosophical treatises','🧘',3,null],
    [4,'स्तोत्रम्','Stotras','Hymns and prayers','🙏',4,null],
    [5,'इतिहासः','Itihasas','Epics and historical texts','📜',5,null],
    [6,'पुराणम्','Puranas','Ancient mythological texts','🌟',6,null],
    [9,'वेदान्तः','Vedanta','Vedanta and related philosophical poetry','📿',7,null],
    [7,'सूत्रपाठः','Sutrapatha','Panini\'s Ashtadhyayi sutras','📜',1,2],
    [8,'धातुपाठः','Dhatupatha','Verb roots','📝',2,2],
].forEach(r => insertCategory.run(...r));

// ── Texts ─────────────────────────────────────────────────────────────────────
const insertText = db.prepare(
    'INSERT OR REPLACE INTO texts VALUES (?,?,?,?,?,?,?,?)'
);
[
    [1,7,'अष्टाध्यायी','Ashtadhyayi','The foundational text of Sanskrit grammar by Panini','पाणिनिः',1,0],
    [2,4,'विष्णुसहस्रनाम','Vishnu Sahasranama','A thousand names of Lord Vishnu','',1,1],
    [3,9,'मणिमञ्जरी','Manimanjari','A Sanskrit kāvya on Madhvacharya — with Kannada word meanings and grammatical commentary','श्रीमन्नारायणपण्डिताचार्यविरचिता',1,0],
].forEach(r => insertText.run(...r));

// ── Chapters ──────────────────────────────────────────────────────────────────
const insertChapter = db.prepare(
    'INSERT OR REPLACE INTO chapters VALUES (?,?,?,?,?,?)'
);
[
    [1,1,'प्रथमोऽध्यायः','Chapter 1',1,1],
    [2,1,'द्वितीयोऽध्यायः','Chapter 2',2,2],
    [3,2,'पूर्वभागः','Part 1',1,1],
    [4,3,'प्रथमः सर्गः','Creation Narrative · Rama\'s birth',1,1],
    [5,3,'द्वितीयः सर्गः','Sita\'s protection · Hanuman\'s mission',2,2],
    [6,3,'तृतीयः सर्गः','Lunar dynasty · Birth of Krishna',3,3],
    [7,3,'चतुर्थः सर्गः','Krishna\'s exploits · Mahabharata',4,4],
    [8,3,'पञ्चमः सर्गः','Buddhist challenge · Kumarila Bhatta',5,5],
    [9,3,'षष्ठः सर्गः','Sankara\'s birth and activities',6,6],
    [10,3,'सप्तमः सर्गः','Debate with Mandana Misra',7,7],
    [11,3,'अष्टमः सर्गः','Madhvacharya\'s advent · Tattvavada',8,8],
].forEach(r => insertChapter.run(...r));

// ── Verses ────────────────────────────────────────────────────────────────────
const insertVerse = db.prepare(`
    INSERT OR REPLACE INTO verses
    (id,chapter_id,verse_number,content_sanskrit,padaccheda,anvaya,meaning_sanskrit,meaning_english,audio_url,display_order)
    VALUES (@id,@chapter_id,@verse_number,@content_sanskrit,@padaccheda,@anvaya,@meaning_sanskrit,@meaning_english,@audio_url,@display_order)
`);
const verses = [
    {id:1,chapter_id:1,verse_number:'१.१.१',content_sanskrit:'वृद्धिरादैच्',padaccheda:'वृद्धिः आत् ऐच्',anvaya:'आत् ऐच् इति वृद्धिसंज्ञाः',meaning_sanskrit:'आ, ऐ, औ इत्येते वृद्धिसंज्ञका भवन्ति',meaning_english:'The vowels ā, ai, and au are called vṛddhi.',audio_url:null,display_order:1},
    {id:2,chapter_id:1,verse_number:'१.१.२',content_sanskrit:'अदेङ्गुणः',padaccheda:'अत् एङ् गुणः',anvaya:'अत् एङ् इति गुणसंज्ञाः',meaning_sanskrit:'अ, ए, ओ इत्येते गुणसंज्ञका भवन्ति',meaning_english:'The vowels a, e, and o are called guṇa.',audio_url:null,display_order:2},
    {id:3,chapter_id:1,verse_number:'१.१.३',content_sanskrit:'इको गुणवृद्धी',padaccheda:'इकः गुण-वृद्धी',anvaya:'इकः स्थाने गुणवृद्धी भवतः',meaning_sanskrit:'इक् (इ उ ऋ लृ) स्थाने गुण-वृद्धी आदेशौ भवतः',meaning_english:'Guṇa and vṛddhi are substitutes for ik vowels.',audio_url:null,display_order:3},
    {id:4,chapter_id:1,verse_number:'१.१.४',content_sanskrit:'न धातुलोप आर्धधातुके',padaccheda:'न धातु-लोपे आर्धधातुके',anvaya:'आर्धधातुके परतः धातोः लोपे सति गुणवृद्धी न भवतः',meaning_sanskrit:'आर्धधातुकप्रत्यये परे धातोः लोपे सति गुणवृद्धी न स्तः',meaning_english:'Guṇa and vṛddhi do not occur when dhātu is elided before ārdhadhātuka.',audio_url:null,display_order:4},
    {id:5,chapter_id:1,verse_number:'१.१.५',content_sanskrit:'क्ङिति च',padaccheda:'क्-ङ्-इति च',anvaya:'कित् ङित् प्रत्यये परे च गुणवृद्धी न भवतः',meaning_sanskrit:'कित् वा ङित् प्रत्यये परे गुणवृद्धी न स्तः',meaning_english:'Guṇa and vṛddhi also do not occur before affixes marked with k or ṅ.',audio_url:null,display_order:5},
    {id:6,chapter_id:3,verse_number:'१',content_sanskrit:'विश्वं विष्णुर्वषट्कारो भूतभव्यभवत्प्रभुः।\nभूतकृद्भूतभृद्भावो भूतात्मा भूतभावनः॥',padaccheda:'विश्वम् विष्णुः वषट्कारः भूत-भव्य-भवत्-प्रभुः भूत-कृत् भूत-भृत् भावः भूत-आत्मा भूत-भावनः',anvaya:'',meaning_sanskrit:'',meaning_english:'He is the universe, all-pervading, the sacred Vasatkara.',audio_url:null,display_order:1},
    {id:7,chapter_id:4,verse_number:'1.1',content_sanskrit:'वन्दे गोविन्दमानन्द-ज्ञानदेहं पतिं श्रियः । श्रीमदानन्दतीर्थार्य-वल्लभं परमक्षरम्',padaccheda:'',anvaya:"वन्द इत्युत्तमपुरुषप्रयोगात् 'अहमि'ति कर्तृवाचकपदमध्याहर्यम् — अहं, आनन्दज्ञानदेहं श्रियः पतिं श्रीमदानन्दतीर्थार्यवल्लभं परं अक्षरं गोविन्दं वन्दे ।",meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:1},
    {id:8,chapter_id:4,verse_number:'1.2',content_sanskrit:'ससर्ज भगवानाऽऽदौ त्रीन् गुणान् प्रकृतेः परः । महत्तत्त्वं ततो विष्णुः सृष्टवान् ब्रह्मणस्तनुम्',padaccheda:'',anvaya:'प्रकृतेः परः भगवान् आदौ त्रीन् गुणान् ससर्ज । विष्णुः ततः ब्रह्मणः तनुं महत्तत्त्वं सृष्टवान् ।',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:2},
    {id:9,chapter_id:4,verse_number:'1.3',content_sanskrit:'महत्तत्त्वादहङ्कारं ससर्ज शिवविग्रहम् । दैवान् देहान् मनः खानि खञ्च स त्रिविधात् ततः',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:3},
    {id:10,chapter_id:4,verse_number:'1.4',content_sanskrit:'आकाशादसृजद् वायुं वायोस्तेजो व्यजीजनत् । तेजसः सलिलं तस्मात् पृथिवीमसृजद् विभुः',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:4},
    {id:11,chapter_id:4,verse_number:'1.5',content_sanskrit:'ततः कूटस्थमसृजद् विधिं ब्रह्माण्डविग्रहम् । तस्मिंस्तु भगवान् भूयो भुवनानि चतुर्दश',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:5},
    {id:12,chapter_id:4,verse_number:'1.6',content_sanskrit:'तात्त्विकानथ देवान् को वैराजः पुरुषोऽसृजत् । तथैव परमान् हंसान् सनकादींश्च योगिनः',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:6},
    {id:13,chapter_id:4,verse_number:'1.7',content_sanskrit:'असुरान् दोषरूपानप्यविद्यां पाञ्चपर्वणीम् । वर्णाश्रमविशेषांश्च धर्मकॢप्तिं च सोऽसृजत्',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:7},
    {id:14,chapter_id:4,verse_number:'1.8',content_sanskrit:'मरीच्यत्र्यादयः पुत्रा अभवन् परमेष्ठिनः । मरीचेः कश्यपो जज्ञे वामनस्य पिता वटोः',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:8},
    {id:15,chapter_id:4,verse_number:'1.9',content_sanskrit:'प्रजाः सिसृक्षुर्विविधा अवहत् कश्यपो दितिम् । अदितिं च दनुं कद्रूं कीकसां विनतामपि',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:9},
    {id:16,chapter_id:4,verse_number:'1.10',content_sanskrit:'दित्यां ततोऽभवन् दैत्या अदित्यां च सुराः पुनः । दनौ तु दानवाः कद्रौ नागा नानाविषोल्वणाः',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:10},
    {id:17,chapter_id:4,verse_number:'1.11',content_sanskrit:'कीकसायां यातुधाना विनतायां तु पक्षिणः । महावीर्याः सुता आसन् कश्यपस्य महात्मनः',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:11},
    {id:18,chapter_id:4,verse_number:'1.12',content_sanskrit:'मानवानां पिता जज्ञे आदित्यात् कश्यपात्मजात् । मनुर्नाम महाप्राज्ञ एतन्मन्वन्तरेश्वरः',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:12},
    {id:19,chapter_id:4,verse_number:'1.13',content_sanskrit:'तस्य घ्राणादभूच्छ्रीमानिक्ष्वाकुः क्षुवतो मनोः । तपस्तप्त्वा विरिञ्चात् स लेभे रङ्गेश्वरं हरिम्',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:13},
    {id:20,chapter_id:4,verse_number:'1.14',content_sanskrit:'विकुक्षिः समभूत्तस्य पुरञ्जयपुरोगमाः । तदन्वये व्यजायन्त शूरा राजर्षयः परे',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:14},
    {id:21,chapter_id:4,verse_number:'1.15',content_sanskrit:'तस्मिन् वंशे दशरथो बभूवाऽत्यन्तभाग्यवान् । सोऽर्चन् वैमानिकं विष्णुं ररक्ष महतीं महीम्',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:15},
    {id:22,chapter_id:4,verse_number:'1.16',content_sanskrit:'तस्मिन् काले सुराः सर्वे महाराक्षसपीडिताः । दुग्धाब्धिशायिनं विष्णुं शरण्यं शरणं ययुः',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:16},
    {id:23,chapter_id:4,verse_number:'1.17',content_sanskrit:'त आदिष्टाः श्रियः पत्या जज्ञिरे क्षितिमण्डले । शाखामृगादिभावेन हनुमान् मारुतोऽभवत्',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:17},
    {id:24,chapter_id:4,verse_number:'1.18',content_sanskrit:'अभयाय सतां हत्यै राक्षसानां ततो हरिः । रामनामा दशरथात् कौसल्यायामजायत',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:18},
    {id:25,chapter_id:4,verse_number:'1.19',content_sanskrit:'ततो लक्ष्मणशत्रुघ्नौ सुमित्रायां बभूवतुः । कैकेय्यां भरतो जज्ञे सदा शुभरतो नृपात्',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:19},
    {id:26,chapter_id:4,verse_number:'1.20',content_sanskrit:'अभ्यवर्ध्यन्त सम्यञ्चः कुमाराः सुकुमारकाः । चतुर्भिश्चतुरैः पुत्रैः पितार्थैरिव निर्बभौ',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:20},
    {id:27,chapter_id:4,verse_number:'1.21',content_sanskrit:'विश्वामित्रस्ततो यज्ञनिघ्नतो राक्षसेश्वरान् । निहन्तुमनयन्नाथं रामदेवं सलक्ष्मणम्',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:21},
    {id:28,chapter_id:4,verse_number:'1.22',content_sanskrit:'अटव्यां ताटकां हत्वा स सिद्धाश्रममेयिवान् । विधूय यज्ञविघ्नांश्च विदेहविषयं ययौ',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:22},
    {id:29,chapter_id:4,verse_number:'1.23',content_sanskrit:'राजाद्यैः पूजितः सोऽथ विभज्य धनुरैश्वरम् । जानकीमलभिष्टोच्चैः स्तूयमानः सुरेश्वरैः',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:23},
    {id:30,chapter_id:4,verse_number:'1.24',content_sanskrit:'गच्छन् देव्या सहाऽयोध्यां सवसिष्ठः सहानुजः । कविकाव्ययुतज्योत्स्नाकान्तवत् स व्यरोचत',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:24},
    {id:31,chapter_id:4,verse_number:'1.25',content_sanskrit:'प्रविश्य नगरीं तत्र प्रवन्द्य पितरं तथा । मातॄश्च पूजितः पौरैः स रेमे सुखचित्तनुः',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:25},
    {id:32,chapter_id:4,verse_number:'1.26',content_sanskrit:"रामराज्याभिषेकाय दध्रे दशरथो मनः । निजघ्ने स तु कैकेय्या 'मत्सुतो गामवेदि'ति",padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:26},
    {id:33,chapter_id:4,verse_number:'1.27',content_sanskrit:'रामदेवः ततः सीतालक्ष्मणाभ्यां समन्वितः । वनं प्रति ययौ — राक्षसानपि हन्तुम्',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:27},
    {id:34,chapter_id:4,verse_number:'1.28',content_sanskrit:'ध्वस्तकर्णां विघोणां च कारयामास राक्षसीम् । लङ्केशभगिनीं रामो लक्ष्मणेनाऽनुजन्मना',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:28},
    {id:35,chapter_id:4,verse_number:'1.29',content_sanskrit:'रामविप्रकृतः क्रव्यात् प्रतिकर्मचिकीर्षया । आजगाम सहानीकः खरो दूषणसंयुतः',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:29},
    {id:36,chapter_id:4,verse_number:'1.30',content_sanskrit:'तान् जघान रमानाथो रामो राजीवलोचनः । लीलयैव परानन्दः सुरकार्यार्थसिद्धये',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:30},
    {id:37,chapter_id:4,verse_number:'1.31',content_sanskrit:'रामः पुरस्तात् परतोऽपि रामो रामः परं दिक्षु विदिक्षु रामः। रामैरनन्तैरिति विश्वरूपो निघ्नन्नरातीन् विरराज रामः',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:31},
    {id:38,chapter_id:5,verse_number:'2.1',content_sanskrit:'ततो दूरं गते रामे रावणः सह लक्ष्मणे । सीतेयं नीयत इति मत्वा निन्ये तदाकृतिम्',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:1},
    {id:39,chapter_id:5,verse_number:'2.2',content_sanskrit:'रामान्तिके स्थिता देवी न मन्दैः समदृश्यत ।रूपान्तरेण कैलासं गता नित्यावियोगिनी',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:2},
    {id:40,chapter_id:5,verse_number:'2.3',content_sanskrit:'नित्यं पश्यन्निजां देवीं पूर्णसन्तोषसंभृतः ।रामो न दृश्यते देवीत्यभूत्सङ्कटवानिव',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:3},
    {id:41,chapter_id:5,verse_number:'2.4',content_sanskrit:'प्रभञ्जनसुतः श्रीमाना-ऽऽञ्जनेयो निरञ्जनः ।ननाम भक्तिसंपूर्णो रामं राजीवलोचनम्',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:4},
    {id:42,chapter_id:5,verse_number:'2.5',content_sanskrit:'स वनान्तरमासाद्य रामः सुग्रीवमैक्षत ।तेन सख्यं समासाद्य निजघान तदग्रजम्',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:5},
    {id:43,chapter_id:5,verse_number:'2.6',content_sanskrit:'दक्षिणां ककुभं गत्वा हनूमानम्भसां निधिम् ।अतिलङ्घ्य ततो लङ्कां सीताकृतिमवैक्षत',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:6},
    {id:44,chapter_id:5,verse_number:'2.7',content_sanskrit:'रामाङ्गुलीयकं देव्यै दत्वा चूडामणिं तथा ।संगृह्य जानकीं भक्त्या नत्वाऽसावारुहत्तरुम्',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:7},
    {id:45,chapter_id:5,verse_number:'2.8',content_sanskrit:'वनं विशकलय्योच्चैः राक्षसानक्षपूर्वकान् ।निहत्य मारुतिर्लङ्कामदहत्पुच्छवह्निना',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:8},
    {id:46,chapter_id:5,verse_number:'2.9',content_sanskrit:'असङ्ख्यान् राक्षसान् हत्वा कुम्भकर्णं च रावणम् ।रामो विभीषणं रक्षःसाम्राज्ये सोऽभ्यषेचयत्',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:9},
    {id:47,chapter_id:5,verse_number:'2.10',content_sanskrit:'हनुमत्प्रमुखैः सार्धं देव्या च पुरुषोत्तमः ।आरुह्य पुष्पकं रामो जगाम नगरीं निजाम्',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:10},
    {id:48,chapter_id:5,verse_number:'2.11',content_sanskrit:'सत्येन भक्त्या च विरक्तिमत्या मत्या च धृत्या च तपस्यया च । हा राम रामेति सदोपगायन् । प्राभञ्जनिः किंपुरुषेषु रेमे',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:11},
    {id:49,chapter_id:6,verse_number:'3.1',content_sanskrit:'हिमांशोरत्रिपुत्रस्य बुधो नाम सुतोऽभवत् ।पुरूरवा महाराजः तस्य पुत्रो व्यजायत',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:1},
    {id:50,chapter_id:6,verse_number:'3.2',content_sanskrit:'तत्र प्रादुरभूद्देवः परमात्मा सनातनः ।दुंपत्योरनयोराशाः पूरयन्त्सुरकार्यवान्',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:2},
    {id:51,chapter_id:6,verse_number:'3.3',content_sanskrit:'ज्ञानानन्दतनुं श्यामं शंखचक्रगदाधरम् ।व्यक्तमात्रं हरिं दृष्ट्वा तुष्टावानकदुन्दुभिः',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:3},
    {id:52,chapter_id:6,verse_number:'3.4',content_sanskrit:'स पालयन्गोपकबालवृन्दैर्बलेन साकं पशुवत्सयूथान् । निहत्य वत्सासुरमादिदेवो बकं च गोपालकतामवाप',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:4},
    {id:53,chapter_id:7,verse_number:'4.1',content_sanskrit:'कृष्णायाः कालियं त्यक्त्वा पीत्वा दावाग्निमुल्बणम् ।स विषद्रुममुच्छिद्य दैत्यान्गोवपुषोहनत्',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:1},
    {id:54,chapter_id:7,verse_number:'4.2',content_sanskrit:'मञ्चस्थं मातुलं कंसं मूर्धि संगृह्य माधवः ।निपात्य निष्पिपेषोच्चैः धरण्यां स ममार च',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:2},
    {id:55,chapter_id:7,verse_number:'4.3',content_sanskrit:'दौत्येन वञ्चयित्वारीन् प्रायो भीमेन सर्वराः ।जघान कृतसारथ्यो जिष्णोः पार्थानपाद्धरिः',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:3},
    {id:56,chapter_id:7,verse_number:'4.4',content_sanskrit:'अथाभिमन्योस्तनयः परीक्षित् राजासवज्रो जगतीं विजित्य । सर्वात्मभावं परमे दधानः सम्राजलक्ष्मीमुपलभ्य रेमे',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:4},
    {id:57,chapter_id:8,verse_number:'5.1',content_sanskrit:'ततः परमहंसा ये कृष्णभीमानुशिक्षिताः ।व्यासाश्रयादत्रिजाद्या वेदशास्त्राण्यवर्तयन्',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:1},
    {id:58,chapter_id:8,verse_number:'5.2',content_sanskrit:'दुर्धर्षा भीमसेनो नः कृष्णोऽप्यत्यन्तदुःसहः ।ताभ्यां निरीक्षिता दैत्या मृत्युं यान्ति न संशयः',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:2},
    {id:59,chapter_id:8,verse_number:'5.3',content_sanskrit:'वेदोऽप्रमाणमित्युक्त्वा बुद्धस्तानप्यमोहयत् ।बौद्धशास्त्रं ततस्तेनुरज्ञात्वा तन्मतं परम्',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:3},
    {id:60,chapter_id:8,verse_number:'5.4',content_sanskrit:'वह्निप्रवेशग्लहया कुमारोवितण्डया माध्यमिकान्निगृह्य ।नष्टायुषोऽपह्नवतः श्रुतीनामह्नाय वह्नौ गमयाञ्चकार',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:4},
    {id:61,chapter_id:9,verse_number:'6.1',content_sanskrit:'उदजृम्भन्त वेदान्ता धर्मा वर्णाश्रमोचिताः ।ब्राह्मणास्तुतुषुर्यज्ञाः प्रावर्तन्त महीतले',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:1},
    {id:62,chapter_id:9,verse_number:'6.2',content_sanskrit:'सूत्रैः प्रपञ्चयाञ्चक्रे मायावी सौगतं मतम् ।शून्यं ब्रह्मपदेनोक्त्वा तथाविद्येति संवृतिम्',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:2},
    {id:63,chapter_id:10,verse_number:'7.1',content_sanskrit:'ततः स विश्वरूपस्य गृहं वव्राज सङ्करः ।किमप्यबोधतापाङ्गवीक्षया तत्प्रियाऽमुना',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:1},
    {id:64,chapter_id:10,verse_number:'7.2',content_sanskrit:'तोटकः पद्मपादश्च ज्ञानोच्चो बीजभुक तथा ।इत्येते मायिनः शिष्या आसंश्चत्वारः',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:2},
    {id:65,chapter_id:10,verse_number:'7.3',content_sanskrit:'हा हा बीजादैष गूढो मदीयो भूयस्तात व्यापृतोऽहं गुणेषु । किं वास्माकं भावि का वा गतिः स्यादित्थं जल्पन्नाप दीर्घा स निद्राम्',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:3},
    {id:66,chapter_id:11,verse_number:'8.1',content_sanskrit:'अथासुराणां श्रुतिदूषकाणांउत्सादनायार्थयतः सुरेन्द्रान् ।आनन्दयन् श्रीदयिताज्ञयेशःसञ्जीवनात्मावततार भूमौ',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:1},
    {id:67,chapter_id:11,verse_number:'8.2',content_sanskrit:'प्रवर्तिता या सनकादिभिः पुराततः परस्तात्परतीर्थशिष्यकैः ।हरेरुपास्तिं स्वगुरुप्रसादितांमध्वाय भक्त्योपदिदेश हंसराट्',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:2},
    {id:68,chapter_id:11,verse_number:'8.3',content_sanskrit:'दस्योर्मणिमत उदितं दुर्भाष्यं व्यस्य मध्व आराध्यः ।वेदान्तसूत्रभाष्यं सकलश्रुतितर्कबृंहितं चक्रे',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:3},
    {id:69,chapter_id:11,verse_number:'8.4',content_sanskrit:'तार्किकद्विरदपुञ्जभञ्जने मध्वकेसरिणि हन्त जृम्भिते । सङ्कटेन च भयेन मायिगोमायवो दशदिशः पराद्रवन्',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:4},
    {id:70,chapter_id:11,verse_number:'8.5',content_sanskrit:'तार्किकद्विरदपुञ्जभञ्जने मध्वकेसरिणि हन्त जृम्भिते । सङ्कटेन च भयेन मायिगोमायवो दशदिशः पराद्रवन्',padaccheda:'',anvaya:'',meaning_sanskrit:'',meaning_english:'',audio_url:null,display_order:5},
];
verses.forEach(r => insertVerse.run(r));

// ── Commentaries ──────────────────────────────────────────────────────────────
const insertComm = db.prepare(`
    INSERT OR REPLACE INTO commentaries (id,verse_id,commentary_type,author,content)
    VALUES (@id,@verse_id,@commentary_type,@author,@content)
`);
const commentaries = [
    {id:1,verse_id:1,commentary_type:'काशिकावृत्तिः',author:'वामन-जयादित्यौ',content:'आदादय एङन्ता वृद्धिसंज्ञाः स्युः। आदिति निर्दिष्टं प्रकृतिग्रहणं तदन्तविधिं प्रयोजयति - आकारान्ता वृद्धिः। ऐचिति निर्दिष्टं एचन्ता वृद्धिः।'},
    {id:2,verse_id:2,commentary_type:'काशिकावृत्तिः',author:'वामन-जयादित्यौ',content:'अकारादय एङन्ताः गुणसंज्ञका भवन्ति। पूर्ववदत्र अकारान्तो गुणः, एङन्तश्च।'},
    {id:3,verse_id:7,commentary_type:'शब्दार्थः',author:'ಕನ್ನಡ ಅರ್ಥ',content:'{"type":"word_meanings","rows":[["अहं","ನಾನು (ಗ್ರಂಥಕರ್ತೃಗಳಾದ ಶ್ರೀನಾರಾಯಣ ಪಂಡಿತಾಚಾರ್ಯರು)."],["आनन्दज्ञानदेहं","ಸುಖವು ಅರಿವು, ಇವುಗಳನ್ನೇ ಶರೀರವನ್ನಾಗಿ ಹೊಂದಿರುವ"],["श्रियः","ಲಕ್ಷ್ಮೀದೇವಿಯರಿಗೆ"],["पतिं","ಪಾಲಕನಾದ"],["श्रीमदानन्दतीर्थार्यवल्लभं","ಕಾಂತಿಸಂಪನ್ನರಾದ ಆನಂದತೀರ್ಥರೆಂಬ ಜ್ಞಾನಿಶ್ರೇಷ್ಠರಿಗೆ ಪ್ರಿಯನಾದ"],["परं","(ದೇಶ,ಕಾಲ,ಗುಣಗಳಿಂದ) ಪೂರ್ಣನಾದ"],["अक्षरं","(ಚತುರ್ವಿಧ) ನಾಶರಹಿತನಾದ"],["गोविन्दं","ವೇದಾದಿ ವಾಗ್ರಾಶಿಗಳಿಂದ ತಿಳಿಯಲ್ಪಡುವ ನಾರಾಯಣನನ್ನು"],["वन्दे","ನಮಿಸಿ ಕೊಂಡಾಡುತ್ತೇನೆ."]]}'},
    {id:4,verse_id:7,commentary_type:'व्याकरणम्',author:'शब्दविश्लेषणम्',content:'{"type":"grammar","rows":[["वन्दे","वदि अभिवादनस्तुत्योः — लट्, उत्तमपुरुष, एकवचन (आत्मनेपद)"],["गोविन्दं","गोविन्द-शब्द, अकारान्त, पुँल्लिङ्ग, द्वितीया, एकवचन । गोभिः विन्दते इति गोविन्दः ।"],["आनन्दज्ञानदेहं","देह-शब्द, अकारान्त, पुँल्लिङ्ग, द्वितीया, एकवचन । आनन्दज्ञाने एव देहः यस्य सः ।"],["पतिं","पति-शब्द, इकारान्त, पुँल्लिङ्ग, द्वितीया, एकवचन । पाति इति पतिः ।"],["श्रियः","श्री-शब्द, ईकारान्त, स्त्रीलिङ्ग, षष्ठी, एकवचन । श्रयते इति श्रीः ।"],["परं","पर-शब्द, अकारान्त, पुँल्लिङ्ग, द्वितीया, एकवचन ।"],["अक्षरं","अक्षर-शब्द, अकारान्त, पुँल्लिङ्ग, द्वितीया, एकवचन । न क्षरति इति अक्षरः ।"]]}'},
    {id:5,verse_id:7,commentary_type:'धातुः',author:'वदिँ अभिवादनस्तुत्योः',content:'{"type":"dhatu","header":"वदिँ अभिवादनस्तुत्योः","tables":[{"lakara":"१. वर्तमाने लट्","rows":[["वन्दते","वन्देते","वन्दन्ते","प्र०"],["वन्दसे","वन्देथे","वन्दध्वे","म०"],["वन्दे","वन्दावहे","वन्दामहे","उ०"]]},{"lakara":"२. अनद्यतन-परोक्ष-भूते लिट्","rows":[["ववन्दे","ववन्दाते","ववन्दिरे","प्र०"],["ववन्दिषे","ववन्दाथे","ववन्दिध्वे","म०"],["ववन्दे","ववन्दिवहे","ववन्दिमहे","उ०"]]}]}'},
    {id:6,verse_id:8,commentary_type:'शब्दार्थः',author:'ಕನ್ನಡ ಅರ್ಥ',content:'{"type":"word_meanings","rows":[["प्रकृतेः परः","ಪ್ರಕೃತಿಯ ದೆಸೆಯಿಂದ ವಿಲಕ್ಷಣನಾದ"],["भगवान्","ಷಡ್ಗುಣಣೈಶ್ವರ್ಯ ಪೂರ್ಣನಾದ ಶ್ರೀಹರಿಯು"],["आदौ","ಸೃಷ್ಟಿಯ ಆದಿಯಲ್ಲಿ"],["त्रीन् गुणान्","ಸತ್ವ, ರಜಸ್ಸು, ತಮಸ್ಸು — ಮೂರು ಗುಣಗಳನ್ನು"],["ससर्ज","ಸೃಷ್ಟಿ ಮಾಡಿದ್ದನು."],["विष्णुः","ವ್ಯಾಪ್ತನಾದ ಶ್ರೀಹರಿಯು"],["ततः","ಆ ಮೂರು ಗುಣಗಳ ದೆಸೆಯಿಂದ"],["ब्रह्मणः तनुं महत्तत्त्वं","ಚತುರ್ಮುಖ ಬ್ರಹ್ಮ ದೇವರ ಶರೀರವಾದ ಮಹತ್ ತತ್ತ್ವವನ್ನು"],["सृष्टवान्","ಸೃಷ್ಟಿ ಮಾಡಿದ್ದನು."]]}'},
    {id:7,verse_id:8,commentary_type:'धातुः',author:'सृजँ विसर्गे',content:'{"type":"dhatu","header":"सृजँ विसर्गे","tables":[{"lakara":"२. अनद्यतन-परोक्ष-भूते लिट्","rows":[["ससर्ज","ससृजतुः","ससृजुः","प्र०"],["ससर्जिथ / सस्रष्ठ","ससृजथुः","ससृज","म०"],["ससर्ज","ससृजिव","ससृजिम","उ०"]]}]}'},
    {id:8,verse_id:9,commentary_type:'शब्दार्थः',author:'ಕನ್ನಡ ಅರ್ಥ',content:'{"type":"word_meanings","rows":[["सः","ಆ ವಿಷ್ಣುವು"],["महत्तत्त्वात्","ಮಹತತ್ತ್ವದ ದೆಸೆಯಿಂದ"],["शिवविग्रहं अहङ्कारं","ರುದ್ರ ದೇವರಿಗೆ ಶರೀರವಾದ ಅಹಂಕಾರ ತತ್ತ್ವವನ್ನು ಸೃಷ್ಟಿ ಮಾಡಿದ್ದನು"],["त्रिविधात् ततः","ವೈಕಾರಿಕ-ತೈಜಸ-ತಾಮಸ ಮೂರು ಪ್ರಭೇದ ಹೊಂದಿರುವ ಆ ಅಹಂಕಾರದ ದೆಸೆಯಿಂದ"],["दैवान् देहान्, मनः, खानि, खं च","ದೇವತೆಗಳ ಶರೀರಗಳನ್ನು, ಮನಸ್ ತತ್ತ್ವವನ್ನು, ದಶ ಇಂದ್ರಿಯಗಳನ್ನು, ಆಕಾಶ ತತ್ತ್ವವನ್ನೂ (ಸೃಷ್ಟಿ ಮಾಡಿದ್ದನು)"]]}'},
    {id:9,verse_id:9,commentary_type:'धातुः',author:'जनीँ प्रादुर्भावे',content:'{"type":"dhatu","header":"जनीँ प्रादुर्भावे (वि-पूर्वक)","tables":[{"lakara":"९. भूते लुङ् (व्यजीजनत् प्रयोगः)","rows":[["व्यजीजनत्","व्यजीजनताम्","व्यजीजनन्","प्र०"],["व्यजीजनः","व्यजीजनतम्","व्यजीजनत","म०"],["व्यजीजनम्","व्यजीजनाव","व्यजीजनाम","उ०"]]}]}'},
    {id:10,verse_id:38,commentary_type:'शब्दार्थः',author:'ಕನ್ನಡ ಅರ್ಥ',content:'{"type":"word_meanings","rows":[["ततः","ಆ ಖರದೂಷಣಾದಿ ದೈತ್ಯರ ಸಂಹಾರದ ನಂತರದಲ್ಲಿ"],["रामे दूरं गते (सति)","ರಾಮದೇವರು ದೂರ ಹೋಗುತ್ತಿರಲು"],["सहलक्ष्मणे (सति)","ಲಕ್ಷ್ಮಣನಿಂದ ಕೂಡಿರಲು"],["रावणः","ರಾವಣನು"],["\'इयं सीता नीयत\' इति मत्वा","ʼಇವಳು ಸೀತೆಯು ಒಯ್ಯಲ್ಪಡುತ್ತಿದ್ದಾಳೆʼ ಎಂದು ತಿಳಿದು"],["तदाकृतिं निन्ये","ಆ ಸೀತಾದೇವಿಯ ಆಕೃತಿಯನ್ನು ಹೊತ್ತೊಯ್ದಿದ್ದನು."]]}'},
    {id:11,verse_id:41,commentary_type:'शब्दार्थः',author:'ಕನ್ನಡ ಅರ್ಥ',content:'{"type":"word_meanings","rows":[["प्रभञ्जनसुतः","ಮುಖ್ಯಪ್ರಾಣದೇವರ ಮಗನಾದ"],["श्रीमान् आञ्जनेयः","ಕಾಂತಿ ಸಂಪನ್ನರಾದ ಅಂಜನಾದೇವಿಯ ಪುತ್ರರಾದ ಹನುಮಂತ ದೇವರು"],["निरञ्जनः","ದೋಷ ದೂರರಾದ"],["भक्तिसंपूर्णः (सन्)","ಜ್ಞಾನಪೂರ್ವಕ ಪ್ರೇಮದಿಂದ ತುಂಬಿದವರಾಗಿ"],["राजीवलोचनं रामं ननाम","ಕಮಲ-ಕಣ್ಣಿನ ರಾಮ ದೇವರನ್ನು ನಮಸ್ಕರಿಸಿದರು."]]}'},
    {id:12,verse_id:48,commentary_type:'शब्दार्थः',author:'ಕನ್ನಡ ಅರ್ಥ',content:'{"type":"word_meanings","rows":[["प्राभञ्जनिः","ಮುಖ್ಯಪ್ರಾಣದೇವರ ಮಕ್ಕಳಾದ ಹನುಮಂತ ದೇವರು"],["सत्येन, विरक्तिमत्या भक्त्या, मत्या, धृत्या, तपस्यया","ಸತ್ಯವಚನ, ವೈರಾಗ್ಯದ ಭಕ್ತಿ, ಮನನ ಶಕ್ತಿ, ಧಾರಣ ಶಕ್ತಿ, ತಪಸ್ಸಿನಿಂದ"],["हा राम रामेति सदा उपगायन् (सन्)","ʼಹಾ ರಾಮ ರಾಮʼ ಎಂದು ಯಾವಾಗಲೂ ಗಾನ ಮಾಡುವವರಾಗಿ"],["किंपुरुषेषु रेमे","ಕಿಂಪುರುಷ ಖಂಡಗಳಲ್ಲಿ ವಿಹರಿಸಿದ್ದರು."]]}'},
];
commentaries.forEach(r => insertComm.run(r));

db.close();
console.log('database.sqlite created and seeded successfully.');
