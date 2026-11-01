'use client';
import { memo, Children, cloneElement, isValidElement, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Answer, Source } from '../../lib/types';
import { visibleEvidence, sourceLocation } from '../../lib/evidence';
import { FileBadge } from '../ui/WorkspacePrimitives';

function citationText(children: ReactNode, evidence: Source[], onOpen: (source: Source) => void): ReactNode {
    return Children.map(children, (child) =>
        typeof child === 'string'
            ? child.split(/(\[\d+\])/g).map((part, index) => {
                  const match = /^\[(\d+)\]$/.exec(part);
                  const passage = match ? evidence[Number(match[1]) - 1] : undefined;
                  return passage ? (
                      <button key={index} className="cite" onClick={() => onOpen(passage)} aria-label={`Open source ${match?.[1]}: ${passage.name}`}>
                          {match?.[1]}
                      </button>
                  ) : (
                      part
                  );
              })
            : isValidElement<{ children?: ReactNode }>(child) && child.type !== 'code' && child.type !== 'a'
              ? cloneElement(child, {}, citationText(child.props.children, evidence, onOpen))
              : child,
    );
}
export const ResearchAnswer = memo(function ResearchAnswer({ result, onOpenSource }: { result: Answer; onOpenSource: (source: Source) => void }) {
    const sources = visibleEvidence(result);
    return (
        <>
            <div className="markdown research-answer-content">
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                        p: ({ children }) => <p>{citationText(children, sources.length ? result.sources : [], onOpenSource)}</p>,
                        li: ({ children }) => <li>{citationText(children, sources.length ? result.sources : [], onOpenSource)}</li>,
                    }}
                >
                    {result.answer}
                </ReactMarkdown>
            </div>
            {result.decision_timeline && result.decision_timeline.length > 0 && (
                <section className="connected-card" aria-label="Evidence timeline">
                    <strong>Evidence timeline</strong>
                    <p className="caption">Dated statements from linked sources, not independently verified events.</p>
                    <ol>
                        {result.decision_timeline.map((item, index) => (
                            <li key={index}>
                                <b>{item.date}</b> · {item.event} · {item.references.join(', ')}{' '}
                                <button
                                    className="cite"
                                    onClick={() => {
                                        const source = result.sources[item.source - 1];
                                        if (source) onOpenSource(source);
                                    }}
                                    aria-label={`Inspect source ${item.source}`}
                                >
                                    [{item.source}]
                                </button>
                                <p className="caption">{item.excerpt}</p>
                            </li>
                        ))}
                    </ol>
                </section>
            )}
            {result.related_sources && result.related_sources.length > 0 && (
                <section className="connected-card" aria-label="Related evidence">
                    <strong>Connected evidence</strong>
                    <p className="caption">Sources sharing explicit issue or PR references; not proof of a decision or causal relationship.</p>
                    {result.related_sources.map((link, index) => (
                        <div key={index} className="source-search-controls">
                            <button
                                className="source-chip"
                                onClick={() => {
                                    const source = result.sources[link.left - 1];
                                    if (source) onOpenSource(source);
                                }}
                            >
                                Source [{link.left}]
                            </button>
                            <span className="caption">{link.references.join(', ')}</span>
                            <button
                                className="source-chip"
                                onClick={() => {
                                    const source = result.sources[link.right - 1];
                                    if (source) onOpenSource(source);
                                }}
                            >
                                Source [{link.right}]
                            </button>
                        </div>
                    ))}
                </section>
            )}
            {sources.length > 0 && (
                <div className="source-chips evidence-source-links">
                    {sources.map(({ source, number }) => (
                        <button className="source-chip" key={`${number}-${source.chunk_id}`} onClick={() => onOpenSource(source)}>
                            <FileBadge name={source.name} />
                            <span>
                                <b>{source.name}</b>
                                <small>
                                    {result.mode === 'local_excerpts' ? 'Search match' : 'Citation'} [{number}] · {sourceLocation(source)}
                                </small>
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </>
    );
});
