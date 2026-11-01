'use client';
import type { Dispatch, SetStateAction } from 'react';
import { Layers3, Check } from 'lucide-react';
import type { Doc } from '../../lib/types';
import { Dialog, FileBadge } from '../ui/WorkspacePrimitives';

type Props = {
  ready: Doc[];
  selected: string[];
  setSelected: Dispatch<SetStateAction<string[]>>;
  onClose: () => void;
};

export function DocumentScopeDialog({ ready, selected, setSelected, onClose }: Props) {
  return (
    <Dialog title="Choose your sources" onClose={() => onClose()}>
      <p className="dialog-intro">Ask across all ready documents, or choose a focused set.</p>
      <button className="btn" onClick={() => setSelected([])}>
        <Layers3 />
        Use all documents
      </button>
      <div className="scope-list">
        {ready.map((d) => (
          <label key={d.id}>
            <input
              type="checkbox"
              checked={selected.includes(d.id)}
              onChange={(e) =>
                setSelected((old) =>
                  e.target.checked ? [...old, d.id] : old.filter((id) => id !== d.id),
                )
              }
            />
            <FileBadge name={d.name} />
            <span>{d.name}</span>
          </label>
        ))}
      </div>
      <div className="dialog-footer">
        <span className="caption">
          {selected.length ? `${selected.length} selected` : 'All ready documents included'}
        </span>
        <button className="btn primary" onClick={() => onClose()}>
          Done
          <Check />
        </button>
      </div>
    </Dialog>
  );
}
