import { useState } from 'react';
import VyakhyaSidebar from './VyakhyaSidebar';

export default function VerseCard({ verse, commentaries = [] }) {
    const [showPadaccheda, setShowPadaccheda] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const {
        verse_number,
        content_sanskrit,
        padaccheda,
        anvaya,
        meaning_sanskrit,
        meaning_english
    } = verse;

    return (
        <>
            <article className="verse-card">
                <span className="verse-number">{verse_number}</span>

                {/* Main verse content */}
                <div className="verse-content">
                    {showPadaccheda && padaccheda ? padaccheda : content_sanskrit}
                </div>

                {/* Toggle for padaccheda */}
                {padaccheda && (
                    <div className="toggle-container">
                        <span className="toggle-label">शब्दच्छेदः (Word separation)</span>
                        <button
                            className={`toggle ${showPadaccheda ? 'active' : ''}`}
                            onClick={() => setShowPadaccheda(!showPadaccheda)}
                            aria-label="Toggle word separation"
                        />
                    </div>
                )}

                {/* Anvaya section */}
                {anvaya && (
                    <div className="verse-meaning">
                        <div className="meaning-label">अन्वयः (Word Order)</div>
                        <p className="meaning-text">{anvaya}</p>
                    </div>
                )}

                {/* Sanskrit meaning */}
                {meaning_sanskrit && (
                    <div className="verse-meaning mt-md">
                        <div className="meaning-label">अर्थः (Sanskrit Meaning)</div>
                        <p className="meaning-text">{meaning_sanskrit}</p>
                    </div>
                )}

                {/* English meaning */}
                {meaning_english && (
                    <div className="verse-meaning mt-md">
                        <div className="meaning-label">Meaning (English)</div>
                        <p className="meaning-text">{meaning_english}</p>
                    </div>
                )}

                {/* Vyakhya button */}
                <div className="verse-actions">
                    {commentaries.length > 0 && (
                        <button
                            className="btn btn-primary"
                            onClick={() => setSidebarOpen(true)}
                        >
                            व्याख्या: (Commentary)
                        </button>
                    )}
                </div>
            </article>

            <VyakhyaSidebar
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                verse={verse}
                commentaries={commentaries}
            />
        </>
    );
}
