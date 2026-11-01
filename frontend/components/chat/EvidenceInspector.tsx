'use client';
import { ArrowUpRight, Download } from 'lucide-react';
import { loadMoreDocumentPassages } from '../../utils/documentActions';
import { sourceLocation } from '../../lib/evidence';
import type { DocumentPreview, Source } from '../../lib/types';
import { DocumentPassage } from '../DocumentPassage';
import { Dialog } from '../ui/WorkspacePrimitives';

export type { DocumentPreview } from '../../lib/types';

export function EvidenceInspector({
  wid,
  source,
  preview,
  onClose,
  onPreviewChange,
  onError,
}: {
  wid: string;
  source: Source | null;
  preview: DocumentPreview | null;
  onClose: () => void;
  onPreviewChange: (preview: DocumentPreview) => void;
  onError: (message: string) => void;
}) {
  if (!source && !preview) return null;
  return (
    <Dialog
      title={source ? 'Source passage' : 'Document preview'}
      closeLabel="Close preview"
      className="evidence-inspector"
      onClose={() => {
        onClose();
      }}
    >
      <div className="drawer-header">
        <div>
          <div className="caption">{source ? 'Source excerpt' : 'Document preview'}</div>
          <h2>{source?.name || preview?.document.name}</h2>
          <div className="caption">
            {source
              ? sourceLocation(source)
              : `${preview?.document.chunk_count} passages · ${preview?.document.status}`}
          </div>
        </div>
      </div>
      <div className="drawer-body">
        {source ? (
          <div className="evidence-inspector-passage">
            <p className="caption evidence-disclaimer">
              Retrieved excerpt. Check the original source to confirm context.
            </p>
            <DocumentPassage name={source.name} text={source.text} />
          </div>
        ) : (
          preview && (
            <>
              {preview.document.error && <p className="feedback error">{preview.document.error}</p>}
              {preview.chunks.map((c) => (
                <section className="preview-chunk" key={c.id}>
                  <span className="caption">
                    {preview.document.name.toLowerCase().endsWith('.pdf') ? 'Page' : 'Section'}{' '}
                    {c.page}
                  </span>
                  <DocumentPassage name={preview.document.name} text={c.text} />
                </section>
              ))}
              {!preview.chunks.length && <p className="evidence-empty">No indexed passages yet.</p>}
              {preview.document.chunk_count > preview.chunks.length && (
                <button
                  className="btn"
                  onClick={() =>
                    void loadMoreDocumentPassages({
                      workspaceId: wid,
                      preview,
                      onPreviewChange,
                      onError,
                    })
                  }
                >
                  Load more passages
                </button>
              )}
            </>
          )
        )}
      </div>
      <div className="drawer-footer">
        {source?.url ? (
          <a className="btn" href={source.url} target="_blank" rel="noopener noreferrer">
            <ArrowUpRight />
            Open source
          </a>
        ) : (
          <a
            className="btn"
            href={`/api/workspaces/${wid}/documents/${source?.document_id || preview?.document.id}/original`}
          >
            <Download />
            Download original
          </a>
        )}
        <button className="btn" onClick={onClose}>
          Close
        </button>
      </div>
    </Dialog>
  );
}
