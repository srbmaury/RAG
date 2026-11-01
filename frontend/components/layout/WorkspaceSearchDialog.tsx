'use client';
import { ArrowUpRight, ChevronRight, Search, Sparkles } from 'lucide-react';
import type { Doc } from '../../lib/types';
import { formatBytes } from '../../utils/workspacePresentation';
import { FileBadge, Dialog } from '../ui/WorkspacePrimitives';

export function WorkspaceSearchDialog({
  query,
  onQueryChange,
  onClose,
  onAsk,
  onInspect,
  documents,
  canAsk,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  onClose: () => void;
  onAsk: (question: string) => void;
  onInspect: (document: Doc) => void;
  documents: Doc[];
  canAsk: boolean;
}) {
  const matches = documents.filter((doc) => doc.name.toLowerCase().includes(query.toLowerCase()));
  return (
    <Dialog title="Search your workspace" onClose={onClose} className="search-dialog">
      <div className="modal-search">
        <Search />
        <input
          autoFocus
          data-autofocus
          aria-label="Search your workspace"
          placeholder="Find a document or ask a question…"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </div>
      {query.trim() && (
        <button className="search-question" disabled={!canAsk} onClick={() => onAsk(query)}>
          <Sparkles />
          <span>Ask Atlas: {query}</span>
          <ArrowUpRight />
        </button>
      )}
      <div className="search-results">
        {matches.slice(0, 12).map((doc) => (
          <button className="doc-item" key={doc.id} onClick={() => onInspect(doc)}>
            <FileBadge name={doc.name} />
            <span className="doc-item-info">
              <strong>{doc.name}</strong>
              <small>
                {formatBytes(doc.size)} · {doc.chunk_count} passages
              </small>
            </span>
            <ChevronRight />
          </button>
        ))}
        {!matches.length && <p className="evidence-empty">No matching documents.</p>}
      </div>
    </Dialog>
  );
}
