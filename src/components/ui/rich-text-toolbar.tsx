import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Bold, Italic, Underline, Palette } from 'lucide-react';

interface RichTextToolbarProps {
  onFormat: (format: string, value?: string) => void;
}

const COLORS = [
  { label: 'Preto', value: '#000000' },
  { label: 'Vermelho', value: '#ef4444' },
  { label: 'Verde', value: '#22c55e' },
  { label: 'Azul', value: '#3b82f6' },
  { label: 'Amarelo', value: '#eab308' },
  { label: 'Roxo', value: '#a855f7' },
  { label: 'Laranja', value: '#f97316' },
  { label: 'Rosa', value: '#ec4899' },
];

export function RichTextToolbar({ onFormat }: RichTextToolbarProps) {
  return (
    <div className="flex items-center gap-1 p-1 border-b bg-muted/30 rounded-t-md">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => onFormat('bold')}
        title="Negrito (Ctrl+B)"
      >
        <Bold className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => onFormat('italic')}
        title="Itálico (Ctrl+I)"
      >
        <Italic className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => onFormat('underline')}
        title="Sublinhado (Ctrl+U)"
      >
        <Underline className="h-4 w-4" />
      </Button>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Cor do texto"
          >
            <Palette className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <div className="grid grid-cols-4 gap-1">
            {COLORS.map((color) => (
              <button
                key={color.value}
                type="button"
                className="h-6 w-6 rounded border border-border hover:scale-110 transition-transform"
                style={{ backgroundColor: color.value }}
                onClick={() => onFormat('color', color.value)}
                title={color.label}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// Helper functions to wrap text with formatting tags
export function applyTextFormat(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  format: string,
  value?: string
): { newText: string; newSelectionStart: number; newSelectionEnd: number } {
  const selectedText = text.substring(selectionStart, selectionEnd);
  
  if (!selectedText) {
    return { newText: text, newSelectionStart: selectionStart, newSelectionEnd: selectionEnd };
  }

  let formattedText = '';
  let tagLength = 0;

  switch (format) {
    case 'bold':
      formattedText = `**${selectedText}**`;
      tagLength = 4;
      break;
    case 'italic':
      formattedText = `_${selectedText}_`;
      tagLength = 2;
      break;
    case 'underline':
      formattedText = `<u>${selectedText}</u>`;
      tagLength = 7;
      break;
    case 'color':
      formattedText = `<span style="color:${value}">${selectedText}</span>`;
      tagLength = 27 + (value?.length || 0);
      break;
    default:
      return { newText: text, newSelectionStart: selectionStart, newSelectionEnd: selectionEnd };
  }

  const newText = text.substring(0, selectionStart) + formattedText + text.substring(selectionEnd);
  
  return {
    newText,
    newSelectionStart: selectionStart,
    newSelectionEnd: selectionStart + formattedText.length,
  };
}
