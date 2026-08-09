import { Link } from 'react-router-dom';

// 8 top-level categories flank the Vedavyāsa video in a 2x2 cluster on each
// side, each swaying gently ("wind") via a staggered CSS animation.
// Positions are percentages of the wrapper so they stay put across widths.
const LEFT_POS = [
    { top: '14%', left: '6%' },
    { top: '14%', left: '27%' },
    { top: '37%', left: '7%' },
    { top: '37%', left: '24%' },
];

const RIGHT_POS = [
    { top: '14%', left: '73%' },
    { top: '14%', left: '94%' },
    { top: '37%', left: '76%' },
    { top: '37%', left: '93%' },
];

const SWAY_CLASSES = ['sway-a', 'sway-b', 'sway-c', 'sway-d'];

export default function HimalayaTree({ categories }) {
    const slots = categories.slice(0, 8);
    const leftSlots = slots.filter((_, i) => i % 2 === 0);
    const rightSlots = slots.filter((_, i) => i % 2 === 1);

    return (
        <div className="veda-tree-wrap">
            <div className="veda-tree-frame">
                <video
                    className="veda-tree-video"
                    src={`${import.meta.env.BASE_URL}media/vedavyasa.mp4`}
                    autoPlay
                    loop
                    muted
                    playsInline
                    aria-hidden="true"
                />
            </div>

            {leftSlots.map((cat, i) => (
                <Link
                    key={cat.id}
                    to={`/category/${cat.id}`}
                    className={`veda-tree-badge ${SWAY_CLASSES[i % SWAY_CLASSES.length]}`}
                    style={{ top: LEFT_POS[i].top, left: LEFT_POS[i].left }}
                >
                    {cat.name_sanskrit}
                </Link>
            ))}

            {rightSlots.map((cat, i) => (
                <Link
                    key={cat.id}
                    to={`/category/${cat.id}`}
                    className={`veda-tree-badge ${SWAY_CLASSES[i % SWAY_CLASSES.length]}`}
                    style={{ top: RIGHT_POS[i].top, left: RIGHT_POS[i].left }}
                >
                    {cat.name_sanskrit}
                </Link>
            ))}
        </div>
    );
}
