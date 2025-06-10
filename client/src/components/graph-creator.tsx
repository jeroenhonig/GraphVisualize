import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, Network, Users, Folder } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { nanoid } from "nanoid";

interface GraphCreatorProps {
  onGraphCreated?: (graphId: string) => void;
}

interface NodeProperty {
  id: string;
  key: string;
  value: string;
}

interface GraphNode {
  id: string;
  label: string;
  type: string;
  properties: NodeProperty[];
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  type: string;
}

export default function GraphCreator({ onGraphCreated }: GraphCreatorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [graphName, setGraphName] = useState("");
  const [graphDescription, setGraphDescription] = useState("");
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [showNodeForm, setShowNodeForm] = useState(false);
  const [showEdgeForm, setShowEdgeForm] = useState(false);
  
  // Node form state
  const [nodeLabel, setNodeLabel] = useState("");
  const [nodeType, setNodeType] = useState("default");
  const [nodeProperties, setNodeProperties] = useState<NodeProperty[]>([
    { id: nanoid(), key: "code", value: "" },
    { id: nanoid(), key: "name", value: "" },
    { id: nanoid(), key: "description", value: "" }
  ]);

  // Edge form state
  const [edgeSource, setEdgeSource] = useState("");
  const [edgeTarget, setEdgeTarget] = useState("");
  const [edgeLabel, setEdgeLabel] = useState("");
  const [edgeType, setEdgeType] = useState("default");

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createGraphMutation = useMutation({
    mutationFn: async (graphData: any) => {
      const response = await apiRequest('POST', '/api/graphs', graphData);
      return response.json();
    },
    onSuccess: (graph) => {
      toast({
        title: "Grafiek aangemaakt",
        description: `${graph.name} is succesvol aangemaakt`,
      });
      onGraphCreated?.(graph.graphId);
      resetForm();
      setIsOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Fout bij aanmaken",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const addNodeMutation = useMutation({
    mutationFn: async ({ graphId, nodeData }: { graphId: string; nodeData: any }) => {
      const response = await apiRequest('POST', `/api/graphs/${graphId}/nodes`, nodeData);
      return response.json();
    },
  });

  const addEdgeMutation = useMutation({
    mutationFn: async ({ graphId, edgeData }: { graphId: string; edgeData: any }) => {
      const response = await apiRequest('POST', `/api/graphs/${graphId}/edges`, edgeData);
      return response.json();
    },
  });

  const resetForm = () => {
    setGraphName("");
    setGraphDescription("");
    setNodes([]);
    setEdges([]);
    setShowNodeForm(false);
    setShowEdgeForm(false);
    resetNodeForm();
    resetEdgeForm();
  };

  const resetNodeForm = () => {
    setNodeLabel("");
    setNodeType("default");
    setNodeProperties([{ id: nanoid(), key: "", value: "" }]);
  };

  const resetEdgeForm = () => {
    setEdgeSource("");
    setEdgeTarget("");
    setEdgeLabel("");
    setEdgeType("default");
  };

  const addProperty = () => {
    setNodeProperties([...nodeProperties, { id: nanoid(), key: "", value: "" }]);
  };

  const removeProperty = (id: string) => {
    setNodeProperties(nodeProperties.filter(prop => prop.id !== id));
  };

  const updateProperty = (id: string, field: 'key' | 'value', value: string) => {
    setNodeProperties(nodeProperties.map(prop => 
      prop.id === id ? { ...prop, [field]: value } : prop
    ));
  };

  const addNode = () => {
    if (!nodeLabel.trim()) {
      toast({
        title: "Fout",
        description: "Node label is verplicht",
        variant: "destructive",
      });
      return;
    }

    const validProperties = nodeProperties.filter(prop => prop.key.trim() && prop.value.trim());
    const nodeData = Object.fromEntries(validProperties.map(prop => [prop.key, prop.value]));

    const newNode: GraphNode = {
      id: nanoid(),
      label: nodeLabel,
      type: nodeType,
      properties: validProperties,
    };

    setNodes([...nodes, newNode]);
    resetNodeForm();
    setShowNodeForm(false);
    
    toast({
      title: "Node toegevoegd",
      description: `${nodeLabel} is toegevoegd aan de grafiek`,
    });
  };

  const addEdge = () => {
    if (!edgeSource || !edgeTarget) {
      toast({
        title: "Fout",
        description: "Bron en doel nodes zijn verplicht",
        variant: "destructive",
      });
      return;
    }

    if (edgeSource === edgeTarget) {
      toast({
        title: "Fout",
        description: "Bron en doel moeten verschillende nodes zijn",
        variant: "destructive",
      });
      return;
    }

    const newEdge: GraphEdge = {
      id: nanoid(),
      source: edgeSource,
      target: edgeTarget,
      label: edgeLabel,
      type: edgeType,
    };

    setEdges([...edges, newEdge]);
    resetEdgeForm();
    setShowEdgeForm(false);
    
    toast({
      title: "Verbinding toegevoegd",
      description: "Nieuwe verbinding is toegevoegd aan de grafiek",
    });
  };

  const removeNode = (nodeId: string) => {
    setNodes(nodes.filter(node => node.id !== nodeId));
    // Remove edges connected to this node
    setEdges(edges.filter(edge => edge.source !== nodeId && edge.target !== nodeId));
  };

  const removeEdge = (edgeId: string) => {
    setEdges(edges.filter(edge => edge.id !== edgeId));
  };

  const createGraph = async () => {
    if (!graphName.trim()) {
      toast({
        title: "Fout",
        description: "Grafiek naam is verplicht",
        variant: "destructive",
      });
      return;
    }

    try {
      // Create the graph first
      const graph = await createGraphMutation.mutateAsync({
        name: graphName,
        description: graphDescription,
        nodeCount: nodes.length,
        edgeCount: edges.length,
      });

      // Add all nodes
      for (const node of nodes) {
        const nodeData = Object.fromEntries(node.properties.map(prop => [prop.key, prop.value]));
        await addNodeMutation.mutateAsync({
          graphId: graph.graphId,
          nodeData: {
            nodeId: node.id,
            label: node.label,
            type: node.type,
            data: nodeData,
            x: Math.random() * 800 + 100,
            y: Math.random() * 600 + 100,
          },
        });
      }

      // Add all edges
      for (const edge of edges) {
        await addEdgeMutation.mutateAsync({
          graphId: graph.graphId,
          edgeData: {
            edgeId: edge.id,
            sourceId: edge.source,
            targetId: edge.target,
            label: edge.label,
            type: edge.type,
            data: {},
          },
        });
      }

      queryClient.invalidateQueries({ queryKey: ['/api/graphs'] });
    } catch (error) {
      console.error('Error creating graph:', error);
    }
  };

  const nodeTypeOptions = [
    { value: "default", label: "Standaard", icon: Users },
    { value: "user", label: "Gebruiker", icon: Users },
    { value: "project", label: "Project", icon: Folder },
    { value: "team", label: "Team", icon: Users },
    { value: "manager", label: "Manager", icon: Users },
    { value: "resource", label: "Resource", icon: Network },
    { value: "department", label: "Afdeling", icon: Folder },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Nieuwe Graaf Maken
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nieuwe Graaf Maken</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Graph Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Graaf Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="graph-name">Naam</Label>
                <Input
                  id="graph-name"
                  value={graphName}
                  onChange={(e) => setGraphName(e.target.value)}
                  placeholder="Voer graaf naam in..."
                />
              </div>
              <div>
                <Label htmlFor="graph-description">Beschrijving</Label>
                <Textarea
                  id="graph-description"
                  value={graphDescription}
                  onChange={(e) => setGraphDescription(e.target.value)}
                  placeholder="Optionele beschrijving..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Nodes Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Knopen ({nodes.length})</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNodeForm(!showNodeForm)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Knoop Toevoegen
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {showNodeForm && (
                <Card className="mb-4">
                  <CardContent className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="node-label">Label</Label>
                        <Input
                          id="node-label"
                          value={nodeLabel}
                          onChange={(e) => setNodeLabel(e.target.value)}
                          placeholder="Knoop naam..."
                        />
                      </div>
                      <div>
                        <Label htmlFor="node-type">Type</Label>
                        <Select value={nodeType} onValueChange={setNodeType}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {nodeTypeOptions.map(option => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label>Eigenschappen</Label>
                        <Button variant="ghost" size="sm" onClick={addProperty}>
                          <Plus className="h-3 w-3 mr-1" />
                          Eigenschap
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {nodeProperties.map((property) => (
                          <div key={property.id} className="flex gap-2">
                            <Input
                              placeholder="Eigenschap naam..."
                              value={property.key}
                              onChange={(e) => updateProperty(property.id, 'key', e.target.value)}
                            />
                            <Input
                              placeholder="Waarde..."
                              value={property.value}
                              onChange={(e) => updateProperty(property.id, 'value', e.target.value)}
                            />
                            {nodeProperties.length > 1 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeProperty(property.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={addNode}>Node Toevoegen</Button>
                      <Button variant="ghost" onClick={() => setShowNodeForm(false)}>
                        Annuleren
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="space-y-2">
                {nodes.map((node) => (
                  <div key={node.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Badge variant="secondary">{node.type}</Badge>
                      <span className="font-medium">{node.label}</span>
                      {node.properties.length > 0 && (
                        <span className="text-xs text-gray-500">
                          ({node.properties.length} eigenschappen)
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeNode(node.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Edges Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Verbindingen ({edges.length})</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEdgeForm(!showEdgeForm)}
                  disabled={nodes.length < 2}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Verbinding Toevoegen
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {nodes.length < 2 && (
                <p className="text-sm text-gray-500 mb-4">
                  Voeg minimaal 2 nodes toe om verbindingen te maken.
                </p>
              )}

              {showEdgeForm && nodes.length >= 2 && (
                <Card className="mb-4">
                  <CardContent className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="edge-source">Van Node</Label>
                        <Select value={edgeSource} onValueChange={setEdgeSource}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecteer bron node..." />
                          </SelectTrigger>
                          <SelectContent>
                            {nodes.map(node => (
                              <SelectItem key={node.id} value={node.id}>
                                {node.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="edge-target">Naar Node</Label>
                        <Select value={edgeTarget} onValueChange={setEdgeTarget}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecteer doel node..." />
                          </SelectTrigger>
                          <SelectContent>
                            {nodes.map(node => (
                              <SelectItem key={node.id} value={node.id}>
                                {node.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="edge-label">Label (optioneel)</Label>
                        <Input
                          id="edge-label"
                          value={edgeLabel}
                          onChange={(e) => setEdgeLabel(e.target.value)}
                          placeholder="Relatie beschrijving..."
                        />
                      </div>
                      <div>
                        <Label htmlFor="edge-type">Type</Label>
                        <Select value={edgeType} onValueChange={setEdgeType}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="default">Standaard</SelectItem>
                            <SelectItem value="reference">Referentie</SelectItem>
                            <SelectItem value="dependency">Afhankelijkheid</SelectItem>
                            <SelectItem value="hierarchy">Hiërarchie</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={addEdge}>Verbinding Toevoegen</Button>
                      <Button variant="ghost" onClick={() => setShowEdgeForm(false)}>
                        Annuleren
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="space-y-2">
                {edges.map((edge) => (
                  <div key={edge.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <span className="text-sm">
                        {nodes.find(n => n.id === edge.source)?.label} → {nodes.find(n => n.id === edge.target)?.label}
                      </span>
                      {edge.label && (
                        <Badge variant="outline">{edge.label}</Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeEdge(edge.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* Actions */}
          <div className="flex justify-end space-x-3">
            <Button variant="ghost" onClick={() => setIsOpen(false)}>
              Annuleren
            </Button>
            <Button 
              onClick={createGraph}
              disabled={!graphName.trim() || createGraphMutation.isPending}
            >
              {createGraphMutation.isPending ? "Aanmaken..." : "Grafiek Aanmaken"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}