import { useEffect, useRef, useState } from "react";
import type { GraphData, VisualizationNode, VisualizationEdge } from "@shared/schema";
import type { GraphTransform } from "@/lib/graph-utils";
import { getNodeTypeColor } from "@/lib/color-utils";

interface G6GraphCanvasProps {
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

export default function G6GraphCanvas({
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
}: G6GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !graph) return;

    const initializeG6 = async () => {
      try {
        // Import G6 v5
        const { Graph } = await import('@antv/g6');

        const container = containerRef.current!;
        const width = container.clientWidth || 800;
        const height = container.clientHeight || 600;

        console.log('G6 v5 Correct: Initializing with dimensions:', { width, height });

        // Debug data availability
        console.log('G6 v5 Correct: Graph data check:', { 
          hasGraph: !!graph, 
          nodeCount: graph?.nodes?.length || 0, 
          edgeCount: graph?.edges?.length || 0,
          visibleNodesSize: visibleNodes.size,
          visibleNodeIds: Array.from(visibleNodes)
        });

        // Prepare data in correct G6 v5 format - show all nodes if no visibility filter
        const visibleNodeIds = visibleNodes.size > 0 ? Array.from(visibleNodes) : graph.nodes.map(n => n.id);
        console.log('G6 v5 Correct: Visibility logic:', { 
          visibleNodesSize: visibleNodes.size,
          totalNodes: graph.nodes.length,
          visibleNodeIds: visibleNodeIds.slice(0, 5) // Show first 5 for debugging
        });
        const nodes = graph.nodes
          .filter(node => visibleNodeIds.includes(node.id))
          .map(node => {
            const colorData = getNodeTypeColor(node.type);
            return {
              id: node.id,
              data: {
                label: node.label,
                type: node.type,
                originalNode: node
              },
              style: {
                keyShape: {
                  r: selectedNode?.id === node.id ? 20 : 15,
                  fill: colorData.secondary,
                  stroke: colorData.primary,
                  lineWidth: selectedNode?.id === node.id ? 3 : 2,
                },
                labelShape: {
                  text: node.label,
                  fontSize: 12,
                  fill: '#333',
                  position: 'bottom',
                  offsetY: 8
                }
              }
            };
          });

        const edges = graph.edges
          .filter(edge => 
            visibleNodeIds.includes(edge.source) && 
            visibleNodeIds.includes(edge.target)
          )
          .map(edge => ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            data: {
              label: edge.label,
              type: edge.type
            },
            style: {
              keyShape: {
                stroke: '#666',
                lineWidth: 1.5,
                endArrow: {
                  path: 'M 0,0 L 8,4 L 8,-4 Z',
                  fill: '#666'
                }
              },
              labelShape: edge.label ? {
                text: edge.label,
                fontSize: 10,
                fill: '#555'
              } : undefined
            }
          }));

        console.log('G6 v5 Correct: Data prepared:', { nodes: nodes.length, edges: edges.length });

        // Create G6 v5 instance with data included at initialization
        const g6Instance = new Graph({
          container,
          width,
          height,
          data: { nodes, edges },
          
          // Correct G6 v5 layout configuration
          layout: {
            type: 'force',
            linkDistance: 150,
            nodeStrength: -300,
            edgeStrength: 0.2,
            preventOverlap: true,
            center: [width / 2, height / 2]
          },

          // Correct G6 v5 behaviors
          behaviors: [
            'drag-canvas',
            'zoom-canvas',
            'drag-element'
          ]
        });

        console.log('G6 v5 Correct: Graph initialized with data successfully');

        // G6 v5 event handling
        g6Instance.on('node:click', (event: any) => {
          console.log('G6 v5 Correct: Node clicked:', event);
          const nodeId = event.itemId;
          const nodeData = graph.nodes.find(n => n.id === nodeId);
          if (nodeData) {
            onNodeSelect(nodeData);
          }
        });

        g6Instance.on('node:dblclick', (event: any) => {
          const nodeId = event.itemId;
          if (nodeId) {
            onNodeExpand(nodeId);
          }
        });

        g6Instance.on('node:contextmenu', (event: any) => {
          if (editMode) {
            event.preventDefault();
            const nodeId = event.itemId;
            const nodeData = graph.nodes.find(n => n.id === nodeId);
            if (nodeData) {
              onNodeEdit?.(nodeData);
            }
          }
        });

        graphRef.current = g6Instance;
        setIsInitialized(true);
        
        console.log('G6 v5 Correct: Successfully initialized with neutron-repellent force layout');

      } catch (error) {
        console.error('G6 v5 Correct: Initialization failed:', error);
      }
    };

    initializeG6();

    return () => {
      if (graphRef.current) {
        try {
          graphRef.current.destroy();
        } catch (e) {
          console.warn('G6 cleanup error:', e);
        }
        graphRef.current = null;
      }
      setIsInitialized(false);
    };
  }, []);

  // Update data when props change
  useEffect(() => {
    if (!graphRef.current || !graph || !isInitialized) return;

    try {
      const visibleNodeIds = Array.from(visibleNodes);
      const nodes = graph.nodes
        .filter(node => visibleNodeIds.includes(node.id))
        .map(node => {
          const colorData = getNodeTypeColor(node.type);
          return {
            id: node.id,
            data: {
              label: node.label,
              type: node.type,
              originalNode: node
            },
            style: {
              keyShape: {
                r: selectedNode?.id === node.id ? 20 : 15,
                fill: colorData.secondary,
                stroke: colorData.primary,
                lineWidth: selectedNode?.id === node.id ? 3 : 2,
              },
              labelShape: {
                text: node.label,
                fontSize: 12,
                fill: '#333',
                position: 'bottom',
                offsetY: 8
              }
            }
          };
        });

      const edges = graph.edges
        .filter(edge => 
          visibleNodeIds.includes(edge.source) && 
          visibleNodeIds.includes(edge.target)
        )
        .map(edge => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          data: {
            label: edge.label,
            type: edge.type
          },
          style: {
            keyShape: {
              stroke: '#666',
              lineWidth: 1.5,
              endArrow: {
                path: 'M 0,0 L 8,4 L 8,-4 Z',
                fill: '#666'
              }
            },
            labelShape: edge.label ? {
              text: edge.label,
              fontSize: 10,
              fill: '#555'
            } : undefined
          }
        }));

      console.log('G6 v5 Correct: Updating data:', { nodes: nodes.length, edges: edges.length });
      graphRef.current.updateData({ nodes, edges });
      
    } catch (error) {
      console.error('G6 v5 Correct: Data update failed:', error);
    }
  }, [graph, visibleNodes, selectedNode, isInitialized]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (graphRef.current && containerRef.current && isInitialized) {
        const width = containerRef.current.clientWidth || 800;
        const height = containerRef.current.clientHeight || 600;
        graphRef.current.setSize(width, height);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isInitialized]);

  if (!graph) {
    return (
      <div className="w-full h-full bg-gray-50 dark:bg-gray-900 rounded-lg flex items-center justify-center">
        <p className="text-gray-500">Geen graph data beschikbaar</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-white dark:bg-gray-900 rounded-lg overflow-hidden">
      <div 
        ref={containerRef}
        className="w-full h-full"
        style={{ minHeight: '600px' }}
      />
      {!isInitialized && (
        <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-900 bg-opacity-90">
          <p className="text-gray-500">G6 force layout laden...</p>
        </div>
      )}
    </div>
  );
}