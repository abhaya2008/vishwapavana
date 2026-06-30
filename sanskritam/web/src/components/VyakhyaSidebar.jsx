export default function VyakhyaSidebar({ isOpen, onClose, verse, commentaries }) {
    if (!verse) return null;

    return (
        <>
            {/* Overlay */}
            {isOpen && (
                <div
                    className="nav-drawer-overlay open"
                    onClick={onClose}
                />
            )}

            {/* Sidebar */}
            <aside className={`vyakhya-sidebar ${isOpen ? 'open' : ''}`}>
                <div className="vyakhya-header">
                    <h2 className="vyakhya-title">॥ व्याख्या ॥</h2>
                    <button
                        className="vyakhya-close"
                        onClick={onClose}
                        aria-label="Close sidebar"
                    >
                        ✕
                    </button>
                </div>

                <div className="vyakhya-content">
                    {/* Original Verse */}
                    <section className="mb-xl">
                        <h3 className="sanskrit-title mb-md">मूलम्</h3>
                        <p className="sanskrit">{verse.content_sanskrit}</p>
                    </section>

                    {/* Commentaries */}
                    {commentaries.map((commentary, index) => (
                        <section key={index} className="mb-xl">
                            <h3 className="sanskrit-title mb-md">
                                {commentary.commentary_type}
                                {commentary.author && ` - ${commentary.author}`}
                            </h3>
                            <div className="sanskrit">{commentary.content}</div>
                        </section>
                    ))}

                    {commentaries.length === 0 && (
                        <p className="text-center" style={{ color: 'var(--color-text-light)' }}>
                            व्याख्या उपलब्धं नास्ति।
                            <br />
                            (No commentary available)
                        </p>
                    )}
                </div>
            </aside>
        </>
    );
}
