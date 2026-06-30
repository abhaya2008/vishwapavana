import { Link } from 'react-router-dom';

export default function CategoryCard({ category, isSubcategory = false }) {
    const { id, name_sanskrit, name_english, icon, description } = category;

    // Use different styling for main categories vs subcategories
    const cardClass = isSubcategory ? 'subcategory-card' : 'category-card';
    const titleClass = isSubcategory ? 'subcategory-title' : 'card-title';

    return (
        <Link to={`/category/${id}`} className={cardClass}>
            {!isSubcategory && (
                <div className="card-icon">{icon || '📜'}</div>
            )}
            <h3 className={titleClass}>
                {isSubcategory ? name_sanskrit : `॥ ${name_sanskrit} ॥`}
            </h3>
            {!isSubcategory && name_english && (
                <p className="card-subtitle">{name_english}</p>
            )}
            {!isSubcategory && description && (
                <p className="card-subtitle mt-sm">{description}</p>
            )}
        </Link>
    );
}
