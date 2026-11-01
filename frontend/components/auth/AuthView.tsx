'use client';
import { type ReactNode, type FormEvent } from 'react';
import { ArrowUpRight, LoaderCircle } from 'lucide-react';
import { AtlasMark } from '../ui/WorkspacePrimitives';

interface AuthViewProps {
    themeButton: ReactNode;
    register: boolean;
    email: string;
    password: string;
    error: string;
    busy: boolean;
    onSubmit: (event: FormEvent<HTMLFormElement>) => void;
    onEmailChange: (email: string) => void;
    onPasswordChange: (password: string) => void;
    onToggleMode: () => void;
}

export function AuthView({ themeButton, register, email, password, error, busy, onSubmit, onEmailChange, onPasswordChange, onToggleMode }: AuthViewProps) {
    return (
        <div className="auth-page">
            <header>
                <div className="brand-row">
                    <AtlasMark />
                    <span>Atlas</span>
                </div>
                {themeButton}
            </header>
            <div className="auth-grid">
                <form className="auth-form" onSubmit={onSubmit}>
                    <h2>{register ? 'Create your workspace' : 'Welcome back'}</h2>
                    <p>{register ? 'Create an account to upload documents and start researching.' : 'Sign in to your research workspace.'}</p>
                    <label>
                        Email address
                        <input type="email" autoComplete="email" required value={email} onChange={(e) => onEmailChange(e.target.value)} placeholder="you@company.com" />
                    </label>
                    <label>
                        Password
                        <input
                            type="password"
                            autoComplete={register ? 'new-password' : 'current-password'}
                            required
                            minLength={10}
                            maxLength={200}
                            value={password}
                            onChange={(e) => onPasswordChange(e.target.value)}
                            placeholder="At least 10 characters"
                        />
                    </label>
                    {error && (
                        <div className="feedback error" role="alert">
                            {error}
                        </div>
                    )}
                    <button className="btn primary" disabled={busy}>
                        {busy ? <LoaderCircle className="spin" /> : <ArrowUpRight />}
                        {register ? 'Create account' : 'Sign in'}
                    </button>
                    <div className="auth-switch">
                        {register ? 'Already have an account?' : 'New to Atlas?'}{' '}
                        <button type="button" onClick={onToggleMode}>
                            {register ? 'Sign in' : 'Create an account'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
