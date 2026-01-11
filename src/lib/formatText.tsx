import React from 'react';

/**
 * Parses text with markdown-like formatting and returns React elements
 * Supports: **bold**, *italic*, __underline__, and [color:value]text[/color]
 */
export function parseFormattedText(text: string): React.ReactNode[] {
  if (!text) return [];

  const elements: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  // Process line by line to maintain paragraph structure
  const lines = remaining.split('\n');
  
  return lines.map((line, lineIndex) => {
    const lineElements = parseInlineFormatting(line, lineIndex * 1000);
    
    return (
      <React.Fragment key={lineIndex}>
        {lineElements}
        {lineIndex < lines.length - 1 && <br />}
      </React.Fragment>
    );
  });
}

function parseInlineFormatting(text: string, keyOffset: number): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  let remaining = text;
  let key = keyOffset;

  while (remaining.length > 0) {
    // Check for bold **text**
    const boldMatch = remaining.match(/^\*\*(.+?)\*\*/);
    if (boldMatch) {
      elements.push(<strong key={key++} className="font-bold">{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Check for italic *text*
    const italicMatch = remaining.match(/^\*([^*]+?)\*/);
    if (italicMatch) {
      elements.push(<em key={key++} className="italic">{italicMatch[1]}</em>);
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // Check for underline __text__
    const underlineMatch = remaining.match(/^__(.+?)__/);
    if (underlineMatch) {
      elements.push(<u key={key++}>{underlineMatch[1]}</u>);
      remaining = remaining.slice(underlineMatch[0].length);
      continue;
    }

    // Check for color [color:#hex]text[/color]
    const colorMatch = remaining.match(/^\[color:(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}|[a-z]+)\](.+?)\[\/color\]/);
    if (colorMatch) {
      elements.push(
        <span key={key++} style={{ color: colorMatch[1] }}>
          {colorMatch[2]}
        </span>
      );
      remaining = remaining.slice(colorMatch[0].length);
      continue;
    }

    // No match - add next character as plain text
    // Find the next potential formatting marker
    const nextMarkerIndex = findNextMarker(remaining.slice(1));
    if (nextMarkerIndex === -1) {
      // No more markers, add rest as plain text
      elements.push(<React.Fragment key={key++}>{remaining}</React.Fragment>);
      break;
    } else {
      // Add text up to next marker
      const plainText = remaining.slice(0, nextMarkerIndex + 1);
      elements.push(<React.Fragment key={key++}>{plainText}</React.Fragment>);
      remaining = remaining.slice(nextMarkerIndex + 1);
    }
  }

  return elements;
}

function findNextMarker(text: string): number {
  const markers = ['**', '*', '__', '[color:'];
  let minIndex = -1;

  for (const marker of markers) {
    const index = text.indexOf(marker);
    if (index !== -1 && (minIndex === -1 || index < minIndex)) {
      minIndex = index;
    }
  }

  return minIndex;
}

interface FormattedTextProps {
  text: string;
  className?: string;
}

export function FormattedText({ text, className = '' }: FormattedTextProps) {
  return <span className={className}>{parseFormattedText(text)}</span>;
}
