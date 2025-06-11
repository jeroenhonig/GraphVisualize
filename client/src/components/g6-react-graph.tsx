import { useEffect, useRef } from "react";
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

  useEffect(() => {
    if (!containerRef.current || !graph) return;

    const initGraph = async () => {
      try {
        const { Graph } = await import('@antv/g6');

        const width = containerRef.current!.clientWidth || 800;
        const height = containerRef.current!.clientHeight || 600;

        // Convert data to G6 format
        const visibleNodeIds = Array.from(visibleNodes);
        const nodes = graph.nodes
          .filter(node => visibleNodeIds.includes(node.id))
          .map(node => {
            const colorData = getNodeTypeColor(node.type);
            return {
              id: node.id,
              data: {
                x: node.x,
                y: node.y,
                label: node.label,
                type: node.type,
                originalData: node
              },
              style: {
                keyShape: {
                  r: selectedNode?.id === node.id ? 20 : 15,
                  fill: colorData.secondary,
                  stroke: colorData.primary,
                  lineWidth: selectedNode?.id === node.id ? 4 : 2,
                },
                labelShape: {
                  text: node.label,
                  fontSize: 12,
                  fill: '#374151',
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
                stroke: '#64748b',
                lineWidth: 2,
                endArrow: {
                  path: 'M 0,0 L 8,4 L 8,-4 Z',
                  fill: '#64748b'
                }
              },
              labelShape: edge.label ? {
                text: edge.label,
                fontSize: 11,
                fill: '#4b5563',
                backgroundColor: 'rgba(255,255,255,0.9)',
                padding: [2, 4]
              } : undefined
            }
          }));

        // Create graph instance
        const g6Graph = new Graph({
          container: containerRef.current!,
          width,
          height,
          data: { nodes, edges },
          layout: {
            type: 'force',
            animated: true,
            linkDistance: 150,
            nodeStrength: -300,
            edgeStrength: 0.2,
            preventOverlap: true,
            nodeSize: 30,
            center: [width / 2, height / 2]
          },
          behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element'],
          node: {
            style: {
              labelShape: {
                position: 'bottom',
                offsetY: 4,
                maxWidth: '150%'
              }
            }
          },
          autoFit: 'view',
          padding: [20, 20, 20, 20]
        });

        // Event listeners
        g6Graph.on('node:click', (event: any) => {
          const nodeData = event.target.id;
          const node = graph.nodes.find(n => n.id === nodeData);
          if (node) {
            onNodeSelect(node);
          }
        });

        g6Graph.on('node:dblclick', (event: any) => {
          const nodeId = event.target.id;
          if (nodeId) {
            onNodeExpand(nodeId);
          }
        });

        g6Graph.on('node:contextmenu', (event: any) => {
          if (editMode) {
            event.preventDefault();
            const nodeData = event.target.id;
            const node = graph.nodes.find(n => n.id === nodeData);
            if (node) {
              onNodeEdit?.(node);
            }
          }
        });

        graphRef.current = g6Graph;
        console.log('G6 force layout active with neutron-repellent physics');

      } catch (error) {
        console.error('G6 initialization error:', error);
      }
    };

    initGraph();

    return () => {
      if (graphRef.current) {
        graphRef.current.destroy();
        graphRef.current = null;
      }
    };
  }, []);

  // Update data when props change
  useEffect(() => {
    if (!graphRef.current || !graph) return;

    try {
      const visibleNodeIds = Array.from(visibleNodes);
      const nodes = graph.nodes
        .filter(node => visibleNodeIds.includes(node.id))
        .map(node => {
          const colorData = getNodeTypeColor(node.type);
          return {
            id: node.id,
            data: {
              x: node.x,
              y: node.y,
              label: node.label,
              type: node.type,
              originalData: node
            },
            style: {
              keyShape: {
                r: selectedNode?.id === node.id ? 20 : 15,
                fill: colorData.secondary,
                stroke: colorData.primary,
                lineWidth: selectedNode?.id === node.id ? 4 : 2,
              },
              labelShape: {
                text: node.label,
                fontSize: 12,
                fill: '#374151',
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
              stroke: '#64748b',
              lineWidth: 2,
              endArrow: {
                path: 'M 0,0 L 8,4 L 8,-4 Z',
                fill: '#64748b'
              }
            },
            labelShape: edge.label ? {
              text: edge.label,
              fontSize: 11,
              fill: '#4b5563',
              backgroundColor: 'rgba(255,255,255,0.9)',
              padding: [2, 4]
            } : undefined
          }
        }));

      graphRef.current.updateData({ nodes, edges });
      
    } catch (error) {
      console.error('G6 data update error:', error);
    }
  }, [graph, visibleNodes, selectedNode]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (graphRef.current && containerRef.current) {
        const width = containerRef.current.clientWidth || 800;
        const height = containerRef.current.clientHeight || 600;
        graphRef.current.setSize(width, height);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!graph) {
    return (
      <div className="w-full h-full bg-gray-50 dark:bg-gray-900 rounded-lg flex items-center justify-center">
        <p className="text-gray-500">Geen graph data beschikbaar</p>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="w-full h-full bg-gray-50 dark:bg-gray-900 rounded-lg"
      style={{ minHeight: '600px' }}
    />
  );
}