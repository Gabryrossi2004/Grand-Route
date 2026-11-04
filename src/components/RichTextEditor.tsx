"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import {
  Bold,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Redo,
  Table as TableIcon,
  Trash2,
  Undo,
} from "lucide-react";
import { useEffect } from "react";
import { richTextClassName } from "@/lib/richText";

function ToolbarButton({
  onClick,
  active,
  disabled,
  children,
  label,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`rounded p-1.5 hover:bg-slate-100 disabled:opacity-30 ${active ? "bg-slate-200" : ""}`}
    >
      {children}
    </button>
  );
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: placeholder ?? "" }),
      Link.configure({ openOnClick: false, autolink: false }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: `${richTextClassName} min-h-[4rem] px-2 py-1.5 outline-none`,
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) return null;

  function toggleLink() {
    if (!editor) return;
    if (editor.isActive("link")) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Inserisci il link (URL):", previousUrl ?? "https://");
    if (!url) return;
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  return (
    <div className="rounded-md border border-slate-300 bg-white">
      <div className="flex gap-0.5 border-b border-slate-200 p-1">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          label="Grassetto"
        >
          <Bold size={14} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          label="Corsivo"
        >
          <Italic size={14} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          label="Elenco puntato"
        >
          <List size={14} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          label="Elenco numerato"
        >
          <ListOrdered size={14} />
        </ToolbarButton>
        <ToolbarButton onClick={toggleLink} active={editor.isActive("link")} label="Inserisci link">
          <LinkIcon size={14} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          label="Inserisci tabella"
        >
          <TableIcon size={14} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          label="Annulla"
        >
          <Undo size={14} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          label="Ripeti"
        >
          <Redo size={14} />
        </ToolbarButton>
      </div>

      {editor.isActive("table") && (
        <div className="flex flex-wrap gap-0.5 border-b border-slate-200 bg-slate-50 p-1">
          <ToolbarTextButton onClick={() => editor.chain().focus().addColumnAfter().run()}>
            + Colonna
          </ToolbarTextButton>
          <ToolbarTextButton onClick={() => editor.chain().focus().addRowAfter().run()}>+ Riga</ToolbarTextButton>
          <ToolbarTextButton onClick={() => editor.chain().focus().deleteColumn().run()}>
            − Colonna
          </ToolbarTextButton>
          <ToolbarTextButton onClick={() => editor.chain().focus().deleteRow().run()}>− Riga</ToolbarTextButton>
          <ToolbarButton onClick={() => editor.chain().focus().deleteTable().run()} label="Elimina tabella">
            <Trash2 size={14} />
          </ToolbarButton>
        </div>
      )}

      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarTextButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
    >
      {children}
    </button>
  );
}
