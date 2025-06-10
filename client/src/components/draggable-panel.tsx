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
  otherPanels?: Array<{ position: { x: number; y: number }; width: number; collapsed: boolean; side: "left" | "right" }>;
}

interface SnapZone {
  type: 'left' | 'right' | 'top' | 'bottom';
  x: number;
  y: number;
  width: number;
  height: number;
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
  otherPanels = [],
}: DraggablePanelProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [snapPreview, setSnapPreview] = useState<SnapZone | null>(null);
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

  // Check for collision with other panels
  const checkCollision = (x: number, y: number, currentWidth: number, currentHeight: number) => {
    const currentPanel = { x, y, width: currentWidth, height: currentHeight };
    
    for (const otherPanel of otherPanels) {
      // Check overlap regardless of side - panels should never overlap
      const otherWidth = otherPanel.collapsed ? 48 : otherPanel.width;
      const otherHeight = otherPanel.collapsed ? 56 : Math.max(400, window.innerHeight - 180);
      
      // Check if rectangles overlap (with generous margin to prevent any overlap)
      const margin = 20; // Increased from 5 to prevent any visual overlap
      if (!(currentPanel.x + currentPanel.width + margin <= otherPanel.position.x ||
            otherPanel.position.x + otherWidth + margin <= currentPanel.x ||
            currentPanel.y + currentPanel.height + margin <= otherPanel.position.y ||
            otherPanel.position.y + otherHeight + margin <= currentPanel.y)) {
        return otherPanel; // Return the colliding panel
      }
    }
    return null;
  };

  // Find the best position to avoid collisions with smart distribution
  const findNonCollidingPosition = (desiredX: number, desiredY: number): { x: number; y: number } => {
    const headerHeight = 80;
    const snapMargin = 10;
    const gap = 25; // Increased gap between panels to prevent overlap
    const currentWidth = collapsed ? 48 : width;
    const currentHeight = collapsed ? 56 : Math.max(400, window.innerHeight - headerHeight - 100);
    
    // Check if desired position has collision
    const collision = checkCollision(desiredX, desiredY, currentWidth, currentHeight);
    if (!collision) {
      return { x: desiredX, y: desiredY };
    }
    
    // Smart side determination: prefer balanced distribution
    const leftSnapX = snapMargin;
    const rightSnapX = window.innerWidth - currentWidth - snapMargin;
    
    // Count panels on each side
    const leftPanels = otherPanels.filter(p => p.position.x < window.innerWidth / 2);
    const rightPanels = otherPanels.filter(p => p.position.x >= window.innerWidth / 2);
    
    // Choose side with fewer panels, or based on desired position
    let targetX: number;
    if (leftPanels.length < rightPanels.length) {
      targetX = leftSnapX;
    } else if (rightPanels.length < leftPanels.length) {
      targetX = rightSnapX;
    } else {
      // Equal panels on both sides, use desired position
      targetX = desiredX < window.innerWidth / 2 ? leftSnapX : rightSnapX;
    }
    
    // If specifically snapping to a side, override the smart choice
    if (Math.abs(desiredX - leftSnapX) < 100) {
      targetX = leftSnapX;
    } else if (Math.abs(desiredX - rightSnapX) < 100) {
      targetX = rightSnapX;
    }
    
    // Get panels that would overlap horizontally with this position
    const conflictingPanels = otherPanels
      .filter(panel => {
        const panelX = panel.position.x;
        const panelWidth = panel.collapsed ? 48 : panel.width;
        
        // Check horizontal overlap with margin
        return !(targetX + currentWidth + gap <= panelX || panelX + panelWidth + gap <= targetX);
      })
      .map(panel => ({
        ...panel,
        width: panel.collapsed ? 48 : panel.width,
        height: panel.collapsed ? 56 : Math.max(400, window.innerHeight - headerHeight - 100)
      }))
      .sort((a, b) => a.position.y - b.position.y);
    
    // Find available Y position
    let bestY = headerHeight + snapMargin;
    
    // Try to place at desired Y first if there are no conflicts
    if (conflictingPanels.length === 0) {
      bestY = Math.max(bestY, desiredY);
    } else {
      // Find first gap that fits
      for (let i = 0; i <= conflictingPanels.length; i++) {
        let gapStart = headerHeight + snapMargin;
        let gapEnd = window.innerHeight - currentHeight - snapMargin;
        
        if (i > 0) {
          // Gap after panel i-1
          gapStart = conflictingPanels[i - 1].position.y + conflictingPanels[i - 1].height + gap;
        }
        
        if (i < conflictingPanels.length) {
          // Gap before panel i
          gapEnd = conflictingPanels[i].position.y - gap;
        }
        
        // Check if current panel fits in this gap
        if (gapEnd - gapStart >= currentHeight) {
          bestY = Math.max(gapStart, Math.min(desiredY, gapEnd - currentHeight));
          break;
        }
      }
    }
    
    // Final bounds check
    bestY = Math.max(headerHeight + snapMargin, Math.min(bestY, window.innerHeight - currentHeight - snapMargin));
    
    return { x: targetX, y: bestY };
  };

  // Get snap zones for current viewport (simplified for vertical stacking)
  const getSnapZones = (): SnapZone[] => {
    const headerHeight = 80;
    const snapMargin = 10;
    const panelHeight = collapsed ? 56 : Math.max(400, window.innerHeight - headerHeight - 100);
    
    return [
      // Left edge snap
      {
        type: 'left',
        x: snapMargin,
        y: headerHeight + snapMargin,
        width: width,
        height: panelHeight,
      },
      // Right edge snap
      {
        type: 'right',
        x: window.innerWidth - width - snapMargin,
        y: headerHeight + snapMargin,
        width: width,
        height: panelHeight,
      },
    ];
  };

  // Check if position is close to a snap zone and find non-colliding position
  const getSnapPosition = (x: number, y: number): { snappedPos: { x: number; y: number }; snapZone: SnapZone | null } => {
    const snapThreshold = 40;
    const snapZones = getSnapZones();
    
    // First check if we're close to a snap zone
    for (const zone of snapZones) {
      const distanceX = Math.abs(x - zone.x);
      
      if (distanceX < snapThreshold) {
        // Try to snap to this side, but find a non-colliding position
        const nonCollidingPos = findNonCollidingPosition(zone.x, y);
        return {
          snappedPos: nonCollidingPos,
          snapZone: {
            ...zone,
            x: nonCollidingPos.x,
            y: nonCollidingPos.y
          }
        };
      }
    }
    
    // If no snap zone, still check for collisions and adjust if needed
    const nonCollidingPos = findNonCollidingPosition(x, y);
    return { snappedPos: nonCollidingPos, snapZone: null };
  };

  // Dragging logic with flexible collision prevention
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const rawX = e.clientX - dragOffset.x;
        const rawY = e.clientY - dragOffset.y;
        
        // Keep panel within viewport bounds
        const headerHeight = 80;
        const currentWidth = collapsed ? 48 : width;
        const currentHeight = collapsed ? 56 : Math.max(400, window.innerHeight - headerHeight - 100);
        const maxX = window.innerWidth - currentWidth;
        const maxY = window.innerHeight - currentHeight;
        
        // Constrain to viewport first
        const constrainedX = Math.max(0, Math.min(rawX, maxX));
        const constrainedY = Math.max(headerHeight, Math.min(rawY, maxY));
        
        // Improved snap zone detection that works across the entire screen
        let snapZone = null;
        
        // Define snap positions
        const leftSnapX = 10;
        const rightSnapX = window.innerWidth - currentWidth - 10;
        const screenQuarter = window.innerWidth / 4;
        const screenThreeQuarters = (window.innerWidth * 3) / 4;
        
        // More generous snap detection: left half of screen snaps left, right half snaps right
        const isNearLeftSnap = constrainedX < window.innerWidth / 2;
        const isNearRightSnap = constrainedX >= window.innerWidth / 2;
        
        // Also check for edge proximity for stronger snapping
        const isCloseToLeftEdge = constrainedX < screenQuarter;
        const isCloseToRightEdge = constrainedX > screenThreeQuarters;
        
        // Always check for collisions - no exceptions
        const hasCollision = checkCollision(constrainedX, constrainedY, currentWidth, currentHeight);
        
        let finalPosition;
        
        // Always use collision detection if there's any overlap
        if (hasCollision) {
          finalPosition = findNonCollidingPosition(constrainedX, constrainedY);
        } else {
          finalPosition = { x: constrainedX, y: constrainedY };
        }
        
        // Handle snapping based on screen position
        if (isNearLeftSnap || isCloseToLeftEdge) {
          // Snap to left side
          const targetPosition = findNonCollidingPosition(leftSnapX, finalPosition.y);
          finalPosition = targetPosition;
          
          snapZone = {
            type: 'left' as const,
            x: finalPosition.x,
            y: finalPosition.y,
            width: currentWidth,
            height: currentHeight
          };
        } else if (isNearRightSnap || isCloseToRightEdge) {
          // Snap to right side
          const targetPosition = findNonCollidingPosition(rightSnapX, finalPosition.y);
          finalPosition = targetPosition;
          
          snapZone = {
            type: 'right' as const,
            x: finalPosition.x,
            y: finalPosition.y,
            width: currentWidth,
            height: currentHeight
          };
        }
        
        setSnapPreview(snapZone);
        onPositionChange(finalPosition);
      }
    };

    const handleMouseUp = () => {
      if (isDragging) {
        // Force final collision check on mouse up
        const headerHeight = 80;
        const currentWidth = collapsed ? 48 : width;
        const currentHeight = collapsed ? 56 : Math.max(400, window.innerHeight - headerHeight - 100);
        
        const hasCollision = checkCollision(position.x, position.y, currentWidth, currentHeight);
        if (hasCollision) {
          // Find non-colliding position and apply it
          const safePosition = findNonCollidingPosition(position.x, position.y);
          onPositionChange(safePosition);
        }
      }
      
      setIsDragging(false);
      setSnapPreview(null);
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

  // Aggressive automatic collision resolution effect
  useEffect(() => {
    if (isDragging) return; // Don't interfere while dragging
    
    const headerHeight = 80;
    const currentWidth = collapsed ? 48 : width;
    const currentHeight = collapsed ? 56 : Math.max(400, window.innerHeight - headerHeight - 100);
    
    const hasCollision = checkCollision(position.x, position.y, currentWidth, currentHeight);
    if (hasCollision) {
      // Force immediate resolution with timeout to prevent infinite loops
      const timer = setTimeout(() => {
        const safePosition = findNonCollidingPosition(position.x, position.y);
        onPositionChange(safePosition);
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [position, width, collapsed, otherPanels, isDragging]);

  // Additional effect to handle window resize and ensure no overlaps
  useEffect(() => {
    const handleWindowResize = () => {
      if (isDragging) return;
      
      const headerHeight = 80;
      const currentWidth = collapsed ? 48 : width;
      const currentHeight = collapsed ? 56 : Math.max(400, window.innerHeight - headerHeight - 100);
      
      const hasCollision = checkCollision(position.x, position.y, currentWidth, currentHeight);
      if (hasCollision) {
        const safePosition = findNonCollidingPosition(position.x, position.y);
        onPositionChange(safePosition);
      }
    };
    
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [position, width, collapsed, otherPanels, isDragging]);

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
    <>
      {/* Snap Preview Overlay */}
      {isDragging && snapPreview && (
        <div
          className="fixed bg-blue-500/20 border-2 border-blue-500 border-dashed rounded-lg z-20 pointer-events-none"
          style={{
            left: snapPreview.x,
            top: snapPreview.y,
            width: snapPreview.width,
            height: snapPreview.height,
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-blue-500 text-white px-3 py-1 rounded-md text-sm font-medium">
              Snap naar {snapPreview.type === 'left' ? 'links' : snapPreview.type === 'right' ? 'rechts' : snapPreview.type === 'top' ? 'boven' : 'onder'}
            </div>
          </div>
        </div>
      )}

      <div
        ref={panelRef}
        className={`fixed bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-30 transition-all duration-200 ${
          isDragging ? 'shadow-2xl scale-105' : 'shadow-lg'
        } ${className}`}
        style={{
          left: position.x,
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
        <div className="flex h-full" style={{ height: 'calc(100% - 56px)' }}>
          {side === 'left' && (
            <div className="flex-1 overflow-auto">
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
            <div className="flex-1 overflow-auto">
              {children}
            </div>
          )}
        </div>
      )}
    </div>
    </>
  );
}