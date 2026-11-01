'use client';
import { useEffect } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Atlas route render failed', error);
  }, [error]);
  return (
    <main className="app-recovery" role="alert">
      <div className="app-recovery-panel">
        <AlertCircle size={26} aria-hidden="true" />
        <h1>We couldn't load this workspace</h1>
        <p>
          Your documents and saved conversations have not been deleted. You can try loading the page
          again.
        </p>
        <button className="btn primary" onClick={reset}>
          <RotateCcw size={16} /> Try again
        </button>
      </div>
    </main>
  );
}
