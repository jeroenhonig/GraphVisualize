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
  panelConstraints?: {
    leftPanel?: { x: number; y: number; width: number; collapsed: boolean };
    rightPanel?: { x: number; y: number; width: number; collapsed: boolean };
  };
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
  panelConstraints,
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
  const [activeDragNodeId, setActiveDragNodeId] = useState<string | null>(null);
  
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
  const [newNodeType, setNewNodeType] = useState("");
  const [customNodeType, setCustomNodeType] = useState("");
  
  // New relation form state
  const [newRelationLabel, setNewRelationLabel] = useState("");
  const [newRelationType, setNewRelationType] = useState("");
  const [customRelationType, setCustomRelationType] = useState("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Extract existing node types from graph data
  const getExistingNodeTypes = useCallback(() => {
    if (!graph?.nodes) return [];
    
    const types = new Set<string>();
    graph.nodes.forEach(node => {
      if (node.type && node.type !== 'default') {
        types.add(node.type);
      }
    });
    
    return Array.from(types).sort();
  }, [graph?.nodes]);

  // Extract existing edge types from graph data
  const getExistingEdgeTypes = useCallback(() => {
    if (!graph?.edges) return [];
    
    const types = new Set<string>();
    graph.edges.forEach(edge => {
      if (edge.type && edge.type !== 'relationship') {
        types.add(edge.type);
      }
    });
    
    return Array.from(types).sort();
  }, [graph?.edges]);

  const existingNodeTypes = getExistingNodeTypes();
  const existingEdgeTypes = getExistingEdgeTypes();

  // Calculate available canvas area excluding panels
  const getCanvasConstraints = useCallback(() => {
    const headerHeight = 80;
    const margin = 20;
    
    let leftBoundary = margin;
    let rightBoundary = window.innerWidth - margin;
    let topBoundary = headerHeight + margin;
    let bottomBoundary = window.innerHeight - margin;

    // Create a list of all panel boundaries to consider
    const panelBoundaries: Array<{ left: number; right: number; top: number; bottom: number }> = [];

    // Add left panel if not collapsed
    if (panelConstraints?.leftPanel && !panelConstraints.leftPanel.collapsed) {
      panelBoundaries.push({
        left: panelConstraints.leftPanel.x,
        right: panelConstraints.leftPanel.x + panelConstraints.leftPanel.width,
        top: panelConstraints.leftPanel.y,
        bottom: panelConstraints.leftPanel.y + Math.max(400, window.innerHeight - headerHeight - 100)
      });
    }

    // Add right panel if not collapsed
    if (panelConstraints?.rightPanel && !panelConstraints.rightPanel.collapsed) {
      panelBoundaries.push({
        left: panelConstraints.rightPanel.x,
        right: panelConstraints.rightPanel.x + panelConstraints.rightPanel.width,
        top: panelConstraints.rightPanel.y,
        bottom: panelConstraints.rightPanel.y + Math.max(400, window.innerHeight - headerHeight - 100)
      });
    }

    // Find the leftmost right edge and rightmost left edge
    for (const panel of panelBoundaries) {
      // If panel is on the left side, adjust left boundary
      if (panel.left < window.innerWidth / 2) {
        leftBoundary = Math.max(leftBoundary, panel.right + margin);
      }
      // If panel is on the right side, adjust right boundary
      if (panel.right > window.innerWidth / 2) {
        rightBoundary = Math.min(rightBoundary, panel.left - margin);
      }
    }

    return {
      left: leftBoundary,
      right: rightBoundary,
      top: topBoundary,
      bottom: bottomBoundary,
      width: Math.max(200, rightBoundary - leftBoundary),
      height: Math.max(200, bottomBoundary - topBoundary)
    };
  }, [panelConstraints]);

  // Improved constraint logic that allows reasonable panning
  const constrainTransform = useCallback((newTransform: GraphTransform): GraphTransform => {
    // Allow generous panning bounds - don't constrain too tightly
    const maxPanDistance = 1000; // Allow panning up to 1000px in any direction
    
    let { translateX, translateY, scale } = newTransform;

    // Constrain scale to reasonable bounds
    scale = Math.min(Math.max(scale, 0.1), 3);

    // Allow generous panning but prevent going too far off-screen
    translateX = Math.min(Math.max(translateX, -maxPanDistance), maxPanDistance);
    translateY = Math.min(Math.max(translateY, -maxPanDistance), maxPanDistance);

    return { translateX, translateY, scale };
  }, []);

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
    onMutate: async (variables) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: ["/api/graphs", graph?.graphId || graph?.id] });
      
      // Snapshot the previous value
      const previousData = queryClient.getQueryData(["/api/graphs", graph?.graphId || graph?.id]);
      
      // Optimistically update the cache
      queryClient.setQueryData(["/api/graphs", graph?.graphId || graph?.id], (old: any) => {
        if (!old) return old;
        
        return {
          ...old,
          nodes: old.nodes.map((node: any) => 
            node.id === variables.nodeId 
              ? { ...node, x: variables.x, y: variables.y }
              : node
          )
        };
      });
      
      return { previousData };
    },
    onSuccess: (data, variables) => {
      // Clear the local position for this node after successful update
      setLocalNodePositions(prev => {
        const updated = { ...prev };
        delete updated[variables.nodeId];
        return updated;
      });
      
      // Delay the invalidation to prevent visual jump
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/graphs"] });
        queryClient.invalidateQueries({ queryKey: ["/api/graphs", graph?.graphId || graph?.id] });
      }, 100);
    },
    onError: (error: Error, variables, context) => {
      // Rollback the optimistic update
      if (context?.previousData) {
        queryClient.setQueryData(["/api/graphs", graph?.graphId || graph?.id], context.previousData);
      }
      
      // Clear local position on error
      setLocalNodePositions(prev => {
        const updated = { ...prev };
        delete updated[variables.nodeId];
        return updated;
      });
      
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
      setNewRelationLabel("");
      setNewRelationType("");
      setCustomRelationType("");
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

    // Determine the final type to use
    let finalType = newNodeType;
    if (newNodeType === "custom" && customNodeType.trim()) {
      finalType = customNodeType.trim();
    } else if (!finalType) {
      finalType = "Entity"; // Default fallback
    }

    try {
      const newNodeId = nanoid();
      const newNode = await createNodeMutation.mutateAsync({
        graphId: graph.graphId || graph.id,
        nodeId: newNodeId,
        label: newNodeLabel,
        type: finalType,
        x: nodePosition.x,
        y: nodePosition.y,
        data: {},
      });

      // Make the new node visible immediately
      onVisibleNodesChange(new Set([...Array.from(visibleNodes), newNodeId]));

      setShowCreateNodeDialog(false);
      setNewNodeLabel("");
      setNewNodeType("");
      setCustomNodeType("");
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

    // Apply local positions for real-time dragging feedback - prioritize local positions absolutely
    const nodesWithLocalPositions = visibleNodesArray.map(node => {
      const localPos = localNodePositions[node.id];
      if (localPos) {
        // During dragging, local position has absolute priority
        return { ...node, x: localPos.x, y: localPos.y };
      }
      return node;
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
            // Don't override positions of nodes that were recently dragged
            if (!localNodePositions[node.id] || !activeDragNodeId || activeDragNodeId !== node.id) {
              newLocalPositions[node.id] = { x: node.x, y: node.y };
            }
          });
          setLocalNodePositions(prev => ({ ...prev, ...newLocalPositions }));
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
        
        // Use SVG point transformation for accurate coordinate mapping
        if (svgRef.current) {
          const svg = svgRef.current;
          const pt = svg.createSVGPoint();
          pt.x = e.clientX;
          pt.y = e.clientY;
          
          // Transform screen coordinates to SVG coordinates
          const svgPoint = pt.matrixTransform(svg.getScreenCTM()?.inverse());
          const currentPos = localNodePositions[node.id] || { x: node.x, y: node.y };
          
          setDraggedNode(node);
          // Store the offset from mouse to node center
          setNodeDragStart({ 
            x: svgPoint.x - currentPos.x, 
            y: svgPoint.y - currentPos.y
          });
        }
        return;
      }
    }
    
    if (e.button === 0) { // Left mouse button - canvas panning setup
      e.preventDefault();
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
          setActiveDragNodeId(draggedNode.id);
        } else {
          setIsDragging(true);
        }
      }
    }

    // Handle dragging for nodes that have been set up for dragging
    if (draggedNode && (isNodeDragging || (hasDraggedSignificantly && !isNodeDragging))) {
      // Use SVG point transformation for accurate dragging
      if (svgRef.current) {
        const svg = svgRef.current;
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        
        // Transform screen coordinates to SVG coordinates
        const svgPoint = pt.matrixTransform(svg.getScreenCTM()?.inverse());
        
        // Position node maintaining the original offset
        const newX = svgPoint.x - nodeDragStart.x;
        const newY = svgPoint.y - nodeDragStart.y;
        
        // Update local position for immediate visual feedback
        setLocalNodePositions(prev => ({
          ...prev,
          [draggedNode.id]: { x: newX, y: newY }
        }));
      }
    } else if (isDragging) {
      // Canvas panning with constraints
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      const newTransform = {
        ...transform,
        translateX: deltaX,
        translateY: deltaY
      };
      
      // Apply constraints to keep canvas within panel bounds
      const constrainedTransform = constrainTransform(newTransform);
      onTransformChange(constrainedTransform);
    }
  }, [isNodeDragging, draggedNode, nodeDragStart, isDragging, dragStart, transform, onTransformChange, mouseDownPosition, hasDraggedSignificantly, DRAG_THRESHOLD]);

  const handleMouseUp = useCallback(() => {
    if (isNodeDragging && draggedNode && hasDraggedSignificantly) {
      // Only save position if we actually dragged significantly
      const localPos = localNodePositions[draggedNode.id];
      if (localPos) {
        console.log(`Saving position for ${draggedNode.id}:`, localPos);
        updateNodePositionMutation.mutate({
          nodeId: draggedNode.id,
          x: Math.round(localPos.x),
          y: Math.round(localPos.y)
        });
        
        // Keep the local position until the mutation succeeds
        // Don't clear it immediately to prevent visual jumping
      }
    }
    
    // Reset drag states but keep local positions for dragged node
    setIsDragging(false);
    setIsNodeDragging(false);
    setDraggedNode(null);
    setMouseDownPosition(null);
    setHasDraggedSignificantly(false);
    setActiveDragNodeId(null);
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

  // Zoom handler with constraints
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(transform.scale * zoomFactor, 0.1), 3);

    const newTransform = {
      ...transform,
      scale: newScale,
    };
    
    // Apply constraints to keep canvas within panel bounds
    const constrainedTransform = constrainTransform(newTransform);
    onTransformChange(constrainedTransform);
  }, [transform, onTransformChange, constrainTransform]);

  // Global mouse event handlers for smooth dragging
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
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
            setActiveDragNodeId(draggedNode.id);
          } else {
            setIsDragging(true);
          }
        }
      }

      if (!isDragging && !isNodeDragging) return;

      // Handle dragging for nodes that have been set up for dragging
      if (draggedNode && isNodeDragging) {
        if (svgRef.current) {
          const svg = svgRef.current;
          const pt = svg.createSVGPoint();
          pt.x = e.clientX;
          pt.y = e.clientY;
          
          // Transform screen coordinates to SVG coordinates
          const svgPoint = pt.matrixTransform(svg.getScreenCTM()?.inverse());
          
          // Position node maintaining the original offset
          const newX = svgPoint.x - nodeDragStart.x;
          const newY = svgPoint.y - nodeDragStart.y;
          
          setLocalNodePositions(prev => ({
            ...prev,
            [draggedNode.id]: { x: newX, y: newY }
          }));
        }
      } else if (isDragging) {
        // Canvas panning with constraints
        const deltaX = e.clientX - dragStart.x;
        const deltaY = e.clientY - dragStart.y;
        const newTransform = {
          ...transform,
          translateX: deltaX,
          translateY: deltaY
        };
        
        const constrainedTransform = constrainTransform(newTransform);
        onTransformChange(constrainedTransform);
      }
    };

    const handleGlobalMouseUp = () => {
      if (isNodeDragging && draggedNode && hasDraggedSignificantly) {
        const localPos = localNodePositions[draggedNode.id];
        if (localPos) {
          updateNodePositionMutation.mutate({
            nodeId: draggedNode.id,
            x: Math.round(localPos.x),
            y: Math.round(localPos.y)
          });
        }
      }
      
      setIsDragging(false);
      setIsNodeDragging(false);
      setDraggedNode(null);
      setMouseDownPosition(null);
      setHasDraggedSignificantly(false);
      setActiveDragNodeId(null);
    };

    if (mouseDownPosition || isDragging || isNodeDragging) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [
    isDragging, 
    isNodeDragging, 
    draggedNode, 
    nodeDragStart, 
    dragStart, 
    transform, 
    onTransformChange, 
    constrainTransform,
    mouseDownPosition,
    hasDraggedSignificantly,
    DRAG_THRESHOLD,
    localNodePositions,
    updateNodePositionMutation
  ]);

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
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
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
                  <SelectValue placeholder="Selecteer of voer nieuw type in" />
                </SelectTrigger>
                <SelectContent>
                  {existingNodeTypes.length > 0 && (
                    <>
                      {existingNodeTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                      <SelectItem value="custom">Nieuw type...</SelectItem>
                    </>
                  )}
                  {existingNodeTypes.length === 0 && (
                    <SelectItem value="custom">Nieuw type maken</SelectItem>
                  )}
                </SelectContent>
              </Select>
              {newNodeType === "custom" && (
                <div className="mt-2">
                  <Input
                    value={customNodeType}
                    onChange={(e) => setCustomNodeType(e.target.value)}
                    placeholder="Voer nieuw node type in..."
                  />
                </div>
              )}
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
                  <SelectValue placeholder="Selecteer of voer nieuw type in" />
                </SelectTrigger>
                <SelectContent>
                  {existingEdgeTypes.length > 0 && (
                    <>
                      {existingEdgeTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                      <SelectItem value="custom">Nieuw type...</SelectItem>
                    </>
                  )}
                  {existingEdgeTypes.length === 0 && (
                    <SelectItem value="custom">Nieuw type maken</SelectItem>
                  )}
                </SelectContent>
              </Select>
              {newRelationType === "custom" && (
                <div className="mt-2">
                  <Input
                    value={customRelationType}
                    onChange={(e) => setCustomRelationType(e.target.value)}
                    placeholder="Voer nieuw relatie type in..."
                  />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowCreateRelationDialog(false);
                  setRelationSourceNode(null);
                  setNewRelationLabel("");
                  setNewRelationType("");
                  setCustomRelationType("");
                }}
              >
                Annuleren
              </Button>
              <Button 
                onClick={() => {
                  if (relationSourceNode && contextMenu.nodeId) {
                    // Determine the final type to use
                    let finalType = newRelationType;
                    if (newRelationType === "custom" && customRelationType.trim()) {
                      finalType = customRelationType.trim();
                    } else if (!finalType) {
                      finalType = "relates_to"; // Default fallback
                    }

                    createRelationMutation.mutate({
                      sourceId: relationSourceNode,
                      targetId: contextMenu.nodeId,
                      label: newRelationLabel || finalType,
                      type: finalType
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
