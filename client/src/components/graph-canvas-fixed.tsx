import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import type { GraphData, VisualizationNode, GraphTransform } from "@shared/schema";
import { getNodeTypeColor } from "@/lib/color-utils";
import { getLayoutConfig } from "@/lib/g6-config";
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

export default function GraphCanvas({
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
}: GraphCanvasProps) {
  const graphRef = useRef<any>(null);
  const [containerElement, setContainerElement] = useState<HTMLDivElement | null>(null);
  const [containerReady, setContainerReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [currentLayout, setCurrentLayout] = useState<'force' | 'circular' | 'radial' | 'dagre'>('circular');
  const [loadedNodeCount, setLoadedNodeCount] = useState(100);
  const [nodeCount, setNodeCount] = useState(0);
  
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

  // Extract nodes and edges from graph data
  const nodes = graph?.nodes || [];
  const edges = graph?.edges || [];

  // Simple callback ref that works immediately
  const setContainerRef = useCallback((node: HTMLDivElement | null) => {
    console.log('Container callback ref called with node:', !!node);
    if (node) {
      console.log('Container mounting immediately:', {
        offsetWidth: node.offsetWidth,
        offsetHeight: node.offsetHeight,
        isConnected: node.isConnected
      });
      setContainerElement(node);
      setContainerReady(true);
    } else {
      console.log('Container ref cleared');
      setContainerElement(null);
      setContainerReady(false);
    }
  }, []);

  // Handle context menu actions
  const handleContextMenuAction = useCallback((action: string) => {
    const targetNode = nodes.find(n => n.id === contextMenu.targetNodeId);
    if (!targetNode) return;

    switch (action) {
      case 'edit':
        if (onNodeEdit) onNodeEdit(targetNode);
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
  }, [contextMenu.targetNodeId, nodes, onNodeEdit, onNodeExpand]);

  // Main graph creation effect
  useEffect(() => {
    console.log('Graph creation useEffect triggered:', { 
      hasContainer: !!containerElement, 
      containerReady,
      hasGraph: !!graph,
      nodeCount: nodes.length,
      edgeCount: edges.length
    });
    
    if (!graph || nodes.length === 0 || !containerReady || !containerElement) {
      console.log('Early return: missing requirements', {
        hasGraph: !!graph,
        hasNodes: nodes.length > 0,
        containerReady,
        hasContainer: !!containerElement
      });
      return;
    }

    const createOptimizedGraph = () => {
      const startTime = performance.now();
      
      try {
        setIsLoading(true);
        setRenderError(null);

        const container = containerElement;
        if (!container) {
          throw new Error('Container reference is null');
        }

        console.log('Container validation passed:', {
          tagName: container.tagName,
          offsetWidth: container.offsetWidth,
          offsetHeight: container.offsetHeight,
          isConnected: container.isConnected
        });

        // Clear existing graph
        if (graphRef.current) {
          try {
            graphRef.current.clear();
            graphRef.current.destroy();
          } catch (cleanupError) {
            console.warn('Cleanup warning:', cleanupError);
          }
          graphRef.current = null;
        }
        
        container.innerHTML = '';
        const width = container.clientWidth || 800;
        const height = container.clientHeight || 600;

        // Progressive loading strategy
        const targetNodeCount = Math.min(nodes.length, loadedNodeCount);
        const nodesToRender = nodes.slice(0, targetNodeCount);
        const edgesToRender = edges.filter(edge => 
          nodesToRender.some(n => n.id === edge.source) && 
          nodesToRender.some(n => n.id === edge.target)
        );

        console.log('Creating G6 graph with:', { 
          totalNodes: nodes.length,
          renderingNodes: nodesToRender.length, 
          edgeCount: edgesToRender.length,
          containerDimensions: { width, height }
        });

        // Get G6 library
        const G6 = (window as any).G6;
        if (!G6) {
          throw new Error('G6 library not available');
        }

        // Prepare data in correct G6 format with centered positions
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) * 0.3;
        
        const g6Data = {
          nodes: nodesToRender.map((node, index) => {
            const colors = getNodeTypeColor(node.type);
            // Create circular layout if no positions
            const angle = (index / nodesToRender.length) * 2 * Math.PI;
            const x = node.x || centerX + Math.cos(angle) * radius;
            const y = node.y || centerY + Math.sin(angle) * radius;
            
            return {
              id: node.id,
              label: node.label.length > 20 ? node.label.substring(0, 20) + '...' : node.label,
              x: x,
              y: y,
              style: {
                fill: colors.secondary || '#e6f7ff',
                stroke: colors.primary || '#1890ff',
                lineWidth: 2
              }
            };
          }),
          edges: edgesToRender.map(edge => ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            label: edge.label || ''
          }))
        };

        console.log('Loading G6 data:', {
          nodes: g6Data.nodes.length,
          edges: g6Data.edges.length
        });

        // G6 v5 configuration with explicit renderer
        const graphConfig = {
          container: container,
          width: width,
          height: height,
          data: g6Data,
          renderer: 'canvas',
          modes: {
            default: ['drag-canvas', 'zoom-canvas', 'drag-node']
          }
        };

        // Create G6 graph instance
        const graphInstance = new G6.Graph(graphConfig);
        
        // Debug: Check if nodes have valid positions
        console.log('Sample node positions:', g6Data.nodes.slice(0, 3).map(n => ({
          id: n.id,
          x: n.x,
          y: n.y,
          label: n.label
        })));
        
        // Force render and inspect DOM
        setTimeout(() => {
          try {
            graphInstance.render();
            graphInstance.fitView();
            
            // Debug DOM structure
            const canvasElements = container.querySelectorAll('canvas');
            const svgElements = container.querySelectorAll('svg');
            console.log('Canvas/SVG elements found:', {
              canvas: canvasElements.length,
              svg: svgElements.length,
              containerChildren: container.children.length
            });
            
            // Force canvas visibility
            canvasElements.forEach((canvas, i) => {
              console.log(`Canvas ${i}:`, {
                width: canvas.width,
                height: canvas.height,
                style: canvas.style.cssText,
                visible: canvas.style.display !== 'none'
              });
            });
            
            console.log('Graph render and fit completed');
          } catch (error) {
            console.error('Render error:', error);
          }
        }, 100);
        
        console.log('G6 v5 graph created, will render with delay');

        // Bind events
        graphInstance.on('node:click', (e: any) => {
          const nodeData = e.item?.getModel ? e.item.getModel() : e.item;
          if (nodeData && onNodeSelect) {
            const originalNode = nodes.find(n => n.id === nodeData.id);
            if (originalNode) {
              onNodeSelect(originalNode);
            }
          }
        });

        graphInstance.on('node:contextmenu', (e: any) => {
          e.preventDefault();
          const nodeData = e.item?.getModel ? e.item.getModel() : e.item;
          if (nodeData) {
            setContextMenu({
              isOpen: true,
              position: { x: e.canvasX || e.x, y: e.canvasY || e.y },
              targetNodeId: nodeData.id as string,
            });
          }
        });

        graphInstance.on('canvas:click', () => {
          setContextMenu(prev => ({ ...prev, isOpen: false }));
        });

        // Store graph reference
        graphRef.current = graphInstance;

        // Performance monitoring
        const endTime = performance.now();
        console.log(`Graph rendered successfully in ${(endTime - startTime).toFixed(2)}ms`);

        setIsLoading(false);
        setNodeCount(nodesToRender.length);

        // Progressive loading continuation
        if (nodesToRender.length < nodes.length) {
          setTimeout(() => {
            setLoadedNodeCount(prev => Math.min(prev + 100, nodes.length));
          }, 1000);
        }

      } catch (error) {
        console.error('Graph creation error:', error);
        console.error('Error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          name: error instanceof Error ? error.name : undefined
        });
        setRenderError(`Failed to create graph: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setIsLoading(false);
      }
    };

    console.log('All requirements met, creating graph');
    createOptimizedGraph();
    
    // Return cleanup function
    return () => {
      if (graphRef.current) {
        try {
          graphRef.current.clear();
          graphRef.current.destroy();
        } catch (e) {
          console.warn('Cleanup error:', e);
        }
        graphRef.current = null;
      }
    };
  }, [graph, nodes, edges, containerReady, containerElement, currentLayout, loadedNodeCount, onNodeSelect]);

  // Auto-resize handler with ResizeObserver
  useEffect(() => {
    if (!containerElement || !graphRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0 && graphRef.current) {
          try {
            graphRef.current.changeSize(width, height);
          } catch (error) {
            console.warn('Resize error:', error);
          }
        }
      }
    });

    resizeObserver.observe(containerElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, [containerElement]);

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
        </div>
      </div>
    );
  }

  // Always show container status for debugging
  const debugInfo = {
    hasGraph: !!graph,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    containerReady,
    hasContainer: !!containerElement,
    g6Available: typeof window !== 'undefined' && !!(window as any).G6
  };

  // Always render container to force mounting - show loading inside
  const shouldShowLoading = isLoading;

  return (
    <>
      <div
        ref={setContainerRef}
        className="w-full h-full bg-white dark:bg-gray-900 rounded-lg overflow-hidden relative"
        style={{ 
          minHeight: '500px',
          minWidth: '500px',
          width: '100%',
          height: '100%',
          position: 'relative',
          display: 'block'
        }}
        data-testid="graph-container"
      >
        {shouldShowLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-900">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Optimizing graph layout... ({nodeCount} nodes)
              </p>
              <div className="mt-4 text-xs text-gray-500">
                Debug: {JSON.stringify(debugInfo)}
              </div>
            </div>
          </div>
        ) : (
          <div className="absolute top-4 left-4 text-sm text-gray-500">
            Container Status: {containerReady ? 'Ready' : 'Not Ready'} | 
            Graph: {graph ? `${nodes.length} nodes` : 'No graph'} |
            G6: {typeof window !== 'undefined' && (window as any).G6 ? 'Loaded' : 'Missing'}
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
}