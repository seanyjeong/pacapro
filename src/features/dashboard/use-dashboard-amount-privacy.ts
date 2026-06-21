import { useCallback, useEffect, useState } from 'react';

const DASHBOARD_AMOUNT_UNLOCK_MS = 5 * 60 * 1000;
const DASHBOARD_AMOUNT_UNLOCK_KEY = 'paca_dashboard_amount_unlock_until';

function getStoredUnlockUntil(): number {
    if (typeof window === 'undefined') return 0;
    const stored = window.sessionStorage.getItem(DASHBOARD_AMOUNT_UNLOCK_KEY);
    if (!stored) return 0;
    const parsed = Number(stored);
    return Number.isFinite(parsed) ? parsed : 0;
}

function isUnlockActive(): boolean {
    return getStoredUnlockUntil() > Date.now();
}

function clearUnlock(): void {
    if (typeof window === 'undefined') return;
    window.sessionStorage.removeItem(DASHBOARD_AMOUNT_UNLOCK_KEY);
}

export function useDashboardAmountPrivacy() {
    const [amountsVisible, setAmountsVisible] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);

    const hideAmounts = useCallback(() => {
        clearUnlock();
        setAmountsVisible(false);
        setConfirmOpen(false);
    }, []);

    const requestReveal = useCallback(() => {
        if (isUnlockActive()) {
            setAmountsVisible(true);
            return;
        }
        setConfirmOpen(true);
    }, []);

    const confirmReveal = useCallback(() => {
        const unlockUntil = Date.now() + DASHBOARD_AMOUNT_UNLOCK_MS;
        window.sessionStorage.setItem(DASHBOARD_AMOUNT_UNLOCK_KEY, String(unlockUntil));
        setAmountsVisible(true);
        setConfirmOpen(false);
    }, []);

    const cancelReveal = useCallback(() => {
        setConfirmOpen(false);
    }, []);

    useEffect(() => {
        setAmountsVisible(isUnlockActive());
    }, []);

    useEffect(() => {
        if (!amountsVisible) return;
        const unlockUntil = getStoredUnlockUntil();
        const delay = Math.max(unlockUntil - Date.now(), 0);
        const timeout = window.setTimeout(hideAmounts, delay);
        return () => window.clearTimeout(timeout);
    }, [amountsVisible, hideAmounts]);

    return {
        amountsVisible,
        confirmOpen,
        requestReveal,
        confirmReveal,
        cancelReveal,
        hideAmounts,
    };
}
