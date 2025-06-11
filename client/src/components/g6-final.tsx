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

  useEffect(() => {
    if (!containerRef.current || !graph) return;

    const initGraph = async () => {
      try {
        setIsLoading(true);
        console.log('G6 Final: Starting initialization');

        // Import G6
        const G6Module = await import('@antv/g6');
        const { Graph } = G6Module;

        // Clear existing graph
        if (graphRef.current) {
          graphRef.current.destroy();
          graphRef.current = null;
        }

        const container = containerRef.current;
        if (!container) return;
        
        const width = container.clientWidth || 800;
        const height = container.clientHeight || 600;

        console.log('G6 Final: Container dimensions:', { width, height });

        // Prepare visible nodes
        const visibleNodeIds = visibleNodes.size > 0 ? Array.from(visibleNodes) : graph.nodes.map(n => n.id);
        console.log('G6 Final: Visible nodes count:', visibleNodeIds.length);

        // Format data for G6 v5 with proper structure
        const nodes = graph.nodes
          .filter(node => visibleNodeIds.includes(node.id))
          .map((node, index) => {
            const colorData = getNodeTypeColor(node.type);
            const angle = (index / visibleNodeIds.length) * 2 * Math.PI;
            const radius = Math.min(width, height) * 0.3;
            
            return {
              id: node.id,
              data: {
                label: node.label.length > 15 ? node.label.substring(0, 15) + '...' : node.label,
                type: node.type,
                originalNode: node,
                size: 20,
                color: colorData.secondary,
                style: {
                  fill: colorData.secondary,
                  stroke: colorData.primary,
                  lineWidth: 2
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
              keyShape: {
                stroke: '#999',
                lineWidth: 1,
                endArrow: {
                  path: 'M 0,0 L 8,4 L 0,8 Z',
                  fill: '#999'
                }
              }
            }
          }));

        console.log('G6 Final: Prepared data:', { nodes: nodes.length, edges: edges.length });

        // Create graph with explicit rendering mode
        const graphInstance = new Graph({
          container,
          width,
          height,
          renderer: 'canvas',
          data: { nodes, edges },
          layout: {
            type: 'force',
            linkDistance: 100,
            nodeStrength: -200,
            edgeStrength: 0.5,
            preventOverlap: true,
            center: [width / 2, height / 2]
          },
          behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element'],
          autoFit: 'view'
        });

        // Force render
        graphInstance.render();

        // Event handlers
        graphInstance.on('node:click', (evt: any) => {
          console.log('G6 Final: Node clicked', evt);
          const nodeData = evt.itemId;
          const originalNode = nodes.find(n => n.id === nodeData)?.data?.originalNode;
          if (originalNode) {
            onNodeSelect(originalNode);
          }
        });

        graphInstance.on('node:dblclick', (evt: any) => {
          console.log('G6 Final: Node double clicked', evt);
          const nodeData = evt.itemId;
          if (nodeData) {
            onNodeExpand(nodeData);
          }
        });

        graphRef.current = graphInstance;
        setIsLoading(false);
        console.log('G6 Final: Graph created successfully');
        
        // Debug: Check if nodes are actually rendered
        setTimeout(() => {
          const svgElement = container.querySelector('svg');
          const canvasElement = container.querySelector('canvas');
          const nodeElements = container.querySelectorAll('circle, rect, [data-item-type="node"]');
          
          console.log('G6 Final: Rendering check:', {
            hasSvg: !!svgElement,
            hasCanvas: !!canvasElement,
            nodeCount: nodeElements.length,
            containerChildren: container.children.length,
            graphInstance: !!graphRef.current
          });
          
          if (nodeElements.length === 0) {
            console.log('G6 Final: No nodes rendered, attempting render refresh');
            if (graphRef.current && typeof graphRef.current.render === 'function') {
              graphRef.current.render();
            }
          }
        }, 1000);

      } catch (error) {
        console.error('G6 Final: Failed to create graph:', error);
        setIsLoading(false);
        
        // Fallback to simple div with node list
        if (containerRef.current) {
          containerRef.current.innerHTML = `
            <div style="padding: 20px; text-align: center;">
              <h3>Graph Data (${graph?.nodes?.length || 0} nodes, ${graph?.edges?.length || 0} edges)</h3>
              <p>G6 rendering temporarily unavailable</p>
              <div style="max-height: 300px; overflow-y: auto; text-align: left; margin-top: 20px;">
                ${graph?.nodes?.slice(0, 10).map(node => 
                  `<div style="padding: 5px; border: 1px solid #ddd; margin: 2px;">
                    <strong>${node.label}</strong> (${node.type})
                  </div>`
                ).join('') || ''}
                ${graph?.nodes && graph.nodes.length > 10 ? `<div style="padding: 10px; text-align: center;">... and ${graph.nodes.length - 10} more nodes</div>` : ''}
              </div>
            </div>
          `;
        }
      }
    };

    initGraph();

    return () => {
      if (graphRef.current) {
        graphRef.current.destroy();
        graphRef.current = null;
      }
    };
  }, [graph, visibleNodes]);

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