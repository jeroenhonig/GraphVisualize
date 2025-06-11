import { useEffect, useRef, useState } from "react";
import type { GraphData, VisualizationNode, GraphTransform } from "@shared/schema";
import { getNodeTypeColor } from "@/lib/color-utils";

interface G6V5NativeProps {
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

export default function G6V5Native({
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
}: G6V5NativeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || !graph) return;

    const createG6V5Graph = async () => {
      try {
        setIsLoading(true);
        setRenderError(null);

        const G6Module = await import('@antv/g6');
        const { Graph } = G6Module;

        // Clean up existing graph
        if (graphRef.current) {
          try {
            graphRef.current.destroy();
          } catch (e) {
            console.warn('Graph cleanup error:', e);
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
        
        // Format data for G6 v5.0.48 native API
        const nodes = graph.nodes
          .filter(node => visibleNodeIds.includes(node.id))
          .slice(0, 100) // Performance limit
          .map(node => {
            const colorData = getNodeTypeColor(node.type);
            return {
              id: node.id,
              data: {
                ...node,
                label: node.label.length > 20 ? node.label.substring(0, 20) + '...' : node.label,
                x: node.x || Math.random() * width,
                y: node.y || Math.random() * height,
                fill: colorData.secondary,
                stroke: colorData.primary,
                size: 30
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
              ...edge
            }
          }));

        console.log('G6 v5.0.48: Creating native graph with', { nodes: nodes.length, edges: edges.length });

        // Create G6 v5.0.48 graph with native API
        const g6Graph = new Graph({
          container,
          width,
          height,
          
          // G6 v5 data format
          data: {
            nodes,
            edges
          },

          // G6 v5 node configuration
          node: (model: any) => ({
            id: model.id,
            data: {
              ...model.data,
              type: 'circle',
              keyShape: {
                r: 15,
                fill: model.data.fill || '#91c7ff',
                stroke: model.data.stroke || '#5b8ff9',
                lineWidth: 2
              },
              labelShape: {
                text: model.data.label,
                fill: '#333',
                fontSize: 10,
                position: 'bottom',
                offsetY: 5
              }
            }
          }),

          // G6 v5 edge configuration  
          edge: (model: any) => ({
            id: model.id,
            source: model.source,
            target: model.target,
            data: {
              type: 'line',
              keyShape: {
                stroke: '#999',
                lineWidth: 1.5,
                opacity: 0.8,
                endArrow: {
                  path: 'M 0,0 L 8,4 L 0,8 Z',
                  fill: '#999'
                }
              }
            }
          }),

          // G6 v5 layout
          layout: {
            type: 'force',
            preventOverlap: true,
            linkDistance: 120,
            nodeStrength: -400,
            edgeStrength: 0.6,
            center: [width / 2, height / 2]
          },

          // G6 v5 behaviors
          behaviors: [
            {
              type: 'zoom-canvas',
              sensitivity: 0.8,
              minZoom: 0.1,
              maxZoom: 5
            },
            {
              type: 'drag-canvas'
            },
            {
              type: 'drag-element',
              elements: ['node']
            }
          ],

          // Performance optimizations
          renderer: 'canvas',
          enableOptimize: true,
          optimize: {
            tileBased: false
          }
        });

        // Event handlers for G6 v5.0.48
        g6Graph.on('node:pointerenter', (event: any) => {
          const { itemId } = event;
          console.log('G6 v5: Node hover enter', itemId);
        });

        g6Graph.on('node:pointerleave', (event: any) => {
          const { itemId } = event;
          console.log('G6 v5: Node hover leave', itemId);
        });

        g6Graph.on('node:click', (event: any) => {
          const { itemId } = event;
          console.log('G6 v5: Node clicked', itemId);
          
          const nodeData = nodes.find(n => n.id === itemId);
          if (nodeData?.data) {
            onNodeSelect(nodeData.data);
          }
        });

        g6Graph.on('node:dblclick', (event: any) => {
          const { itemId } = event;
          console.log('G6 v5: Node double clicked', itemId);
          
          if (itemId) {
            onNodeExpand(itemId);
          }
        });

        g6Graph.on('canvas:click', () => {
          console.log('G6 v5: Canvas clicked');
        });

        // Auto fit and render
        try {
          g6Graph.render();
          
          setTimeout(() => {
            try {
              g6Graph.fitView();
            } catch (e) {
              console.warn('G6 v5: fitView failed:', e);
            }
          }, 1000);
        } catch (renderErr) {
          console.error('G6 v5: Render failed:', renderErr);
          throw renderErr;
        }

        // Check rendering success
        setTimeout(() => {
          const canvas = container.querySelector('canvas');
          const svg = container.querySelector('svg');
          const children = Array.from(container.children);
          
          console.log('G6 v5: Render check:', {
            hasCanvas: !!canvas,
            hasSvg: !!svg,
            childrenCount: children.length,
            childrenTypes: children.map(c => c.tagName)
          });

          if (!canvas && !svg && children.length === 0) {
            setRenderError('G6 v5.0.48 failed to create visual elements');
          }
        }, 1500);

        graphRef.current = g6Graph;
        setIsLoading(false);
        console.log('G6 v5.0.48: Native graph created successfully');

      } catch (error) {
        console.error('G6 v5.0.48: Creation failed:', error);
        setRenderError(`G6 v5.0.48 native error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setIsLoading(false);
      }
    };

    createG6V5Graph();

    return () => {
      if (graphRef.current) {
        try {
          graphRef.current.destroy();
        } catch (e) {
          console.warn('G6 v5: Cleanup error:', e);
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
            G6 v5.0.48 Native Implementation
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            {renderError}
          </p>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
            <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">
              API Compatibility
            </h4>
            <p className="text-sm text-yellow-600 dark:text-yellow-300">
              G6 v5.0.48 native API test - mogelijk incompatibiliteit
            </p>
            <p className="text-xs text-gray-500 mt-2">
              {graph?.nodes?.length || 0} nodes • {graph?.edges?.length || 0} edges
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
              G6 v5.0.48 native API laden...
            </div>
            <div className="text-xs text-gray-400">
              Canvas renderer • Force layout • Event handlers
            </div>
          </div>
        </div>
      )}
      
      {/* G6 v5 info overlay */}
      {!isLoading && !renderError && (
        <div className="absolute top-4 right-4 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-md text-xs">
          <div className="font-medium mb-2">G6 v5.0.48 Native:</div>
          <div className="space-y-1 text-gray-600 dark:text-gray-300">
            <div>• Canvas renderer</div>
            <div>• Force layout algorithm</div>
            <div>• zoom-canvas behavior</div>
            <div>• drag-canvas behavior</div>
            <div>• drag-element behavior</div>
            <div>• Performance optimized</div>
          </div>
        </div>
      )}
    </div>
  );
}