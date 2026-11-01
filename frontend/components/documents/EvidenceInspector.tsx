'use client';
import { ArrowUpRight, Download } from 'lucide-react';
import type { Source, DocumentPreview } from '../../lib/types';
import { sourceLocation } from '../../lib/evidence';
import { DocumentPassage } from '../DocumentPassage';
import { Dialog } from '../ui/WorkspacePrimitives';

type Props = {
  source: Source | null;
  preview: DocumentPreview | null;
  downloadUrl: string;
  onClose: () => void;
  onLoadMore: () => void;
};

export function EvidenceInspector({ source, preview, downloadUrl, onClose, onLoadMore }: Props) {
  return (
    <Dialog
      title={source ? 'Source passage' : 'Document preview'}
      closeLabel="Close preview"
      className="evidence-inspector"
      onClose={onClose}
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
                <button className="btn" onClick={onLoadMore}>
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
          <a className="btn" href={downloadUrl}>
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
