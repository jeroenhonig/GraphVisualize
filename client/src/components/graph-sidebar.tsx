import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ExpandIcon, EyeOff, Info } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import FileUpload from "./file-upload";
import GraphCreator from "./graph-creator";
import type { GraphData, VisualizationNode } from "@shared/schema";

interface GraphSidebarProps {
  currentGraph?: GraphData;
  selectedNode?: VisualizationNode;
  onNodeSelect: (node: VisualizationNode) => void;
  onNodeExpand: (nodeId: string) => void;
  onNodeCollapse: (nodeId: string) => void;
}

export default function GraphSidebar({
  currentGraph,
  selectedNode,
  onNodeSelect,
  onNodeExpand,
  onNodeCollapse,
}: GraphSidebarProps) {
  const { data: nodeConnections } = useQuery({
    queryKey: ['/api/nodes', selectedNode?.id, 'connections'],
    enabled: !!selectedNode?.id,
  });

  const getNodeColor = (type: string) => {
    const colors: Record<string, string> = {
      'default': 'bg-purple-500',
      'user': 'bg-purple-500',
      'project': 'bg-green-500',
      'team': 'bg-yellow-500',
      'manager': 'bg-purple-500',
      'resource': 'bg-gray-500',
      'department': 'bg-red-500',
    };
    return colors[type.toLowerCase()] || colors.default;
  };

  const getNodeShape = (type: string) => {
    const shapes: Record<string, string> = {
      'project': 'rounded-lg',
      'team': 'rotate-45',
      'default': 'rounded-full',
    };
    return shapes[type.toLowerCase()] || shapes.default;
  };

  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
      {/* File Upload Section */}
      <div className="p-6 border-b border-gray-200 space-y-4">
        <FileUpload />
        <GraphCreator onGraphCreated={(graphId) => {
          // This will be handled by the useGraph hook's auto-selection
        }} />
      </div>

      {/* Graph Statistics */}
      {currentGraph && (
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Graaf Statistieken</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Totaal Knopen:</span>
              <span className="text-sm font-mono font-medium">{currentGraph.nodeCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Totaal Kanten:</span>
              <span className="text-sm font-mono font-medium">{currentGraph.edgeCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Zichtbare Knopen:</span>
              <span className="text-sm font-mono font-medium text-blue-600">
                {currentGraph.nodes?.filter(n => n.visible !== false).length || 0}
              </span>
            </div>
            {selectedNode && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Geselecteerd:</span>
                <span className="text-sm font-mono font-medium text-purple-600">
                  {selectedNode.label}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Node Details Panel */}
      <div className="flex-1 p-6 overflow-y-auto">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Knoop Details</h3>
        
        {selectedNode ? (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center mb-3">
                  <div 
                    className={`w-4 h-4 ${getNodeColor(selectedNode.type)} ${getNodeShape(selectedNode.type)} mr-3`}
                  />
                  <span className="font-medium text-gray-900">{selectedNode.label}</span>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-600">Type:</span>
                    <Badge variant="secondary" className="ml-2">
                      {selectedNode.type}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-gray-600">ID:</span>
                    <span className="ml-2 font-mono text-xs">{selectedNode.id}</span>
                  </div>
                  {nodeConnections && Array.isArray((nodeConnections as any)?.connections) && (
                    <div>
                      <span className="text-gray-600">Connecties:</span>
                      <span className="ml-2 font-mono">{(nodeConnections as any)?.connections?.length || 0}</span>
                    </div>
                  )}
                </div>

                {/* Additional node data */}
                {selectedNode.data && Object.keys(selectedNode.data).length > 0 && (
                  <div className="mt-4">
                    <Separator className="mb-3" />
                    <h4 className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-2">
                      Eigenschappen
                    </h4>
                    <div className="space-y-1 text-xs">
                      {Object.entries(selectedNode.data)
                        .filter(([key, value]) => value && key !== 'id' && key !== 'label' && key !== 'type')
                        .slice(0, 5)
                        .map(([key, value]) => (
                          <div key={key} className="flex justify-between">
                            <span className="text-gray-600 truncate">{key}:</span>
                            <span className="font-mono ml-2 truncate max-w-32" title={String(value)}>
                              {String(value)}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Connected Nodes */}
            {(nodeConnections as any)?.connections && (nodeConnections as any).connections.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-2">
                  Verbonden Knopen
                </h4>
                
                <div className="space-y-2">
                  {(nodeConnections as any).connections.slice(0, 8).map((connection: any) => (
                    <Card key={connection.id} className="hover:bg-gray-50 cursor-pointer">
                      <CardContent className="p-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div 
                              className={`w-3 h-3 ${getNodeColor(connection.type)} ${getNodeShape(connection.type)} mr-2`}
                            />
                            <span className="text-sm font-mono truncate max-w-32" title={connection.label}>
                              {connection.label}
                            </span>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {connection.relationship}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  
                  {(nodeConnections as any).connections.length > 8 && (
                    <div className="text-xs text-gray-500 text-center py-2">
                      +{(nodeConnections as any).connections.length - 8} meer...
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-2">
              <Button
                onClick={() => onNodeExpand(selectedNode.id)}
                className="w-full"
                variant="outline"
                size="sm"
              >
                <ExpandIcon className="h-4 w-4 mr-2" />
                Uitklappen
              </Button>
              <Button
                onClick={() => onNodeCollapse(selectedNode.id)}
                className="w-full"
                variant="outline"
                size="sm"
              >
                <EyeOff className="h-4 w-4 mr-2" />
                Verbergen
              </Button>
            </div>
          </div>
        ) : (
          <Card>
            <CardContent className="p-6 text-center">
              <Info className="h-8 w-8 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-600">
                Selecteer een node om details te bekijken
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
