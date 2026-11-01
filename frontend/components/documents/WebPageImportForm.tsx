'use client';
import type { FormEvent } from 'react';

export function WebPageImportForm({
  url,
  busy,
  onUrlChange,
  onSubmit,
}: {
  url: string;
  busy: boolean;
  onUrlChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <form
      onSubmit={onSubmit}
      style={{
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
        alignItems: 'center',
        margin: '18px 0',
      }}
    >
      <label htmlFor="atlas-web-url">Save public web page</label>
      <input
        id="atlas-web-url"
        type="url"
        required
        value={url}
        onChange={(event) => onUrlChange(event.target.value)}
        placeholder="https://example.com/article"
        style={{
          minWidth: 260,
          flex: 1,
          padding: 10,
          borderRadius: 8,
          border: '1px solid var(--border, #999)',
        }}
      />
      <button className="btn" type="submit" disabled={busy}>
        {busy ? 'Importing…' : 'Add URL'}
      </button>
    </form>
  );
}
