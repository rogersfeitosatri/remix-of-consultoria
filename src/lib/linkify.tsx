import React from 'react';

/**
 * Converts text with URLs to clickable links
 * Matches http:// and https:// URLs
 */
export function linkifyText(text: string): React.ReactNode[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  
  return parts.map((part, index) => {
    if (urlRegex.test(part)) {
      // Reset regex lastIndex to avoid issues
      urlRegex.lastIndex = 0;
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[hsl(43,74%,49%)] underline hover:text-[hsl(43,74%,60%)] break-all"
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

/**
 * Component that renders text with clickable links
 */
export function LinkifiedText({ text, className }: { text: string; className?: string }) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  
  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.match(/^https?:\/\//)) {
          return (
            <a
              key={index}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[hsl(43,74%,49%)] underline hover:text-[hsl(43,74%,60%)] break-all"
            >
              {part}
            </a>
          );
        }
        return part;
      })}
    </span>
  );
}
