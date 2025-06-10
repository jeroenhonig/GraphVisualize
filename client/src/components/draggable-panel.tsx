import { useState, useRef, useEffect, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, GripVertical, Move, Minimize2, Maximize2 } from "lucide-react";

interface DraggablePanelProps {
  children: ReactNode;
  title: string;
  position: { x: number; y: number };
  width: number;
  collapsed: boolean;
  side: "left" | "right";
  onPositionChange: (position: { x: number; y: number }) => void;
  onWidthChange: (width: number) => void;
  onToggleCollapse: () => void;
  className?: string;
}

export default function DraggablePanel({
  children,
  title,
  position,
  width,
  collapsed,
  side,
  onPositionChange,
  onWidthChange,
  onToggleCollapse,
  className = "",
}: DraggablePanelProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<HTMLDivElement>(null);

  // Handle window resize to keep panels in bounds
  useEffect(() => {
    const handleResize = () => {
      if (panelRef.current) {
        const rect = panelRef.current.getBoundingClientRect();
        const maxX = window.innerWidth - rect.width;
        const maxY = window.innerHeight - rect.height;
        
        if (position.x > maxX || position.y > maxY) {
          onPositionChange({
            x: Math.min(position.x, Math.max(0, maxX)),
            y: Math.min(position.y, Math.max(80, maxY)) // 80px for header
          });
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [position, onPositionChange]);

  // Dragging logic
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newX = e.clientX - dragOffset.x;
        const newY = e.clientY - dragOffset.y;
        
        // Keep panel within viewport bounds
        const maxX = window.innerWidth - width;
        const maxY = window.innerHeight - 400; // Min height for panel
        
        onPositionChange({
          x: Math.max(0, Math.min(newX, maxX)),
          y: Math.max(80, Math.min(newY, maxY)) // 80px for header
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, width, onPositionChange]);

  // Resizing logic
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing) {
        const rect = panelRef.current?.getBoundingClientRect();
        if (rect) {
          let newWidth;
          if (side === 'left') {
            newWidth = e.clientX - rect.left;
          } else {
            newWidth = rect.right - e.clientX;
          }
          onWidthChange(Math.max(200, Math.min(600, newWidth)));
        }
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, side, onWidthChange]);

  const handleDragStart = (e: React.MouseEvent) => {
    if (panelRef.current) {
      const rect = panelRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      setIsDragging(true);
    }
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
  };

  const collapsedWidth = 48;
  const panelWidth = collapsed ? collapsedWidth : width;

  return (
    <div
      ref={panelRef}
      className={`fixed bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-30 transition-all duration-200 ${className}`}
      style={{
        left: side === 'left' ? position.x : `calc(100vw - ${position.x + panelWidth}px)`,
        top: position.y,
        width: panelWidth,
        height: collapsed ? '56px' : 'calc(100vh - 120px)',
        cursor: isDragging ? 'grabbing' : 'default'
      }}
    >
      {/* Header with drag handle and controls */}
      <div 
        className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-t-lg cursor-grab active:cursor-grabbing"
        onMouseDown={handleDragStart}
      >
        <div className="flex items-center space-x-2">
          <Move className="h-4 w-4 text-gray-400" />
          {!collapsed && (
            <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {title}
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCollapse}
            className="h-6 w-6 p-0"
            title={collapsed ? "Uitklappen" : "Inklappen"}
          >
            {collapsed ? (
              side === 'left' ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />
            ) : (
              side === 'left' ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
            )}
          </Button>
        </div>
      </div>

      {/* Content */}
      {!collapsed && (
        <div className="flex h-full">
          {side === 'left' && (
            <div className="flex-1 overflow-hidden">
              {children}
            </div>
          )}
          
          {/* Resize handle */}
          <div
            ref={resizeRef}
            className={`w-1 bg-gray-300 dark:bg-gray-600 hover:bg-blue-500 cursor-col-resize transition-colors ${
              side === 'left' ? 'order-last' : 'order-first'
            }`}
            onMouseDown={handleResizeStart}
            title="Sleep om grootte aan te passen"
          />
          
          {side === 'right' && (
            <div className="flex-1 overflow-hidden">
              {children}
            </div>
          )}
        </div>
      )}
    </div>
  );
}