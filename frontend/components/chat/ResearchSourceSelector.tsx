'use client';
import { ArrowUpRight } from 'lucide-react';
import type { GmailStatus } from '../../lib/types';

type Status = { provider: string; connected: boolean; account: string | null };
type Provider =
  | 'drive'
  | 'github'
  | 'notion'
  | 'slack'
  | 'calendar'
  | 'linear'
  | 'jira'
  | 'onedrive'
  | 'outlook'
  | 'sharepoint';
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
  onManage,
}: {
  includeDocuments: boolean;
  onIncludeDocuments: (value: boolean) => void;
  gmailStatus: GmailStatus | null;
  connectedGmail: boolean;
  onIncludeGmail: (value: boolean) => void;
  driveStatus: { connected: boolean } | null;
  sourceStatuses: Status[];
  connectedProviders: string[];
  onToggleProvider: (provider: Provider, enabled: boolean) => void;
  onManage: () => void;
}) {
  return (
    <div className="unified-sources">
      <span className="unified-sources-label">Search sources</span>
      <label>
        <input
          type="checkbox"
          checked={includeDocuments}
          onChange={(e) => onIncludeDocuments(e.target.checked)}
        />{' '}
        Documents
      </label>
      <label>
        <input
          type="checkbox"
          disabled={!gmailStatus?.connected}
          checked={connectedGmail}
          onChange={(e) => onIncludeGmail(e.target.checked)}
        />{' '}
        Gmail
      </label>
      {(
        [
          'drive',
          'github',
          'notion',
          'slack',
          'calendar',
          'linear',
          'jira',
          'onedrive',
          'outlook',
          'sharepoint',
        ] as const
      ).map((p) => (
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
            disabled={
              p === 'drive'
                ? !driveStatus?.connected
                : !sourceStatuses.some((x) => x.provider === p && x.connected)
            }
            checked={connectedProviders.includes(p)}
            onChange={(e) => onToggleProvider(p, e.target.checked)}
          />
          {p === 'drive'
            ? 'Drive'
            : p === 'github'
              ? 'GitHub'
              : p === 'notion'
                ? 'Notion'
                : p === 'slack'
                  ? 'Slack'
                  : (
                      {
                        calendar: 'Calendar',
                        linear: 'Linear',
                        jira: 'Jira',
                        onedrive: 'OneDrive',
                        outlook: 'Outlook',
                        sharepoint: 'SharePoint',
                      } as Record<string, string>
                    )[p]}
        </label>
      ))}
      <button type="button" className="unified-source-manage" onClick={() => onManage()}>
        Manage connections <ArrowUpRight size={13} />
      </button>
    </div>
  );
}
