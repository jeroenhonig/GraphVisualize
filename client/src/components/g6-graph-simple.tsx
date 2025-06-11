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
  const [isReady, setIsReady] = useState(false);

  // Initialize G6
  useEffect(() => {
    if (!containerRef.current || !graph) return;

    let cleanup: (() => void) | undefined;

    const initializeG6 = async () => {
      try {
        const { Graph, ExtensionCategory, register } = await import('@antv/g6');
        
        // Force layout is built-in for G6 v5, no need to register

        const rect = containerRef.current!.getBoundingClientRect();
        const width = Math.max(rect.width, 800);
        const height = Math.max(rect.height, 600);

        // Create graph instance
        const graphInstance = new Graph({
          container: containerRef.current!,
          width,
          height,
          transforms: ['transform-v4-data'],
          layout: {
            type: 'force',
            preventOverlap: true,
            nodeSize: 30,
            nodeSpacing: d => 100,
            linkDistance: d => 150,
            nodeStrength: d => -300,
            edgeStrength: d => 0.2,
            center: [width / 2, height / 2],
            gravity: 0.1,
            alpha: 0.9,
            alphaDecay: 0.028,
            velocityDecay: 0.6
          },
          autoFit: 'view',
          padding: [50, 50, 50, 50]
        });

        console.log('G6 force layout initialized with neutron-repellent physics');

        // Store instance
        g6InstanceRef.current = graphInstance;
        setIsReady(true);

        cleanup = () => {
          if (g6InstanceRef.current) {
            g6InstanceRef.current.destroy();
            g6InstanceRef.current = null;
          }
        };

      } catch (error) {
        console.error('G6 initialization failed:', error);
        setIsReady(false);
      }
    };

    initializeG6();

    return cleanup;
  }, []);

  // Update data when props change
  useEffect(() => {
    if (!g6InstanceRef.current || !graph || !isReady) return;

    try {
      const visibleNodeIds = Array.from(visibleNodes);
      
      // Convert to G6 v4 compatible format
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
            label: edge.label || '',
            type: 'line',
            style: {
              stroke: '#64748b',
              lineWidth: 2,
              opacity: 0.8,
              endArrow: {
                path: 'M 0,0 L 8,4 L 8,-4 Z',
                fill: '#64748b'
              }
            },
            labelCfg: {
              style: {
                fontSize: 11,
                fill: '#4b5563',
                background: {
                  fill: 'rgba(255,255,255,0.9)',
                  padding: [2, 4],
                  radius: 2,
                },
              },
            },
          }))
      };

      // Update graph data
      g6InstanceRef.current.data(g6Data);
      g6InstanceRef.current.render();

    } catch (error) {
      console.error('Error updating G6 data:', error);
    }
  }, [graph, visibleNodes, selectedNode, isReady]);

  // Event handlers
  useEffect(() => {
    if (!g6InstanceRef.current || !isReady) return;

    const handleNodeClick = (evt: any) => {
      const model = evt.item?.getModel();
      if (model?.originalData) {
        onNodeSelect(model.originalData);
      }
    };

    const handleNodeDblClick = (evt: any) => {
      const model = evt.item?.getModel();
      if (model?.id) {
        onNodeExpand(model.id);
      }
    };

    const handleNodeContextMenu = (evt: any) => {
      if (editMode) {
        evt.preventDefault();
        const model = evt.item?.getModel();
        if (model?.originalData) {
          onNodeEdit?.(model.originalData);
        }
      }
    };

    g6InstanceRef.current.on('node:click', handleNodeClick);
    g6InstanceRef.current.on('node:dblclick', handleNodeDblClick);
    g6InstanceRef.current.on('node:contextmenu', handleNodeContextMenu);

    return () => {
      if (g6InstanceRef.current) {
        g6InstanceRef.current.off('node:click', handleNodeClick);
        g6InstanceRef.current.off('node:dblclick', handleNodeDblClick);
        g6InstanceRef.current.off('node:contextmenu', handleNodeContextMenu);
      }
    };
  }, [isReady, editMode, onNodeSelect, onNodeExpand, onNodeEdit]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (g6InstanceRef.current && containerRef.current && isReady) {
        try {
          const rect = containerRef.current.getBoundingClientRect();
          const width = Math.max(rect.width, 800);
          const height = Math.max(rect.height, 600);
          
          g6InstanceRef.current.changeSize(width, height);
          g6InstanceRef.current.fitView();
        } catch (error) {
          console.error('Error resizing G6:', error);
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isReady]);

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
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-900 rounded-lg">
          <p className="text-gray-500">G6 force layout aan het laden...</p>
        </div>
      )}
    </div>
  );
}