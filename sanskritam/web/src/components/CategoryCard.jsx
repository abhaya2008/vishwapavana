import { Link } from 'react-router-dom';

export default function CategoryCard({ category, isSubcategory = false }) {
    const { id, name_sanskrit } = category;

    const cardClass = isSubcategory ? 'subcategory-card' : 'category-card';
    const titleClass = isSubcategory ? 'subcategory-title' : 'card-title';

    return (
        <Link to={`/category/${id}`} className={cardClass}>
            <h3 className={titleClass}>{name_sanskrit}</h3>
        </Link>
    );
}
