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
  const g6GraphRef = useRef<any>(null);

  // Initialize G6 graph
  useEffect(() => {
    if (!containerRef.current || !graph) return;

    // Dynamic import to avoid SSR issues
    import('@antv/g6').then((G6Module) => {
      const G6 = G6Module.default || G6Module;
      
      // Calculate container dimensions
      const containerRect = containerRef.current!.getBoundingClientRect();
      const width = Math.max(containerRect.width, 800);
      const height = Math.max(containerRect.height, 600);

      // Convert our data to G6 format
      const visibleNodeIds = Array.from(visibleNodes);
      const g6Data = {
        nodes: graph.nodes
          .filter((node: any) => visibleNodeIds.includes(node.id))
          .map((node: any) => {
            const colorData = getNodeTypeColor(node.type);
            return {
              id: node.id,
              label: node.label,
              type: 'circle',
              size: selectedNode?.id === node.id ? 40 : 30,
              style: {
                fill: colorData.secondary,
                stroke: colorData.primary,
                lineWidth: selectedNode?.id === node.id ? 4 : 2,
              },
              labelCfg: {
                style: {
                  fontSize: 12,
                  fill: '#374151',
                  fontWeight: 500,
                },
                position: 'bottom',
                offset: 8,
              },
              originalData: node,
            };
          }),
        edges: graph.edges
          .filter((edge: any) => 
            visibleNodeIds.includes(edge.source) && 
            visibleNodeIds.includes(edge.target)
          )
          .map((edge: any) => ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            label: edge.label,
            type: 'quadratic',
            style: {
              stroke: 'hsl(215, 30, 55%)',
              lineWidth: 2,
              opacity: 0.75,
              endArrow: true,
            },
            labelCfg: {
              style: {
                fontSize: 11,
                fill: '#4B5563',
                background: {
                  fill: 'rgba(255, 255, 255, 0.9)',
                  padding: [2, 4],
                  radius: 2,
                },
              },
            },
          }))
      };

      // Create G6 graph with force layout  
      const g6Graph = new G6.Graph({
        container: containerRef.current!,
        width,
        height,
        layout: {
          type: 'force',
          preventOverlap: true,
          nodeSpacing: 100,
          nodeStrength: -300,
          edgeStrength: 0.1,
          center: [width / 2, height / 2],
          linkDistance: 150,
          alpha: 0.3,
          alphaDecay: 0.028,
        },
        defaultNode: {
          type: 'circle',
          size: 30,
          style: {
            lineWidth: 2,
            opacity: 0.9,
          },
        },
        defaultEdge: {
          type: 'quadratic',
          style: {
            opacity: 0.75,
            lineWidth: 2,
          },
        },
        nodeStateStyles: {
          hover: {
            lineWidth: 3,
            shadowColor: '#000',
            shadowBlur: 10,
          },
          selected: {
            lineWidth: 4,
            shadowColor: '#000',
            shadowBlur: 15,
          },
        },
        modes: {
          default: [
            'drag-canvas',
            'zoom-canvas',
            'click-select',
            'drag-node',
          ],
        },
        animate: true,
        fitView: true,
        fitViewPadding: [50, 50, 50, 50],
      });

      // Event handlers
      graph.on('node:click', (evt: any) => {
        const model = evt.item?.getModel();
        if (model?.originalData) {
          onNodeSelect(model.originalData);
        }
      });

      graph.on('node:dblclick', (evt: any) => {
        const model = evt.item?.getModel();
        if (model?.id) {
          onNodeExpand(model.id);
        }
      });

      graph.on('node:contextmenu', (evt: any) => {
        const model = evt.item?.getModel();
        if (model?.originalData && editMode) {
          onNodeEdit?.(model.originalData);
        }
      });

      // Hover effects
      graph.on('node:mouseenter', (evt: any) => {
        const item = evt.item;
        graph.setItemState(item, 'hover', true);
      });

      graph.on('node:mouseleave', (evt: any) => {
        const item = evt.item;
        graph.setItemState(item, 'hover', false);
      });

      // Load data and render
      graph.data(g6Data);
      graph.render();

      console.log('G6 force layout initialized with neutron-repellent physics');

      // Store reference
      g6GraphRef.current = graph;

      // Cleanup
      return () => {
        if (g6GraphRef.current && !g6GraphRef.current.destroyed) {
          g6GraphRef.current.destroy();
        }
      };
    }).catch(error => {
      console.error('Failed to load G6:', error);
      // Fallback to basic visualization if G6 fails
    });
  }, []);

  // Update data when props change
  useEffect(() => {
    if (!g6GraphRef.current || !graph) return;

    const visibleNodeIds = Array.from(visibleNodes);
    const g6Data = {
      nodes: graph.nodes
        .filter(node => visibleNodeIds.includes(node.id))
        .map(node => {
          const colorData = getNodeTypeColor(node.type);
          return {
            id: node.id,
            label: node.label,
            type: 'circle',
            size: selectedNode?.id === node.id ? 40 : 30,
            style: {
              fill: colorData.secondary,
              stroke: colorData.primary,
              lineWidth: selectedNode?.id === node.id ? 4 : 2,
            },
            labelCfg: {
              style: {
                fontSize: 12,
                fill: '#374151',
                fontWeight: 500,
              },
              position: 'bottom',
              offset: 8,
            },
            originalData: node,
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
          label: edge.label,
          type: 'quadratic',
          style: {
            stroke: 'hsl(215, 30%, 55%)',
            lineWidth: 2,
            opacity: 0.75,
            endArrow: true,
          },
          labelCfg: {
            style: {
              fontSize: 11,
              fill: '#4B5563',
              background: {
                fill: 'rgba(255, 255, 255, 0.9)',
                padding: [2, 4],
                radius: 2,
              },
            },
          },
        }))
    };

    try {
      g6GraphRef.current.changeData(g6Data);
      g6GraphRef.current.fitView(50);
    } catch (error) {
      console.error('Error updating G6 data:', error);
    }
  }, [graph, visibleNodes, selectedNode]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (g6GraphRef.current && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const width = Math.max(containerRect.width, 800);
        const height = Math.max(containerRect.height, 600);
        
        try {
          g6GraphRef.current.changeSize(width, height);
          g6GraphRef.current.fitView(50);
        } catch (error) {
          console.error('Error resizing G6 graph:', error);
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div 
      ref={containerRef}
      className="w-full h-full bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden"
      style={{ minHeight: '600px' }}
    />
  );
}