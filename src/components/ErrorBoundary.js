'use client';

import { Component } from 'react';

/**
 * React Error Boundary — catches render-time errors and shows a fallback UI
 * instead of a blank white screen in production.
 */
export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (!this.state.hasError) return this.props.children;

        return (
            <div style={{
                minHeight: '60vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2rem',
                textAlign: 'center',
                gap: '1rem',
            }}>
                <div style={{ fontSize: '3rem' }}>⚠️</div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
                    Something went wrong
                </h2>
                <p style={{ opacity: 0.7, maxWidth: 420, margin: 0 }}>
                    An unexpected error occurred. Please try refreshing the page. If the
                    problem persists, contact support.
                </p>
                {process.env.NODE_ENV === 'development' && this.state.error && (
                    <pre style={{
                        background: 'rgba(255,0,0,0.1)',
                        border: '1px solid rgba(255,0,0,0.3)',
                        borderRadius: 8,
                        padding: '1rem',
                        fontSize: '0.75rem',
                        textAlign: 'left',
                        maxWidth: '100%',
                        overflowX: 'auto',
                    }}>
                        {this.state.error.toString()}
                    </pre>
                )}
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button
                        onClick={this.handleReset}
                        style={{
                            padding: '0.6rem 1.4rem',
                            borderRadius: 8,
                            border: '1px solid currentColor',
                            background: 'transparent',
                            cursor: 'pointer',
                            fontWeight: 600,
                        }}
                    >
                        Try again
                    </button>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            padding: '0.6rem 1.4rem',
                            borderRadius: 8,
                            border: 'none',
                            background: 'var(--accent, #6366f1)',
                            color: '#fff',
                            cursor: 'pointer',
                            fontWeight: 600,
                        }}
                    >
                        Reload page
                    </button>
                </div>
            </div>
        );
    }
}
