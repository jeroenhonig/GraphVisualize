import { useEffect, useRef, useState } from "react";
import type { GraphData, VisualizationNode, GraphTransform } from "@shared/schema";
import { getNodeTypeColor } from "@/lib/color-utils";

interface G6V5WorkingProps {
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

export default function G6V5Working({
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
}: G6V5WorkingProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || !graph) return;

    const createWorkingGraph = async () => {
      try {
        setIsLoading(true);
        setRenderError(null);

        const G6Module = await import('@antv/g6');
        const { Graph } = G6Module;

        if (graphRef.current) {
          try {
            graphRef.current.destroy();
          } catch (e) {
            console.warn('Graph cleanup:', e);
          }
          graphRef.current = null;
        }

        const container = containerRef.current;
        if (!container) return;
        
        container.innerHTML = '';
        const width = container.clientWidth || 800;
        const height = container.clientHeight || 600;

        const visibleNodeIds = visibleNodes.size > 0 ? Array.from(visibleNodes) : graph.nodes.map(n => n.id);
        
        const nodes = graph.nodes
          .filter(node => visibleNodeIds.includes(node.id))
          .slice(0, 100)
          .map(node => {
            const colorData = getNodeTypeColor(node.type);
            return {
              id: node.id,
              data: {
                ...node,
                label: node.label.length > 15 ? node.label.substring(0, 15) + '...' : node.label,
                fill: colorData.secondary,
                stroke: colorData.primary
              }
            };
          });

        const edges = graph.edges
          .filter(edge => 
            nodes.find(n => n.id === edge.source) && 
            nodes.find(n => n.id === edge.target)
          )
          .slice(0, 200)
          .map(edge => ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            data: {
              ...edge,
              label: edge.label || '',
              type: edge.type || 'line'
            }
          }));

        console.log('Creating G6 v5.0.48 working graph:', { nodes: nodes.length, edges: edges.length });

        // Use actual G6 v5.0.48 API
        const g6Graph = new Graph({
          container,
          width,
          height,
          data: { nodes, edges },
          node: {
            style: {
              size: 30,
              fill: (d: any) => {
                const colorData = getNodeTypeColor(d.data?.type || 'unknown');
                return colorData.secondary;
              },
              stroke: (d: any) => {
                const colorData = getNodeTypeColor(d.data?.type || 'unknown');
                return colorData.primary;
              },
              lineWidth: 2,
              labelText: (d: any) => d.data?.label || d.id,
              labelFill: '#333',
              labelFontSize: 10
            },
            state: {
              selected: {
                fill: '#ffeb3b',
                stroke: '#ff9800',
                lineWidth: 4
              },
              hover: {
                fill: '#ffc107',
                stroke: '#ff6f00',
                lineWidth: 3
              }
            }
          },
          edge: {
            style: {
              stroke: '#999',
              lineWidth: 1.5,
              endArrow: true
            }
          },
          layout: {
            type: 'force',
            preventOverlap: true,
            linkDistance: 100,
            nodeStrength: -300,
            edgeStrength: 0.5
          },
          behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element']
        });

        // Event handlers for G6 v5.0.48
        g6Graph.on('node:click', (event: any) => {
          console.log('Node clicked:', event);
          const { itemId, itemType } = event;
          
          if (itemType === 'node' && itemId) {
            // Find the original node data
            const nodeData = nodes.find(n => n.id === itemId);
            if (nodeData?.data) {
              console.log('Selecting node:', nodeData.data.label || itemId);
              onNodeSelect(nodeData.data);
              
              // Visual feedback using G6 v5.0.48 element state API
              try {
                // Clear previous selections
                nodes.forEach(node => {
                  if (node.id !== itemId) {
                    g6Graph.setElementState(node.id, 'selected', false);
                    g6Graph.setElementState(node.id, 'hover', false);
                  }
                });
                
                // Set current node as selected
                g6Graph.setElementState(itemId, 'selected', true);
                console.log(`Node "${nodeData.data.label || itemId}" selected with yellow highlight`);
              } catch (e) {
                console.warn('Element state selection failed:', e);
              }
            }
          }
        });

        g6Graph.on('node:dblclick', (event: any) => {
          console.log('Node double clicked:', event);
          const { itemId, itemType } = event;
          
          if (itemType === 'node' && itemId) {
            onNodeExpand(itemId);
          }
        });

        // Hover effects
        g6Graph.on('node:mouseenter', (event: any) => {
          const { itemId } = event;
          if (itemId) {
            g6Graph.setElementState(itemId, 'hover', true);
          }
        });

        g6Graph.on('node:mouseleave', (event: any) => {
          const { itemId } = event;
          if (itemId) {
            g6Graph.setElementState(itemId, 'hover', false);
          }
        });

        // Edge selection
        g6Graph.on('edge:click', (event: any) => {
          console.log('Edge clicked:', event);
          const { itemId, itemType } = event;
          
          if (itemType === 'edge' && itemId) {
            const edgeData = edges.find(e => e.id === itemId);
            if (edgeData) {
              console.log('Edge selected:', edgeData.label || itemId);
            }
          }
        });

        // Canvas click to clear selection
        g6Graph.on('canvas:click', () => {
          console.log('Canvas clicked - clearing selection');
          // Clear all node selections using available nodes data
          try {
            nodes.forEach(node => {
              g6Graph.setElementState(node.id, 'selected', false);
            });
            g6Graph.render();
            console.log('All selections cleared successfully');
          } catch (e) {
            console.warn('Failed to clear selections:', e);
          }
        });

        // Render graph
        await g6Graph.render();

        // Check if rendering worked
        setTimeout(() => {
          const hasElements = container.children.length > 0;
          console.log('G6 v5: Render success check:', { 
            hasElements, 
            childCount: container.children.length,
            containerSize: { width: container.clientWidth, height: container.clientHeight }
          });
          
          if (!hasElements) {
            setRenderError('G6 v5.0.48 rendering incomplete');
          }
        }, 1000);

        graphRef.current = g6Graph;
        setIsLoading(false);
        console.log('G6 v5.0.48 working graph created');

      } catch (error) {
        console.error('G6 v5.0.48 creation error:', error);
        setRenderError(`G6 v5.0.48 error: ${error instanceof Error ? error.message : 'Creation failed'}`);
        setIsLoading(false);
      }
    };

    createWorkingGraph();

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
            G6 v5.0.48 Working Implementation
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            {renderError}
          </p>
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
              Infrastructure Dataset
            </h4>
            <p className="text-sm text-blue-600 dark:text-blue-300">
              {graph?.nodes?.length || 0} nodes • {graph?.edges?.length || 0} edges
            </p>
            <p className="text-xs text-gray-500 mt-2">
              RDF infrastructure model - force layout with performance optimization
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
              G6 v5.0.48 force layout initialiseren...
            </div>
            <div className="text-xs text-gray-400">
              Canvas rendering • Force simulation • Event binding
            </div>
          </div>
        </div>
      )}
      
      {!isLoading && !renderError && (
        <div className="absolute top-4 right-4 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-md text-xs">
          <div className="font-medium mb-2">G6 v5.0.48 Status:</div>
          <div className="space-y-1 text-gray-600 dark:text-gray-300">
            <div>• Canvas renderer actief</div>
            <div>• Force layout algoritme</div>
            <div>• Drag & zoom behaviors</div>
            <div>• Node click events</div>
            <div>• Performance geoptimaliseerd</div>
          </div>
        </div>
      )}
    </div>
  );
}