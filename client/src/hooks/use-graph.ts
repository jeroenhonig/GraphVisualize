import { useState, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { GraphData, VisualizationNode } from "@shared/schema";
import type { GraphTransform } from "@/lib/graph-utils";

export function useGraph() {
  const [currentGraphId, setCurrentGraphId] = useState<string>();
  const [selectedNode, setSelectedNode] = useState<VisualizationNode>();
  const [visibleNodes, setVisibleNodes] = useState<Set<string>>(new Set());
  const [transform, setTransform] = useState<GraphTransform>({
    scale: 1,
    translateX: 0,
    translateY: 0,
  });

  // Fetch current graph
  const { data: currentGraph } = useQuery({
    queryKey: ['/api/graphs', currentGraphId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/graphs/${currentGraphId}`);
      return res.json();
    },
    enabled: !!currentGraphId,
  });

  // Fetch all graphs
  const { data: allGraphs } = useQuery({
    queryKey: ['/api/graphs'],
  });

  const selectGraph = useCallback((graphId: string) => {
    setCurrentGraphId(graphId);
    setSelectedNode(undefined);
    setVisibleNodes(new Set());
    setTransform({ scale: 1, translateX: 0, translateY: 0 });
  }, []);

  // Auto-select the most recent graph if none is selected
  useEffect(() => {
    if (!currentGraphId && allGraphs && Array.isArray(allGraphs) && allGraphs.length > 0) {
      // Sort by creation date and select the most recent
      const mostRecent = [...allGraphs].sort((a: any, b: any) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];
      setCurrentGraphId(mostRecent.graphId);
    }
  }, [allGraphs, currentGraphId]);

  const expandNode = useCallback((nodeId: string) => {
    console.log('expandNode called with nodeId:', nodeId);
    if (!currentGraph || !currentGraph.edges) {
      console.log('No graph or edges available');
      return;
    }

    // Add connected nodes to visible set
    const connectedNodeIds = new Set<string>();
    
    currentGraph.edges.forEach((edge: any) => {
      if (edge.source === nodeId && !visibleNodes.has(edge.target)) {
        connectedNodeIds.add(edge.target);
        console.log('Found connected target node:', edge.target);
      }
      if (edge.target === nodeId && !visibleNodes.has(edge.source)) {
        connectedNodeIds.add(edge.source);
        console.log('Found connected source node:', edge.source);
      }
    });

    console.log('Total connected nodes found:', connectedNodeIds.size);
    console.log('Connected node IDs:', Array.from(connectedNodeIds));

    if (connectedNodeIds.size > 0) {
      setVisibleNodes(prev => {
        const newSet = new Set([...Array.from(prev), ...Array.from(connectedNodeIds)]);
        console.log('Updated visible nodes:', Array.from(newSet));
        return newSet;
      });
    } else {
      console.log('No new connected nodes to add');
    }
  }, [currentGraph, visibleNodes]);

  const collapseNode = useCallback((nodeId: string) => {
    if (!currentGraph || !currentGraph.edges) return;

    // Remove node from visible set, but keep nodes that have other connections
    const nodesToKeep = new Set(visibleNodes);
    nodesToKeep.delete(nodeId);

    // Check which connected nodes should remain visible
    const connectedNodes = currentGraph.edges
      .filter((edge: any) => edge.source === nodeId || edge.target === nodeId)
      .flatMap((edge: any) => [edge.source, edge.target])
      .filter((id: any) => id !== nodeId);

    connectedNodes.forEach((connectedNodeId: any) => {
      // Check if this connected node has other visible connections
      const hasOtherConnections = currentGraph.edges.some((edge: any) => 
        (edge.source === connectedNodeId && nodesToKeep.has(edge.target)) ||
        (edge.target === connectedNodeId && nodesToKeep.has(edge.source))
      );

      if (!hasOtherConnections) {
        nodesToKeep.delete(connectedNodeId);
      }
    });

    setVisibleNodes(nodesToKeep);
    
    // Deselect node if it was selected
    if (selectedNode?.id === nodeId) {
      setSelectedNode(undefined);
    }
  }, [currentGraph, visibleNodes, selectedNode]);

  const resetView = useCallback(() => {
    // Reset transform (zoom and pan)
    setTransform({ scale: 1, translateX: 0, translateY: 0 });
    
    // Show all nodes and edges
    if (currentGraph && currentGraph.nodes) {
      const allNodeIds = new Set<string>(currentGraph.nodes.map((node: any) => node.id as string));
      setVisibleNodes(allNodeIds);
    }
    
    // Clear node selection
    setSelectedNode(undefined);
  }, [currentGraph]);

  const fitToScreen = useCallback(() => {
    if (!currentGraph || !currentGraph.nodes || visibleNodes.size === 0) return;

    const visibleNodesArray = currentGraph.nodes.filter((node: any) => visibleNodes.has(node.id));
    
    if (visibleNodesArray.length === 0) return;

    // Calculate bounds
    const padding = 100;
    const minX = Math.min(...visibleNodesArray.map((n: any) => n.x)) - padding;
    const maxX = Math.max(...visibleNodesArray.map((n: any) => n.x)) + padding;
    const minY = Math.min(...visibleNodesArray.map((n: any) => n.y)) - padding;
    const maxY = Math.max(...visibleNodesArray.map((n: any) => n.y)) + padding;

    const width = maxX - minX;
    const height = maxY - minY;

    // Calculate scale to fit
    const scaleX = 1200 / width;
    const scaleY = 800 / height;
    const scale = Math.min(scaleX, scaleY, 2); // Max scale of 2

    // Calculate center offset
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const translateX = 600 - centerX * scale;
    const translateY = 400 - centerY * scale;

    setTransform({ scale, translateX, translateY });
  }, [currentGraph, visibleNodes]);

  return {
    currentGraph,
    allGraphs,
    selectedNode,
    setSelectedNode,
    visibleNodes,
    setVisibleNodes,
    transform,
    setTransform,
    selectGraph,
    expandNode,
    collapseNode,
    resetView,
    fitToScreen,
  };
}
