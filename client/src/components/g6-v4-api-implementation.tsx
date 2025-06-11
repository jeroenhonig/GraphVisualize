import { useEffect, useRef, useState } from "react";
import type { GraphData, VisualizationNode, GraphTransform } from "@shared/schema";
import { getNodeTypeColor } from "@/lib/color-utils";

interface G6V4ApiProps {
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

export default function G6V4ApiImplementation({
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
}: G6V4ApiProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || !graph) return;

    const createGraph = async () => {
      try {
        setIsLoading(true);
        setRenderError(null);

        // Try to import G6 - fallback to SVG if fails
        let G6Module;
        try {
          G6Module = await import('@antv/g6');
        } catch (importError) {
          console.warn('G6 import failed, using SVG fallback:', importError);
          setRenderError('G6 library not available');
          return;
        }

        const { Graph } = G6Module;

        // Clean up existing graph
        if (graphRef.current) {
          try {
            graphRef.current.destroy();
          } catch (e) {
            console.warn('Error destroying graph:', e);
          }
          graphRef.current = null;
        }

        const container = containerRef.current;
        if (!container) return;
        
        container.innerHTML = '';

        const width = container.clientWidth || 800;
        const height = container.clientHeight || 600;

        // Prepare visible nodes
        const visibleNodeIds = visibleNodes.size > 0 ? Array.from(visibleNodes) : graph.nodes.map(n => n.id);
        
        // Format data according to G6 v4 API
        const nodes = graph.nodes
          .filter(node => visibleNodeIds.includes(node.id))
          .slice(0, 50)
          .map(node => {
            const colorData = getNodeTypeColor(node.type);
            return {
              id: node.id,
              label: node.label.length > 20 ? node.label.substring(0, 20) + '...' : node.label,
              type: 'circle',
              size: 30,
              style: {
                fill: colorData.secondary,
                stroke: colorData.primary,
                lineWidth: 2
              },
              labelCfg: {
                style: {
                  fill: '#333',
                  fontSize: 11,
                  fontWeight: 'normal'
                }
              },
              originalNode: node
            };
          });

        const edges = graph.edges
          .filter(edge => 
            nodes.find(n => n.id === edge.source) && 
            nodes.find(n => n.id === edge.target)
          )
          .slice(0, 100)
          .map(edge => ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            type: 'line',
            style: {
              stroke: '#999',
              lineWidth: 1.5,
              endArrow: {
                path: 'M 0,0 L 8,4 L 0,8 Z',
                fill: '#999'
              }
            }
          }));

        console.log('Creating G6 v4 graph with API specification');

        // Create graph instance following G6 v4 API
        const g6Graph = new Graph({
          container,
          width,
          height,
          // Layout configuration
          layout: {
            type: 'force',
            preventOverlap: true,
            linkDistance: 120,
            nodeStrength: -400,
            edgeStrength: 0.6,
            center: [width / 2, height / 2],
            nodeSize: 30
          },
          // Default node style
          defaultNode: {
            type: 'circle',
            size: 30,
            style: {
              fill: '#C6E5FF',
              stroke: '#5B8FF9',
              lineWidth: 2
            },
            labelCfg: {
              style: {
                fill: '#000',
                fontSize: 11
              }
            }
          },
          // Default edge style  
          defaultEdge: {
            type: 'line',
            style: {
              stroke: '#e2e2e2',
              lineWidth: 1.5,
              endArrow: {
                path: 'M 0,0 L 8,4 L 0,8 Z',
                fill: '#e2e2e2'
              }
            }
          },
          // Interaction modes
          modes: {
            default: [
              'drag-canvas',    // Pan canvas
              'zoom-canvas',    // Zoom with wheel
              'drag-node',      // Drag nodes
              'click-select'    // Select nodes
            ]
          },
          // Node state styles
          nodeStateStyles: {
            hover: {
              fill: '#d3f3ff',
              stroke: '#1890ff',
              lineWidth: 3
            },
            selected: {
              fill: '#ffeb3b',
              stroke: '#ff9800', 
              lineWidth: 4
            }
          },
          // Edge state styles
          edgeStateStyles: {
            hover: {
              stroke: '#1890ff',
              lineWidth: 2
            }
          }
        });

        // Load data
        g6Graph.data({ nodes, edges });
        g6Graph.render();

        // Event handling following G6 v4 API patterns
        g6Graph.on('node:click', (evt: any) => {
          const { item } = evt;
          if (!item) return;
          
          const model = item.getModel();
          console.log('Node clicked:', model);

          // Clear all selections
          const allNodes = g6Graph.getNodes();
          allNodes.forEach((node: any) => {
            g6Graph.clearItemStates(node);
          });

          // Set selected state
          g6Graph.setItemState(item, 'selected', true);

          if (model?.originalNode) {
            onNodeSelect(model.originalNode);
          }
        });

        g6Graph.on('node:dblclick', (evt: any) => {
          const { item } = evt;
          if (!item) return;
          
          const model = item.getModel();
          if (model?.originalNode) {
            onNodeExpand(model.originalNode.id);
          }
        });

        // Hover effects
        g6Graph.on('node:mouseenter', (evt: any) => {
          const { item } = evt;
          if (!item) return;
          
          const isSelected = g6Graph.getItemState(item, 'selected');
          if (!isSelected) {
            g6Graph.setItemState(item, 'hover', true);
          }
        });

        g6Graph.on('node:mouseleave', (evt: any) => {
          const { item } = evt;
          if (!item) return;
          
          g6Graph.setItemState(item, 'hover', false);
        });

        // Edge hover
        g6Graph.on('edge:mouseenter', (evt: any) => {
          const { item } = evt;
          if (!item) return;
          g6Graph.setItemState(item, 'hover', true);
        });

        g6Graph.on('edge:mouseleave', (evt: any) => {
          const { item } = evt;
          if (!item) return;
          g6Graph.setItemState(item, 'hover', false);
        });

        // Canvas click to clear selection
        g6Graph.on('canvas:click', () => {
          const allNodes = g6Graph.getNodes();
          allNodes.forEach((node: any) => {
            g6Graph.clearItemStates(node);
          });
        });

        // Auto fit view
        setTimeout(() => {
          try {
            g6Graph.fitView();
          } catch (e) {
            console.warn('fitView failed:', e);
          }
        }, 500);

        graphRef.current = g6Graph;
        setIsLoading(false);
        console.log('G6 v4 API graph created successfully');

      } catch (error) {
        console.error('G6 v4 API creation failed:', error);
        setRenderError(`G6 v4 API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setIsLoading(false);
      }
    };

    createGraph();

    return () => {
      if (graphRef.current) {
        try {
          graphRef.current.destroy();
        } catch (e) {
          console.warn('Cleanup error:', e);
        }
        graphRef.current = null;
      }
    };
  }, [graph, visibleNodes]);

  if (renderError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center p-8">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            G6 v4 API Implementation
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            {renderError}
          </p>
          <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
            <h4 className="font-medium text-red-800 dark:text-red-200 mb-2">
              Implementatie Status
            </h4>
            <p className="text-sm text-red-600 dark:text-red-300">
              G6 v4 API niet beschikbaar in huidige versie
            </p>
            <p className="text-xs text-gray-500 mt-2">
              {graph?.nodes?.length || 0} nodes • {graph?.edges?.length || 0} edges
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative bg-white dark:bg-gray-900">
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ minHeight: '400px' }}
      />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-900/80">
          <div className="text-center">
            <div className="text-gray-500 dark:text-gray-400 mb-2">
              G6 v4 API laden...
            </div>
            <div className="text-xs text-gray-400">
              modes • defaultNode • nodeStateStyles • event handling
            </div>
          </div>
        </div>
      )}
      
      {/* API info overlay */}
      {!isLoading && !renderError && (
        <div className="absolute top-4 right-4 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-md text-xs">
          <div className="font-medium mb-2">G6 v4 API:</div>
          <div className="space-y-1 text-gray-600 dark:text-gray-300">
            <div>• modes: default behaviors</div>
            <div>• defaultNode/Edge styling</div>
            <div>• nodeStateStyles (hover/selected)</div>
            <div>• Event handling (click/hover)</div>
            <div>• Force layout met repulsion</div>
          </div>
        </div>
      )}
    </div>
  );
}