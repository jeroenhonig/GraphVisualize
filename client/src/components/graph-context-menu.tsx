import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Edit, Link, Trash2, Expand } from "lucide-react";

interface GraphContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  onEdit: () => void;
  onCreateRelation: () => void;
  onDelete: () => void;
  onExpand: () => void;
}

export default function GraphContextMenu({
  isOpen,
  position,
  onClose,
  onEdit,
  onCreateRelation,
  onDelete,
  onExpand
}: GraphContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={menuRef}
      className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 min-w-48"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <div className="p-1">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 h-8"
          onClick={() => {
            onEdit();
            onClose();
          }}
        >
          <Edit size={14} />
          Bewerk Node
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 h-8"
          onClick={() => {
            onCreateRelation();
            onClose();
          }}
        >
          <Link size={14} />
          Maak Relatie
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 h-8"
          onClick={() => {
            onExpand();
            onClose();
          }}
        >
          <Expand size={14} />
          Uitbreiden
        </Button>
        <hr className="my-1 border-gray-200 dark:border-gray-700" />
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 h-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
          onClick={() => {
            onDelete();
            onClose();
          }}
        >
          <Trash2 size={14} />
          Verwijder Node
        </Button>
      </div>
    </div>,
    document.body
  );
}