import { useEffect, useRef, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Upload } from "lucide-react";
import { createGraphLayout, renderGraph, type GraphTransform } from "@/lib/graph-utils";
import type { GraphData, VisualizationNode, VisualizationEdge } from "@shared/schema";

interface GraphCanvasProps {
  graph?: GraphData;
  selectedNode?: VisualizationNode;
  onNodeSelect: (node: VisualizationNode) => void;
  onNodeExpand: (nodeId: string) => void;
  visibleNodes: Set<string>;
  onVisibleNodesChange: (nodes: Set<string>) => void;
  transform: GraphTransform;
  onTransformChange: (transform: GraphTransform) => void;
}

export default function GraphCanvas({
  graph,
  selectedNode,
  onNodeSelect,
  onNodeExpand,
  visibleNodes,
  onVisibleNodesChange,
  transform,
  onTransformChange,
}: GraphCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isLoading, setIsLoading] = useState(false);

  // Initialize layout when graph changes
  useEffect(() => {
    if (graph?.nodes && graph?.edges) {
      setIsLoading(true);
      
      // Simulate layout calculation
      setTimeout(() => {
        const layoutNodes = createGraphLayout(graph.nodes, graph.edges);
        
        // Update visible nodes to show initial set
        if (visibleNodes.size === 0 && layoutNodes.length > 0) {
          const initialVisible = new Set(layoutNodes.slice(0, Math.min(20, layoutNodes.length)).map(n => n.id));
          onVisibleNodesChange(initialVisible);
        }
        
        setIsLoading(false);
      }, 500);
    }
  }, [graph?.id]);

  // Render graph
  useEffect(() => {
    if (!graph || !svgRef.current) return;

    const visibleNodesArray = graph.nodes.filter(node => visibleNodes.has(node.id));
    const visibleEdges = graph.edges.filter(
      edge => visibleNodes.has(edge.source) && visibleNodes.has(edge.target)
    );

    renderGraph(
      svgRef.current,
      visibleNodesArray,
      visibleEdges,
      {
        selectedNodeId: selectedNode?.id,
        onNodeClick: onNodeSelect,
        onNodeDoubleClick: onNodeExpand,
        transform,
      }
    );
  }, [graph, visibleNodes, selectedNode, transform, onNodeSelect, onNodeExpand]);

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) { // Left mouse button
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;

    onTransformChange({
      ...transform,
      translateX: transform.translateX + deltaX,
      translateY: transform.translateY + deltaY,
    });

    setDragStart({ x: e.clientX, y: e.clientY });
  }, [isDragging, dragStart, transform, onTransformChange]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Zoom handler
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(transform.scale * zoomFactor, 0.1), 3);

    onTransformChange({
      ...transform,
      scale: newScale,
    });
  }, [transform, onTransformChange]);

  if (!graph) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <FileSpreadsheet className="h-16 w-16 text-gray-300 mx-auto mb-6" />
            <h3 className="text-xl font-medium text-gray-900 mb-2">Geen Grafiek Geladen</h3>
            <p className="text-gray-600 mb-6">
              Upload een Excel bestand om te beginnen met het visualiseren van uw data als een interactieve grafiek.
            </p>
            <Button>
              <Upload className="h-4 w-4 mr-2" />
              Excel Bestand Uploaden
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="w-full h-full relative overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* Grid Background */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="hsl(210, 40%, 90%)" strokeWidth="1" opacity="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* Main Graph SVG */}
      <svg
        ref={svgRef}
        className="w-full h-full cursor-grab"
        style={{
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
        viewBox="0 0 1200 800"
      />

      {/* Loading State */}
      {isLoading && (
        <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center">
          <Card>
            <CardContent className="p-6 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Grafiek wordt geladen...</p>
              <p className="text-sm text-gray-500 mt-1">
                Verwerking van {graph.nodeCount} nodes...
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Graph Info Overlay */}
      {graph && !isLoading && (
        <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-3 text-sm">
          <div className="font-medium text-gray-900">{graph.name}</div>
          {graph.description && (
            <div className="text-gray-600 mt-1">{graph.description}</div>
          )}
          <div className="text-xs text-gray-500 mt-2">
            {visibleNodes.size} van {graph.nodeCount} nodes zichtbaar
          </div>
        </div>
      )}
    </div>
  );
}
