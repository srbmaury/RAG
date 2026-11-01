'use client';
import type { FormEvent } from 'react';
import { Check, ChevronRight, Trash2, Plus } from 'lucide-react';
import type { Workspace } from '../../lib/types';
import { Dialog } from '../ui/WorkspacePrimitives';

type Props = {
    workspaces: Workspace[];
    wid: string;
    setWid: (id: string) => void;
    busy: boolean;
    uploading: boolean;
    deletingWorkspace: boolean;
    deleteWorkspaceId: string | null;
    setDeleteWorkspaceId: (id: string | null) => void;
    confirmWorkspaceName: string;
    setConfirmWorkspaceName: (name: string) => void;
    workspaceName: string;
    setWorkspaceName: (name: string) => void;
    setNewWorkspace: (open: boolean) => void;
    addWorkspace: (event: FormEvent<HTMLFormElement>) => void;
    removeWorkspace: () => void;
};

export function WorkspaceManagementDialog({
    workspaces,
    wid,
    setWid,
    busy,
    uploading,
    deletingWorkspace,
    deleteWorkspaceId,
    setDeleteWorkspaceId,
    confirmWorkspaceName,
    setConfirmWorkspaceName,
    workspaceName,
    setWorkspaceName,
    setNewWorkspace,
    addWorkspace,
    removeWorkspace,
}: Props) {
    return (
        <Dialog
            title="Your workspaces"
            onClose={() => {
                setNewWorkspace(false);
                setDeleteWorkspaceId(null);
            }}
        >
            <p className="dialog-intro">Manage your workspaces and their saved conversations.</p>
            <div className="workspace-list">
                {workspaces.map((w) => (
                    <div className="workspace-manage-row" key={w.id}>
                        <button
                            className={w.id === wid ? 'selected' : ''}
                            disabled={busy || uploading || deletingWorkspace}
                            onClick={() => {
                                setWid(w.id);
                                setNewWorkspace(false);
                            }}
                        >
                            <span className="ws-avatar">{w.name[0].toUpperCase()}</span>
                            <strong>{w.name}</strong>
                            {w.id === wid ? <Check /> : <ChevronRight />}
                        </button>
                        <button
                            className="workspace-delete"
                            type="button"
                            title={`Delete ${w.name}`}
                            aria-label={`Delete workspace ${w.name}`}
                            onClick={() => {
                                setDeleteWorkspaceId(w.id);
                                setConfirmWorkspaceName('');
                            }}
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                ))}
            </div>
            {deleteWorkspaceId && (
                <div className="workspace-delete-confirm" role="group" aria-label="Confirm workspace deletion">
                    <strong>Delete “{workspaces.find((w) => w.id === deleteWorkspaceId)?.name}”?</strong>
                    <p>This permanently deletes its documents, indexed passages, and saved chats. Type the workspace name to confirm.</p>
                    <input
                        aria-label="Type workspace name to confirm"
                        autoComplete="off"
                        value={confirmWorkspaceName}
                        onChange={(e) => setConfirmWorkspaceName(e.target.value)}
                        placeholder="Exact workspace name"
                    />
                    <div className="dialog-actions">
                        <button className="btn" type="button" onClick={() => setDeleteWorkspaceId(null)}>
                            Cancel
                        </button>
                        <button
                            className="btn danger"
                            type="button"
                            disabled={deletingWorkspace || busy || uploading || confirmWorkspaceName !== workspaces.find((w) => w.id === deleteWorkspaceId)?.name}
                            onClick={() => void removeWorkspace()}
                        >
                            {deletingWorkspace ? 'Deleting…' : 'Delete workspace'}
                        </button>
                    </div>
                </div>
            )}
            <form className="workspace-form" onSubmit={addWorkspace}>
                <label>
                    New workspace
                    <input required maxLength={100} value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} placeholder="e.g. Product research" />
                </label>
                <button className="btn primary">
                    <Plus />
                    Create workspace
                </button>
            </form>
        </Dialog>
    );
}
