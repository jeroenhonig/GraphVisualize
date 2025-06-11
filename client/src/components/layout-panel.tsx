import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Layout } from "lucide-react";

interface LayoutPanelProps {
  children: ReactNode;
  title: string;
  panelType: 'navigation' | 'view';
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
  graphInfo?: {
    name: string;
    description?: string;
    nodeCount: number;
    visibleCount: number;
  };
}

export default function LayoutPanel({
  children,
  title,
  panelType,
  position,
  collapsed,
  onToggleCollapse,
  onRotateLayout,
  className = "",
  graphInfo
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
    
    // Handle calc() expressions for x position
    if (typeof position.x === 'string') {
      if (position.x === 'calc(100vw - 320px)') {
        actualX = windowWidth - 320;
      } else if (position.x.includes('calc')) {
        // Parse other calc expressions if needed
        actualX = position.x;
      }
    }
    
    // Handle calc() expressions for y position
    if (typeof position.y === 'string') {
      if (position.y === 'calc(50vh + 40px)') {
        actualY = (windowHeight / 2) + 40;
      } else if (position.y.includes('calc')) {
        actualY = position.y;
      }
    }
    
    // Handle calc() expressions for width
    if (typeof actualWidth === 'string' && actualWidth.includes('calc')) {
      if (actualWidth === 'calc(100vw - 640px)') {
        actualWidth = windowWidth - 640;
      } else if (actualWidth === 'calc(100vw - 320px)') {
        actualWidth = windowWidth - 320;
      } else {
        // For other calc expressions, keep as string for CSS
        actualWidth = actualWidth;
      }
    }
    
    return { x: actualX, y: actualY, width: actualWidth };
  };

  const actualPosition = getActualPosition();

  return (
    <div
      className={`fixed bg-white dark:bg-gray-900 z-30 transition-all duration-300 ${className}`}
      style={{
        left: actualPosition.x,
        top: actualPosition.y,
        width: collapsed ? '48px' : actualPosition.width,
        height: collapsed ? '56px' : position.height,
      }}
    >
      {/* Header with controls */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center space-x-2 flex-1">
          <Layout className="h-4 w-4 text-gray-400" />
          {!collapsed && (
            <div className="flex-1">
              <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {title}
              </span>
              {panelType === 'view' && graphInfo && (
                <div className="mt-1">
                  <div className="text-xs font-medium text-gray-900 dark:text-white">
                    {graphInfo.name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-500">
                    {graphInfo.visibleCount} van {graphInfo.nodeCount} nodes zichtbaar
                  </div>
                </div>
              )}
            </div>
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
            {getCollapseIcon()}
          </Button>
        </div>
      </div>

      {/* Content - Always render but hide visually when collapsed */}
      <div 
        className="h-full overflow-y-auto overflow-x-hidden" 
        style={{ 
          height: 'calc(100% - 56px)',
          visibility: collapsed ? 'hidden' : 'visible',
          position: collapsed ? 'absolute' : 'relative',
          width: '100%'
        }}
      >
        {children}
      </div>
    </div>
  );
}