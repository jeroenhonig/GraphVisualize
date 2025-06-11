import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type { GraphData, VisualizationNode, GraphTransform } from "@shared/schema";
import { getNodeTypeColor } from "@/lib/color-utils";
import { getLayoutConfig, G6_PERFORMANCE_CONFIG, NODE_STYLES, EDGE_STYLES } from "@/lib/g6-config";
import GraphContextMenu from "./graph-context-menu";

interface G6NodeModel {
  id: string;
  x?: number;
  y?: number;
  [key: string]: any;
}

interface G6GraphInstance {
  render: () => void;
  destroy: () => void;
  clear: () => void;
  setElementState: (id: string, state: string, value: boolean) => void;
  updateLayout: (config: any) => void;
  getZoom: () => number;
  zoomTo: (ratio: number) => void;
  fitView: (padding?: number) => void;
  changeSize: (width: number, height: number) => void;
  on: (event: string, handler: Function) => void;
  off: (event: string, handler?: Function) => void;
}

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

export default function GraphCanvasOptimized({
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
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const keyDownHandlerRef = useRef<((e: KeyboardEvent) => void) | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [currentLayout, setCurrentLayout] = useState<'force' | 'circular' | 'radial' | 'dagre'>('circular');
  const [loadedNodeCount, setLoadedNodeCount] = useState(100);
  
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

  // Relation mode state
  const [relationMode, setRelationMode] = useState(false);
  const [relationSourceNode, setRelationSourceNode] = useState<string | null>(null);

  // Performance monitoring
  const nodeCount = graph?.nodes?.length || 0;
  const edgeCount = graph?.edges?.length || 0;

  // Progressive loading functie
  const loadMoreNodes = useCallback(() => {
    if (loadedNodeCount < nodeCount) {
      setLoadedNodeCount(prev => Math.min(prev + 50, nodeCount));
    }
  }, [loadedNodeCount, nodeCount]);

  // Memoized data preparation with performance optimization
  const { nodes, edges } = useMemo(() => {
    if (!graph) return { nodes: [], edges: [] };

    // Performance warning for large datasets
    if (nodeCount > G6_PERFORMANCE_CONFIG.MAX_NODES_WARNING) {
      console.warn(`Performance: ${nodeCount} nodes detected. Consider filtering.`);
    }

    const visibleNodeIds = visibleNodes.size > 0 
      ? Array.from(visibleNodes) 
      : graph.nodes.map((n: any) => n.id);
    
    const processedNodes = graph.nodes
      .filter((node: any) => visibleNodeIds.includes(node.id))
      .slice(0, Math.min(G6_PERFORMANCE_CONFIG.MAX_NODES_DISPLAY, loadedNodeCount))
      .map((node: any, index: number) => {
        const colorData = getNodeTypeColor(node.type);
        
        // Circulaire posities zonder layout engine
        const totalNodes = Math.min(graph.nodes.length, G6_PERFORMANCE_CONFIG.MAX_NODES_DISPLAY);
        const angle = (index / totalNodes) * Math.PI * 2;
        const radius = 200;
        const centerX = 400;
        const centerY = 300;
        
        return {
          id: node.id,
          label: node.label.length > 15 ? node.label.substring(0, 15) + '...' : node.label,
          x: node.x || (centerX + Math.cos(angle) * radius),
          y: node.y || (centerY + Math.sin(angle) * radius),
          data: {
            ...node,
            colorData,
            nodeData: node.data
          }
        };
      });

    const processedEdges = graph.edges
      .filter((edge: any) => 
        processedNodes.find((n: any) => n.id === edge.source) && 
        processedNodes.find((n: any) => n.id === edge.target)
      )
      .map((edge: any) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label || '',
        data: edge.data || {},
        type: edge.type || 'line'
      }));

    return { nodes: processedNodes, edges: processedEdges };
  }, [graph, visibleNodes, nodeCount]);

  // Layout switching with error handling
  const switchLayout = useCallback((layoutType: typeof currentLayout) => {
    if (!graphRef.current) return;
    
    try {
      const layoutConfig = getLayoutConfig(layoutType);
      graphRef.current.updateLayout(layoutConfig);
      setCurrentLayout(layoutType);
    } catch (error) {
      console.error('Layout switch failed:', error);
      if (layoutType !== 'force') {
        switchLayout('force');
      }
    }
  }, []);

  // Optimized zoom controls
  const zoomIn = useCallback(() => {
    if (!graphRef.current) return;
    try {
      const currentZoom = graphRef.current.getZoom();
      graphRef.current.zoomTo(Math.min(currentZoom * 1.2, 3));
    } catch (error) {
      console.error('Zoom in failed:', error);
    }
  }, []);

  const zoomOut = useCallback(() => {
    if (!graphRef.current) return;
    try {
      const currentZoom = graphRef.current.getZoom();
      graphRef.current.zoomTo(Math.max(currentZoom * 0.8, 0.1));
    } catch (error) {
      console.error('Zoom out failed:', error);
    }
  }, []);

  const fitView = useCallback(() => {
    if (!graphRef.current) return;
    try {
      graphRef.current.fitView(20);
    } catch (error) {
      console.error('Fit view failed:', error);
    }
  }, []);

  // Context menu handlers with proper node data
  const handleContextMenuAction = useCallback((action: string) => {
    if (!contextMenu.targetNodeId) return;

    const targetNode = nodes.find((n: any) => n.id === contextMenu.targetNodeId);
    if (!targetNode) return;

    const visualizationNode = {
      id: targetNode.data.id,
      label: targetNode.data.label,
      type: targetNode.data.type,
      data: targetNode.data.nodeData || {},
      x: targetNode.data.x,
      y: targetNode.data.y
    };

    switch (action) {
      case 'edit':
        if (onNodeEdit) {
          onNodeEdit(visualizationNode);
        }
        break;
      case 'expand':
        onNodeExpand(contextMenu.targetNodeId);
        break;
      case 'createRelation':
        setRelationMode(true);
        setRelationSourceNode(contextMenu.targetNodeId);
        if (graphRef.current) {
          try {
            graphRef.current.setElementState(contextMenu.targetNodeId, 'relation-source', true);
          } catch (error) {
            console.error('Failed to set relation state:', error);
          }
        }
        break;
      case 'delete':
        console.log('Delete node:', contextMenu.targetNodeId);
        break;
    }
    
    setContextMenu(prev => ({ ...prev, isOpen: false }));
  }, [contextMenu.targetNodeId, nodes, onNodeEdit, onNodeExpand]);

  // Main graph creation effect with comprehensive error handling
  useEffect(() => {
    if (!containerRef.current || !graph) return;

    const createOptimizedGraph = async () => {
      const startTime = performance.now();
      
      try {
        setIsLoading(true);
        setRenderError(null);

        const G6Module = await import('@antv/g6');
        const { Graph } = G6Module;

        // Cleanup previous instance
        if (graphRef.current) {
          try {
            graphRef.current.clear();
            graphRef.current.destroy();
          } catch (cleanupError) {
            console.warn('Cleanup warning:', cleanupError);
          }
          graphRef.current = null;
        }

        const container = containerRef.current;
        if (!container) throw new Error('Container not available');
        
        container.innerHTML = '';
        const width = container.clientWidth || 800;
        const height = container.clientHeight || 600;

        // Bereken beschikbare ruimte op basis van panel constraints
        const calculateGraphCenter = () => {
          const leftOffset = panelConstraints?.leftPanel && !panelConstraints.leftPanel.collapsed 
            ? panelConstraints.leftPanel.width 
            : 0;
          const rightOffset = panelConstraints?.rightPanel && !panelConstraints.rightPanel.collapsed 
            ? panelConstraints.rightPanel.width 
            : 0;
          
          const availableWidth = width - leftOffset - rightOffset;
          const centerX = leftOffset + (availableWidth / 2);
          const centerY = height / 2;
          
          return [centerX, centerY];
        };

        // Create optimized G6 graph with performance configuration
        const g6Graph = new Graph({
          container,
          width,
          height,
          data: { nodes, edges },
          node: {
            style: {
              size: NODE_STYLES.default.size,
              fill: (d: any) => d.data?.colorData?.secondary || '#e6f3ff',
              stroke: (d: any) => d.data?.colorData?.primary || '#1890ff',
              lineWidth: NODE_STYLES.default.lineWidth,
              labelText: (d: any) => d.label || d.id,
              labelFill: '#333',
              labelFontSize: NODE_STYLES.default.labelFontSize,
              labelPosition: NODE_STYLES.default.labelPosition
            },
            state: {
              selected: {
                fill: '#ffeb3b',
                stroke: '#ff9800',
                lineWidth: NODE_STYLES.selected.lineWidth,
                size: NODE_STYLES.selected.size
              },
              hover: {
                fill: '#ffc107',
                stroke: '#ff6f00',
                lineWidth: NODE_STYLES.hover.lineWidth,
                size: NODE_STYLES.hover.size
              },
              'relation-source': {
                fill: '#4caf50',
                stroke: '#2e7d32',
                lineWidth: NODE_STYLES['relation-source'].lineWidth,
                size: NODE_STYLES['relation-source'].size,
                shadowColor: '#4caf50',
                shadowBlur: NODE_STYLES['relation-source'].shadowBlur
              }
            }
          },
          edge: {
            style: {
              stroke: '#999',
              lineWidth: EDGE_STYLES.default.lineWidth,
              endArrow: EDGE_STYLES.default.endArrow,
              labelText: (d: any) => d.label || '',
              labelFill: '#666',
              labelFontSize: EDGE_STYLES.default.labelFontSize
            }
          },
          layout: {
            type: 'circular',
            radius: 200,
            startAngle: 0,
            endAngle: Math.PI * 2
          },
          behaviors: ['zoom-canvas', 'drag-canvas', 'drag-element']
        });

        // Render with error handling
        try {
          g6Graph.render();
        } catch (renderError) {
          console.error('G6 render failed:', renderError);
          throw new Error(`Render failed: ${renderError instanceof Error ? renderError.message : 'Unknown error'}`);
        }

        console.log('Graph rendered with circular layout');

        // Performance monitoring in development
        if (process.env.NODE_ENV === 'development') {
          // Monitor memory usage
          if ('memory' in performance) {
            const memInfo = (performance as any).memory;
            console.log('Memory usage:', {
              usedJSHeapSize: `${(memInfo.usedJSHeapSize / 1048576).toFixed(2)} MB`,
              totalJSHeapSize: `${(memInfo.totalJSHeapSize / 1048576).toFixed(2)} MB`
            });
          }
          
          // Frame rate monitoring
          let lastTime = performance.now();
          let frames = 0;
          const measureFPS = () => {
            frames++;
            const currentTime = performance.now();
            if (currentTime >= lastTime + 1000) {
              console.log(`FPS: ${Math.round((frames * 1000) / (currentTime - lastTime))}`);
              frames = 0;
              lastTime = currentTime;
            }
            if (graphRef.current) {
              requestAnimationFrame(measureFPS);
            }
          };
          requestAnimationFrame(measureFPS);
        }

        // Enhanced event handling with batch updates for performance
        let selectedNodeId: string | null = null;

        // Node click handling with relationship creation
        g6Graph.on('node:click', (event: any) => {
          const nodeId = event.itemId || event.target?.id;
          
          if (nodeId) {
            // Handle relationship creation mode
            if (relationMode && relationSourceNode && relationSourceNode !== nodeId) {
              const sourceNode = nodes.find((n: any) => n.id === relationSourceNode);
              const targetNode = nodes.find((n: any) => n.id === nodeId);
              
              if (sourceNode && targetNode) {
                console.log('Creating relationship:', sourceNode.data.label, '→', targetNode.data.label);
                
                // Exit relation mode
                setRelationMode(false);
                try {
                  g6Graph.setElementState(relationSourceNode, 'relation-source', false);
                } catch (error) {
                  console.error('Failed to clear relation state:', error);
                }
                setRelationSourceNode(null);
                return;
              }
            }

            // Normal node selection with batch state updates
            if (nodeId !== selectedNodeId) {
              selectedNodeId = nodeId;
              
              const originalNode = nodes.find((n: any) => n.id === nodeId);
              if (originalNode && originalNode.data) {
                const visualizationNode = {
                  id: originalNode.data.id,
                  label: originalNode.data.label,
                  type: originalNode.data.type,
                  data: originalNode.data.nodeData || {},
                  x: originalNode.data.x,
                  y: originalNode.data.y
                };
                
                onNodeSelect(visualizationNode as any);
                
                // Update state for selected node
                try {
                  nodes.forEach((node: any) => {
                    g6Graph.setElementState(node.id, 'selected', false);
                  });
                  g6Graph.setElementState(nodeId, 'selected', true);
                } catch (error) {
                  console.error('Selection state update failed:', error);
                }
              }
            }
          }
        });

        // Context menu handling
        g6Graph.on('node:contextmenu', (event: any) => {
          event.preventDefault();
          const nodeId = event.itemId || event.target?.id;
          
          if (nodeId && editMode) {
            setContextMenu({
              isOpen: true,
              position: { x: event.canvasX + 10, y: event.canvasY + 10 },
              targetNodeId: nodeId
            });
          }
        });

        // Canvas click to clear selections
        g6Graph.on('canvas:click', () => {
          if (selectedNodeId) {
            selectedNodeId = null;
            try {
              nodes.forEach((node: any) => {
                g6Graph.setElementState(node.id, 'selected', false);
              });
            } catch (error) {
              console.error('Clear selection failed:', error);
            }
          }
          
          // Close context menu
          setContextMenu(prev => ({ ...prev, isOpen: false }));
        });

        // Improved keyboard event handling with ref
        keyDownHandlerRef.current = (e: KeyboardEvent) => {
          if (e.key === 'Escape') {
            if (relationMode) {
              setRelationMode(false);
              if (relationSourceNode && graphRef.current) {
                try {
                  graphRef.current.setElementState(relationSourceNode, 'relation-source', false);
                } catch (error) {
                  console.error('Failed to clear relation state on escape:', error);
                }
              }
              setRelationSourceNode(null);
            }
            setContextMenu(prev => ({ ...prev, isOpen: false }));
          }
        };

        document.addEventListener('keydown', keyDownHandlerRef.current);

        // Store graph reference
        graphRef.current = g6Graph as any;
        setIsLoading(false);
        
        // Performance logging
        const endTime = performance.now();
        if (process.env.NODE_ENV === 'development') {
          console.log(`Graph rendered in ${(endTime - startTime).toFixed(2)}ms with ${nodeCount} nodes, ${edgeCount} edges`);
        }

        // Cleanup function
        return () => {
          if (keyDownHandlerRef.current) {
            document.removeEventListener('keydown', keyDownHandlerRef.current);
          }
          if (g6Graph) {
            try {
              g6Graph.destroy();
            } catch (destroyError) {
              console.warn('Graph destroy failed:', destroyError);
            }
          }
        };

      } catch (error) {
        console.error('Graph creation error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setRenderError(`Graph creation failed: ${errorMessage}`);
        setIsLoading(false);
        
        // Auto-retry met simplified config na 2 seconden
        if (!renderError && errorMessage.includes('render')) {
          console.log('Attempting simplified layout retry...');
          setTimeout(() => {
            setRenderError(null);
            setCurrentLayout('circular'); // Fallback naar eenvoudigere layout
          }, 2000);
        }
      }
    };

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
      
      // Remove any lingering event listeners
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setRelationMode(false);
          setRelationSourceNode(null);
          setContextMenu(prev => ({ ...prev, isOpen: false }));
        }
      };
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [graph, visibleNodes, nodeCount, edgeCount, nodes, edges, currentLayout, editMode, onNodeSelect, relationMode, relationSourceNode]);

  // Reageer op panel constraint changes
  useEffect(() => {
    if (graphRef.current && panelConstraints) {
      const container = containerRef.current;
      if (!container) return;
      
      const width = container.clientWidth || 800;
      const height = container.clientHeight || 600;
      
      const leftOffset = panelConstraints?.leftPanel && !panelConstraints.leftPanel.collapsed 
        ? panelConstraints.leftPanel.width 
        : 0;
      const rightOffset = panelConstraints?.rightPanel && !panelConstraints.rightPanel.collapsed 
        ? panelConstraints.rightPanel.width 
        : 0;
      
      const availableWidth = width - leftOffset - rightOffset;
      const newCenterX = leftOffset + (availableWidth / 2);
      const newCenterY = height / 2;
      
      // Update layout center
      try {
        graphRef.current.updateLayout({
          center: [newCenterX, newCenterY]
        });
      } catch (error) {
        console.warn('Failed to update layout center:', error);
      }
    }
  }, [panelConstraints]);

  // Auto-resize handler with ResizeObserver
  useEffect(() => {
    if (!containerRef.current || !graphRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0 && graphRef.current) {
          try {
            graphRef.current.changeSize(width, height);
            
            // Herbereken center na resize
            const leftOffset = panelConstraints?.leftPanel && !panelConstraints.leftPanel.collapsed 
              ? panelConstraints.leftPanel.width 
              : 0;
            const rightOffset = panelConstraints?.rightPanel && !panelConstraints.rightPanel.collapsed 
              ? panelConstraints.rightPanel.width 
              : 0;
            
            const availableWidth = width - leftOffset - rightOffset;
            const newCenterX = leftOffset + (availableWidth / 2);
            const newCenterY = height / 2;
            
            graphRef.current.updateLayout({
              center: [newCenterX, newCenterY]
            });
          } catch (error) {
            console.warn('Resize handling failed:', error);
          }
        }
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [panelConstraints]);

  // Expose control functions for parent component
  useEffect(() => {
    if (graphRef.current) {
      // Attach control functions to graph ref for external access
      (graphRef.current as any).switchLayout = switchLayout;
      (graphRef.current as any).zoomIn = zoomIn;
      (graphRef.current as any).zoomOut = zoomOut;
      (graphRef.current as any).fitView = fitView;
    }
  }, [switchLayout, zoomIn, zoomOut, fitView]);

  if (renderError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center p-8">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            G6 Graph Render Error
          </h3>
          <p className="text-sm text-red-600 dark:text-red-400 mb-6">
            {renderError}
          </p>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              Trying fallback to simple force layout...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Optimizing graph layout... ({nodeCount} nodes)
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        ref={containerRef}
        className="w-full h-full bg-white dark:bg-gray-900 rounded-lg overflow-hidden relative"
        style={{ minHeight: '400px' }}
      />
      
      <GraphContextMenu
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        onClose={() => setContextMenu(prev => ({ ...prev, isOpen: false }))}
        onEdit={() => handleContextMenuAction('edit')}
        onCreateRelation={() => handleContextMenuAction('createRelation')}
        onDelete={() => handleContextMenuAction('delete')}
        onExpand={() => handleContextMenuAction('expand')}
      />
      
      {relationMode && (
        <div className="absolute top-4 left-4 bg-green-100 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg p-3 shadow-lg">
          <p className="text-sm text-green-800 dark:text-green-200 font-medium">
            Relatie Modus Actief
          </p>
          <p className="text-xs text-green-600 dark:text-green-300 mt-1">
            Klik op een andere node om een relatie te maken, of druk Escape om te annuleren
          </p>
        </div>
      )}

      {loadedNodeCount < nodeCount && (
        <button
          onClick={loadMoreNodes}
          className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-blue-600 transition-colors"
        >
          Load More Nodes ({loadedNodeCount}/{nodeCount})
        </button>
      )}
      
      {nodeCount > G6_PERFORMANCE_CONFIG.MAX_NODES_WARNING && (
        <div className="absolute top-4 right-4 bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg p-3 shadow-lg">
          <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
            Performance Waarschuwing
          </p>
          <p className="text-xs text-yellow-600 dark:text-yellow-300 mt-1">
            {nodeCount} nodes gedetecteerd. Overweeg filtering voor betere prestaties.
          </p>
        </div>
      )}
    </>
  );
}