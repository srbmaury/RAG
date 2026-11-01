/** Shared frontend API contracts for workspace, research and connected sources. */
export type User = { id: string; email: string; mode: string; max_file_bytes: number };
export type Workspace = { id: string; name: string };
export type Doc = {
    id: string;
    name: string;
    size: number;
    status: string;
    error?: string;
    pages: number;
    chunk_count: number;
};
export type DocumentPreview = {
    document: Doc;
    chunks: { id: string; page: number; text: string }[];
};
export type Source = {
    chunk_id: string;
    document_id: string;
    name: string;
    page: number;
    text: string;
    location_type: string;
    provider?: string;
    url?: string;
};
export type Answer = {
    answer: string;
    sources: Source[];
    related_sources?: { left: number; right: number; references: string[]; status: string }[];
    decision_timeline?: {
        date: string;
        source: number;
        references: string[];
        event: string;
        excerpt: string;
        status: string;
    }[];
    mode: string;
    citation_note?: string;
    scope?: string[];
};
export type Message = { role: 'user' | 'assistant'; content: string; result?: Answer };
export type GmailMessage = {
    id: string;
    subject: string;
    sender: string;
    date: string;
    snippet: string;
    body: string;
    url: string;
};
export type GmailStatus = { connected: boolean; email: string | null; configured: boolean };
export type GmailSummary = {
    summary: string;
    sources: { number: number; id: string; subject: string; url: string }[];
};
export type ChatSummary = { id: string; title: string; updated: number };
export type SavedChat = ChatSummary & { messages: Message[] };
