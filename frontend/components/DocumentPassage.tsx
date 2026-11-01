import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function DocumentPassage({ text, name }: { text: string; name: string }) {
    if (/\.(md|docx)$/i.test(name))
        return (
            <div className="document-markdown">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
            </div>
        );
    return <div className="document-plain">{text}</div>;
}
