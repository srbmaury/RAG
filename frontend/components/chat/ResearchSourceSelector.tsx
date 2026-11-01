'use client';
import { ArrowUpRight } from 'lucide-react';
import type { GmailStatus } from '../../lib/types';
import type { ConnectedSourceStatus, ResearchProvider } from '../../lib/types';
import { PROVIDER_LABELS, RESEARCH_PROVIDERS } from '../../lib/providers';

interface ResearchSourceSelectorProps {
    includeDocuments: boolean;
    onIncludeDocuments: (value: boolean) => void;
    gmailStatus: GmailStatus | null;
    connectedGmail: boolean;
    onIncludeGmail: (value: boolean) => void;
    driveStatus: { connected: boolean } | null;
    sourceStatuses: ConnectedSourceStatus[];
    connectedProviders: ResearchProvider[];
    onToggleProvider: (provider: ResearchProvider, enabled: boolean) => void;
    onSelectAll: (select: boolean) => void;
    onManage: () => void;
}

export function ResearchSourceSelector({
    includeDocuments,
    onIncludeDocuments,
    gmailStatus,
    connectedGmail,
    onIncludeGmail,
    driveStatus,
    sourceStatuses,
    connectedProviders,
    onToggleProvider,
    onSelectAll,
    onManage,
}: ResearchSourceSelectorProps) {
    const availableProviders: ResearchProvider[] = [...(driveStatus?.connected ? (['drive'] as const) : []), ...sourceStatuses.filter((source) => source.connected).map((source) => source.provider)];
    const allSelected = includeDocuments && (!gmailStatus?.connected || connectedGmail) && availableProviders.every((provider) => connectedProviders.includes(provider));
    return (
        <div className="unified-sources">
            <span className="unified-sources-label">Search sources</span>
            <button
                type="button"
                className="unified-source-select-all"
                onClick={() => onSelectAll(!allSelected)}
                aria-label={allSelected ? 'Unselect all connected sources and documents' : 'Select all connected sources and documents'}
            >
                {allSelected ? 'Unselect all' : 'Select all'}
            </button>
            <label>
                <input type="checkbox" checked={includeDocuments} onChange={(e) => onIncludeDocuments(e.target.checked)} /> Documents
            </label>
            <label>
                <input type="checkbox" disabled={!gmailStatus?.connected} checked={connectedGmail} onChange={(e) => onIncludeGmail(e.target.checked)} /> Gmail
            </label>
            {RESEARCH_PROVIDERS.map((p) => (
                <label
                    key={p}
                    title={
                        p === 'drive'
                            ? driveStatus?.connected
                                ? ''
                                : 'Connect Drive in Sources first'
                            : sourceStatuses.find((x) => x.provider === p)?.connected
                              ? ''
                              : 'Connect this source in Sources first'
                    }
                >
                    <input
                        type="checkbox"
                        disabled={p === 'drive' ? !driveStatus?.connected : !sourceStatuses.some((x) => x.provider === p && x.connected)}
                        checked={connectedProviders.includes(p)}
                        onChange={(e) => onToggleProvider(p, e.target.checked)}
                    />
                    {PROVIDER_LABELS[p]}
                </label>
            ))}
            <button type="button" className="unified-source-manage" onClick={onManage}>
                Manage connections <ArrowUpRight size={13} />
            </button>
        </div>
    );
}
