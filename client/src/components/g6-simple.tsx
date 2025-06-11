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
  const graphRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || !graph) return;

    const createGraph = async () => {
      try {
        setIsLoading(true);
        setRenderError(null);

        // Clear container
        const container = containerRef.current!;
        container.innerHTML = '';

        // Clear existing graph
        if (graphRef.current) {
          try {
            graphRef.current.destroy();
          } catch (e) {
            console.warn('Error destroying previous graph:', e);
          }
          graphRef.current = null;
        }

        // Get dimensions
        const width = container.clientWidth || 800;
        const height = container.clientHeight || 600;

        // Prepare visible nodes
        const visibleNodeIds = visibleNodes.size > 0 ? Array.from(visibleNodes) : graph.nodes.map(n => n.id);

        // Simple data format for G6
        const nodes = graph.nodes
          .filter(node => visibleNodeIds.includes(node.id))
          .slice(0, 50) // Limit to first 50 nodes for performance
          .map((node, index) => {
            const colorData = getNodeTypeColor(node.type);
            const angle = (index / Math.min(50, visibleNodeIds.length)) * 2 * Math.PI;
            const radius = Math.min(width, height) * 0.25;
            
            return {
              id: node.id,
              x: width / 2 + Math.cos(angle) * radius,
              y: height / 2 + Math.sin(angle) * radius,
              label: node.label.length > 12 ? node.label.substring(0, 12) + '...' : node.label,
              size: 20,
              color: colorData.secondary,
              style: {
                fill: colorData.secondary,
                stroke: colorData.primary,
                lineWidth: 2
              },
              originalNode: node
            };
          });

        const edges = graph.edges
          .filter(edge => 
            nodes.find(n => n.id === edge.source) && 
            nodes.find(n => n.id === edge.target)
          )
          .slice(0, 100) // Limit edges
          .map(edge => ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            style: {
              stroke: '#999',
              lineWidth: 1,
              endArrow: true
            }
          }));

        console.log('G6 Simple: Creating graph with', { nodes: nodes.length, edges: edges.length });

        // Import and create G6 graph
        const { Graph } = await import('@antv/g6');
        
        const g6Graph = new Graph({
          container,
          width,
          height,
          data: { nodes, edges },
          layout: {
            type: 'force',
            preventOverlap: true,
            linkDistance: 80,
            nodeStrength: -200,
            edgeStrength: 0.6,
            center: [width / 2, height / 2]
          },
          behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element'],
          autoFit: 'view'
        });

        // Event handlers for G6 v5.0.48
        g6Graph.on('node:click', (e: any) => {
          console.log('Node clicked:', e);
          const nodeId = e.itemId || e.target?.id;
          if (nodeId) {
            const nodeData = nodes.find(n => n.id === nodeId);
            if (nodeData?.originalNode) {
              onNodeSelect(nodeData.originalNode);
            }
          }
        });

        g6Graph.on('node:dblclick', (e: any) => {
          console.log('Node double clicked:', e);
          const nodeId = e.itemId || e.target?.id;
          if (nodeId) {
            const nodeData = nodes.find(n => n.id === nodeId);
            if (nodeData?.originalNode) {
              onNodeExpand(nodeData.originalNode.id);
            }
          }
        });

        graphRef.current = g6Graph;
        setIsLoading(false);
        console.log('G6 Simple: Graph created successfully');

      } catch (error) {
        console.error('G6 Simple: Failed to create graph:', error);
        setRenderError(`Graph rendering failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setIsLoading(false);
      }
    };

    createGraph();

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
            Graph Visualization
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            {renderError}
          </p>
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
            <h4 className="font-medium mb-2">Dataset Overview</h4>
            <p className="text-sm">
              {graph?.nodes?.length || 0} nodes • {graph?.edges?.length || 0} edges
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Infrastructure RDF model with {visibleNodes.size > 0 ? visibleNodes.size : 'all'} visible nodes
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
          <div className="text-gray-500 dark:text-gray-400">
            G6 force layout laden...
          </div>
        </div>
      )}
    </div>
  );
}