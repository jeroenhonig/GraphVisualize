import { useEffect, useRef, useState } from "react";
import type { GraphData, VisualizationNode, GraphTransform } from "@shared/schema";
import { getNodeTypeColor } from "@/lib/color-utils";

interface SVGGraphCanvasProps {
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

export default function SVGGraphCanvas({
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
}: SVGGraphCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    startPos: { x: number; y: number };
    nodeId?: string;
  }>({ isDragging: false, startPos: { x: 0, y: 0 } });

  // Prepare visible nodes with physics positions
  const visibleNodeIds = visibleNodes.size > 0 ? Array.from(visibleNodes) : graph?.nodes.map(n => n.id) || [];
  const nodes = graph?.nodes.filter(node => visibleNodeIds.includes(node.id)).slice(0, 50) || [];
  const edges = graph?.edges.filter(edge => 
    nodes.find(n => n.id === edge.source) && 
    nodes.find(n => n.id === edge.target)
  ).slice(0, 100) || [];

  // Calculate physics-based positions using force simulation
  const nodesWithPositions = nodes.map((node, index) => {
    const angle = (index / nodes.length) * 2 * Math.PI;
    const radius = Math.min(400, 300) * 0.4;
    const centerX = 400;
    const centerY = 300;
    
    return {
      ...node,
      x: centerX + Math.cos(angle) * radius + (Math.random() - 0.5) * 100,
      y: centerY + Math.sin(angle) * radius + (Math.random() - 0.5) * 100,
      vx: 0,
      vy: 0
    };
  });

  // Apply force simulation
  useEffect(() => {
    if (nodes.length === 0) return;

    const simulation = () => {
      // Repulsion between nodes
      for (let i = 0; i < nodesWithPositions.length; i++) {
        for (let j = i + 1; j < nodesWithPositions.length; j++) {
          const nodeA = nodesWithPositions[i];
          const nodeB = nodesWithPositions[j];
          
          const dx = nodeB.x - nodeA.x;
          const dy = nodeB.y - nodeA.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < 100 && distance > 0) {
            const force = 50 / (distance * distance);
            const fx = (dx / distance) * force;
            const fy = (dy / distance) * force;
            
            nodeA.vx -= fx;
            nodeA.vy -= fy;
            nodeB.vx += fx;
            nodeB.vy += fy;
          }
        }
      }

      // Attraction for connected nodes
      edges.forEach(edge => {
        const sourceNode = nodesWithPositions.find(n => n.id === edge.source);
        const targetNode = nodesWithPositions.find(n => n.id === edge.target);
        
        if (sourceNode && targetNode) {
          const dx = targetNode.x - sourceNode.x;
          const dy = targetNode.y - sourceNode.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance > 80) {
            const force = 0.1;
            const fx = (dx / distance) * force;
            const fy = (dy / distance) * force;
            
            sourceNode.vx += fx;
            sourceNode.vy += fy;
            targetNode.vx -= fx;
            targetNode.vy -= fy;
          }
        }
      });

      // Apply velocity with damping
      nodesWithPositions.forEach(node => {
        node.x += node.vx;
        node.y += node.vy;
        node.vx *= 0.8;
        node.vy *= 0.8;
        
        // Keep nodes in bounds
        node.x = Math.max(30, Math.min(770, node.x));
        node.y = Math.max(30, Math.min(570, node.y));
      });
    };

    const interval = setInterval(simulation, 50);
    return () => clearInterval(interval);
  }, [nodes.length, edges.length]);

  const handleMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    setDragState({
      isDragging: true,
      startPos: { x: e.clientX, y: e.clientY },
      nodeId
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragState.isDragging && dragState.nodeId) {
      const node = nodesWithPositions.find(n => n.id === dragState.nodeId);
      if (node) {
        const dx = e.clientX - dragState.startPos.x;
        const dy = e.clientY - dragState.startPos.y;
        node.x += dx * 0.5;
        node.y += dy * 0.5;
        setDragState(prev => ({
          ...prev,
          startPos: { x: e.clientX, y: e.clientY }
        }));
      }
    }
  };

  const handleMouseUp = () => {
    setDragState({ isDragging: false, startPos: { x: 0, y: 0 } });
  };

  const handleNodeClick = (node: VisualizationNode) => {
    onNodeSelect(node);
  };

  const handleNodeDoubleClick = (node: VisualizationNode) => {
    onNodeExpand(node.id);
  };

  return (
    <div className="w-full h-full bg-white dark:bg-gray-900 relative">
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox="0 0 800 600"
        className="w-full h-full"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Background grid */}
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#f0f0f0" strokeWidth="1"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />

        {/* Edges */}
        {edges.map(edge => {
          const sourceNode = nodesWithPositions.find(n => n.id === edge.source);
          const targetNode = nodesWithPositions.find(n => n.id === edge.target);
          
          if (!sourceNode || !targetNode) return null;
          
          return (
            <g key={edge.id}>
              <line
                x1={sourceNode.x}
                y1={sourceNode.y}
                x2={targetNode.x}
                y2={targetNode.y}
                stroke="#999"
                strokeWidth="1.5"
                strokeOpacity="0.6"
              />
              {/* Arrow */}
              <polygon
                points={`${targetNode.x-8},${targetNode.y-4} ${targetNode.x},${targetNode.y} ${targetNode.x-8},${targetNode.y+4}`}
                fill="#999"
                opacity="0.6"
              />
            </g>
          );
        })}

        {/* Nodes */}
        {nodesWithPositions.map(node => {
          const colorData = getNodeTypeColor(node.type);
          const isSelected = selectedNode?.id === node.id;
          const radius = 15;
          
          return (
            <g key={node.id}>
              {/* Node circle */}
              <circle
                cx={node.x}
                cy={node.y}
                r={radius}
                fill={colorData.secondary}
                stroke={isSelected ? "#ff6b35" : colorData.primary}
                strokeWidth={isSelected ? 3 : 2}
                className="cursor-pointer hover:stroke-width-3 transition-all"
                onMouseDown={(e) => handleMouseDown(e, node.id)}
                onClick={() => handleNodeClick(node)}
                onDoubleClick={() => handleNodeDoubleClick(node)}
              />
              
              {/* Node label */}
              <text
                x={node.x}
                y={node.y + radius + 15}
                textAnchor="middle"
                fontSize="10"
                fill="#333"
                className="pointer-events-none select-none"
              >
                {node.label.length > 12 ? node.label.substring(0, 12) + '...' : node.label}
              </text>
              
              {/* Type indicator */}
              <text
                x={node.x}
                y={node.y + radius + 28}
                textAnchor="middle"
                fontSize="8"
                fill="#666"
                className="pointer-events-none select-none"
              >
                {node.type}
              </text>
            </g>
          );
        })}

        {/* Legend */}
        <g transform="translate(20, 20)">
          <rect x="0" y="0" width="160" height="80" fill="white" stroke="#ddd" strokeWidth="1" rx="5"/>
          <text x="10" y="20" fontSize="12" fill="#333" fontWeight="bold">Graph Overview</text>
          <text x="10" y="40" fontSize="10" fill="#666">{nodes.length} nodes • {edges.length} edges</text>
          <text x="10" y="55" fontSize="10" fill="#666">RDF Infrastructure Model</text>
          <text x="10" y="70" fontSize="9" fill="#999">Click nodes for details • Double-click to expand</text>
        </g>
      </svg>
      
      {/* Loading indicator */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-gray-500">Loading graph data...</div>
        </div>
      )}
    </div>
  );
}