import React from 'react';

/**
 * Pure, safe markdown parser that renders **bold**, bullet lists, numbered lists,
 * and paragraphs strictly into React elements.
 *
 * NO dangerouslySetInnerHTML.
 * Unknown markdown (such as # headers or ~strikes~) is rendered as plain text.
 * Any unmatched ** is preserved as plain text without throwing.
 */
function renderInline(text: string): React.ReactNode {
  if (!text) return null;

  // Split on **...** with capture group
  const parts = text.split(/(\*\*[^\*\n]+?\*\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      const boldContent = part.slice(2, -2);
      return (
        <strong key={index} className="font-semibold text-inherit">
          {boldContent}
        </strong>
      );
    }
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

export function SafeMarkdown({
  content,
  className = '',
}: {
  content: string;
  className?: string;
}) {
  if (!content || typeof content !== 'string') {
    return null;
  }

  const rawLines = content.split('\n');
  const elements: React.ReactNode[] = [];

  let currentList: { type: 'ul' | 'ol'; items: string[] } | null = null;
  let currentParagraph: string[] = [];

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      const pText = currentParagraph.join(' ').trim();
      if (pText) {
        elements.push(
          <p key={`p-${elements.length}`} className="mb-2 last:mb-0 leading-relaxed">
            {renderInline(pText)}
          </p>
        );
      }
      currentParagraph = [];
    }
  };

  const flushList = () => {
    if (currentList && currentList.items.length > 0) {
      const ListTag = currentList.type;
      const listClass =
        ListTag === 'ul'
          ? 'list-disc pl-5 mb-2.5 space-y-1'
          : 'list-decimal pl-5 mb-2.5 space-y-1';

      elements.push(
        <ListTag key={`list-${elements.length}`} className={listClass}>
          {currentList.items.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInline(item)}
            </li>
          ))}
        </ListTag>
      );
      currentList = null;
    }
  };

  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    // Bullet list: *, -, •
    const bulletMatch = trimmed.match(/^[\*\-•]\s+(.*)$/);
    if (bulletMatch) {
      flushParagraph();
      if (!currentList || currentList.type !== 'ul') {
        flushList();
        currentList = { type: 'ul', items: [] };
      }
      currentList.items.push(bulletMatch[1]);
      continue;
    }

    // Numbered list: 1., 2., etc.
    const numMatch = trimmed.match(/^\d+[\.\)]\s+(.*)$/);
    if (numMatch) {
      flushParagraph();
      if (!currentList || currentList.type !== 'ol') {
        flushList();
        currentList = { type: 'ol', items: [] };
      }
      currentList.items.push(numMatch[1]);
      continue;
    }

    // Regular paragraph line
    flushList();
    currentParagraph.push(trimmed);
  }

  flushParagraph();
  flushList();

  return <div className={`text-sm ${className}`}>{elements}</div>;
}

