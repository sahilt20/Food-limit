import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import styles from './FeatureFlow.module.css';

export default function FeatureFlow({ title = 'Connected workflow', description, items = [] }) {
    if (!items.length) return null;

    return (
        <section className={styles.flow}>
            <div className={styles.header}>
                <div>
                    <p className={styles.eyebrow}>Flow</p>
                    <h2 className={styles.title}>{title}</h2>
                </div>
                {description && <p className={styles.description}>{description}</p>}
            </div>

            <div className={styles.grid}>
                {items.map((item) => {
                    const Icon = item.icon;
                    const stateClass =
                        item.state === 'current'
                            ? styles.cardCurrent
                            : item.state === 'done'
                                ? styles.cardDone
                                : styles.cardNext;

                    return (
                        <Link key={`${item.href}-${item.label}`} href={item.href} className={`${styles.card} ${stateClass}`}>
                            <div className={styles.cardTop}>
                                <div className={styles.iconWrap}>
                                    {Icon && <Icon size={18} />}
                                </div>
                                <span className={styles.badge}>
                                    {item.state === 'current' ? 'Current' : item.state === 'done' ? 'Done' : 'Next'}
                                </span>
                            </div>
                            <div className={styles.cardBody}>
                                <span className={styles.label}>{item.label}</span>
                                {item.description && <p className={styles.copy}>{item.description}</p>}
                            </div>
                            <span className={styles.cta}>
                                Open
                                <ArrowRight size={14} />
                            </span>
                        </Link>
                    );
                })}
            </div>
        </section>
    );
}
