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
  const g6InstanceRef = useRef<any>(null);
  const [g6Loaded, setG6Loaded] = useState(false);

  // Load G6 dynamically
  useEffect(() => {
    let isMounted = true;

    const loadG6 = async () => {
      try {
        // Import G6 with explicit version 5 syntax
        const { Graph } = await import('@antv/g6');
        
        if (!isMounted || !containerRef.current || !graph) return;

        console.log('G6 v5 loaded successfully, initializing force layout');

        // Convert data to G6 v5 format
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
                  x: node.x,
                  y: node.y
                },
                style: {
                  fill: colorData.secondary,
                  stroke: colorData.primary,
                  lineWidth: selectedNode?.id === node.id ? 4 : 2,
                  r: selectedNode?.id === node.id ? 20 : 15,
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
                label: edge.label,
                type: edge.type
              },
              style: {
                stroke: '#64748b',
                lineWidth: 2,
                opacity: 0.8,
                endArrow: {
                  path: 'M 0,0 L 8,4 L 8,-4 Z',
                  fill: '#64748b'
                }
              }
            }))
        };

        // Calculate container dimensions
        const rect = containerRef.current.getBoundingClientRect();
        const width = Math.max(rect.width, 800);
        const height = Math.max(rect.height, 600);

        // Create G6 v5 instance with proper API
        const g6Instance = new Graph({
          container: containerRef.current,
          width,
          height,
          autoFit: 'view',
          padding: 50,
          
          // G6 v5 uses behaviors instead of modes
          behaviors: [
            'drag-canvas',
            'zoom-canvas', 
            'drag-element',
            'click-select'
          ],

          // Node styling
          node: (model: any) => ({
            id: model.id,
            data: {
              type: 'circle',
              size: model.style?.r || 15,
              keyShape: {
                fill: model.style?.fill || '#e2e8f0',
                stroke: model.style?.stroke || '#475569',
                lineWidth: model.style?.lineWidth || 2,
                r: model.style?.r || 15
              },
              labelShape: {
                text: model.data?.label || model.id,
                fill: '#374151',
                fontSize: 12,
                position: 'bottom',
                offsetY: 8
              }
            }
          }),

          // Edge styling
          edge: (model: any) => ({
            id: model.id,
            source: model.source,
            target: model.target,
            data: {
              type: 'line',
              keyShape: {
                stroke: model.style?.stroke || '#64748b',
                lineWidth: model.style?.lineWidth || 2,
                opacity: model.style?.opacity || 0.8,
                endArrow: {
                  path: 'M 0,0 L 8,4 L 8,-4 Z',
                  fill: model.style?.stroke || '#64748b'
                }
              },
              labelShape: model.data?.label ? {
                text: model.data.label,
                fill: '#4b5563',
                fontSize: 11,
                background: {
                  fill: 'rgba(255,255,255,0.9)',
                  padding: [2, 4],
                  radius: 2
                }
              } : undefined
            }
          }),

          // Layout configuration
          layout: {
            type: 'force',
            animated: true,
            preventOverlap: true,
            nodeSize: 30,
            nodeSpacing: 100,
            linkDistance: 150,
            nodeStrength: -300,
            edgeStrength: 0.2,
            center: [width / 2, height / 2],
            gravity: 0.1,
            alpha: 0.9,
            alphaDecay: 0.028,
            velocityDecay: 0.6
          }
        });

        // Event handlers
        g6Instance.on('node:click', (event: any) => {
          const nodeData = event.itemId;
          const node = graph.nodes.find(n => n.id === nodeData);
          if (node) {
            onNodeSelect(node);
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
            const nodeData = event.itemId;
            const node = graph.nodes.find(n => n.id === nodeData);
            if (node) {
              onNodeEdit?.(node);
            }
          }
        });

        // Load data and render
        g6Instance.data(g6Data);
        g6Instance.render();

        console.log('G6 force layout with neutron-repellent physics active');

        g6InstanceRef.current = g6Instance;
        setG6Loaded(true);

      } catch (error) {
        console.error('Failed to initialize G6:', error);
        setG6Loaded(false);
      }
    };

    loadG6();

    return () => {
      isMounted = false;
      if (g6InstanceRef.current) {
        try {
          g6InstanceRef.current.destroy();
        } catch (e) {
          console.warn('Error destroying G6 instance:', e);
        }
      }
    };
  }, []);

  // Update data when props change
  useEffect(() => {
    if (!g6InstanceRef.current || !graph || !g6Loaded) return;

    try {
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
                x: node.x,
                y: node.y
              },
              style: {
                fill: colorData.secondary,
                stroke: colorData.primary,
                lineWidth: selectedNode?.id === node.id ? 4 : 2,
                r: selectedNode?.id === node.id ? 20 : 15,
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
              label: edge.label,
              type: edge.type
            },
            style: {
              stroke: '#64748b',
              lineWidth: 2,
              opacity: 0.8,
              endArrow: {
                path: 'M 0,0 L 8,4 L 8,-4 Z',
                fill: '#64748b'
              }
            }
          }))
      };

      g6InstanceRef.current.read(g6Data);
      
    } catch (error) {
      console.error('Error updating G6 data:', error);
    }
  }, [graph, visibleNodes, selectedNode, g6Loaded]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (g6InstanceRef.current && containerRef.current && g6Loaded) {
        try {
          const rect = containerRef.current.getBoundingClientRect();
          const width = Math.max(rect.width, 800);
          const height = Math.max(rect.height, 600);
          
          g6InstanceRef.current.setSize([width, height]);
          g6InstanceRef.current.fitView();
        } catch (error) {
          console.error('Error resizing G6:', error);
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [g6Loaded]);

  if (!graph) {
    return (
      <div className="w-full h-full bg-gray-50 dark:bg-gray-900 rounded-lg flex items-center justify-center">
        <p className="text-gray-500">Geen graph data beschikbaar</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-gray-50 dark:bg-gray-900 rounded-lg relative">
      <div 
        ref={containerRef}
        className="w-full h-full"
        style={{ minHeight: '600px' }}
      />
      {!g6Loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-900 rounded-lg">
          <p className="text-gray-500">G6 aan het laden...</p>
        </div>
      )}
    </div>
  );
}