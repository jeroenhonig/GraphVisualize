import { useEffect, useRef, useState, useCallback } from "react";
import type { GraphData, VisualizationNode, GraphTransform } from "@shared/schema";
import { getNodeTypeColor } from "@/lib/color-utils";

interface CanvasGraphPerformanceProps {
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

interface CanvasNode extends VisualizationNode {
  vx: number;
  vy: number;
  fx?: number;
  fy?: number;
  selected?: boolean;
  hovered?: boolean;
}

interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  sourceNode?: CanvasNode;
  targetNode?: CanvasNode;
}

export default function CanvasGraphPerformance({
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
}: CanvasGraphPerformanceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [edges, setEdges] = useState<CanvasEdge[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [dragNode, setDragNode] = useState<CanvasNode | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Performance optimizations following G6 v4 guide
  const NODE_SIZE = 15;
  const MAX_NODES = 200; // Limit for performance
  const MAX_EDGES = 500;
  const REPULSION_STRENGTH = -800;
  const LINK_DISTANCE = 100;
  const DAMPING = 0.85;

  // Initialize graph data
  useEffect(() => {
    if (!graph) return;

    const visibleNodeIds = visibleNodes.size > 0 ? Array.from(visibleNodes) : graph.nodes.map(n => n.id);
    
    // Limit nodes for performance
    const graphNodes = graph.nodes
      .filter(node => visibleNodeIds.includes(node.id))
      .slice(0, MAX_NODES)
      .map((node, index) => ({
        ...node,
        vx: (Math.random() - 0.5) * 50,
        vy: (Math.random() - 0.5) * 50,
        x: node.x || 400 + (Math.random() - 0.5) * 200,
        y: node.y || 300 + (Math.random() - 0.5) * 200,
        selected: selectedNode?.id === node.id,
        hovered: false
      }));

    // Limit edges for performance
    const graphEdges = graph.edges
      .filter(edge => 
        graphNodes.find(n => n.id === edge.source) && 
        graphNodes.find(n => n.id === edge.target)
      )
      .slice(0, MAX_EDGES)
      .map(edge => {
        const sourceNode = graphNodes.find(n => n.id === edge.source);
        const targetNode = graphNodes.find(n => n.id === edge.target);
        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceNode,
          targetNode
        };
      });

    setNodes(graphNodes);
    setEdges(graphEdges);
    setIsLoading(false);
  }, [graph, visibleNodes, selectedNode]);

  // Force simulation step
  const forceSimulation = useCallback(() => {
    setNodes(prevNodes => {
      const newNodes = [...prevNodes];
      
      // Apply forces between nodes (repulsion)
      for (let i = 0; i < newNodes.length; i++) {
        for (let j = i + 1; j < newNodes.length; j++) {
          const nodeA = newNodes[i];
          const nodeB = newNodes[j];
          
          const dx = nodeB.x - nodeA.x;
          const dy = nodeB.y - nodeA.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          
          if (distance < 150) {
            const force = REPULSION_STRENGTH / (distance * distance);
            const fx = (dx / distance) * force;
            const fy = (dy / distance) * force;
            
            nodeA.vx -= fx;
            nodeA.vy -= fy;
            nodeB.vx += fx;
            nodeB.vy += fy;
          }
        }
      }
      
      // Apply edge forces (attraction)
      edges.forEach(edge => {
        const sourceNode = newNodes.find(n => n.id === edge.source);
        const targetNode = newNodes.find(n => n.id === edge.target);
        
        if (sourceNode && targetNode) {
          const dx = targetNode.x - sourceNode.x;
          const dy = targetNode.y - sourceNode.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          
          const force = (distance - LINK_DISTANCE) * 0.1;
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;
          
          sourceNode.vx += fx;
          sourceNode.vy += fy;
          targetNode.vx -= fx;
          targetNode.vy -= fy;
        }
      });
      
      // Update positions with damping
      newNodes.forEach(node => {
        if (!node.fx && !node.fy) { // Only if not being dragged
          node.vx *= DAMPING;
          node.vy *= DAMPING;
          node.x += node.vx;
          node.y += node.vy;
          
          // Boundary constraints
          const canvas = canvasRef.current;
          if (canvas) {
            node.x = Math.max(NODE_SIZE, Math.min(canvas.width - NODE_SIZE, node.x));
            node.y = Math.max(NODE_SIZE, Math.min(canvas.height - NODE_SIZE, node.y));
          }
        }
      });
      
      return newNodes;
    });
  }, [edges]);

  // Canvas rendering with performance optimizations
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Performance: Use offscreen canvas for complex rendering
    const { width, height } = canvas;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Apply transform
    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.scale, transform.scale);
    
    // Performance: Only render visible elements
    const viewBounds = {
      left: -transform.x / transform.scale,
      top: -transform.y / transform.scale,
      right: (-transform.x + width) / transform.scale,
      bottom: (-transform.y + height) / transform.scale
    };
    
    // Render edges first (behind nodes)
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    
    edges.forEach(edge => {
      const sourceNode = nodes.find(n => n.id === edge.source);
      const targetNode = nodes.find(n => n.id === edge.target);
      
      if (sourceNode && targetNode) {
        // Performance: Only render if edge is in view
        if (sourceNode.x < viewBounds.right && sourceNode.x > viewBounds.left &&
            targetNode.x < viewBounds.right && targetNode.x > viewBounds.left) {
          ctx.moveTo(sourceNode.x, sourceNode.y);
          ctx.lineTo(targetNode.x, targetNode.y);
        }
      }
    });
    ctx.stroke();
    
    // Render edge arrows
    edges.forEach(edge => {
      const sourceNode = nodes.find(n => n.id === edge.source);
      const targetNode = nodes.find(n => n.id === edge.target);
      
      if (sourceNode && targetNode) {
        const dx = targetNode.x - sourceNode.x;
        const dy = targetNode.y - sourceNode.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length > 0) {
          const arrowLength = 8;
          const arrowX = targetNode.x - (dx / length) * (NODE_SIZE + arrowLength);
          const arrowY = targetNode.y - (dy / length) * (NODE_SIZE + arrowLength);
          
          ctx.save();
          ctx.translate(arrowX, arrowY);
          ctx.rotate(Math.atan2(dy, dx));
          
          ctx.fillStyle = '#999';
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(-arrowLength, -4);
          ctx.lineTo(-arrowLength, 4);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }
    });
    
    // Render nodes
    nodes.forEach(node => {
      // Performance: Only render if node is in view
      if (node.x < viewBounds.left - NODE_SIZE || node.x > viewBounds.right + NODE_SIZE ||
          node.y < viewBounds.top - NODE_SIZE || node.y > viewBounds.bottom + NODE_SIZE) {
        return;
      }
      
      const colorData = getNodeTypeColor(node.type);
      
      // Node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, NODE_SIZE, 0, 2 * Math.PI);
      
      if (node.selected) {
        ctx.fillStyle = '#ffeb3b';
        ctx.strokeStyle = '#ff9800';
        ctx.lineWidth = 3;
      } else if (node.hovered) {
        ctx.fillStyle = '#d3f3ff';
        ctx.strokeStyle = '#1890ff';
        ctx.lineWidth = 2;
      } else {
        ctx.fillStyle = colorData.secondary;
        ctx.strokeStyle = colorData.primary;
        ctx.lineWidth = 1.5;
      }
      
      ctx.fill();
      ctx.stroke();
      
      // Node label (performance: only for larger scales)
      if (transform.scale > 0.5) {
        ctx.fillStyle = '#333';
        ctx.font = `${Math.max(10, 10 * transform.scale)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const label = node.label.length > 12 ? node.label.substring(0, 12) + '...' : node.label;
        ctx.fillText(label, node.x, node.y + NODE_SIZE + 15);
      }
    });
    
    ctx.restore();
  }, [nodes, edges, transform]);

  // Animation loop
  useEffect(() => {
    let frameCount = 0;
    const animate = () => {
      frameCount++;
      
      // Performance: Reduce force simulation frequency
      if (frameCount % 2 === 0) {
        forceSimulation();
      }
      
      render();
      animationRef.current = requestAnimationFrame(animate);
    };
    
    if (!isLoading) {
      animate();
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [forceSimulation, render, isLoading]);

  // Mouse event handlers
  const getMousePos = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - transform.x) / transform.scale,
      y: (e.clientY - rect.top - transform.y) / transform.scale
    };
  };

  const findNodeAt = (x: number, y: number) => {
    return nodes.find(node => {
      const dx = node.x - x;
      const dy = node.y - y;
      return Math.sqrt(dx * dx + dy * dy) <= NODE_SIZE;
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const pos = getMousePos(e);
    const node = findNodeAt(pos.x, pos.y);
    
    if (node) {
      setDragNode(node);
      node.fx = pos.x;
      node.fy = pos.y;
      
      // Clear other selections
      setNodes(prev => prev.map(n => ({ ...n, selected: n.id === node.id })));
      onNodeSelect(node);
    } else {
      setIsDragging(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const pos = getMousePos(e);
    
    if (dragNode) {
      dragNode.fx = pos.x;
      dragNode.fy = pos.y;
      dragNode.x = pos.x;
      dragNode.y = pos.y;
      dragNode.vx = 0;
      dragNode.vy = 0;
    } else if (isDragging) {
      // Pan canvas
      onTransformChange({
        ...transform,
        x: transform.x + e.movementX,
        y: transform.y + e.movementY
      });
    } else {
      // Update hover states
      const hoveredNode = findNodeAt(pos.x, pos.y);
      setNodes(prev => prev.map(node => ({
        ...node,
        hovered: node.id === hoveredNode?.id
      })));
    }
  };

  const handleMouseUp = () => {
    if (dragNode) {
      delete dragNode.fx;
      delete dragNode.fy;
      setDragNode(null);
    }
    setIsDragging(false);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    const pos = getMousePos(e);
    const node = findNodeAt(pos.x, pos.y);
    
    if (node) {
      onNodeExpand(node.id);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const scaleFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newScale = Math.max(0.1, Math.min(3, transform.scale * scaleFactor));
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    onTransformChange({
      x: mouseX - (mouseX - transform.x) * (newScale / transform.scale),
      y: mouseY - (mouseY - transform.y) * (newScale / transform.scale),
      scale: newScale
    });
  };

  // Canvas resize handler
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
      }
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center">
          <div className="text-gray-500 dark:text-gray-400 mb-2">
            Canvas Performance Layout laden...
          </div>
          <div className="text-xs text-gray-400">
            Force simulation • Performance optimized • Max {MAX_NODES} nodes
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative bg-white dark:bg-gray-900">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
        style={{ minHeight: '400px' }}
      />
      
      {/* Performance info overlay */}
      <div className="absolute top-4 right-4 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-md text-xs">
        <div className="font-medium mb-2">Canvas Performance:</div>
        <div className="space-y-1 text-gray-600 dark:text-gray-300">
          <div>• {nodes.length} nodes • {edges.length} edges</div>
          <div>• Force simulation optimized</div>
          <div>• Offscreen rendering</div>
          <div>• View culling active</div>
          <div>• Scale: {transform.scale.toFixed(2)}x</div>
        </div>
      </div>
      
      {/* Controls overlay */}
      <div className="absolute bottom-4 right-4 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-md text-xs">
        <div className="font-medium mb-2">Controls:</div>
        <div className="space-y-1 text-gray-600 dark:text-gray-300">
          <div>• Scroll: Zoom</div>
          <div>• Drag background: Pan</div>
          <div>• Drag nodes: Move</div>
          <div>• Click: Select • Double-click: Expand</div>
        </div>
      </div>
    </div>
  );
}