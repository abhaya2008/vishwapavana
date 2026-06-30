import { Link } from 'react-router-dom';

export default function TextCard({ text }) {
    const { id, name_sanskrit, name_english, author, has_audio } = text;

    return (
        <Link to={`/text/${id}`} className="category-card">
            <div className="card-icon">
                {has_audio ? '🎵' : '📖'}
            </div>
            <h3 className="card-title">॥ {name_sanskrit} ॥</h3>
            {name_english && <p className="card-subtitle">{name_english}</p>}
            {author && <p className="card-subtitle mt-sm">रचयिता: {author}</p>}
        </Link>
    );
}
