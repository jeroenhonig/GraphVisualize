import { useEffect, useRef, useState } from "react";
import type { GraphData, VisualizationNode, GraphTransform } from "@shared/schema";
import { getNodeTypeColor } from "@/lib/color-utils";

interface G6V4BehaviorsProps {
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

export default function G6V4Behaviors({
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
}: G6V4BehaviorsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || !graph) return;

    const createG6Graph = async () => {
      try {
        setIsLoading(true);
        setRenderError(null);

        // Import G6
        const G6Module = await import('@antv/g6');
        const { Graph } = G6Module;

        // Clear existing graph
        if (graphRef.current) {
          try {
            graphRef.current.destroy();
          } catch (e) {
            console.warn('Error destroying previous graph:', e);
          }
          graphRef.current = null;
        }

        const container = containerRef.current;
        container.innerHTML = '';

        const width = container.clientWidth || 800;
        const height = container.clientHeight || 600;

        // Prepare visible nodes
        const visibleNodeIds = visibleNodes.size > 0 ? Array.from(visibleNodes) : graph.nodes.map(n => n.id);
        
        // Format data for G6 v4
        const nodes = graph.nodes
          .filter(node => visibleNodeIds.includes(node.id))
          .slice(0, 50) // Limit for performance
          .map(node => {
            const colorData = getNodeTypeColor(node.type);
            return {
              id: node.id,
              label: node.label.length > 15 ? node.label.substring(0, 15) + '...' : node.label,
              type: 'circle',
              size: 25,
              style: {
                fill: colorData.secondary,
                stroke: colorData.primary,
                lineWidth: 2
              },
              labelCfg: {
                style: {
                  fill: '#333',
                  fontSize: 10
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

        console.log('G6 V4: Creating graph with', { nodes: nodes.length, edges: edges.length });

        // Create G6 v4 graph with behaviors from documentation
        const g6Graph = new Graph({
          container,
          width,
          height,
          layout: {
            type: 'force',
            preventOverlap: true,
            linkDistance: 100,
            nodeStrength: -300,
            edgeStrength: 0.5,
            center: [width / 2, height / 2]
          },
          // Default behaviors as described in G6 v4 documentation
          modes: {
            default: [
              'drag-canvas',     // Pan canvas by dragging
              'zoom-canvas',     // Zoom with mouse wheel
              'drag-node',       // Drag individual nodes
              'click-select'     // Select nodes by clicking
            ]
          },
          // Default node styling
          defaultNode: {
            type: 'circle',
            size: 25,
            style: {
              fill: '#C6E5FF',
              stroke: '#5B8FF9',
              lineWidth: 2
            },
            labelCfg: {
              style: {
                fill: '#000',
                fontSize: 10
              }
            }
          },
          // Default edge styling
          defaultEdge: {
            type: 'line',
            style: {
              stroke: '#e2e2e2',
              lineWidth: 1,
              endArrow: {
                path: 'M 0,0 L 8,4 L 0,8 Z',
                fill: '#e2e2e2'
              }
            }
          },
          // Node states for interaction feedback
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
          // Edge states
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

        // Event binding following G6 v4 documentation patterns
        
        // Node click event with state management
        g6Graph.on('node:click', (evt: any) => {
          const { item } = evt;
          const nodeModel = item.getModel();
          
          // Clear all node states first
          g6Graph.getNodes().forEach((node: any) => {
            g6Graph.clearItemStates(node, ['selected', 'hover']);
          });
          
          // Set clicked node to selected state
          g6Graph.setItemState(item, 'selected', true);
          
          if (nodeModel?.originalNode) {
            onNodeSelect(nodeModel.originalNode);
          }
        });

        // Double click for expansion
        g6Graph.on('node:dblclick', (evt: any) => {
          const { item } = evt;
          const nodeModel = item.getModel();
          
          if (nodeModel?.originalNode) {
            onNodeExpand(nodeModel.originalNode.id);
          }
        });

        // Mouse enter/leave for hover states
        g6Graph.on('node:mouseenter', (evt: any) => {
          const { item } = evt;
          if (!g6Graph.getItemState(item, 'selected')) {
            g6Graph.setItemState(item, 'hover', true);
          }
        });

        g6Graph.on('node:mouseleave', (evt: any) => {
          const { item } = evt;
          g6Graph.setItemState(item, 'hover', false);
        });

        // Edge hover events
        g6Graph.on('edge:mouseenter', (evt: any) => {
          const { item } = evt;
          g6Graph.setItemState(item, 'hover', true);
        });

        g6Graph.on('edge:mouseleave', (evt: any) => {
          const { item } = evt;
          g6Graph.setItemState(item, 'hover', false);
        });

        // Canvas click to clear selection
        g6Graph.on('canvas:click', () => {
          g6Graph.getNodes().forEach((node: any) => {
            g6Graph.clearItemStates(node, ['selected']);
          });
        });

        // Context menu prevention
        g6Graph.on('contextmenu', (evt: any) => {
          evt.preventDefault();
        });

        graphRef.current = g6Graph;
        setIsLoading(false);
        console.log('G6 V4: Graph created successfully with behaviors');

      } catch (error) {
        console.error('G6 V4: Failed to create graph:', error);
        setRenderError(`G6 v4 rendering failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setIsLoading(false);
      }
    };

    createG6Graph();

    return () => {
      if (graphRef.current) {
        try {
          graphRef.current.destroy();
        } catch (e) {
          console.warn('Error destroying graph on cleanup:', e);
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
            G6 v4 Graph Visualization
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            {renderError}
          </p>
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
            <h4 className="font-medium mb-2">Fallback: Dataset Overview</h4>
            <p className="text-sm">
              {graph?.nodes?.length || 0} nodes • {graph?.edges?.length || 0} edges
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Infrastructure RDF model with default behaviors
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
              G6 v4 behaviors laden...
            </div>
            <div className="text-xs text-gray-400">
              drag-canvas • zoom-canvas • drag-node • click-select
            </div>
          </div>
        </div>
      )}
      
      {/* Controls overlay */}
      {!isLoading && !renderError && (
        <div className="absolute top-4 right-4 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-md text-xs">
          <div className="font-medium mb-2">G6 v4 Controls:</div>
          <div className="space-y-1 text-gray-600 dark:text-gray-300">
            <div>• Scroll: Zoom in/out</div>
            <div>• Drag background: Pan</div>
            <div>• Drag nodes: Move</div>
            <div>• Click nodes: Select</div>
            <div>• Double-click: Expand</div>
          </div>
        </div>
      )}
    </div>
  );
}