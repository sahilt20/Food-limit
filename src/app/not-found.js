import Link from 'next/link';

export const metadata = {
    title: 'Page Not Found',
};

export default function NotFound() {
    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            textAlign: 'center',
            gap: '1.25rem',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            background: 'var(--bg, #0a0a0f)',
            color: 'var(--text, #e5e7eb)',
        }}>
            <div style={{ fontSize: '5rem', lineHeight: 1 }}>🥦</div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: 0 }}>404 — Page Not Found</h1>
            <p style={{ opacity: 0.6, maxWidth: 380, margin: 0, lineHeight: 1.6 }}>
                Looks like this page got lost in the grocery aisle. Let&apos;s get you back on track.
            </p>
            <Link
                href="/dashboard"
                style={{
                    marginTop: '0.5rem',
                    padding: '0.75rem 2rem',
                    borderRadius: 10,
                    background: '#6366f1',
                    color: '#fff',
                    textDecoration: 'none',
                    fontWeight: 700,
                    fontSize: '1rem',
                }}
            >
                Go to Dashboard
            </Link>
        </div>
    );
}
