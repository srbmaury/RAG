import { Fragment, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function linkedLine(line: string, keyPrefix: string) {
    const pieces: ReactNode[] = [];
    const pattern = /https?:\/\/[^\s<>"']+/g;
    let cursor = 0;
    let index = 0;

    for (const match of line.matchAll(pattern)) {
        const raw = match[0];
        let url = raw;
        let trailing = '';
        while (/[.,!?;:]$/.test(url)) {
            trailing = url.slice(-1) + trailing;
            url = url.slice(0, -1);
        }
        while (url.endsWith(')') && (url.match(/\)/g)?.length || 0) > (url.match(/\(/g)?.length || 0)) {
            trailing = ')' + trailing;
            url = url.slice(0, -1);
        }
        const start = match.index ?? 0;
        if (start > cursor) pieces.push(line.slice(cursor, start));
        try {
            const parsed = new URL(url);
            if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                pieces.push(
                    <a key={`${keyPrefix}-${index++}`} href={url} target="_blank" rel="noopener noreferrer">
                        {url}
                    </a>,
                );
            } else pieces.push(url);
        } catch {
            pieces.push(url);
        }
        if (trailing) pieces.push(trailing);
        cursor = start + raw.length;
    }
    if (cursor < line.length) pieces.push(line.slice(cursor));
    return pieces;
}

export function DocumentPassage({ text, name }: { text: string; name: string }) {
    if (/\.(md|docx)$/i.test(name))
        return (
            <div className="document-markdown">
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                        a: ({ href, children }) => (
                            <a href={href} target="_blank" rel="noopener noreferrer">
                                {children}
                            </a>
                        ),
                    }}
                >
                    {text}
                </ReactMarkdown>
            </div>
        );
    return (
        <div className="document-plain">
            {text.split(/\n{2,}/).map((paragraph, paragraphIndex) => (
                <p key={paragraphIndex}>
                    {paragraph.split('\n').map((line, lineIndex) => (
                        <Fragment key={`${paragraphIndex}-${lineIndex}`}>
                            {lineIndex > 0 && <br />}
                            {linkedLine(line, `${paragraphIndex}-${lineIndex}`)}
                        </Fragment>
                    ))}
                </p>
            ))}
        </div>
    );
}
