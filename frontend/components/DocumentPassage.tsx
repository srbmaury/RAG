import type { ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { parseExtractedText } from '../lib/documentText';

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
            {parseExtractedText(text).map((block, index) => {
                if (block.type === 'kicker')
                    return (
                        <div className="document-kicker" key={index}>
                            {block.text}
                        </div>
                    );
                if (block.type === 'heading')
                    return (
                        <h3 className="document-section-heading" key={index}>
                            {block.text}
                        </h3>
                    );
                if (block.type === 'field')
                    return (
                        <div className="document-field" key={index}>
                            <strong>{block.label}</strong>
                            <span>{linkedLine(block.value, `field-${index}`)}</span>
                        </div>
                    );
                if (block.type === 'list')
                    return (
                        <ul key={index}>
                            {block.items.map((item, itemIndex) => (
                                <li key={itemIndex}>{linkedLine(item, `list-${index}-${itemIndex}`)}</li>
                            ))}
                        </ul>
                    );
                return <p key={index}>{linkedLine(block.text, `paragraph-${index}`)}</p>;
            })}
        </div>
    );
}
