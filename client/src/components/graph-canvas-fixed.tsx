import React, { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo } from "react";
import type { GraphData, VisualizationNode, GraphTransform } from "@shared/schema";
import { getNodeTypeColor } from "@/lib/color-utils";
import { getLayoutConfig, G6_PERFORMANCE_CONFIG } from "@/lib/g6-config";
import GraphContextMenu from "./graph-context-menu";

interface GraphCanvasProps {
  graph?: GraphData;
  selectedNode?: VisualizationNode;
  onNodeSelect: (node: VisualizationNode) => void;
  onNodeExpand: (nodeId: string) => void;
  onNodeEdit?: (node: VisualizationNode) => void;
  visibleNodes: Set<string>;
  onVisibleNodesChange: (nodes: Set<string>) => void;
  transform: GraphTransform;
  onTransformChange: (transform: GraphTransform) => void;
  editMode?: boolean;
  panelConstraints?: {
    leftPanel?: { x: number; y: number; width: number; collapsed: boolean };
    rightPanel?: { x: number; y: number; width: number; collapsed: boolean };
  };
}

// Error Boundary Component
class GraphErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Graph rendering error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

const GraphCanvas = React.memo(({
  graph,
  selectedNode,
  onNodeSelect,
  onNodeExpand,
  onNodeEdit,
  visibleNodes,
  onVisibleNodesChange,
  transform,
  onTransformChange,
  editMode = false,
  panelConstraints
}: GraphCanvasProps) => {
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [currentLayout, setCurrentLayout] = useState<'force' | 'circular' | 'radial' | 'dagre'>('circular');
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
    targetNodeId: string | null;
  }>({
    isOpen: false,
    position: { x: 0, y: 0 },
    targetNodeId: null
  });

  // Memoize processed graph data
  const processedGraphData = useMemo(() => {
    if (!graph?.nodes?.length) return null;

    const nodes = graph.nodes.slice(0, G6_PERFORMANCE_CONFIG.MAX_NODES_DISPLAY);
    const edges = graph.edges?.filter(edge => 
      nodes.some(n => n.id === edge.source) && 
      nodes.some(n => n.id === edge.target)
    ) || [];

    return {
      nodes: nodes.map(node => {
        const colors = getNodeTypeColor(node.type);
        return {
          id: node.id,
          label: node.label.length > 15 ? node.label.substring(0, 15) + '...' : node.label,
          // Remove type for default node rendering in G6 v5
          size: 25,
          style: {
            fill: colors.primary,
            stroke: colors.secondary,
            lineWidth: 2,
          },
          labelCfg: {
            style: {
              fill: '#333',
              fontSize: 10,
            },
            position: 'bottom',
            offset: 5,
          },
          originalNode: node,
        };
      }),
      edges: edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label || '',
        style: {
          stroke: '#91d5ff',
          lineWidth: 1,
          opacity: 0.8,
        },
      }))
    };
  }, [graph?.nodes, graph?.edges]);

  // Cleanup function with proper DOM isolation
  const cleanupGraph = useCallback(() => {
    // Prevent cleanup race conditions
    if (graphRef.current) {
      try {
        // Temporarily disable React's DOM management for this container
        const container = containerRef.current;
        if (container) {
          container.style.pointerEvents = 'none';
        }
        
        // Use async cleanup to avoid blocking React
        setTimeout(() => {
          try {
            if (graphRef.current) {
              graphRef.current.destroy();
              graphRef.current = null;
            }
          } catch (error) {
            console.warn('Async graph cleanup warning:', error);
          }
        }, 0);
        
      } catch (error) {
        console.warn('Graph cleanup warning:', error);
      }
    }

    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
      resizeObserverRef.current = null;
    }
  }, []);

  // Handle context menu actions
  const handleContextMenuAction = useCallback((action: string) => {
    const targetNode = graph?.nodes?.find(n => n.id === contextMenu.targetNodeId);
    if (!targetNode) return;

    switch (action) {
      case 'edit':
        onNodeEdit?.(targetNode);
        break;
      case 'expand':
        onNodeExpand(targetNode.id);
        break;
      case 'createRelation':
        // Handle relation creation
        break;
      case 'delete':
        // Handle node deletion
        break;
    }

    setContextMenu(prev => ({ ...prev, isOpen: false }));
  }, [contextMenu.targetNodeId, graph?.nodes, onNodeEdit, onNodeExpand]);

  // Create G6 graph
  const createGraph = useCallback(async () => {
    if (!containerRef.current || !processedGraphData) return;

    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const width = rect.width || 800;
    const height = rect.height || 600;

    try {
      setIsLoading(true);
      setRenderError(null);

      // Clean up existing graph with proper G6 lifecycle
      if (graphRef.current) {
        try {
          // Disable event listeners before cleanup
          graphRef.current.off();
          graphRef.current.destroy();
        } catch (error) {
          console.warn('Graph cleanup warning:', error);
        }
        graphRef.current = null;
      }
      
      // Don't manually clear container - let G6 handle its own cleanup
      // This prevents React/G6 DOM manipulation conflicts

      // Check G6 availability
      const G6 = (window as any).G6;
      if (!G6) {
        throw new Error('G6 library not available');
      }

      // Create G6 graph with proper v5 configuration
      const layoutConfig = getLayoutConfig(currentLayout);

      const graph = new G6.Graph({
        container,
        width,
        height,
        data: processedGraphData,
        layout: layoutConfig,
        node: {
          style: {
            size: 25,
            fill: '#e6f7ff',
            stroke: '#1890ff',
            lineWidth: 2,
          },
          labelText: (d: any) => d.label || d.id,
          labelPosition: 'bottom',
        },
        edge: {
          style: {
            stroke: '#91d5ff',
            lineWidth: 1,
            opacity: 0.8,
          },
        },
        behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element'],
        autoFit: 'view',
      });

      console.log('Loading G6 data:', { nodes: processedGraphData.nodes.length, edges: processedGraphData.edges.length });
      
      // Render the graph
      graph.render();

      // Bind events
      graph.on('node:click', (e: any) => {
        const nodeModel = e.item?.getModel?.() || e.item;
        const originalNode = processedGraphData.nodes.find(n => n.id === nodeModel.id)?.originalNode;
        if (originalNode) {
          onNodeSelect(originalNode);
        }
      });

      graph.on('node:contextmenu', (e: any) => {
        e.preventDefault();
        const nodeModel = e.item?.getModel?.() || e.item;
        if (nodeModel) {
          setContextMenu({
            isOpen: true,
            position: { x: e.canvasX || e.x, y: e.canvasY || e.y },
            targetNodeId: nodeModel.id as string,
          });
        }
      });

      graph.on('canvas:click', () => {
        setContextMenu(prev => ({ ...prev, isOpen: false }));
      });

      // Setup resize observer with G6 v5 compatible methods
      resizeObserverRef.current = new ResizeObserver((entries) => {
        try {
          for (const entry of entries) {
            const { width, height } = entry.contentRect;
            if (width > 0 && height > 0 && graphRef.current && typeof graphRef.current.setSize === 'function') {
              // Use G6 v5 compatible resize method with proper validation
              graphRef.current.setSize(width, height);
              if (typeof graphRef.current.fitView === 'function') {
                graphRef.current.fitView();
              }
            }
          }
        } catch (error) {
          // Completely suppress resize errors as they're not critical for functionality
        }
      });

      resizeObserverRef.current.observe(container);
      graphRef.current = graph;
      setIsLoading(false);

      console.log(`Graph rendered successfully with ${processedGraphData.nodes.length} nodes`);

    } catch (error) {
      console.error('Graph creation error:', error);
      setRenderError(error instanceof Error ? error.message : 'Unknown error');
      setIsLoading(false);
    }
  }, [processedGraphData, currentLayout, cleanupGraph, onNodeSelect]);

  // Effect for graph creation
  useEffect(() => {
    let isMounted = true;
    
    if (processedGraphData && containerRef.current && isMounted) {
      createGraph();
    }

    return () => {
      isMounted = false;
      // Use cleanup function instead of direct cleanup
      cleanupGraph();
    };
  }, [processedGraphData, createGraph, cleanupGraph]);

  // Update selected node highlight
  useEffect(() => {
    if (!graphRef.current || !selectedNode) return;

    try {
      // Clear previous selections
      graphRef.current.getNodes().forEach((node: any) => {
        graphRef.current.clearItemStates(node, ['selected']);
      });

      // Highlight selected node
      const selectedG6Node = graphRef.current.findById(selectedNode.id);
      if (selectedG6Node) {
        graphRef.current.setItemState(selectedG6Node, 'selected', true);
      }
    } catch (error) {
      console.warn('Node selection error:', error);
    }
  }, [selectedNode]);

  if (renderError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-red-50 dark:bg-red-900/20">
        <div className="text-center p-8 max-w-md">
          <div className="text-red-600 dark:text-red-400 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-red-800 dark:text-red-200 mb-2">
            Graph Rendering Error
          </h3>
          <p className="text-sm text-red-600 dark:text-red-400 mb-4">
            {renderError}
          </p>
          <button 
            onClick={createGraph}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        ref={containerRef}
        className="w-full h-full bg-white dark:bg-gray-900 rounded-lg overflow-hidden relative"
        style={{ 
          minHeight: '500px',
          minWidth: '500px',
        }}
        data-testid="graph-container"
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-900 z-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Loading graph... ({processedGraphData?.nodes?.length || 0} nodes)
              </p>
            </div>
          </div>
        )}

        {!isLoading && processedGraphData && (
          <div className="absolute top-4 left-4 text-sm text-gray-500 bg-white dark:bg-gray-800 px-2 py-1 rounded">
            {processedGraphData.nodes.length} nodes, {processedGraphData.edges.length} edges
          </div>
        )}
      </div>

      <GraphContextMenu
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        onClose={() => setContextMenu(prev => ({ ...prev, isOpen: false }))}
        onEdit={() => handleContextMenuAction('edit')}
        onCreateRelation={() => handleContextMenuAction('createRelation')}
        onDelete={() => handleContextMenuAction('delete')}
        onExpand={() => handleContextMenuAction('expand')}
      />
    </>
  );
});

GraphCanvas.displayName = 'GraphCanvas';

// Export with Error Boundary
export default function GraphCanvasWithErrorBoundary(props: GraphCanvasProps) {
  return (
    <GraphErrorBoundary
      fallback={
        <div className="w-full h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="text-center p-8">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              Graph Component Error
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              The graph visualization encountered an unexpected error.
            </p>
          </div>
        </div>
      }
    >
      <GraphCanvas {...props} />
    </GraphErrorBoundary>
  );
}