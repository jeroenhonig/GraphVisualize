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
  const graphInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || !graph) return;

    const initializeGraph = async () => {
      try {
        const { Graph } = await import('@antv/g6');

        const width = containerRef.current!.clientWidth || 800;
        const height = containerRef.current!.clientHeight || 600;

        // Convert our data to proper G6 v5 format according to official docs
        const visibleNodeIds = Array.from(visibleNodes);
        
        const g6Data = {
          nodes: graph.nodes
            .filter(node => visibleNodeIds.includes(node.id))
            .map(node => {
              const colorData = getNodeTypeColor(node.type);
              return {
                id: node.id,
                data: {
                  label: node.label,
                  type: node.type,
                  originalData: node,
                  // Initial position
                  x: node.x || Math.random() * width,
                  y: node.y || Math.random() * height
                }
              };
            }),
          edges: graph.edges
            .filter(edge => 
              visibleNodeIds.includes(edge.source) && 
              visibleNodeIds.includes(edge.target)
            )
            .map(edge => ({
              id: edge.id,
              source: edge.source,
              target: edge.target,
              data: {
                label: edge.label || '',
                type: edge.type
              }
            }))
        };

        // Initialize graph with proper G6 v5 configuration
        const g6Instance = new Graph({
          container: containerRef.current!,
          width,
          height,
          
          // Use the new v5 data format
          data: g6Data,
          
          // Layout configuration for force-directed with neutron-repellent physics
          layout: {
            type: 'force',
            animated: true,
            preventOverlap: true,
            nodeSize: 30,
            nodeSpacing: (d: any) => 100,
            linkDistance: (d: any) => 150,
            nodeStrength: (d: any) => -300,  // Strong repulsion for neutron-repellent effect
            edgeStrength: (d: any) => 0.2,
            center: [width / 2, height / 2],
            gravity: 0.1,
            alpha: 0.9,
            alphaDecay: 0.028,
            velocityDecay: 0.6,
            collideStrength: 0.8
          },

          // Node styling using proper G6 v5 theme configuration
          theme: {
            node: {
              palette: {
                type: 'group',
                field: 'cluster'
              }
            }
          },

          // Node configuration
          node: {
            style: (model: any) => {
              const colorData = getNodeTypeColor(model.data?.type || 'default');
              const isSelected = selectedNode?.id === model.id;
              
              return {
                keyShape: {
                  r: isSelected ? 20 : 15,
                  fill: colorData.secondary,
                  stroke: colorData.primary,
                  lineWidth: isSelected ? 4 : 2,
                  cursor: 'pointer'
                },
                labelShape: {
                  text: model.data?.label || model.id,
                  fontSize: 12,
                  fill: '#374151',
                  fontWeight: isSelected ? 600 : 400,
                  position: 'bottom',
                  offsetY: 8,
                  maxWidth: 120,
                  wordWrap: true,
                  cursor: 'pointer'
                },
                haloShape: isSelected ? {
                  r: 25,
                  fill: colorData.primary,
                  opacity: 0.2
                } : undefined
              };
            }
          },

          // Edge configuration
          edge: {
            style: {
              keyShape: {
                stroke: '#64748b',
                lineWidth: 2,
                opacity: 0.8,
                endArrow: {
                  path: 'M 0,0 L 8,4 L 8,-4 Z',
                  fill: '#64748b'
                }
              },
              labelShape: {
                fontSize: 11,
                fill: '#4b5563',
                background: {
                  fill: 'rgba(255, 255, 255, 0.9)',
                  padding: [2, 4],
                  radius: 2
                }
              }
            }
          },

          // Interaction behaviors
          behaviors: [
            'drag-canvas',
            'zoom-canvas',
            'drag-element',
            'click-select'
          ],

          // Auto-fit to view
          autoFit: 'view',
          padding: [20, 20, 20, 20]
        });

        // Event handlers following G6 v5 pattern
        g6Instance.on('node:click', (event: any) => {
          const nodeId = event.itemId;
          const nodeData = graph.nodes.find(n => n.id === nodeId);
          if (nodeData) {
            onNodeSelect(nodeData);
          }
        });

        g6Instance.on('node:dblclick', (event: any) => {
          const nodeId = event.itemId;
          if (nodeId) {
            onNodeExpand(nodeId);
          }
        });

        g6Instance.on('node:contextmenu', (event: any) => {
          if (editMode) {
            event.preventDefault();
            const nodeId = event.itemId;
            const nodeData = graph.nodes.find(n => n.id === nodeId);
            if (nodeData) {
              onNodeEdit?.(nodeData);
            }
          }
        });

        // Store reference
        graphInstanceRef.current = g6Instance;
        
        console.log('G6 v5 force layout initialized with official API - neutron-repellent physics active');

      } catch (error) {
        console.error('G6 initialization failed:', error);
      }
    };

    initializeGraph();

    // Cleanup function
    return () => {
      if (graphInstanceRef.current) {
        graphInstanceRef.current.destroy();
        graphInstanceRef.current = null;
      }
    };
  }, []);

  // Update data when props change
  useEffect(() => {
    if (!graphInstanceRef.current || !graph) return;

    try {
      const visibleNodeIds = Array.from(visibleNodes);
      
      const g6Data = {
        nodes: graph.nodes
          .filter(node => visibleNodeIds.includes(node.id))
          .map(node => {
            return {
              id: node.id,
              data: {
                label: node.label,
                type: node.type,
                originalData: node,
                x: node.x,
                y: node.y
              }
            };
          }),
        edges: graph.edges
          .filter(edge => 
            visibleNodeIds.includes(edge.source) && 
            visibleNodeIds.includes(edge.target)
          )
          .map(edge => ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            data: {
              label: edge.label || '',
              type: edge.type
            }
          }))
      };

      // Update with proper G6 v5 method
      graphInstanceRef.current.updateData(g6Data);
      
    } catch (error) {
      console.error('G6 data update failed:', error);
    }
  }, [graph, visibleNodes, selectedNode]);

  // Handle container resize
  useEffect(() => {
    const handleResize = () => {
      if (graphInstanceRef.current && containerRef.current) {
        const width = containerRef.current.clientWidth || 800;
        const height = containerRef.current.clientHeight || 600;
        graphInstanceRef.current.setSize(width, height);
        graphInstanceRef.current.fitView();
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  if (!graph) {
    return (
      <div className="w-full h-full bg-gray-50 dark:bg-gray-900 rounded-lg flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Geen graph data beschikbaar</p>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="w-full h-full bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden"
      style={{ minHeight: '600px' }}
    />
  );
}