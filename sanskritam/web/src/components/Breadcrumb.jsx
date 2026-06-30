import { Link } from 'react-router-dom';

export default function Breadcrumb({ items }) {
    return (
        <nav className="breadcrumb">
            <Link to="/" className="breadcrumb-link">गृहम्</Link>

            {items.map((item, index) => (
                <span key={index}>
                    <span className="breadcrumb-separator"> › </span>
                    {index === items.length - 1 ? (
                        <span className="breadcrumb-current">{item.label}</span>
                    ) : (
                        <Link to={item.path} className="breadcrumb-link">
                            {item.label}
                        </Link>
                    )}
                </span>
            ))}
        </nav>
    );
}
