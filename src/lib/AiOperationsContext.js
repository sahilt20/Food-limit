'use client';

import { createContext, useContext, useState, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabaseClient';

const AiOperationsContext = createContext(null);

const CONTENT_LABELS = {
    recipes: 'Recipes',
    meal_plan: 'Meal Plan',
    diet_plan: 'Diet Plan',
    recommendations: 'Recommendations',
};

export function AiOperationsProvider({ children }) {
    const pendingOps = useRef(new Map());
    const [completedResults, setCompletedResults] = useState({});
    const [runningOps, setRunningOps] = useState({});
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((message, type = 'success') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 5000);
    }, []);

    const dismissToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const startOperation = useCallback(async (contentType, fetchFn, inputParams) => {
        if (pendingOps.current.has(contentType)) {
            return pendingOps.current.get(contentType);
        }

        const promise = (async () => {
            setRunningOps(prev => ({ ...prev, [contentType]: true }));

            try {
                const result = await fetchFn();

                if (result?.data) {
                    setCompletedResults(prev => ({
                        ...prev,
                        [contentType]: {
                            content: result.data,
                            inputParams,
                            provider: result.provider,
                            timestamp: Date.now(),
                        }
                    }));

                    // Persist to database (fire-and-forget)
                    try {
                        const supabase = createClient();
                        const { data: { user } } = await supabase.auth.getUser();
                        if (user) {
                            await supabase
                                .from('ai_generated_content')
                                .upsert({
                                    user_id: user.id,
                                    content_type: contentType,
                                    content: result.data,
                                    input_params: inputParams,
                                    provider: result.provider || 'unknown',
                                }, { onConflict: 'user_id,content_type' });
                        }
                    } catch (dbErr) {
                        console.error(`Failed to persist ${contentType}:`, dbErr);
                    }

                    addToast(`${CONTENT_LABELS[contentType] || contentType} ready!`, 'success');
                }
                return result;
            } catch (err) {
                addToast(`Failed to generate ${CONTENT_LABELS[contentType] || contentType}`, 'error');
                throw err;
            } finally {
                pendingOps.current.delete(contentType);
                setRunningOps(prev => {
                    const next = { ...prev };
                    delete next[contentType];
                    return next;
                });
            }
        })();

        pendingOps.current.set(contentType, promise);
        return promise;
    }, [addToast]);

    const getCompleted = useCallback((contentType) => {
        return completedResults[contentType] || null;
    }, [completedResults]);

    const clearCompleted = useCallback((contentType) => {
        setCompletedResults(prev => {
            const next = { ...prev };
            delete next[contentType];
            return next;
        });
    }, []);

    const isRunning = useCallback((contentType) => {
        return !!runningOps[contentType];
    }, [runningOps]);

    return (
        <AiOperationsContext.Provider value={{
            startOperation,
            getCompleted,
            clearCompleted,
            isRunning,
        }}>
            {children}
            {/* Toast notifications */}
            {toasts.length > 0 && (
                <div style={{
                    position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
                    display: 'flex', flexDirection: 'column', gap: 10,
                    pointerEvents: 'none',
                }}>
                    {toasts.map(t => (
                        <div key={t.id} onClick={() => dismissToast(t.id)} style={{
                            padding: '14px 22px',
                            borderRadius: 14,
                            background: t.type === 'error'
                                ? 'linear-gradient(135deg, rgba(239,68,68,0.95), rgba(220,38,38,0.95))'
                                : 'linear-gradient(135deg, rgba(0,212,170,0.95), rgba(0,180,140,0.95))',
                            color: '#fff',
                            fontSize: '0.9rem',
                            fontWeight: 600,
                            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                            backdropFilter: 'blur(12px)',
                            cursor: 'pointer',
                            pointerEvents: 'auto',
                            animation: 'fadeInUp 0.3s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                        }}>
                            <span>{t.type === 'error' ? '⚠️' : '✅'}</span>
                            <span>{t.message}</span>
                        </div>
                    ))}
                </div>
            )}
        </AiOperationsContext.Provider>
    );
}

export function useAiOperations() {
    const ctx = useContext(AiOperationsContext);
    if (!ctx) throw new Error('useAiOperations must be used within AiOperationsProvider');
    return ctx;
}
