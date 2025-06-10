import { useEffect, useRef, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileSpreadsheet, Upload, Plus } from "lucide-react";
import { createGraphLayout, renderGraph, simulatePhysicsStep, type GraphTransform } from "@/lib/graph-utils";
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
  editMode?: boolean;
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
  editMode = false,
}: GraphCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isLoading, setIsLoading] = useState(false);
  
  // Node dragging state
  const [draggedNode, setDraggedNode] = useState<VisualizationNode | null>(null);
  const [nodeDragStart, setNodeDragStart] = useState({ x: 0, y: 0 });
  const [isNodeDragging, setIsNodeDragging] = useState(false);
  
  // Real-time node positions for immediate visual feedback
  const [localNodePositions, setLocalNodePositions] = useState<Record<string, { x: number; y: number }>>({});
  
  // Physics simulation state
  const [physicsEnabled, setPhysicsEnabled] = useState(true);
  const [animationId, setAnimationId] = useState<number | null>(null);
  const [physicsTimeout, setPhysicsTimeout] = useState<NodeJS.Timeout | null>(null);
  
  // Drag threshold to distinguish between click and drag
  const [mouseDownPosition, setMouseDownPosition] = useState<{ x: number; y: number } | null>(null);
  const [hasDraggedSignificantly, setHasDraggedSignificantly] = useState(false);
  const DRAG_THRESHOLD = 5; // pixels
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ 
    x: number; 
    y: number; 
    visible: boolean; 
    nodeId?: string;
    type: 'canvas' | 'node' | 'relation';
  }>({
    x: 0,
    y: 0,
    visible: false,
    type: 'canvas'
  });
  const [showCreateNodeDialog, setShowCreateNodeDialog] = useState(false);
  const [showCreateRelationDialog, setShowCreateRelationDialog] = useState(false);
  const [nodePosition, setNodePosition] = useState({ x: 0, y: 0 });
  const [relationSourceNode, setRelationSourceNode] = useState<string | null>(null);
  
  // New node form state
  const [newNodeLabel, setNewNodeLabel] = useState("");
  const [newNodeType, setNewNodeType] = useState("default");
  
  // New relation form state
  const [newRelationLabel, setNewRelationLabel] = useState("");
  const [newRelationType, setNewRelationType] = useState("relationship");
  
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
      const response = await apiRequest("POST", `/api/graphs/${graphId}/nodes`, {
        nodeId: nodeData.nodeId,
        label: nodeData.label,
        type: nodeData.type,
        graphId: graphId,
        x: nodeData.x,
        y: nodeData.y,
        data: nodeData.data,
      });
      return response.json();
    },
    onSuccess: (newNode) => {
      queryClient.invalidateQueries({ queryKey: ["/api/graphs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/graphs", graph?.graphId || graph?.id] });
      
      // Add the new node to visible nodes immediately
      if (newNode && newNode.nodeId) {
        onVisibleNodesChange(new Set([...Array.from(visibleNodes), newNode.nodeId]));
      }
      
      setContextMenu({ ...contextMenu, visible: false });
      toast({
        title: "Node aangemaakt",
        description: "Nieuwe node is succesvol toegevoegd aan de graaf",
      });
    },
    onError: (error: Error) => {
      console.error("Error creating node:", error);
      toast({
        title: "Fout",
        description: "Kon node niet aanmaken",
        variant: "destructive",
      });
    },
  });

  // Update node position mutation
  const updateNodePositionMutation = useMutation({
    mutationFn: async ({ nodeId, x, y }: { nodeId: string; x: number; y: number }) => {
      const response = await apiRequest("PATCH", `/api/nodes/${nodeId}/position`, { x, y });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/graphs"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Fout",
        description: "Kon node positie niet bijwerken",
        variant: "destructive",
      });
    },
  });

  // Create relation mutation
  const createRelationMutation = useMutation({
    mutationFn: async ({ sourceId, targetId, label, type }: { 
      sourceId: string; 
      targetId: string; 
      label?: string; 
      type?: string;
    }) => {
      const graphId = graph?.graphId || graph?.id;
      const response = await apiRequest("POST", `/api/graphs/${graphId}/edges`, {
        sourceId,
        targetId,
        label: label || "relates_to",
        type: type || "relationship"
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/graphs"] });
      setShowCreateRelationDialog(false);
      setRelationSourceNode(null);
      toast({
        title: "Relatie aangemaakt",
        description: "Nieuwe relatie is succesvol toegevoegd",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Fout",
        description: "Kon relatie niet aanmaken",
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
      type: 'canvas'
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
        description: "Node naam is verplicht",
        variant: "destructive",
      });
      return;
    }

    try {
      const newNodeId = nanoid();
      const newNode = await createNodeMutation.mutateAsync({
        graphId: graph.graphId || graph.id,
        nodeId: newNodeId,
        label: newNodeLabel,
        type: newNodeType,
        x: nodePosition.x,
        y: nodePosition.y,
        data: {},
      });

      // Make the new node visible immediately
      onVisibleNodesChange(new Set([...Array.from(visibleNodes), newNodeId]));

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
        
        // Disable physics after initial layout to prevent position interference
        setPhysicsEnabled(false);
        setIsLoading(false);
      }, 500);
    }
  }, [graph?.id]);

  // Handle node context menu for relation creation
  const handleNodeContextMenu = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      visible: true,
      nodeId,
      type: 'node'
    });
  }, []);

  // Render graph with real-time node positions
  useEffect(() => {
    if (!graph || !svgRef.current) return;

    const visibleNodesArray = graph.nodes?.filter(node => visibleNodes.has(node.id)) || [];
    const visibleEdges = graph.edges?.filter(
      edge => visibleNodes.has(edge.source) && visibleNodes.has(edge.target)
    ) || [];

    // Apply local positions for real-time dragging feedback
    const nodesWithLocalPositions = visibleNodesArray.map(node => {
      const localPos = localNodePositions[node.id];
      return localPos ? { ...node, x: localPos.x, y: localPos.y } : node;
    });

    renderGraph(
      svgRef.current,
      nodesWithLocalPositions,
      visibleEdges,
      {
        selectedNodeId: selectedNode?.id,
        onNodeClick: onNodeSelect,
        onNodeDoubleClick: (nodeId: string) => {
          // Temporarily enable physics for node expansion
          setPhysicsEnabled(true);
          
          // Clear any existing timeout
          if (physicsTimeout) {
            clearTimeout(physicsTimeout);
          }
          
          // Auto-disable physics after 3 seconds
          const timeout = setTimeout(() => {
            setPhysicsEnabled(false);
          }, 3000);
          setPhysicsTimeout(timeout);
          
          // Call the expand function
          onNodeExpand(nodeId);
        },
        onNodeContextMenu: (e: MouseEvent, nodeId: string) => {
          handleNodeContextMenu(e as any, nodeId);
        },
        transform,
      }
    );
  }, [graph, visibleNodes, selectedNode, transform, onNodeSelect, onNodeExpand, localNodePositions, handleNodeContextMenu, physicsTimeout]);

  // Physics simulation loop
  useEffect(() => {
    if (!physicsEnabled || editMode || isNodeDragging || !graph?.nodes || !containerRef.current) return;

    const animate = () => {
      const bounds = {
        width: containerRef.current?.clientWidth || 1200,
        height: containerRef.current?.clientHeight || 800
      };

      const visibleNodesArray = graph.nodes?.filter(node => visibleNodes.has(node.id)) || [];
      const visibleEdges = graph.edges?.filter(
        edge => visibleNodes.has(edge.source) && visibleNodes.has(edge.target)
      ) || [];

      if (visibleNodesArray.length > 0) {
        // Apply local positions from dragging
        const nodesWithLocalPositions = visibleNodesArray.map(node => {
          const localPos = localNodePositions[node.id];
          return localPos ? { ...node, x: localPos.x, y: localPos.y } : node;
        });

        // Run physics simulation
        const updatedNodes = simulatePhysicsStep(nodesWithLocalPositions, visibleEdges, bounds);
        
        // Update local positions with physics results (unless node is being dragged)
        if (!isNodeDragging) {
          const newLocalPositions: Record<string, { x: number; y: number }> = {};
          updatedNodes.forEach(node => {
            newLocalPositions[node.id] = { x: node.x, y: node.y };
          });
          setLocalNodePositions(newLocalPositions);
        }
      }

      const id = requestAnimationFrame(animate);
      setAnimationId(id);
    };

    const id = requestAnimationFrame(animate);
    setAnimationId(id);

    return () => {
      if (id) cancelAnimationFrame(id);
    };
  }, [graph, visibleNodes, physicsEnabled, localNodePositions, isNodeDragging]);

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [animationId]);

  // Enhanced mouse handlers for both panning and node dragging
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as Element;
    const nodeElement = target.closest('[data-node-id]');
    
    // Store initial mouse position for drag threshold
    setMouseDownPosition({ x: e.clientX, y: e.clientY });
    setHasDraggedSignificantly(false);
    
    if (nodeElement && e.button === 0) {
      // Node interaction
      const nodeId = nodeElement.getAttribute('data-node-id');
      const node = graph?.nodes.find(n => n.id === nodeId);
      
      if (node) {
        e.preventDefault();
        e.stopPropagation();
        
        // Select node immediately
        onNodeSelect(node);
        
        // Set up dragging data for potential use
        const rect = svgRef.current?.getBoundingClientRect();
        if (rect) {
          const currentPos = localNodePositions[node.id] || { x: node.x, y: node.y };
          const svgX = (e.clientX - rect.left - transform.translateX) / transform.scale;
          const svgY = (e.clientY - rect.top - transform.translateY) / transform.scale;
          
          setDraggedNode(node);
          setNodeDragStart({ 
            x: svgX - currentPos.x, 
            y: svgY - currentPos.y 
          });
        }
        return;
      }
    }
    
    if (e.button === 0) { // Left mouse button - canvas panning setup
      setDragStart({ x: e.clientX - transform.translateX, y: e.clientY - transform.translateY });
    }
  }, [graph?.nodes, localNodePositions, transform, onNodeSelect]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    // Check if we've moved beyond the drag threshold
    if (mouseDownPosition && !hasDraggedSignificantly) {
      const deltaX = Math.abs(e.clientX - mouseDownPosition.x);
      const deltaY = Math.abs(e.clientY - mouseDownPosition.y);
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      
      if (distance > DRAG_THRESHOLD) {
        setHasDraggedSignificantly(true);
        // Start dragging based on what was set up in mouseDown
        if (draggedNode) {
          setIsNodeDragging(true);
        } else {
          setIsDragging(true);
        }
      }
    }

    if (isNodeDragging && draggedNode) {
      // Node dragging with proper coordinate transformation
      const rect = svgRef.current?.getBoundingClientRect();
      if (rect) {
        const svgX = (e.clientX - rect.left - transform.translateX) / transform.scale;
        const svgY = (e.clientY - rect.top - transform.translateY) / transform.scale;
        
        const newX = svgX - nodeDragStart.x;
        const newY = svgY - nodeDragStart.y;
        
        // Update local position for immediate visual feedback
        setLocalNodePositions(prev => ({
          ...prev,
          [draggedNode.id]: { x: newX, y: newY }
        }));
      }
    } else if (isDragging) {
      // Canvas panning
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      onTransformChange({
        ...transform,
        translateX: deltaX,
        translateY: deltaY
      });
    }
  }, [isNodeDragging, draggedNode, nodeDragStart, isDragging, dragStart, transform, onTransformChange, mouseDownPosition, hasDraggedSignificantly, DRAG_THRESHOLD]);

  const handleMouseUp = useCallback(() => {
    if (isNodeDragging && draggedNode && hasDraggedSignificantly) {
      // Only save position if we actually dragged significantly
      const localPos = localNodePositions[draggedNode.id];
      if (localPos) {
        updateNodePositionMutation.mutate({
          nodeId: draggedNode.id,
          x: Math.round(localPos.x),
          y: Math.round(localPos.y)
        });
        
        // Clear local position after server update
        setLocalNodePositions(prev => {
          const updated = { ...prev };
          delete updated[draggedNode.id];
          return updated;
        });
      }
    }
    
    // Reset all drag states
    setIsDragging(false);
    setIsNodeDragging(false);
    setDraggedNode(null);
    setMouseDownPosition(null);
    setHasDraggedSignificantly(false);
  }, [isNodeDragging, draggedNode, hasDraggedSignificantly, localNodePositions, updateNodePositionMutation]);

  const handleCreateRelation = useCallback((targetNodeId: string) => {
    if (relationSourceNode && targetNodeId !== relationSourceNode) {
      setShowCreateRelationDialog(true);
      setContextMenu({ ...contextMenu, visible: false });
    }
  }, [relationSourceNode, contextMenu]);

  const handleStartRelation = useCallback((nodeId: string) => {
    setRelationSourceNode(nodeId);
    setContextMenu({ ...contextMenu, visible: false });
    toast({
      title: "Relatie Modus",
      description: "Rechtermuisklik op een andere node om een relatie te maken",
    });
  }, [contextMenu, toast]);

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
            {visibleNodes.size} van {graph.nodeCount} Nodes zichtbaar
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
          {contextMenu.type === 'canvas' && (
            <button
              onClick={handleCreateNode}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Nieuwe Node maken
            </button>
          )}
          
          {contextMenu.type === 'node' && contextMenu.nodeId && (
            <>
              <button
                onClick={() => handleStartRelation(contextMenu.nodeId!)}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Start relatie
              </button>
              {relationSourceNode && relationSourceNode !== contextMenu.nodeId && (
                <button
                  onClick={() => handleCreateRelation(contextMenu.nodeId!)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Maak relatie
                </button>
              )}
            </>
          )}
        </div>
      )}
      


      {/* Create Node Dialog */}
      <Dialog open={showCreateNodeDialog} onOpenChange={setShowCreateNodeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nieuwe Node Maken</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="nodeLabel">Node Naam</Label>
              <Input
                id="nodeLabel"
                value={newNodeLabel}
                onChange={(e) => setNewNodeLabel(e.target.value)}
                placeholder="Voer node naam in..."
              />
            </div>
            <div>
              <Label htmlFor="nodeType">Node Type</Label>
              <Select value={newNodeType} onValueChange={setNewNodeType}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Standaard</SelectItem>
                  <SelectItem value="Person">Persoon</SelectItem>
                  <SelectItem value="Organization">Organisatie</SelectItem>
                  <SelectItem value="Event">Gebeurtenis</SelectItem>
                  <SelectItem value="Location">Locatie</SelectItem>
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
                {createNodeMutation.isPending ? "Maken..." : "Node Maken"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Relation Dialog */}
      <Dialog open={showCreateRelationDialog} onOpenChange={setShowCreateRelationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nieuwe Relatie Maken</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Van Node</Label>
              <Input
                value={relationSourceNode || ""}
                disabled
                className="bg-gray-100"
              />
            </div>
            <div>
              <Label>Naar Node</Label>
              <Input
                value={contextMenu.nodeId || ""}
                disabled
                className="bg-gray-100"
              />
            </div>
            <div>
              <Label htmlFor="relationLabel">Relatie Label</Label>
              <Input
                id="relationLabel"
                value={newRelationLabel}
                onChange={(e) => setNewRelationLabel(e.target.value)}
                placeholder="Voer relatie beschrijving in..."
              />
            </div>
            <div>
              <Label htmlFor="relationType">Relatie Type</Label>
              <Select value={newRelationType} onValueChange={setNewRelationType}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="relationship">Relatie</SelectItem>
                  <SelectItem value="works_at">Werkt bij</SelectItem>
                  <SelectItem value="knows">Kent</SelectItem>
                  <SelectItem value="located_in">Gevestigd in</SelectItem>
                  <SelectItem value="part_of">Onderdeel van</SelectItem>
                  <SelectItem value="connected_to">Verbonden met</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowCreateRelationDialog(false);
                  setRelationSourceNode(null);
                }}
              >
                Annuleren
              </Button>
              <Button 
                onClick={() => {
                  if (relationSourceNode && contextMenu.nodeId) {
                    createRelationMutation.mutate({
                      sourceId: relationSourceNode,
                      targetId: contextMenu.nodeId,
                      label: newRelationLabel || "relates_to",
                      type: newRelationType
                    });
                  }
                }}
                disabled={createRelationMutation.isPending}
              >
                {createRelationMutation.isPending ? "Maken..." : "Relatie Maken"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
