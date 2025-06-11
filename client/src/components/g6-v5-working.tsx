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
            // Random starting positions to prevent clustering at center
            const randomX = (Math.random() - 0.5) * width * 0.6;
            const randomY = (Math.random() - 0.5) * height * 0.6;
            
            return {
              id: node.id,
              x: randomX,
              y: randomY,
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
            center: [width / 2, height / 2],
            linkDistance: 150,
            nodeStrength: -800,
            edgeStrength: 0.3,
            preventOverlap: true,
            nodeSize: 30,
            alpha: 0.5,
            alphaDecay: 0.02,
            velocityDecay: 0.4,
            collideStrength: 1.0,
            clustering: false
          },
          behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element']
        });

        // Event handlers for G6 v5.0.48
        g6Graph.on('node:click', (event: any) => {
          console.log('G6 v5 Node clicked:', event);
          const nodeId = event.itemId || event.target?.id;
          
          if (nodeId) {
            // Find the original node data from the nodes array
            const originalNode = nodes.find(n => n.id === nodeId);
            if (originalNode) {
              console.log('Original node found:', originalNode);
              
              // Use the original visualization node structure
              const visualizationNode = {
                id: originalNode.data.id,
                label: originalNode.data.label,
                type: originalNode.data.type,
                data: originalNode.data.data,
                x: originalNode.data.x,
                y: originalNode.data.y
              };
              
              console.log('Calling onNodeSelect with:', visualizationNode);
              onNodeSelect(visualizationNode as any);
              
              // Visual feedback using G6 v5.0.48 element state
              try {
                // Clear all selections using the original nodes array
                nodes.forEach((node: any) => {
                  if (node.id !== nodeId) {
                    g6Graph.setElementState(node.id, 'selected', false);
                  }
                });
                
                // Set current node as selected
                g6Graph.setElementState(nodeId, 'selected', true);
                console.log(`Node "${visualizationNode.label}" selected successfully`);
              } catch (e) {
                console.warn('Selection visual feedback failed:', e);
              }
            }
          }
        });

        g6Graph.on('node:dblclick', (event: any) => {
          console.log('Node double clicked:', event);
          const nodeId = event.itemId || event.target?.id;
          
          if (nodeId) {
            onNodeExpand(nodeId);
          }
        });

        // Right-click context menu for node editing
        g6Graph.on('node:contextmenu', (event: any) => {
          console.log('Node right-clicked:', event);
          const nodeId = event.itemId || event.target?.id;
          
          if (nodeId && onNodeEdit) {
            // Prevent default browser context menu
            event.preventDefault?.();
            
            // Find the original node from the nodes array for editing
            const originalNode = nodes.find(n => n.id === nodeId);
            if (originalNode) {
              console.log('Opening edit for node:', originalNode.data.label);
              onNodeEdit(originalNode.data as any);
            }
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
              console.log('Edge selected:', edgeData.data?.data?.label || itemId);
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

        // Initialize force layout with better distribution
        setTimeout(() => {
          g6Graph.layout();
        }, 100);

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