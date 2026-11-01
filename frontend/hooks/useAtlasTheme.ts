'use client';
import { useEffect, useState } from 'react';

export function useAtlasTheme() {
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    useEffect(() => {
        const stored = localStorage.getItem('atlas-theme');
        const next = stored === 'dark' || (stored !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
        setTheme(next);
        document.documentElement.dataset.theme = next;
    }, []);
    const toggleTheme = () => {
        const next = theme === 'light' ? 'dark' : 'light';
        setTheme(next);
        document.documentElement.dataset.theme = next;
        localStorage.setItem('atlas-theme', next);
    };
    return { theme, toggleTheme };
}
