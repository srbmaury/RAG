'use client';
import { useState } from 'react';

/** Source connection, provider discovery and research selection state. */
export function useSourceConnections() {
    const [driveStatus, setDriveStatus] = useState<{
        connected: boolean;
        account: string | null;
        configured: boolean;
    } | null>(null);
    const [driveQuery, setDriveQuery] = useState('');
    const [driveResults, setDriveResults] = useState<{ id: string; title: string; excerpt: string; url: string }[]>([]);
    const [driveBusy, setDriveBusy] = useState(false);
    const [sourceStatuses, setSourceStatuses] = useState<{ provider: string; connected: boolean; account: string | null }[]>([]);
    const [sourceChecks, setSourceChecks] = useState<Record<string, { healthy: boolean; matches: number | null; error: string | null; checked_at: number }>>({});
    const [sourceChecksBusy, setSourceChecksBusy] = useState(false);
    const [sourceManage, setSourceManage] = useState<string | null>(null);
    const [sourceProvider, setSourceProvider] = useState<'github' | 'notion' | 'slack' | 'calendar' | 'linear' | 'jira' | 'onedrive' | 'outlook' | 'sharepoint'>('github');
    const [sourceCredential, setSourceCredential] = useState('');
    const [sourceSearch, setSourceSearch] = useState('');
    const [sourceResults, setSourceResults] = useState<{ provider: string; id: string; title: string; excerpt: string; url?: string }[]>([]);
    const [sourceBusy, setSourceBusy] = useState(false);
    const [connectedGmail, setConnectedGmail] = useState(false);
    const [connectedProviders, setConnectedProviders] = useState<string[]>([]);
    const [connectedGmailQuery, setConnectedGmailQuery] = useState('newer_than:30d');
    return {
        driveStatus,
        setDriveStatus,
        driveQuery,
        setDriveQuery,
        driveResults,
        setDriveResults,
        driveBusy,
        setDriveBusy,
        sourceStatuses,
        setSourceStatuses,
        sourceChecks,
        setSourceChecks,
        sourceChecksBusy,
        setSourceChecksBusy,
        sourceManage,
        setSourceManage,
        sourceProvider,
        setSourceProvider,
        sourceCredential,
        setSourceCredential,
        sourceSearch,
        setSourceSearch,
        sourceResults,
        setSourceResults,
        sourceBusy,
        setSourceBusy,
        connectedGmail,
        setConnectedGmail,
        connectedProviders,
        setConnectedProviders,
        connectedGmailQuery,
        setConnectedGmailQuery,
    };
}
