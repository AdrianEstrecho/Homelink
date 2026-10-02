import { Fragment } from 'react';
import { Link } from 'react-router-dom';

// Just the markdown the assistant is told to write — paragraphs, bullet/numbered lists, bold,
// italics and links — turned into React elements rather than injected HTML, so nothing in a reply
// can ever become markup. Site paths ("/products/...") become router links that keep the chat
// open across navigation; http(s) links open in a new tab; anything else renders as plain text.
const INLINE = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[[^\]]+\]\([^)\s]+\))/g;
const LINK = /^\[([^\]]+)\]\(([^)\s]+)\)$/;
const LINK_CLASS = 'font-semibold text-brand-teal underline decoration-brand-teal/30 underline-offset-2 hover:decoration-brand-teal';

function renderInline(text, onNavigate) {
  return text.split(INLINE).filter(Boolean).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={i} className="font-semibold text-brand-ink">{renderInline(part.slice(2, -2), onNavigate)}</strong>;
    }
    const link = part.match(LINK);
    if (link) {
      const [, label, href] = link;
      if (href.startsWith('/') && !href.startsWith('//')) {
        return <Link key={i} to={href} onClick={onNavigate} className={LINK_CLASS}>{label}</Link>;
      }
      if (/^https?:\/\//i.test(href)) {
        return <a key={i} href={href} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>{label}</a>;
      }
      return <Fragment key={i}>{label}</Fragment>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={i}>{renderInline(part.slice(1, -1), onNavigate)}</em>;
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

function toBlocks(text) {
  const blocks = [];
  let paragraph = [];
  let list = null;
  const flushParagraph = () => { if (paragraph.length) blocks.push({ type: 'p', lines: paragraph }); paragraph = []; };
  const flushList = () => { if (list) blocks.push(list); list = null; };

  for (const raw of text.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim();
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    if (bullet || numbered) {
      flushParagraph();
      const type = bullet ? 'ul' : 'ol';
      if (list?.type !== type) { flushList(); list = { type, items: [] }; }
      list.items.push((bullet || numbered)[1]);
    } else if (!line) {
      // A list carries on across blank lines between its items; text that follows ends it.
      flushParagraph();
    } else if (list && /^\s/.test(raw)) {
      // An indented line under a bullet is more of that item, not the end of the list.
      list.items[list.items.length - 1] += `\n${line}`;
    } else {
      flushList();
      // Headings aren't part of the chat's style; one that slips through reads fine as bold.
      const heading = line.match(/^#{1,6}\s+(.*)$/);
      paragraph.push(heading ? `**${heading[1]}**` : line);
    }
  }
  flushParagraph();
  flushList();
  return blocks;
}

export default function ChatMarkdown({ text, onNavigate }) {
  return (
    <div className="space-y-2">
      {toBlocks(text).map((block, i) => {
        if (block.type === 'p') {
          return (
            <p key={i}>
              {block.lines.map((line, j) => (
                <Fragment key={j}>{j > 0 && <br />}{renderInline(line, onNavigate)}</Fragment>
              ))}
            </p>
          );
        }
        const ListTag = block.type;
        return (
          <ListTag key={i} className={`pl-5 space-y-1 ${ListTag === 'ul' ? 'list-disc marker:text-brand-orange' : 'list-decimal marker:text-gray-400 marker:font-semibold'}`}>
            {block.items.map((item, j) => (
              <li key={j}>
                {item.split('\n').map((line, k) => (
                  <Fragment key={k}>{k > 0 && <br />}{renderInline(line, onNavigate)}</Fragment>
                ))}
              </li>
            ))}
          </ListTag>
        );
      })}
    </div>
  );
}
