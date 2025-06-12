import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Save, Plus, Trash2, Edit3, Edit, Check, X } from "lucide-react";
import type { VisualizationNode } from "@shared/schema";

interface NodeEditorProps {
  node: VisualizationNode;
  onNodeUpdate?: (nodeId: string) => void;
}

export default function NodeEditor({ node, onNodeUpdate }: NodeEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedNode, setEditedNode] = useState(node);
  const [newPropertyKey, setNewPropertyKey] = useState("");
  const [newPropertyValue, setNewPropertyValue] = useState("");
  const [customType, setCustomType] = useState("");
  const [showCustomTypeInput, setShowCustomTypeInput] = useState(false);
  const [customPropertyKey, setCustomPropertyKey] = useState("");
  const [showCustomPropertyInput, setShowCustomPropertyInput] = useState(false);
  const [editingProperties, setEditingProperties] = useState<Set<string>>(new Set());
  const [newPropertyAdded, setNewPropertyAdded] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all existing node types from the dataset (RDF-compliant)
  const { data: existingTypes = [] } = useQuery<string[]>({
    queryKey: ["/api/node-types"],
    enabled: isEditing,
  });

  useEffect(() => {
    setEditedNode(node);
    setIsEditing(false);
    setEditingProperties(new Set());
    setNewPropertyAdded(false);
  }, [node]);

  const updateNodeMutation = useMutation({
    mutationFn: async (updates: { label?: string; type?: string; data?: Record<string, any> }) => {
      try {
        const response = await apiRequest("PATCH", `/api/nodes/${node.id}`, updates);
        return await response.json();
      } catch (error) {
        console.error('Node update mutation error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Node Bijgewerkt",
        description: "De node gegevens zijn succesvol opgeslagen",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/graphs"] });
      setIsEditing(false);
      if (onNodeUpdate) {
        onNodeUpdate(node.id);
      }
    },
    onError: (error: Error) => {
      console.error('Node update error:', error);
      toast({
        title: "Update Fout",
        description: error.message || "Er is een fout opgetreden bij het bijwerken van de node",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    try {
      updateNodeMutation.mutate({
        label: editedNode.label,
        type: editedNode.type,
        data: editedNode.data,
      });
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: "Opslaan Fout",
        description: "Er is een fout opgetreden bij het opslaan",
        variant: "destructive",
      });
    }
  };

  const handleCancel = () => {
    setEditedNode(node);
    setIsEditing(false);
  };

  const handleAddProperty = () => {
    if (newPropertyKey.trim() && newPropertyValue.trim()) {
      setEditedNode(prev => ({
        ...prev,
        data: {
          [newPropertyKey]: newPropertyValue,
          ...prev.data
        }
      }));

      setNewPropertyKey("");
      setNewPropertyValue("");
      setNewPropertyAdded(true);
    }
  };

  const handleRemoveProperty = (key: string) => {
    setEditedNode(prev => ({
      ...prev,
      data: Object.fromEntries(
        Object.entries(prev.data).filter(([k]) => k !== key)
      )
    }));
  };

  const handlePropertyValueChange = (key: string, value: string) => {
    setEditedNode(prev => ({
      ...prev,
      data: {
        ...prev.data,
        [key]: value
      }
    }));
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Node Details</CardTitle>
          <Button
            onClick={() => setIsEditing(!isEditing)}
            variant="outline"
            size="sm"
            disabled={updateNodeMutation.isPending}
          >
            <Edit3 className="h-4 w-4 mr-1" />
            {isEditing ? "Annuleren" : "Bewerken"}
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Basic Info */}
        <div className="space-y-3">
          <div>
            <Label htmlFor="node-id">ID</Label>
            <Input
              id="node-id"
              value={node.id}
              disabled
              className="font-mono text-sm"
            />
          </div>

          <div>
            <Label htmlFor="node-label">Label</Label>
            <Input
              id="node-label"
              value={editedNode.label}
              onChange={(e) => setEditedNode(prev => ({ ...prev, label: e.target.value }))}
              disabled={!isEditing}
            />
          </div>

          <div>
            <Label htmlFor="node-type">RDF Type</Label>
            <div className="flex items-center space-x-2">
              <Input value={editedNode.type} disabled />
              <Badge variant="secondary">{editedNode.type}</Badge>
            </div>
          </div>

          <div>
            <Label>Positie</Label>
            <div className="flex space-x-2">
              <Input
                value={`X: ${Math.round(node.x)}`}
                disabled
                className="text-sm"
              />
              <Input
                value={`Y: ${Math.round(node.y)}`}
                disabled
                className="text-sm"
              />
            </div>
          </div>
        </div>

        {/* Properties */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-base font-medium">Eigenschappen</Label>
            <Badge variant="secondary" className="text-xs">
              {Object.keys(editedNode.data).length} eigenschappen
            </Badge>
          </div>

          <div className="space-y-3">
            {Object.entries(editedNode.data).map(([key, value]) => (
              <div key={key} className="border rounded-lg p-3 bg-gray-50 dark:bg-gray-800">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {key.includes('/') ? key.split('/').pop() || key : key}
                  </Label>
                  {isEditing && (
                    <Button
                      onClick={() => handleRemoveProperty(key)}
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="text-xs text-gray-500 font-mono bg-white dark:bg-gray-900 px-2 py-1 rounded border break-all">
                    {key}
                  </div>
                  <Input
                    placeholder="Waarde"
                    value={String(value)}
                    onChange={(e) => handlePropertyValueChange(key, e.target.value)}
                    disabled={!isEditing}
                    className="text-sm"
                  />
                </div>
              </div>
            ))}

            {Object.keys(editedNode.data).length === 0 && (
              <div className="text-center py-6 border-2 border-dashed border-gray-300 rounded-lg">
                <p className="text-sm text-gray-500 italic">
                  Geen eigenschappen gevonden
                </p>
                {isEditing && (
                  <p className="text-xs text-gray-400 mt-1">
                    Voeg hieronder een eigenschap toe
                  </p>
                )}
              </div>
            )}
          </div>

          {isEditing && (
            <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-blue-800 dark:text-blue-300">Eigenschap Toevoegen</Label>
                <Button
                  onClick={handleAddProperty}
                  variant="default"
                  size="sm"
                  disabled={!newPropertyKey.trim() || !newPropertyValue.trim()}
                  className="h-8"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Toevoegen
                </Button>
              </div>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-blue-700 dark:text-blue-300 mb-1 block">Eigenschap Type</Label>
                  <Select 
                    value={showCustomPropertyInput ? "custom" : newPropertyKey} 
                    onValueChange={(value) => {
                      if (value === "custom") {
                        setShowCustomPropertyInput(true);
                        setCustomPropertyKey("");
                        setNewPropertyKey("");
                      } else {
                        setShowCustomPropertyInput(false);
                        setNewPropertyKey(value);
                        setCustomPropertyKey("");
                      }
                    }}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Selecteer eigenschap type" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Infrastructure Ontology Properties - Full URIs */}
                      <SelectItem value="https://example.org/infrastructure/property/typeName">
                        <div className="flex flex-col">
                          <span className="font-medium">Infrastructure Type Name</span>
                          <span className="text-xs text-gray-500 font-mono">https://example.org/infrastructure/property/typeName</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="https://example.org/infrastructure/property/typeCode">
                        <div className="flex flex-col">
                          <span className="font-medium">Infrastructure Type Code</span>
                          <span className="text-xs text-gray-500 font-mono">https://example.org/infrastructure/property/typeCode</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="https://example.org/infrastructure/property/objectCode">
                        <div className="flex flex-col">
                          <span className="font-medium">Infrastructure Object Code</span>
                          <span className="text-xs text-gray-500 font-mono">https://example.org/infrastructure/property/objectCode</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="https://example.org/infrastructure/property/objectName">
                        <div className="flex flex-col">
                          <span className="font-medium">Infrastructure Object Name</span>
                          <span className="text-xs text-gray-500 font-mono">https://example.org/infrastructure/property/objectName</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="https://example.org/infrastructure/property/omschrijving">
                        <div className="flex flex-col">
                          <span className="font-medium">Omschrijving</span>
                          <span className="text-xs text-gray-500 font-mono">https://example.org/infrastructure/property/omschrijving</span>
                        </div>
                      </SelectItem>
                      {/* Building/Construction Properties */}
                      <SelectItem value="https://example.org/building/property/area">
                        <div className="flex flex-col">
                          <span className="font-medium">Area</span>
                          <span className="text-xs text-gray-500 font-mono">https://example.org/building/property/area</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="https://example.org/building/property/height">
                        <div className="flex flex-col">
                          <span className="font-medium">Height</span>
                          <span className="text-xs text-gray-500 font-mono">https://example.org/building/property/height</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="https://example.org/building/property/materialType">
                        <div className="flex flex-col">
                          <span className="font-medium">Material Type</span>
                          <span className="text-xs text-gray-500 font-mono">https://example.org/building/property/materialType</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="https://example.org/building/property/cost">
                        <div className="flex flex-col">
                          <span className="font-medium">Cost</span>
                          <span className="text-xs text-gray-500 font-mono">https://example.org/building/property/cost</span>
                        </div>
                      </SelectItem>
                      {/* Standard RDF Properties */}
                      <SelectItem value="http://www.w3.org/2000/01/rdf-schema#comment">
                        <div className="flex flex-col">
                          <span className="font-medium">Comment</span>
                          <span className="text-xs text-gray-500 font-mono">rdfs:comment</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="http://schema.org/description">
                        <div className="flex flex-col">
                          <span className="font-medium">Description</span>
                          <span className="text-xs text-gray-500 font-mono">schema:description</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="http://www.w3.org/2000/01/rdf-schema#label">
                        <div className="flex flex-col">
                          <span className="font-medium">Label</span>
                          <span className="text-xs text-gray-500 font-mono">rdfs:label</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="http://schema.org/name">
                        <div className="flex flex-col">
                          <span className="font-medium">Name</span>
                          <span className="text-xs text-gray-500 font-mono">schema:name</span>
                        </div>
                      </SelectItem>
                      <div className="border-t my-1"></div>
                      <SelectItem value="custom">+ Aangepaste eigenschap</SelectItem>
                    </SelectContent>
                  </Select>
                
                  {showCustomPropertyInput && (
                    <div className="space-y-2 p-2 bg-gray-50 rounded border mt-2">
                      <Label className="text-xs text-gray-700">Aangepaste Eigenschap</Label>
                      <Input
                        placeholder="Volledige URI (bijv. https://example.org/custom/property/myProperty)"
                        value={customPropertyKey}
                        onChange={(e) => setCustomPropertyKey(e.target.value)}
                        className="text-sm"
                      />
                      <div className="text-xs text-gray-600 mb-2">
                        <p>Voorbeelden:</p>
                        <ul className="list-disc list-inside font-mono text-xs">
                          <li>https://example.org/infrastructure/property/customField</li>
                          <li>https://example.org/building/property/newAttribute</li>
                          <li>http://purl.org/dc/terms/identifier</li>
                        </ul>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          onClick={() => {
                            if (customPropertyKey.trim()) {
                              let propertyKey = customPropertyKey.trim();
                              // Validate URI format
                              if (!propertyKey.startsWith('http://') && !propertyKey.startsWith('https://')) {
                                // Auto-expand common prefixes to full URIs
                                if (propertyKey.includes(':')) {
                                  const [prefix, localName] = propertyKey.split(':', 2);
                                  switch (prefix) {
                                    case 'rdfs':
                                      propertyKey = `http://www.w3.org/2000/01/rdf-schema#${localName}`;
                                      break;
                                    case 'schema':
                                      propertyKey = `http://schema.org/${localName}`;
                                      break;
                                    case 'dc':
                                      propertyKey = `http://purl.org/dc/terms/${localName}`;
                                      break;
                                    case 'property':
                                      propertyKey = `https://example.org/infrastructure/property/${localName}`;
                                      break;
                                    case 'building':
                                      propertyKey = `https://example.org/building/property/${localName}`;
                                      break;
                                    default:
                                      propertyKey = `https://example.org/custom/property/${localName}`;
                                  }
                                } else {
                                  propertyKey = `https://example.org/custom/property/${propertyKey}`;
                                }
                              }
                              setNewPropertyKey(propertyKey);
                              setShowCustomPropertyInput(false);
                              setCustomPropertyKey("");
                            }
                          }}
                          size="sm"
                          disabled={!customPropertyKey.trim()}
                        >
                          Gebruik
                        </Button>
                        <Button
                          onClick={() => {
                            setShowCustomPropertyInput(false);
                            setCustomPropertyKey("");
                          }}
                          variant="outline"
                          size="sm"
                        >
                          Annuleer
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                
                <div>
                  <Label className="text-xs text-blue-700 dark:text-blue-300 mb-1 block">Waarde</Label>
                  <Input
                    placeholder="Voer de waarde in"
                    value={newPropertyValue}
                    onChange={(e) => setNewPropertyValue(e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        {isEditing && (
          <div className="flex space-x-2 pt-3 border-t">
            <Button
              onClick={handleSave}
              disabled={updateNodeMutation.isPending}
              className="flex-1"
            >
              <Save className="h-4 w-4 mr-2" />
              {updateNodeMutation.isPending ? "Opslaan..." : "Opslaan"}
            </Button>
            <Button
              onClick={handleCancel}
              variant="outline"
              disabled={updateNodeMutation.isPending}
            >
              Annuleren
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}