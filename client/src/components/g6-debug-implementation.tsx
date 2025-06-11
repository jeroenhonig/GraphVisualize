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
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!containerRef.current || !graph) {
      setIsLoading(false);
      return;
    }

    let mounted = true;

    const initGraph = async () => {
      try {
        setError(null);
        setIsLoading(true);

        // Wait for container to be properly sized
        await new Promise(resolve => setTimeout(resolve, 100));

        if (!mounted) return;

        const { Graph } = await import('@antv/g6');

        const rect = containerRef.current!.getBoundingClientRect();
        const width = Math.max(rect.width, 400);
        const height = Math.max(rect.height, 400);

        console.log('G6 Debug: Container dimensions:', { width, height });
        console.log('G6 Debug: Graph data:', { nodeCount: graph.nodes.length, edgeCount: graph.edges.length });

        // Simple data format for debugging
        const visibleNodeIds = Array.from(visibleNodes);
        const nodes = graph.nodes
          .filter(node => visibleNodeIds.includes(node.id))
          .map((node, index) => {
            const colorData = getNodeTypeColor(node.type);
            return {
              id: node.id,
              label: node.label || node.id,
              x: node.x || (index % 5) * 100 + 100,
              y: node.y || Math.floor(index / 5) * 100 + 100,
              style: {
                fill: colorData.secondary,
                stroke: colorData.primary,
                lineWidth: selectedNode?.id === node.id ? 3 : 1,
                r: selectedNode?.id === node.id ? 18 : 12
              },
              data: { originalNode: node }
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
            label: edge.label || '',
            style: {
              stroke: '#666',
              lineWidth: 1,
              endArrow: true
            }
          }));

        console.log('G6 Debug: Prepared data:', { nodes: nodes.length, edges: edges.length });

        // Create G6 instance with explicit rendering config
        const g6Instance = new Graph({
          container: containerRef.current!,
          width,
          height,
          data: { nodes, edges },
          layout: {
            type: 'force',
            preventOverlap: true,
            linkDistance: 120,
            nodeStrength: -300,
            edgeStrength: 0.2,
            center: [width / 2, height / 2],
            gravity: 0.1,
            alpha: 0.9,
            alphaDecay: 0.028
          },
          behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element'],
          renderer: 'canvas',
          theme: 'light',
          autoFit: 'view',
          padding: [20, 20, 20, 20]
        });

        // Simple event handlers
        g6Instance.on('node:click', (evt: any) => {
          console.log('G6 Debug: Node clicked:', evt);
          const nodeId = evt.itemId;
          const nodeData = graph.nodes.find(n => n.id === nodeId);
          if (nodeData) {
            onNodeSelect(nodeData);
          }
        });

        g6Instance.on('node:dblclick', (evt: any) => {
          const nodeId = evt.itemId;
          if (nodeId) {
            onNodeExpand(nodeId);
          }
        });

        if (!mounted) {
          g6Instance.destroy();
          return;
        }

        graphRef.current = g6Instance;
        
        console.log('G6 Debug: Graph initialized successfully');
        setIsLoading(false);

      } catch (error) {
        console.error('G6 Debug: Initialization failed:', error);
        setError(`G6 initialization failed: ${error}`);
        setIsLoading(false);
      }
    };

    initGraph();

    return () => {
      mounted = false;
      if (graphRef.current) {
        try {
          graphRef.current.destroy();
        } catch (e) {
          console.warn('G6 Debug: Cleanup error:', e);
        }
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
        .map((node, index) => {
          const colorData = getNodeTypeColor(node.type);
          return {
            id: node.id,
            label: node.label || node.id,
            x: node.x || (index % 5) * 100 + 100,
            y: node.y || Math.floor(index / 5) * 100 + 100,
            style: {
              fill: colorData.secondary,
              stroke: colorData.primary,
              lineWidth: selectedNode?.id === node.id ? 3 : 1,
              r: selectedNode?.id === node.id ? 18 : 12
            },
            data: { originalNode: node }
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
          label: edge.label || '',
          style: {
            stroke: '#666',
            lineWidth: 1,
            endArrow: true
          }
        }));

      console.log('G6 Debug: Updating data:', { nodes: nodes.length, edges: edges.length });
      graphRef.current.updateData({ nodes, edges });
      
    } catch (error) {
      console.error('G6 Debug: Data update failed:', error);
      setError(`Data update failed: ${error}`);
    }
  }, [graph, visibleNodes, selectedNode]);

  if (!graph) {
    return (
      <div className="w-full h-full bg-gray-50 dark:bg-gray-900 rounded-lg flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Geen graph data beschikbaar</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full bg-gray-50 dark:bg-gray-900 rounded-lg flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-500 font-medium">G6 Error:</p>
          <p className="text-gray-600 text-sm mt-2">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-gray-50 dark:bg-gray-900 rounded-lg relative">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-900 bg-opacity-90 z-10">
          <p className="text-gray-500 dark:text-gray-400">G6 aan het laden...</p>
        </div>
      )}
      <div 
        ref={containerRef}
        className="w-full h-full"
        style={{ minHeight: '600px', minWidth: '400px' }}
      />
    </div>
  );
}