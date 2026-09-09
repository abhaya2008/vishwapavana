import { Link } from 'react-router-dom';

export default function TextCard({ text }) {
    const { id, name_sanskrit, author } = text;

    return (
        <Link to={`/text/${id}`} className="category-card">
            <h3 className="card-title">{name_sanskrit}</h3>
            {author && <p className="card-subtitle mt-sm">रचयिता: {author}</p>}
        </Link>
    );
}
