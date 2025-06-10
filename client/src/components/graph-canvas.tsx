import { useEffect, useRef, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileSpreadsheet, Upload, Plus } from "lucide-react";
import { createGraphLayout, renderGraph, type GraphTransform } from "@/lib/graph-utils";
import type { GraphData, VisualizationNode, VisualizationEdge } from "@shared/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { nanoid } from "nanoid";

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
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; visible: boolean }>({
    x: 0,
    y: 0,
    visible: false,
  });
  const [showCreateNodeDialog, setShowCreateNodeDialog] = useState(false);
  const [nodePosition, setNodePosition] = useState({ x: 0, y: 0 });
  
  // New node form state
  const [newNodeLabel, setNewNodeLabel] = useState("");
  const [newNodeType, setNewNodeType] = useState("default");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Create node mutation
  const createNodeMutation = useMutation({
    mutationFn: async (nodeData: {
      graphId: string;
      nodeId: string;
      label: string;
      type: string;
      x: number;
      y: number;
      data: Record<string, any>;
    }) => {
      const graphId = graph?.graphId || graph?.id;
      return await apiRequest(`/api/graphs/${graphId}/nodes`, "POST", {
        nodeId: nodeData.nodeId,
        label: nodeData.label,
        type: nodeData.type,
        graphId: graphId,
        x: nodeData.x,
        y: nodeData.y,
        data: nodeData.data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/graphs"] });
      toast({
        title: "Knoop aangemaakt",
        description: "Nieuwe knoop is succesvol toegevoegd aan de graaf",
      });
    },
    onError: (error: Error) => {
      console.error("Error creating node:", error);
      toast({
        title: "Fout",
        description: "Kon knoop niet aanmaken",
        variant: "destructive",
      });
    },
  });

  // Context menu handlers
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    console.log('Context menu triggered', { graphId: graph?.graphId || graph?.id, clientX: e.clientX, clientY: e.clientY });
    
    if (!graph?.graphId && !graph?.id) {
      console.log('No graph ID available', { graph });
      return;
    }
    
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) {
      console.log('No SVG rect available');
      return;
    }

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Convert screen coordinates to SVG coordinates
    const svgX = (x - transform.translateX) / transform.scale;
    const svgY = (y - transform.translateY) / transform.scale;
    
    console.log('Setting node position and context menu', { svgX, svgY, clientX: e.clientX, clientY: e.clientY });
    
    setNodePosition({ x: svgX, y: svgY });
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      visible: true,
    });
  }, [graph?.id, transform]);

  const handleCreateNode = () => {
    setContextMenu({ ...contextMenu, visible: false });
    setShowCreateNodeDialog(true);
  };

  const handleCreateNodeSubmit = async () => {
    if (!newNodeLabel.trim() || !graph?.id) {
      toast({
        title: "Fout",
        description: "Knoop naam is verplicht",
        variant: "destructive",
      });
      return;
    }

    try {
      await createNodeMutation.mutateAsync({
        graphId: graph.id,
        nodeId: nanoid(),
        label: newNodeLabel,
        type: newNodeType,
        x: nodePosition.x,
        y: nodePosition.y,
        data: {},
      });

      setShowCreateNodeDialog(false);
      setNewNodeLabel("");
      setNewNodeType("default");
    } catch (error) {
      console.error("Error creating node:", error);
    }
  };

  // Close context menu when clicking elsewhere
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu({ ...contextMenu, visible: false });
    };

    if (contextMenu.visible) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu.visible]);

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

    const visibleNodesArray = graph.nodes?.filter(node => visibleNodes.has(node.id)) || [];
    const visibleEdges = graph.edges?.filter(
      edge => visibleNodes.has(edge.source) && visibleNodes.has(edge.target)
    ) || [];

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
        onContextMenu={handleContextMenu}
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

      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          className="fixed bg-white border border-gray-200 rounded-lg shadow-xl py-1 z-[9999] min-w-[160px]"
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
            pointerEvents: 'auto',
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleCreateNode}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nieuwe knoop maken
          </button>
        </div>
      )}
      
      {/* Debug Context Menu State */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed top-0 right-0 bg-red-100 p-2 text-xs z-[10000]">
          Context Menu: {contextMenu.visible ? 'VISIBLE' : 'HIDDEN'} 
          {contextMenu.visible && ` at (${contextMenu.x}, ${contextMenu.y})`}
        </div>
      )}

      {/* Create Node Dialog */}
      <Dialog open={showCreateNodeDialog} onOpenChange={setShowCreateNodeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nieuwe Knoop Maken</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="nodeLabel">Knoop Naam</Label>
              <Input
                id="nodeLabel"
                value={newNodeLabel}
                onChange={(e) => setNewNodeLabel(e.target.value)}
                placeholder="Voer knoop naam in..."
              />
            </div>
            <div>
              <Label htmlFor="nodeType">Knoop Type</Label>
              <Select value={newNodeType} onValueChange={setNewNodeType}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Standaard</SelectItem>
                  <SelectItem value="person">Persoon</SelectItem>
                  <SelectItem value="organization">Organisatie</SelectItem>
                  <SelectItem value="event">Gebeurtenis</SelectItem>
                  <SelectItem value="location">Locatie</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => setShowCreateNodeDialog(false)}
              >
                Annuleren
              </Button>
              <Button 
                onClick={handleCreateNodeSubmit}
                disabled={createNodeMutation.isPending}
              >
                {createNodeMutation.isPending ? "Maken..." : "Knoop Maken"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
