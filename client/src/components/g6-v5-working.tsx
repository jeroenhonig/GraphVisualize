import { useEffect, useRef, useState } from "react";
import type { GraphData, VisualizationNode, GraphTransform } from "@shared/schema";
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
  const g6InstanceRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!containerRef.current || !graph) return;

    const initializeG6 = async () => {
      try {
        setIsLoading(true);
        
        // Dynamic import of G6
        const G6 = await import('@antv/g6');
        
        const container = containerRef.current!;
        const width = container.clientWidth || 800;
        const height = container.clientHeight || 600;

        console.log('G6 Working: Initializing with dimensions:', { width, height });

        // Clear previous instance
        if (g6InstanceRef.current) {
          g6InstanceRef.current.destroy();
        }

        // Prepare data - show all nodes if no visibility filter
        const visibleNodeIds = visibleNodes.size > 0 ? Array.from(visibleNodes) : graph.nodes.map(n => n.id);
        
        const nodes = graph.nodes
          .filter(node => visibleNodeIds.includes(node.id))
          .map(node => {
            const colorData = getNodeTypeColor(node.type);
            return {
              id: node.id,
              x: node.x || Math.random() * width,
              y: node.y || Math.random() * height,
              size: selectedNode?.id === node.id ? 20 : 15,
              color: colorData.secondary,
              style: {
                fill: colorData.secondary,
                stroke: colorData.primary,
                lineWidth: selectedNode?.id === node.id ? 3 : 2,
              },
              label: node.label,
              labelCfg: {
                style: {
                  fill: '#333',
                  fontSize: 12,
                }
              },
              originalNode: node
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
            label: edge.label,
            style: {
              stroke: '#999',
              lineWidth: 1.5,
              opacity: 0.6,
              endArrow: {
                path: G6.Arrow.triangle(6, 8, 10),
                fill: '#999'
              }
            },
            labelCfg: edge.label ? {
              style: {
                fill: '#666',
                fontSize: 10,
                background: {
                  fill: 'white',
                  stroke: '#ccc',
                  padding: [2, 4, 2, 4],
                  radius: 2
                }
              }
            } : undefined
          }));

        console.log('G6 Working: Data prepared:', { nodes: nodes.length, edges: edges.length });

        // Create G6 v5.0.48 compatible instance 
        const graph_instance = new G6.Graph({
          container: container,
          width,
          height,
          data: { nodes, edges },
          layout: {
            type: 'force',
            preventOverlap: true,
            linkDistance: 150,
            nodeStrength: -300,
            edgeStrength: 0.2,
            center: [width / 2, height / 2]
          },
          behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element']
        });

        // Event handlers
        graph_instance.on('node:click', (e: any) => {
          const nodeModel = e.item.getModel();
          const originalNode = nodeModel.originalNode;
          if (originalNode) {
            onNodeSelect(originalNode);
          }
        });

        graph_instance.on('node:dblclick', (e: any) => {
          const nodeModel = e.item.getModel();
          const originalNode = nodeModel.originalNode;
          if (originalNode) {
            onNodeExpand(originalNode.id);
          }
        });

        graph_instance.on('canvas:click', () => {
          // Clear selection when clicking on canvas
        });

        g6InstanceRef.current = graph_instance;
        setIsLoading(false);
        console.log('G6 Working: Graph initialized successfully');

      } catch (error) {
        console.error('G6 Working: Failed to initialize:', error);
        setIsLoading(false);
      }
    };

    initializeG6();

    return () => {
      if (g6InstanceRef.current) {
        g6InstanceRef.current.destroy();
        g6InstanceRef.current = null;
      }
    };
  }, [graph, visibleNodes]);

  // Update selected node highlighting
  useEffect(() => {
    if (!g6InstanceRef.current) return;

    try {
      // Clear all states
      g6InstanceRef.current.setAutoPaint(false);
      g6InstanceRef.current.getNodes().forEach((node: any) => {
        g6InstanceRef.current.clearItemStates(node);
      });

      // Highlight selected node
      if (selectedNode) {
        const node = g6InstanceRef.current.findById(selectedNode.id);
        if (node) {
          g6InstanceRef.current.setItemState(node, 'selected', true);
        }
      }

      g6InstanceRef.current.setAutoPaint(true);
      g6InstanceRef.current.paint();
    } catch (error) {
      console.error('G6 Working: Failed to update selection:', error);
    }
  }, [selectedNode]);

  return (
    <div className="w-full h-full relative bg-white dark:bg-gray-900">
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ minHeight: '400px' }}
      />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-900/80">
          <div className="text-gray-500 dark:text-gray-400">
            G6 force layout laden...
          </div>
        </div>
      )}
    </div>
  );
}