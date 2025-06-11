import { useEffect, useRef, useState } from "react";
import type { GraphData, VisualizationNode, GraphTransform } from "@shared/schema";
import { getNodeTypeColor } from "@/lib/color-utils";

interface G6V5WorkingProps {
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

export default function G6V5Working({
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
}: G6V5WorkingProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || !graph) return;

    const createWorkingGraph = async () => {
      try {
        setIsLoading(true);
        setRenderError(null);

        const G6Module = await import('@antv/g6');
        const { Graph } = G6Module;

        if (graphRef.current) {
          try {
            graphRef.current.destroy();
          } catch (e) {
            console.warn('Graph cleanup:', e);
          }
          graphRef.current = null;
        }

        const container = containerRef.current;
        if (!container) return;
        
        container.innerHTML = '';
        const width = container.clientWidth || 800;
        const height = container.clientHeight || 600;

        const visibleNodeIds = visibleNodes.size > 0 ? Array.from(visibleNodes) : graph.nodes.map(n => n.id);
        
        const nodes = graph.nodes
          .filter(node => visibleNodeIds.includes(node.id))
          .slice(0, 100)
          .map(node => {
            const colorData = getNodeTypeColor(node.type);
            // Random starting positions to prevent clustering at center
            const randomX = (Math.random() - 0.5) * width * 0.6;
            const randomY = (Math.random() - 0.5) * height * 0.6;
            
            return {
              id: node.id,
              x: randomX,
              y: randomY,
              data: {
                ...node,
                label: node.label.length > 15 ? node.label.substring(0, 15) + '...' : node.label,
                fill: colorData.secondary,
                stroke: colorData.primary
              }
            };
          });

        const edges = graph.edges
          .filter(edge => 
            nodes.find(n => n.id === edge.source) && 
            nodes.find(n => n.id === edge.target)
          )
          .slice(0, 200)
          .map(edge => ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            data: {
              ...edge,
              label: edge.label || '',
              type: edge.type || 'line'
            }
          }));

        console.log('Creating G6 v5.0.48 working graph:', { nodes: nodes.length, edges: edges.length });

        // Use G6 v5.0.48 API
        const g6Graph = new Graph({
          container,
          width,
          height,
          data: { nodes, edges },
          node: {
            style: {
              size: 20,
              fill: (d: any) => {
                const colorData = getNodeTypeColor(d.data?.type || 'unknown');
                return colorData.secondary;
              },
              stroke: (d: any) => {
                const colorData = getNodeTypeColor(d.data?.type || 'unknown');
                return colorData.primary;
              },
              lineWidth: 2,
              labelText: (d: any) => d.data?.label || d.id,
              labelFill: '#333',
              labelFontSize: 12,
              labelPosition: 'bottom',
              labelOffset: 8
            },
            state: {
              selected: {
                fill: '#ffeb3b',
                stroke: '#ff9800',
                lineWidth: 4
              },
              hover: {
                fill: '#ffc107',
                stroke: '#ff6f00',
                lineWidth: 3
              },
              'relation-source': {
                fill: '#4caf50',
                stroke: '#2e7d32',
                lineWidth: 4,
                shadowColor: '#4caf50',
                shadowBlur: 10
              }
            }
          },
          edge: {
            style: {
              stroke: '#999',
              lineWidth: 1.5,
              endArrow: true
            }
          },
          layout: {
            type: 'force',
            preventOverlap: true,
            nodeSize: 25,
            linkDistance: 120,
            nodeStrength: -300,
            edgeStrength: 0.6,
            alpha: 0.3,
            alphaDecay: 0.02,
            velocityDecay: 0.8,
            collideStrength: 1
          },
          behaviors: ['zoom-canvas', 'drag-element']
        });

        // Store selected node for manual highlighting
        let selectedNodeId: string | null = null;
        
        // Drag-and-drop relationship builder state
        let isDraggingForRelation = false;
        let relationSourceNode: string | null = null;
        let tempEdge: any = null;
        let relationMode = false;
        
        // Node click handler with relationship creation support
        g6Graph.on('node:click', (event: any) => {
          console.log('Node clicked:', event);
          const nodeId = event.itemId || event.target?.id;
          
          if (nodeId) {
            // Handle relationship creation mode
            if (relationMode && relationSourceNode && relationSourceNode !== nodeId) {
              const sourceNode = nodes.find(n => n.id === relationSourceNode);
              const targetNode = nodes.find(n => n.id === nodeId);
              
              if (sourceNode && targetNode) {
                console.log('Creating relationship:', sourceNode.data.label, '→', targetNode.data.label);
                
                // Create new edge
                const newEdgeId = `edge_${relationSourceNode}_${nodeId}_${Date.now()}`;
                const newEdge = {
                  id: newEdgeId,
                  source: relationSourceNode,
                  target: nodeId,
                  data: {
                    label: 'nieuwe relatie',
                    type: 'custom'
                  }
                };
                
                // Add edge to graph
                g6Graph.addEdgeData([newEdge]);
                
                // Reset relation mode
                relationMode = false;
                if (relationSourceNode) {
                  g6Graph.setElementState(relationSourceNode, 'relation-source', false);
                }
                relationSourceNode = null;
                
                console.log('Relationship created successfully');
              }
              return;
            }
            
            // Reset relation mode if clicking same node
            if (relationMode && relationSourceNode === nodeId) {
              relationMode = false;
              if (relationSourceNode) {
                g6Graph.setElementState(relationSourceNode, 'relation-source', false);
              }
              relationSourceNode = null;
              console.log('Relation mode cancelled');
              return;
            }
            
            // Normal node selection
            const originalNode = nodes.find(n => n.id === nodeId);
            if (originalNode) {
              console.log('Node selected:', originalNode.data.label);
              
              // Update selected node tracking
              selectedNodeId = nodeId;
              
              // Pass node data to parent component
              const visualizationNode = {
                id: originalNode.data.id,
                label: originalNode.data.label,
                type: originalNode.data.type,
                data: originalNode.data.data,
                x: originalNode.data.x,
                y: originalNode.data.y
              };
              
              onNodeSelect(visualizationNode as any);
              
              // Clear all node selections and highlight current
              try {
                nodes.forEach((node: any) => {
                  g6Graph.setElementState(node.id, 'selected', false);
                });
                g6Graph.setElementState(nodeId, 'selected', true);
                
                console.log(`Node "${originalNode.data.label}" highlighted`);
              } catch (e) {
                console.warn('Selection highlighting failed:', e);
              }
            }
          }
        });

        g6Graph.on('node:dblclick', (event: any) => {
          console.log('Node double clicked:', event);
          const nodeId = event.itemId || event.target?.id;
          
          if (nodeId) {
            onNodeExpand(nodeId);
          }
        });

        // Context menu implementation
        let contextMenu: HTMLDivElement | null = null;
        let contextMenuTargetNode: string | null = null;

        // Create context menu element
        const createContextMenu = () => {
          if (contextMenu) return contextMenu;
          
          contextMenu = document.createElement('div');
          contextMenu.className = 'g6-context-menu';
          contextMenu.style.cssText = `
            position: fixed;
            background: white;
            border: 1px solid #ccc;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            z-index: 1000;
            padding: 4px 0;
            min-width: 150px;
            display: none;
          `;
          
          const menuItems = [
            { label: 'Bewerk Node', action: 'edit' },
            { label: 'Maak Relatie', action: 'relation' },
            { label: 'Uitklappen', action: 'expand' },
            { label: 'Verwijder Node', action: 'delete' }
          ];
          
          menuItems.forEach(item => {
            const menuItem = document.createElement('div');
            menuItem.textContent = item.label;
            menuItem.style.cssText = `
              padding: 8px 16px;
              cursor: pointer;
              font-size: 14px;
              color: #333;
            `;
            menuItem.addEventListener('mouseenter', () => {
              menuItem.style.backgroundColor = '#f5f5f5';
            });
            menuItem.addEventListener('mouseleave', () => {
              menuItem.style.backgroundColor = 'transparent';
            });
            menuItem.addEventListener('click', () => {
              handleContextMenuAction(item.action);
            });
            contextMenu!.appendChild(menuItem);
          });
          
          document.body.appendChild(contextMenu);
          return contextMenu;
        };

        // Handle context menu actions
        const handleContextMenuAction = (action: string) => {
          if (!contextMenuTargetNode) return;
          
          const originalNode = nodes.find(n => n.id === contextMenuTargetNode);
          if (!originalNode) return;
          
          const visualizationNode = {
            id: originalNode.data.id,
            label: originalNode.data.label,
            type: originalNode.data.type,
            data: originalNode.data.data,
            x: originalNode.data.x,
            y: originalNode.data.y
          };
          
          switch (action) {
            case 'edit':
              if (onNodeEdit) {
                console.log('Opening node editor:', originalNode.data.label);
                onNodeEdit(visualizationNode as any);
              }
              break;
            case 'expand':
              console.log('Expanding node:', originalNode.data.label);
              onNodeExpand(contextMenuTargetNode);
              break;
            case 'relation':
              console.log('Starting relation mode from:', originalNode.data.label);
              relationMode = true;
              relationSourceNode = contextMenuTargetNode;
              // Highlight source node for relation creation
              g6Graph.setElementState(contextMenuTargetNode, 'relation-source', true);
              console.log('Relation mode active - click another node to create connection');
              break;
            case 'delete':
              console.log('Delete node requested:', originalNode.data.label);
              // TODO: Implement node deletion
              break;
          }
          
          hideContextMenu();
        };

        // Show context menu
        const showContextMenu = (x: number, y: number, nodeId: string) => {
          const menu = createContextMenu();
          contextMenuTargetNode = nodeId;
          
          menu.style.left = x + 'px';
          menu.style.top = y + 'px';
          menu.style.display = 'block';
        };

        // Hide context menu
        const hideContextMenu = () => {
          if (contextMenu) {
            contextMenu.style.display = 'none';
            contextMenuTargetNode = null;
          }
        };

        // Right-click context menu for node editing
        g6Graph.on('node:contextmenu', (event: any) => {
          event.preventDefault?.();
          console.log('Node right-clicked:', event);
          const nodeId = event.itemId || event.target?.id;
          
          if (nodeId) {
            const originalEvent = event.originalEvent || event;
            showContextMenu(originalEvent.clientX, originalEvent.clientY, nodeId);
          }
        });



        // Hide context menu on outside click
        document.addEventListener('click', (e) => {
          if (contextMenu && !contextMenu.contains(e.target as Node)) {
            hideContextMenu();
          }
        });

        // Enhanced drag behavior following G6 v3 pattern
        g6Graph.on('afterlayout', () => {
          console.log('Layout completed - nodes positioned');
        });

        g6Graph.on('node:dragstart', (event: any) => {
          console.log('Node drag started');
          // Restart layout calculation during drag
          g6Graph.layout();
          refreshDraggedNodePosition(event);
        });

        g6Graph.on('node:drag', (event: any) => {
          console.log('Node dragging');
          refreshDraggedNodePosition(event);
        });

        g6Graph.on('node:dragend', (event: any) => {
          console.log('Node drag ended');
          const nodeId = event.itemId || event.target?.id;
          if (nodeId) {
            try {
              const nodeData = g6Graph.getNodeData(nodeId);
              if (nodeData) {
                // Release fixed position to allow natural layout
                delete nodeData.fx;
                delete nodeData.fy;
              }
            } catch (e) {
              console.warn('Failed to release drag position:', e);
            }
          }
        });

        // Function to handle dragged node position (adapted from G6 v3 docs)
        const refreshDraggedNodePosition = (event: any) => {
          const nodeId = event.itemId || event.target?.id;
          if (nodeId && event.canvas) {
            try {
              const nodeData = g6Graph.getNodeData(nodeId);
              if (nodeData) {
                // Fix position during drag to prevent layout interference
                nodeData.fx = event.canvas.x;
                nodeData.fy = event.canvas.y;
              }
            } catch (e) {
              console.warn('Failed to update drag position:', e);
            }
          }
        };

        // Hover effects
        g6Graph.on('node:mouseenter', (event: any) => {
          const { itemId } = event;
          if (itemId) {
            g6Graph.setElementState(itemId, 'hover', true);
          }
        });

        g6Graph.on('node:mouseleave', (event: any) => {
          const { itemId } = event;
          if (itemId) {
            g6Graph.setElementState(itemId, 'hover', false);
          }
        });

        // Edge selection
        g6Graph.on('edge:click', (event: any) => {
          console.log('Edge clicked:', event);
          const { itemId, itemType } = event;
          
          if (itemType === 'edge' && itemId) {
            const edgeData = edges.find(e => e.id === itemId);
            if (edgeData) {
              console.log('Edge selected:', edgeData.data?.data?.label || itemId);
            }
          }
        });

        // Canvas click to clear selection and hide context menu
        g6Graph.on('canvas:click', () => {
          console.log('Canvas clicked - clearing selection');
          selectedNodeId = null;
          hideContextMenu();
          
          // Reset relation mode
          if (relationMode && relationSourceNode) {
            relationMode = false;
            g6Graph.setElementState(relationSourceNode, 'relation-source', false);
            relationSourceNode = null;
            console.log('Relation mode cancelled');
          }
          
          // Reset all nodes to normal state
          try {
            nodes.forEach((node: any) => {
              g6Graph.setElementState(node.id, 'selected', false);
            });
            console.log('All selections cleared - nodes back to normal state');
          } catch (e) {
            console.warn('Failed to clear selections:', e);
          }
        });

        // Render graph
        await g6Graph.render();

        // Initialize force layout with better distribution
        setTimeout(() => {
          g6Graph.layout();
        }, 100);

        // Check if rendering worked
        setTimeout(() => {
          const hasElements = container.children.length > 0;
          console.log('G6 v5: Render success check:', { 
            hasElements, 
            childCount: container.children.length,
            containerSize: { width: container.clientWidth, height: container.clientHeight }
          });
          
          if (!hasElements) {
            setRenderError('G6 v5.0.48 rendering incomplete');
          }
        }, 1000);

        graphRef.current = g6Graph;
        setIsLoading(false);
        console.log('G6 v5.0.48 working graph created');

      } catch (error) {
        console.error('G6 v5.0.48 creation error:', error);
        setRenderError(`G6 v5.0.48 error: ${error instanceof Error ? error.message : 'Creation failed'}`);
        setIsLoading(false);
      }
    };

    createWorkingGraph();

    return () => {
      if (graphRef.current) {
        try {
          graphRef.current.destroy();
        } catch (e) {
          console.warn('Cleanup error:', e);
        }
        graphRef.current = null;
      }
    };
  }, [graph, visibleNodes]);

  if (renderError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center p-8">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            G6 v5.0.48 Working Implementation
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            {renderError}
          </p>
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
              Infrastructure Dataset
            </h4>
            <p className="text-sm text-blue-600 dark:text-blue-300">
              {graph?.nodes?.length || 0} nodes • {graph?.edges?.length || 0} edges
            </p>
            <p className="text-xs text-gray-500 mt-2">
              RDF infrastructure model - force layout with performance optimization
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative bg-white dark:bg-gray-900">
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ minHeight: '400px' }}
      />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-900/80">
          <div className="text-center">
            <div className="text-gray-500 dark:text-gray-400 mb-2">
              G6 v5.0.48 force layout initialiseren...
            </div>
            <div className="text-xs text-gray-400">
              Canvas rendering • Force simulation • Event binding
            </div>
          </div>
        </div>
      )}
      
      {!isLoading && !renderError && (
        <div className="absolute top-4 right-4 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-md text-xs">
          <div className="font-medium mb-2">G6 v5.0.48 Status:</div>
          <div className="space-y-1 text-gray-600 dark:text-gray-300">
            <div>• Canvas renderer actief</div>
            <div>• Force layout algoritme</div>
            <div>• Drag & zoom behaviors</div>
            <div>• Node click events</div>
            <div>• Performance geoptimaliseerd</div>
          </div>
        </div>
      )}
    </div>
  );
}