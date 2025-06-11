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

  const [viewTransform, setViewTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

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

  // Enhanced force simulation with stronger repulsion
  useEffect(() => {
    if (nodes.length === 0) return;

    const simulation = () => {
      // Strong repulsion between all nodes
      for (let i = 0; i < nodesWithPositions.length; i++) {
        for (let j = i + 1; j < nodesWithPositions.length; j++) {
          const nodeA = nodesWithPositions[i];
          const nodeB = nodesWithPositions[j];
          
          const dx = nodeB.x - nodeA.x;
          const dy = nodeB.y - nodeA.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < 150 && distance > 0) {
            // Much stronger repulsion force
            const force = 1500 / (distance * distance + 10);
            const fx = (dx / distance) * force;
            const fy = (dy / distance) * force;
            
            nodeA.vx -= fx;
            nodeA.vy -= fy;
            nodeB.vx += fx;
            nodeB.vy += fy;
          }
        }
      }

      // Moderate attraction for connected nodes
      edges.forEach(edge => {
        const sourceNode = nodesWithPositions.find(n => n.id === edge.source);
        const targetNode = nodesWithPositions.find(n => n.id === edge.target);
        
        if (sourceNode && targetNode) {
          const dx = targetNode.x - sourceNode.x;
          const dy = targetNode.y - sourceNode.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // Ideal edge length
          const idealDistance = 120;
          if (distance > idealDistance) {
            const force = 0.05 * (distance - idealDistance);
            const fx = (dx / distance) * force;
            const fy = (dy / distance) * force;
            
            sourceNode.vx += fx;
            sourceNode.vy += fy;
            targetNode.vx -= fx;
            targetNode.vy -= fy;
          }
        }
      });

      // Center gravity (weak)
      const centerX = 400;
      const centerY = 300;
      nodesWithPositions.forEach(node => {
        const dx = centerX - node.x;
        const dy = centerY - node.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
          const force = 0.002;
          node.vx += (dx / distance) * force;
          node.vy += (dy / distance) * force;
        }
      });

      // Apply velocity with stronger damping
      nodesWithPositions.forEach(node => {
        node.x += node.vx;
        node.y += node.vy;
        node.vx *= 0.85; // Better damping
        node.vy *= 0.85;
        
        // Larger bounds
        node.x = Math.max(50, Math.min(750, node.x));
        node.y = Math.max(50, Math.min(550, node.y));
      });
    };

    const interval = setInterval(simulation, 30); // Faster updates
    return () => clearInterval(interval);
  }, [nodes.length, edges.length]);

  // Node dragging handlers
  const handleMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    setDragState({
      isDragging: true,
      startPos: { x: e.clientX - rect.left, y: e.clientY - rect.top },
      nodeId
    });
  };

  // Canvas panning handlers
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (dragState.isDragging) return;
    
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    setIsPanning(true);
    setPanStart({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    if (dragState.isDragging && dragState.nodeId) {
      // Node dragging
      const node = nodesWithPositions.find(n => n.id === dragState.nodeId);
      if (node) {
        const dx = (currentX - dragState.startPos.x) / viewTransform.scale;
        const dy = (currentY - dragState.startPos.y) / viewTransform.scale;
        node.x += dx;
        node.y += dy;
        setDragState(prev => ({
          ...prev,
          startPos: { x: currentX, y: currentY }
        }));
      }
    } else if (isPanning) {
      // Canvas panning
      const dx = currentX - panStart.x;
      const dy = currentY - panStart.y;
      setViewTransform(prev => ({
        ...prev,
        x: prev.x + dx,
        y: prev.y + dy
      }));
      setPanStart({ x: currentX, y: currentY });
    }
  };

  const handleMouseUp = () => {
    setDragState({ isDragging: false, startPos: { x: 0, y: 0 } });
    setIsPanning(false);
  };

  // Zoom handling
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.1, Math.min(3, viewTransform.scale * scaleFactor));
    
    // Zoom to mouse position
    const scaleChange = newScale / viewTransform.scale;
    const newX = mouseX - (mouseX - viewTransform.x) * scaleChange;
    const newY = mouseY - (mouseY - viewTransform.y) * scaleChange;
    
    setViewTransform({
      x: newX,
      y: newY,
      scale: newScale
    });
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
        className="w-full h-full cursor-grab"
        style={{ cursor: isPanning ? 'grabbing' : dragState.isDragging ? 'grabbing' : 'grab' }}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {/* Background grid */}
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#f0f0f0" strokeWidth="1"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />

        {/* Main graph group with transform */}
        <g transform={`translate(${viewTransform.x}, ${viewTransform.y}) scale(${viewTransform.scale})`}>
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
        </g>

        {/* Legend - outside transform group */}
        <g transform="translate(20, 20)">
          <rect x="0" y="0" width="160" height="80" fill="white" stroke="#ddd" strokeWidth="1" rx="5"/>
          <text x="10" y="20" fontSize="12" fill="#333" fontWeight="bold">Graph Overview</text>
          <text x="10" y="40" fontSize="10" fill="#666">{nodes.length} nodes • {edges.length} edges</text>
          <text x="10" y="55" fontSize="10" fill="#666">RDF Infrastructure Model</text>
          <text x="10" y="70" fontSize="9" fill="#999">Click nodes for details • Double-click to expand</text>
        </g>

        {/* Zoom controls */}
        <g transform="translate(750, 20)">
          <rect x="0" y="0" width="30" height="60" fill="white" stroke="#ddd" strokeWidth="1" rx="3"/>
          <text 
            x="15" y="20" 
            textAnchor="middle" 
            fontSize="16" 
            fill="#333" 
            className="cursor-pointer select-none hover:fill-blue-600"
            onClick={() => setViewTransform(prev => ({ ...prev, scale: Math.min(3, prev.scale * 1.2) }))}
          >+</text>
          <text 
            x="15" y="50" 
            textAnchor="middle" 
            fontSize="16" 
            fill="#333" 
            className="cursor-pointer select-none hover:fill-blue-600"
            onClick={() => setViewTransform(prev => ({ ...prev, scale: Math.max(0.1, prev.scale * 0.8) }))}
          >-</text>
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