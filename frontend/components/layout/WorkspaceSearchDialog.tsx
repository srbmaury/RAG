'use client';
import { Search, Sparkles, ArrowUpRight, ChevronRight } from 'lucide-react';
import type { Doc } from '../../lib/types';
import { Dialog, FileBadge } from '../ui/WorkspacePrimitives';

type Props = {
  docs: Doc[];
  globalQuery: string;
  setGlobalQuery: (value: string) => void;
  busy: boolean;
  hasAskSources: boolean;
  onClose: () => void;
  onAsk: (question: string) => void;
  onInspect: (document: Doc) => void;
  formatSize: (bytes: number) => string;
};

export function WorkspaceSearchDialog({
  docs,
  globalQuery,
  setGlobalQuery,
  busy,
  hasAskSources,
  onClose,
  onAsk,
  onInspect,
  formatSize,
}: Props) {
  return (
    <Dialog title="Search your workspace" onClose={() => onClose()} className="search-dialog">
      <div className="modal-search">
        <Search />
        <input
          autoFocus
          data-autofocus
          aria-label="Search your workspace"
          placeholder="Find a document or ask a question…"
          value={globalQuery}
          onChange={(e) => setGlobalQuery(e.target.value)}
        />
      </div>
      {globalQuery.trim() && (
        <button
          className="search-question"
          disabled={busy || !hasAskSources}
          onClick={() => {
            onClose();
            onAsk(globalQuery);
            setGlobalQuery('');
          }}
        >
          <Sparkles />
          <span>Ask Atlas: {globalQuery}</span>
          <ArrowUpRight />
        </button>
      )}
      <div className="search-results">
        {docs
          .filter((d) => d.name.toLowerCase().includes(globalQuery.toLowerCase()))
          .slice(0, 12)
          .map((d) => (
            <button
              className="doc-item"
              key={d.id}
              onClick={() => {
                onClose();
                onInspect(d);
              }}
            >
              <FileBadge name={d.name} />
              <span className="doc-item-info">
                <strong>{d.name}</strong>
                <small>
                  {formatSize(d.size)} · {d.chunk_count} passages
                </small>
              </span>
              <ChevronRight />
            </button>
          ))}
        {!docs.some((d) => d.name.toLowerCase().includes(globalQuery.toLowerCase())) && (
          <p className="evidence-empty">No matching documents.</p>
        )}
      </div>
    </Dialog>
  );
}
