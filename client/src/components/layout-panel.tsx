import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Layout } from "lucide-react";

interface LayoutPanelProps {
  children: ReactNode;
  title: string;
  panelType: 'navigation' | 'details' | 'view';
  position: {
    x: number | string;
    y: number | string;
    width: number | string;
    height: string;
  };
  collapsed: boolean;
  onToggleCollapse: () => void;
  onRotateLayout: () => void;
  className?: string;
}

export default function LayoutPanel({
  children,
  title,
  panelType,
  position,
  collapsed,
  onToggleCollapse,
  onRotateLayout,
  className = ""
}: LayoutPanelProps) {
  const getCollapseIcon = () => {
    return collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />;
  };

  // Calculate actual position based on window dimensions
  const getActualPosition = () => {
    const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
    
    let actualX = position.x;
    let actualY = position.y;
    let actualWidth = position.width;
    
    if (position.x === 'center') {
      actualX = 360; // Leave space for left panel
    } else if (position.x === 'right') {
      actualX = windowWidth - (typeof position.width === 'string' ? 320 : position.width) - 20;
    }
    
    if (position.y === 'bottom-half') {
      actualY = (windowHeight / 2) + 10;
    }
    
    // Calculate width for view panel based on available space
    if (typeof actualWidth === 'string' && actualWidth.includes('calc')) {
      if (actualWidth === 'calc(100vw - 680px)') {
        actualWidth = windowWidth - 680;
      } else if (actualWidth === 'calc(100vw - 360px)') {
        actualWidth = windowWidth - 360;
      }
    }
    
    return { x: actualX, y: actualY, width: actualWidth };
  };

  const actualPosition = getActualPosition();

  return (
    <div
      className={`fixed bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-30 transition-all duration-300 ${className}`}
      style={{
        left: actualPosition.x,
        top: actualPosition.y,
        width: collapsed ? '48px' : actualPosition.width,
        height: collapsed ? '56px' : position.height,
      }}
    >
      {/* Header with controls */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-t-lg">
        <div className="flex items-center space-x-2">
          <Layout className="h-4 w-4 text-gray-400" />
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
            onClick={onRotateLayout}
            className="h-6 w-6 p-0"
            title="Roteer layout"
          >
            <Layout className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCollapse}
            className="h-6 w-6 p-0"
            title={collapsed ? "Uitklappen" : "Inklappen"}
          >
            {getCollapseIcon()}
          </Button>
        </div>
      </div>

      {/* Content */}
      {!collapsed && (
        <div className="h-full overflow-y-auto overflow-x-hidden" style={{ height: 'calc(100% - 56px)', maxHeight: 'calc(100vh - 200px)' }}>
          {children}
        </div>
      )}
    </div>
  );
}