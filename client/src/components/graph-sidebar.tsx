import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExpandIcon, EyeOff, Info, Edit3, Save, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { GraphData, VisualizationNode } from "@shared/schema";

interface GraphSidebarProps {
  currentGraph?: GraphData;
  selectedNode?: VisualizationNode;
  onNodeSelect: (node: VisualizationNode) => void;
  onNodeExpand: (nodeId: string) => void;
  onNodeCollapse: (nodeId: string) => void;
  editMode?: boolean;
  onEditModeChange?: (editing: boolean) => void;
}

export default function GraphSidebar({
  currentGraph,
  selectedNode,
  onNodeSelect,
  onNodeExpand,
  onNodeCollapse,
  editMode = false,
  onEditModeChange,
}: GraphSidebarProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    label: '',
    type: '',
    data: {} as Record<string, string>
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: nodeConnections } = useQuery({
    queryKey: ['/api/nodes', selectedNode?.id, 'connections'],
    enabled: !!selectedNode?.id,
  });

  const updateNodeMutation = useMutation({
    mutationFn: async (updates: { label?: string; type?: string; data?: Record<string, any> }) => {
      if (!selectedNode) throw new Error('Geen node geselecteerd');
      return apiRequest(`/api/nodes/${selectedNode.id}`, 'PATCH', updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/graphs'] });
      toast({ title: "Node bijgewerkt", description: "Wijzigingen zijn opgeslagen" });
      setIsEditing(false);
      onEditModeChange?.(false);
    },
    onError: (error: Error) => {
      toast({ 
        title: "Fout bij bijwerken", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  const startEditing = () => {
    if (selectedNode) {
      setEditForm({
        label: selectedNode.label,
        type: selectedNode.type,
        data: selectedNode.data || {}
      });
      setIsEditing(true);
      onEditModeChange?.(true);
    }
  };

  const cancelEditing = () => {
    setIsEditing(false);
    onEditModeChange?.(false);
  };

  const saveChanges = () => {
    const updates: any = {};
    if (editForm.label !== selectedNode?.label) updates.label = editForm.label;
    if (editForm.type !== selectedNode?.type) updates.type = editForm.type;
    if (Object.keys(editForm.data).length > 0) updates.data = editForm.data;
    
    updateNodeMutation.mutate(updates);
  };

  const getNodeColor = (type: string) => {
    const colors: Record<string, string> = {
      'default': 'bg-purple-500',
      'Person': 'bg-blue-500',
      'Organization': 'bg-green-500',
      'Event': 'bg-orange-500',
      'Location': 'bg-red-500',
      'Concept': 'bg-purple-500',
      'Document': 'bg-gray-500'
    };
    return colors[type] || colors['default'];
  };

  const getNodeShape = (type: string) => {
    const shapes: Record<string, string> = {
      'Person': 'rounded-full',
      'Organization': 'rounded-md',
      'Event': 'rounded-full',
      'Location': 'rounded-sm',
      'Concept': 'rounded-lg',
      'Document': 'rounded-none'
    };
    return shapes[type] || 'rounded-full';
  };

  return (
    <div className="w-80 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full">
      {/* Graph Statistics */}
      {currentGraph && (
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {currentGraph.name}
          </h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {currentGraph.nodeCount}
              </div>
              <div className="text-gray-600 dark:text-gray-400">Nodes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {currentGraph.edgeCount}
              </div>
              <div className="text-gray-600 dark:text-gray-400">Relaties</div>
            </div>
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
                {isEditing ? (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium text-gray-900">Node Bewerken</h4>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={cancelEditing}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={saveChanges}
                          disabled={updateNodeMutation.isPending}
                        >
                          <Save className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="edit-label">Label</Label>
                        <Input
                          id="edit-label"
                          value={editForm.label}
                          onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
                          placeholder="Node label"
                        />
                      </div>

                      <div>
                        <Label htmlFor="edit-type">Type</Label>
                        <Select
                          value={editForm.type}
                          onValueChange={(value) => setEditForm({ ...editForm, type: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecteer type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Person">Persoon</SelectItem>
                            <SelectItem value="Organization">Organisatie</SelectItem>
                            <SelectItem value="Event">Gebeurtenis</SelectItem>
                            <SelectItem value="Location">Locatie</SelectItem>
                            <SelectItem value="Concept">Concept</SelectItem>
                            <SelectItem value="Document">Document</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Eigenschappen</Label>
                        <Textarea
                          value={JSON.stringify(editForm.data, null, 2)}
                          onChange={(e) => {
                            try {
                              const parsed = JSON.parse(e.target.value);
                              setEditForm({ ...editForm, data: parsed });
                            } catch {
                              // Invalid JSON, keep current data
                            }
                          }}
                          placeholder='{"eigenschap": "waarde"}'
                          rows={6}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center">
                        <div 
                          className={`w-4 h-4 ${getNodeColor(selectedNode.type)} ${getNodeShape(selectedNode.type)} mr-3`}
                        />
                        <span className="font-medium text-gray-900">{selectedNode.label}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={startEditing}
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
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
                    </div>

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
                  </>
                )}
              </CardContent>
            </Card>

            {!isEditing && (
              <>
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
              </>
            )}
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