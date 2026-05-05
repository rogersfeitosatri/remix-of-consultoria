import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { TextAlign } from '@tiptap/extension-text-align';
import { FontFamily } from '@tiptap/extension-font-family';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Link as LinkIcon, Image as ImageIcon, Palette, Type,
  AlignLeft, AlignCenter, AlignRight, List, ListOrdered,
  Heading1, Heading2, Heading3, Undo, Redo,
} from 'lucide-react';
import { useEffect } from 'react';

const COLORS = [
  '#000000', '#ffffff', '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#6b7280',
];

const FONTS = [
  { label: 'Padrão', value: '' },
  { label: 'Sans', value: 'Inter, sans-serif' },
  { label: 'Serif', value: 'Georgia, serif' },
  { label: 'Mono', value: 'monospace' },
];

const SIZES = [
  { label: 'Pequeno', value: '14px' },
  { label: 'Normal', value: '16px' },
  { label: 'Médio', value: '20px' },
  { label: 'Grande', value: '28px' },
  { label: 'Enorme', value: '40px' },
];

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

export function RichTextEditor({ value, onChange, minHeight = 250 }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-primary underline' } }),
      Image.configure({ HTMLAttributes: { class: 'max-w-full rounded-lg my-2' } }),
      TextStyle,
      Color,
      FontFamily,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none p-3',
        style: `min-height: ${minHeight}px;`,
      },
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="border border-input rounded-md bg-background">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const setLink = () => {
    const previous = editor.getAttributes('link').href;
    const url = window.prompt('URL do link:', previous || 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const addImage = () => {
    const url = window.prompt('URL da imagem:');
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };

  const setFontSize = (size: string) => {
    // Use inline style via TextStyle mark
    editor.chain().focus().setMark('textStyle', { ...editor.getAttributes('textStyle'), fontSize: size }).run();
    // tiptap textStyle doesn't natively support fontSize without extension; fallback via HTML
    document.execCommand && document.execCommand('fontSize', false, '7');
  };

  const btn = (active: boolean, onClick: () => void, icon: React.ReactNode, title: string) => (
    <Button
      type="button"
      variant={active ? 'secondary' : 'ghost'}
      size="icon"
      className="h-8 w-8"
      onClick={onClick}
      title={title}
    >
      {icon}
    </Button>
  );

  return (
    <div className="flex flex-wrap items-center gap-0.5 p-1 border-b bg-muted/30 rounded-t-md">
      {btn(editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), <Bold className="h-4 w-4" />, 'Negrito')}
      {btn(editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), <Italic className="h-4 w-4" />, 'Itálico')}
      {btn(editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run(), <UnderlineIcon className="h-4 w-4" />, 'Sublinhado')}
      {btn(editor.isActive('strike'), () => editor.chain().focus().toggleStrike().run(), <Strikethrough className="h-4 w-4" />, 'Tachado')}
      <div className="w-px h-6 bg-border mx-1" />
      {btn(editor.isActive('heading', { level: 1 }), () => editor.chain().focus().toggleHeading({ level: 1 }).run(), <Heading1 className="h-4 w-4" />, 'Título 1')}
      {btn(editor.isActive('heading', { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), <Heading2 className="h-4 w-4" />, 'Título 2')}
      {btn(editor.isActive('heading', { level: 3 }), () => editor.chain().focus().toggleHeading({ level: 3 }).run(), <Heading3 className="h-4 w-4" />, 'Título 3')}
      <div className="w-px h-6 bg-border mx-1" />
      {btn(editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), <List className="h-4 w-4" />, 'Lista')}
      {btn(editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), <ListOrdered className="h-4 w-4" />, 'Lista numerada')}
      <div className="w-px h-6 bg-border mx-1" />
      {btn(editor.isActive({ textAlign: 'left' }), () => editor.chain().focus().setTextAlign('left').run(), <AlignLeft className="h-4 w-4" />, 'Alinhar esquerda')}
      {btn(editor.isActive({ textAlign: 'center' }), () => editor.chain().focus().setTextAlign('center').run(), <AlignCenter className="h-4 w-4" />, 'Centralizar')}
      {btn(editor.isActive({ textAlign: 'right' }), () => editor.chain().focus().setTextAlign('right').run(), <AlignRight className="h-4 w-4" />, 'Alinhar direita')}
      <div className="w-px h-6 bg-border mx-1" />

      {/* Color picker */}
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title="Cor do texto">
            <Palette className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <div className="grid grid-cols-5 gap-1">
            {COLORS.map(c => (
              <button
                key={c}
                type="button"
                className="h-6 w-6 rounded border border-border hover:scale-110 transition-transform"
                style={{ backgroundColor: c }}
                onClick={() => editor.chain().focus().setColor(c).run()}
              />
            ))}
            <button
              type="button"
              className="col-span-5 text-xs underline mt-1"
              onClick={() => editor.chain().focus().unsetColor().run()}
            >
              Remover cor
            </button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Font family */}
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title="Fonte">
            <Type className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-40 p-1" align="start">
          {FONTS.map(f => (
            <button
              key={f.label}
              type="button"
              className="w-full text-left px-2 py-1 text-sm rounded hover:bg-muted"
              style={{ fontFamily: f.value || undefined }}
              onClick={() => f.value
                ? editor.chain().focus().setFontFamily(f.value).run()
                : editor.chain().focus().unsetFontFamily().run()}
            >
              {f.label}
            </button>
          ))}
          <div className="border-t my-1" />
          <p className="px-2 text-xs text-muted-foreground">Tamanho</p>
          {SIZES.map(s => (
            <button
              key={s.value}
              type="button"
              className="w-full text-left px-2 py-1 text-sm rounded hover:bg-muted"
              onClick={() => {
                // wrap selection in span with font-size
                const { from, to } = editor.state.selection;
                if (from === to) return;
                const text = editor.state.doc.textBetween(from, to);
                editor.chain().focus().insertContent(`<span style="font-size:${s.value}">${text}</span>`).run();
              }}
            >
              {s.label} ({s.value})
            </button>
          ))}
        </PopoverContent>
      </Popover>

      <div className="w-px h-6 bg-border mx-1" />
      {btn(editor.isActive('link'), setLink, <LinkIcon className="h-4 w-4" />, 'Link')}
      {btn(false, addImage, <ImageIcon className="h-4 w-4" />, 'Imagem (URL)')}

      <div className="w-px h-6 bg-border mx-1" />
      {btn(false, () => editor.chain().focus().undo().run(), <Undo className="h-4 w-4" />, 'Desfazer')}
      {btn(false, () => editor.chain().focus().redo().run(), <Redo className="h-4 w-4" />, 'Refazer')}
    </div>
  );
}
