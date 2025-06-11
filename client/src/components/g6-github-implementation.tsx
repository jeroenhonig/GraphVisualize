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
  const graphRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || !graph) return;

    const initGraph = async () => {
      try {
        const { Graph } = await import('@antv/g6');

        const width = containerRef.current!.offsetWidth || 800;
        const height = containerRef.current!.offsetHeight || 600;

        // Prepare data in G6 format based on GitHub examples
        const visibleNodeIds = Array.from(visibleNodes);
        const data = {
          nodes: graph.nodes
            .filter(node => visibleNodeIds.includes(node.id))
            .map(node => {
              const colorData = getNodeTypeColor(node.type);
              return {
                id: node.id,
                label: node.label,
                type: node.type,
                x: node.x || Math.random() * width,
                y: node.y || Math.random() * height,
                style: {
                  fill: colorData.secondary,
                  stroke: colorData.primary,
                  lineWidth: selectedNode?.id === node.id ? 4 : 2,
                  r: selectedNode?.id === node.id ? 20 : 15
                },
                originalData: node
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
              style: {
                stroke: '#64748b',
                lineWidth: 2,
                endArrow: true
              }
            }))
        };

        // Create graph with G6 v5 configuration from GitHub examples
        const g6Graph = new Graph({
          container: containerRef.current!,
          width,
          height,
          
          // Data
          data,
          
          // Layout - force directed with neutron-repellent physics
          layout: {
            type: 'force',
            linkDistance: 150,
            nodeStrength: -300,  // Strong repulsion for neutron-repellent effect
            edgeStrength: 0.2,
            preventOverlap: true,
            nodeSize: 30,
            center: [width / 2, height / 2],
            gravity: 0.1,
            alpha: 0.9,
            alphaDecay: 0.028,
            velocityDecay: 0.6
          },

          // Behaviors for interaction
          behaviors: [
            'drag-canvas',
            'zoom-canvas',
            'drag-element',
            'click-select'
          ],

          // Auto fit view
          autoFit: 'view',
          padding: [20, 20, 20, 20]
        });

        // Event listeners following GitHub patterns
        g6Graph.on('node:click', (evt: any) => {
          const nodeId = evt.itemId;
          const nodeData = graph.nodes.find(n => n.id === nodeId);
          if (nodeData) {
            onNodeSelect(nodeData);
          }
        });

        g6Graph.on('node:dblclick', (evt: any) => {
          const nodeId = evt.itemId;
          if (nodeId) {
            onNodeExpand(nodeId);
          }
        });

        g6Graph.on('node:contextmenu', (evt: any) => {
          if (editMode) {
            evt.preventDefault();
            const nodeId = evt.itemId;
            const nodeData = graph.nodes.find(n => n.id === nodeId);
            if (nodeData) {
              onNodeEdit?.(nodeData);
            }
          }
        });

        // Store reference
        graphRef.current = g6Graph;
        
        console.log('G6 v5 GitHub implementation active - neutron-repellent force layout initialized');

      } catch (error) {
        console.error('G6 GitHub implementation failed:', error);
      }
    };

    initGraph();

    return () => {
      if (graphRef.current) {
        graphRef.current.destroy();
        graphRef.current = null;
      }
    };
  }, []);

  // Update data when props change
  useEffect(() => {
    if (!graphRef.current || !graph) return;

    try {
      const visibleNodeIds = Array.from(visibleNodes);
      const data = {
        nodes: graph.nodes
          .filter(node => visibleNodeIds.includes(node.id))
          .map(node => {
            const colorData = getNodeTypeColor(node.type);
            return {
              id: node.id,
              label: node.label,
              type: node.type,
              x: node.x,
              y: node.y,
              style: {
                fill: colorData.secondary,
                stroke: colorData.primary,
                lineWidth: selectedNode?.id === node.id ? 4 : 2,
                r: selectedNode?.id === node.id ? 20 : 15
              },
              originalData: node
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
            style: {
              stroke: '#64748b',
              lineWidth: 2,
              endArrow: true
            }
          }))
      };

      // Update data using proper G6 v5 method
      graphRef.current.updateData(data);
      
    } catch (error) {
      console.error('G6 data update failed:', error);
    }
  }, [graph, visibleNodes, selectedNode]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (graphRef.current && containerRef.current) {
        const width = containerRef.current.offsetWidth || 800;
        const height = containerRef.current.offsetHeight || 600;
        graphRef.current.setSize(width, height);
        graphRef.current.fitView();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="w-full h-full bg-gray-50 dark:bg-gray-900 rounded-lg relative">
      {!graph ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-gray-500 dark:text-gray-400">Geen graph data beschikbaar</p>
        </div>
      ) : (
        <div 
          ref={containerRef}
          className="w-full h-full"
          style={{ minHeight: '600px', minWidth: '400px' }}
        />
      )}
    </div>
  );
}