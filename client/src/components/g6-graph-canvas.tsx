import { useEffect, useRef, useCallback } from 'react';
import * as G6 from '@antv/g6';
import type { VisualizationNode, VisualizationEdge, GraphData } from '@shared/schema';
import { getNodeTypeColor } from '@/lib/color-utils';

interface G6GraphCanvasProps {
  graph?: GraphData;
  selectedNode?: VisualizationNode;
  onNodeSelect: (node: VisualizationNode) => void;
  onNodeExpand: (nodeId: string) => void;
  onNodeEdit?: (node: VisualizationNode) => void;
  visibleNodes: Set<string>;
  onVisibleNodesChange: (nodes: Set<string>) => void;
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
  editMode = false,
  panelConstraints
}: G6GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const g6GraphRef = useRef<any>(null);

  // Convert our graph data to G6 format
  const convertToG6Data = useCallback((graphData: GraphData) => {
    const visibleNodeIds = Array.from(visibleNodes);
    
    const nodes = graphData.nodes
      .filter(node => visibleNodeIds.includes(node.id))
      .map(node => {
        const colorData = getNodeTypeColor(node.type);
        return {
          id: node.id,
          label: node.label,
          type: 'circle',
          size: selectedNode?.id === node.id ? 36 : 30,
          style: {
            fill: colorData.secondary,
            stroke: colorData.primary,
            lineWidth: selectedNode?.id === node.id ? 4 : 2,
            opacity: 0.9,
          },
          labelCfg: {
            style: {
              fontSize: 12,
              fontWeight: 500,
              fill: '#374151',
            },
            position: 'bottom',
            offset: 8,
          },
          // Store original node data for event handlers
          originalData: node,
        };
      });

    const edges = graphData.edges
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
          endArrow: {
            path: 'M 0,0 L 8,4 L 8,-4 Z',
            fill: 'hsl(215, 30%, 55%)',
          },
        },
        labelCfg: {
          style: {
            fontSize: 11,
            fill: '#4B5563',
            background: {
              fill: 'rgba(255, 255, 255, 0.95)',
              stroke: 'hsl(215, 20%, 75%)',
              lineWidth: 1,
              padding: [2, 6],
              radius: 4,
            },
          },
          autoRotate: false,
        },
      }));

    return { nodes, edges };
  }, [visibleNodes, selectedNode]);

  // Initialize G6 graph
  useEffect(() => {
    if (!containerRef.current || !graph) return;

    // Calculate container dimensions accounting for panels
    const containerRect = containerRef.current.getBoundingClientRect();
    let width = containerRect.width;
    let height = containerRect.height;

    // Adjust for panel constraints
    if (panelConstraints?.leftPanel && !panelConstraints.leftPanel.collapsed) {
      width -= panelConstraints.leftPanel.width;
    }
    if (panelConstraints?.rightPanel && !panelConstraints.rightPanel.collapsed) {
      width -= panelConstraints.rightPanel.width;
    }

    const g6Graph = new G6.Graph({
      container: containerRef.current,
      width: Math.max(width, 400),
      height: Math.max(height, 300),
      
      // Use force layout for neutron-repellent behavior
      layout: {
        type: 'force',
        preventOverlap: true,
        nodeSpacing: 100,
        nodeStrength: -200,
        edgeStrength: 0.1,
        collideStrength: 0.8,
        alpha: 0.3,
        alphaDecay: 0.028,
        center: [width / 2, height / 2],
        // Additional force layout options for better spreading
        linkDistance: 150,
        nodeSize: 30,
        onLayoutEnd: () => {
          console.log('G6 force layout completed');
        },
      },

      // Interaction modes
      modes: {
        default: [
          'drag-canvas',
          'zoom-canvas',
          'click-select',
          {
            type: 'drag-node',
            enableDelegate: false,
          },
        ],
      },

      // Default node and edge styles
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
          lineWidth: 3,
        },
      },

      // Animation and interaction settings
      animate: true,
      animateCfg: {
        duration: 500,
        easing: 'easeLinear',
      },

      // Fit view settings
      fitView: true,
      fitViewPadding: [50, 50, 50, 50],
    });

    // Event handlers
    g6Graph.on('node:click', (evt) => {
      const { item } = evt;
      const model = item?.getModel();
      if (model?.originalData) {
        onNodeSelect(model.originalData as VisualizationNode);
      }
    });

    g6Graph.on('node:dblclick', (evt) => {
      const { item } = evt;
      const model = item?.getModel();
      if (model?.id) {
        onNodeExpand(model.id as string);
      }
    });

    g6Graph.on('node:contextmenu', (evt) => {
      evt.preventDefault();
      const { item } = evt;
      const model = item?.getModel();
      if (model?.originalData && editMode) {
        onNodeEdit?.(model.originalData as VisualizationNode);
      }
    });

    // Hover effects
    g6Graph.on('node:mouseenter', (evt) => {
      const { item } = evt;
      g6Graph.setItemState(item!, 'hover', true);
    });

    g6Graph.on('node:mouseleave', (evt) => {
      const { item } = evt;
      g6Graph.setItemState(item!, 'hover', false);
    });

    // Store reference
    g6GraphRef.current = g6Graph;

    // Cleanup function
    return () => {
      if (g6GraphRef.current && !g6GraphRef.current.destroyed) {
        g6GraphRef.current.destroy();
      }
      g6GraphRef.current = null;
    };
  }, []);

  // Update graph data when props change
  useEffect(() => {
    if (!g6GraphRef.current || !graph) return;

    const g6Data = convertToG6Data(graph);
    g6GraphRef.current.data(g6Data);
    g6GraphRef.current.render();

    // Re-fit view after data update
    setTimeout(() => {
      if (g6GraphRef.current && !g6GraphRef.current.destroyed) {
        g6GraphRef.current.fitView(50);
      }
    }, 100);
  }, [graph, convertToG6Data]);

  // Update selection when selectedNode changes
  useEffect(() => {
    if (!g6GraphRef.current) return;

    // Clear previous selections
    const nodes = g6GraphRef.current.getNodes();
    nodes.forEach(node => {
      g6GraphRef.current!.clearItemStates(node, ['selected']);
    });

    // Set new selection
    if (selectedNode) {
      const selectedG6Node = g6GraphRef.current.findById(selectedNode.id);
      if (selectedG6Node) {
        g6GraphRef.current.setItemState(selectedG6Node, 'selected', true);
      }
    }
  }, [selectedNode]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (g6GraphRef.current && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        let width = containerRect.width;
        let height = containerRect.height;

        // Adjust for panel constraints
        if (panelConstraints?.leftPanel && !panelConstraints.leftPanel.collapsed) {
          width -= panelConstraints.leftPanel.width;
        }
        if (panelConstraints?.rightPanel && !panelConstraints.rightPanel.collapsed) {
          width -= panelConstraints.rightPanel.width;
        }

        g6GraphRef.current.changeSize(Math.max(width, 400), Math.max(height, 300));
        g6GraphRef.current.fitView(50);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [panelConstraints]);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden"
      style={{ minHeight: '400px' }}
    />
  );
}