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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!mounted || !containerRef.current || !graph) return;

    const initGraph = async () => {
      try {
        const { Graph } = await import('@antv/g6');
        
        // Ensure container has dimensions
        const container = containerRef.current!;
        const rect = container.getBoundingClientRect();
        const width = Math.max(rect.width, 600);
        const height = Math.max(rect.height, 500);

        // Prepare node data with visible colors and positions
        const visibleNodeIds = Array.from(visibleNodes);
        const nodeData = graph.nodes
          .filter(node => visibleNodeIds.includes(node.id))
          .map((node, index) => {
            const colorData = getNodeTypeColor(node.type);
            const angle = (index / graph.nodes.length) * 2 * Math.PI;
            const radius = Math.min(width, height) * 0.3;
            
            return {
              id: node.id,
              label: node.label,
              x: width/2 + Math.cos(angle) * radius,
              y: height/2 + Math.sin(angle) * radius,
              size: selectedNode?.id === node.id ? 25 : 15,
              style: {
                fill: colorData.secondary,
                stroke: colorData.primary,
                lineWidth: selectedNode?.id === node.id ? 3 : 2,
                opacity: 0.9
              },
              labelCfg: {
                style: {
                  fill: '#333',
                  fontSize: 10,
                  fontWeight: selectedNode?.id === node.id ? 'bold' : 'normal'
                },
                position: 'bottom',
                offset: 5
              },
              data: { originalNode: node }
            };
          });

        const edgeData = graph.edges
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
                path: 'M 0,0 L 8,4 L 8,-4 Z',
                fill: '#999'
              }
            },
            labelCfg: edge.label ? {
              style: {
                fill: '#666',
                fontSize: 9,
                background: {
                  fill: 'rgba(255,255,255,0.8)',
                  padding: [1, 3],
                  radius: 2
                }
              }
            } : undefined
          }));

        console.log('Creating G6 graph with:', { nodes: nodeData.length, edges: edgeData.length, width, height });

        // Create graph with working configuration
        const g6Graph = new Graph({
          container: container,
          width,
          height,
          layout: {
            type: 'force',
            preventOverlap: true,
            linkDistance: 100,
            nodeStrength: -300,
            edgeStrength: 0.2,
            collideStrength: 0.8,
            alpha: 0.8,
            alphaDecay: 0.028,
            velocityDecay: 0.6
          },
          defaultNode: {
            type: 'circle',
            size: [15],
            style: {
              fill: '#91d5ff',
              stroke: '#40a9ff',
              lineWidth: 2
            },
            labelCfg: {
              style: {
                fill: '#333',
                fontSize: 10
              },
              position: 'bottom',
              offset: 5
            }
          },
          defaultEdge: {
            type: 'line',
            style: {
              stroke: '#999',
              lineWidth: 1.5,
              opacity: 0.6,
              endArrow: {
                path: 'M 0,0 L 8,4 L 8,-4 Z',
                fill: '#999'
              }
            }
          },
          modes: {
            default: ['drag-canvas', 'zoom-canvas', 'drag-node']
          },
          animate: true
        });

        // Load data
        g6Graph.data({ nodes: nodeData, edges: edgeData });
        g6Graph.render();

        // Event handlers
        g6Graph.on('node:click', (e: any) => {
          const nodeModel = e.item?.getModel();
          if (nodeModel?.data?.originalNode) {
            onNodeSelect(nodeModel.data.originalNode);
          }
        });

        g6Graph.on('node:dblclick', (e: any) => {
          const nodeModel = e.item?.getModel();
          if (nodeModel?.id) {
            onNodeExpand(nodeModel.id);
          }
        });

        g6Graph.on('node:contextmenu', (e: any) => {
          if (editMode) {
            e.preventDefault();
            const nodeModel = e.item?.getModel();
            if (nodeModel?.data?.originalNode) {
              onNodeEdit?.(nodeModel.data.originalNode);
            }
          }
        });

        graphRef.current = g6Graph;
        console.log('G6 graph created and rendered successfully');

      } catch (error) {
        console.error('G6 initialization error:', error);
      }
    };

    // Small delay to ensure container is fully mounted
    const timer = setTimeout(initGraph, 100);

    return () => {
      clearTimeout(timer);
      if (graphRef.current) {
        graphRef.current.destroy();
        graphRef.current = null;
      }
    };
  }, [mounted, graph]);

  // Update selection
  useEffect(() => {
    if (!graphRef.current || !mounted) return;

    try {
      const nodes = graphRef.current.getNodes();
      nodes.forEach((node: any) => {
        const model = node.getModel();
        const isSelected = selectedNode?.id === model.id;
        
        graphRef.current.updateItem(node, {
          size: isSelected ? 25 : 15,
          style: {
            ...model.style,
            lineWidth: isSelected ? 3 : 2
          },
          labelCfg: {
            ...model.labelCfg,
            style: {
              ...model.labelCfg?.style,
              fontWeight: isSelected ? 'bold' : 'normal'
            }
          }
        });
      });
    } catch (error) {
      console.error('Selection update error:', error);
    }
  }, [selectedNode, mounted]);

  // Handle resize
  useEffect(() => {
    if (!mounted) return;

    const handleResize = () => {
      if (graphRef.current && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const width = Math.max(rect.width, 600);
        const height = Math.max(rect.height, 500);
        graphRef.current.changeSize(width, height);
        graphRef.current.fitView();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [mounted]);

  if (!graph) {
    return (
      <div className="w-full h-full bg-white dark:bg-gray-900 rounded-lg flex items-center justify-center">
        <p className="text-gray-500">Geen graph data beschikbaar</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-white dark:bg-gray-900 rounded-lg relative overflow-hidden">
      <div 
        ref={containerRef}
        className="w-full h-full"
        style={{ minHeight: '500px', minWidth: '600px' }}
      />
    </div>
  );
}