import { useEffect, useRef, useState } from "react";
import type { GraphData, VisualizationNode, GraphTransform } from "@shared/schema";
import { getNodeTypeColor } from "@/lib/color-utils";

interface G6V5CompatibleProps {
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

export default function G6V5Compatible({
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
}: G6V5CompatibleProps) {
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
        if (!container) return;
        
        container.innerHTML = '';

        const width = container.clientWidth || 800;
        const height = container.clientHeight || 600;

        // Prepare visible nodes
        const visibleNodeIds = visibleNodes.size > 0 ? Array.from(visibleNodes) : graph.nodes.map(n => n.id);
        
        // Format data for G6 v5.0.48
        const nodes = graph.nodes
          .filter(node => visibleNodeIds.includes(node.id))
          .slice(0, 50)
          .map(node => {
            const colorData = getNodeTypeColor(node.type);
            return {
              id: node.id,
              data: {
                label: node.label.length > 15 ? node.label.substring(0, 15) + '...' : node.label,
                type: node.type,
                originalNode: node,
                style: {
                  fill: colorData.secondary,
                  stroke: colorData.primary,
                  lineWidth: 2,
                  r: 15
                }
              }
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
            data: {
              style: {
                stroke: '#999',
                lineWidth: 1.5,
                endArrow: true
              }
            }
          }));

        console.log('G6 V5: Creating graph with', { nodes: nodes.length, edges: edges.length });

        // Create G6 v5.0.48 graph
        const g6Graph = new Graph({
          container,
          width,
          height,
          data: { nodes, edges },
          layout: {
            type: 'force',
            preventOverlap: true,
            linkDistance: 100,
            nodeStrength: -300,
            edgeStrength: 0.5,
            center: [width / 2, height / 2]
          },
          behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element'],
          autoFit: 'view',
          padding: [20, 20, 20, 20]
        });

        // Force render
        setTimeout(() => {
          try {
            if (graphRef.current) {
              graphRef.current.fitView();
            }
          } catch (e) {
            console.warn('G6 V5: fitView failed:', e);
          }
        }, 100);

        // Event handlers for G6 v5.0.48
        g6Graph.on('node:click', (evt: any) => {
          console.log('G6 V5: Node clicked', evt);
          const nodeId = evt.itemId;
          const nodeData = nodes.find(n => n.id === nodeId);
          
          if (nodeData?.data?.originalNode) {
            onNodeSelect(nodeData.data.originalNode);
          }
        });

        g6Graph.on('node:dblclick', (evt: any) => {
          console.log('G6 V5: Node double clicked', evt);
          const nodeId = evt.itemId;
          
          if (nodeId) {
            onNodeExpand(nodeId);
          }
        });

        // Canvas events
        g6Graph.on('canvas:click', () => {
          console.log('G6 V5: Canvas clicked - clearing selection');
        });

        // Debug rendering
        setTimeout(() => {
          const canvas = container.querySelector('canvas');
          const svg = container.querySelector('svg');
          const children = Array.from(container.children);
          
          console.log('G6 V5: Rendering check:', {
            hasCanvas: !!canvas,
            hasSvg: !!svg,
            childrenCount: children.length,
            childrenTypes: children.map(c => c.tagName),
            containerSize: { width: container.clientWidth, height: container.clientHeight }
          });

          if (!canvas && !svg && children.length === 0) {
            console.warn('G6 V5: No rendering elements found');
            setRenderError('G6 v5.0.48 failed to create visual elements');
          }
        }, 1000);

        graphRef.current = g6Graph;
        setIsLoading(false);
        console.log('G6 V5: Graph created successfully');

      } catch (error) {
        console.error('G6 V5: Failed to create graph:', error);
        setRenderError(`G6 v5.0.48 error: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
            G6 v5.0.48 Visualization
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
              Infrastructure RDF model - G6 v5.0.48 compatibility layer
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
              G6 v5.0.48 force layout laden...
            </div>
            <div className="text-xs text-gray-400">
              drag-canvas • zoom-canvas • drag-element
            </div>
          </div>
        </div>
      )}
      
      {/* Controls overlay */}
      {!isLoading && !renderError && (
        <div className="absolute top-4 right-4 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-md text-xs">
          <div className="font-medium mb-2">G6 v5.0.48:</div>
          <div className="space-y-1 text-gray-600 dark:text-gray-300">
            <div>• Scroll: Zoom</div>
            <div>• Drag: Pan</div>
            <div>• Click nodes: Select</div>
            <div>• Infrastructure dataset</div>
          </div>
        </div>
      )}
    </div>
  );
}