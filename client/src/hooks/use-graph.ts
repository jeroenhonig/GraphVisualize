import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
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

  const expandNode = useCallback((nodeId: string) => {
    if (!currentGraph) return;

    // Add connected nodes to visible set
    const connectedNodeIds = new Set<string>();
    
    currentGraph.edges.forEach(edge => {
      if (edge.source === nodeId && !visibleNodes.has(edge.target)) {
        connectedNodeIds.add(edge.target);
      }
      if (edge.target === nodeId && !visibleNodes.has(edge.source)) {
        connectedNodeIds.add(edge.source);
      }
    });

    if (connectedNodeIds.size > 0) {
      setVisibleNodes(prev => new Set([...prev, ...connectedNodeIds]));
    }
  }, [currentGraph, visibleNodes]);

  const collapseNode = useCallback((nodeId: string) => {
    if (!currentGraph) return;

    // Remove node from visible set, but keep nodes that have other connections
    const nodesToKeep = new Set(visibleNodes);
    nodesToKeep.delete(nodeId);

    // Check which connected nodes should remain visible
    const connectedNodes = currentGraph.edges
      .filter(edge => edge.source === nodeId || edge.target === nodeId)
      .flatMap(edge => [edge.source, edge.target])
      .filter(id => id !== nodeId);

    connectedNodes.forEach(connectedNodeId => {
      // Check if this connected node has other visible connections
      const hasOtherConnections = currentGraph.edges.some(edge => 
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
    setTransform({ scale: 1, translateX: 0, translateY: 0 });
  }, []);

  const fitToScreen = useCallback(() => {
    if (!currentGraph || visibleNodes.size === 0) return;

    const visibleNodesArray = currentGraph.nodes.filter(node => visibleNodes.has(node.id));
    
    if (visibleNodesArray.length === 0) return;

    // Calculate bounds
    const padding = 100;
    const minX = Math.min(...visibleNodesArray.map(n => n.x)) - padding;
    const maxX = Math.max(...visibleNodesArray.map(n => n.x)) + padding;
    const minY = Math.min(...visibleNodesArray.map(n => n.y)) - padding;
    const maxY = Math.max(...visibleNodesArray.map(n => n.y)) + padding;

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
