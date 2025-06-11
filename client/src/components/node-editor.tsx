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
    // Add the new property and mark it as newly added
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
      return;
    }
  };

  const handleEditProperty = (key: string) => {
    setEditingProperties(prev => new Set([...prev, key]));
  };

  const handleSaveProperty = (key: string) => {
    setEditingProperties(prev => {
      const newSet = new Set(prev);
      newSet.delete(key);
      return newSet;
    });
  };

  const handleCancelPropertyEdit = (key: string) => {
    setEditingProperties(prev => {
      const newSet = new Set(prev);
      newSet.delete(key);
      return newSet;
    });
    // Reset to original value
    setEditedNode(prev => ({
      ...prev,
      data: {
        ...prev.data,
        [key]: node.data[key]
      }
    }));
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

  const handlePropertyKeyChange = (oldKey: string, newKey: string) => {
    if (newKey === oldKey) return;
    
    setEditedNode(prev => {
      const newData = { ...prev.data };
      const value = newData[oldKey];
      delete newData[oldKey];
      newData[newKey] = value;
      return {
        ...prev,
        data: newData
      };
    });
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
            {isEditing ? (
              <div className="space-y-2">
                <Select
                  value={showCustomTypeInput ? "custom" : editedNode.type}
                  onValueChange={(value) => {
                    if (value === "custom") {
                      setShowCustomTypeInput(true);
                      setCustomType("");
                    } else {
                      setShowCustomTypeInput(false);
                      setEditedNode(prev => ({ ...prev, type: value }));
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecteer een RDF type" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Existing types from dataset */}
                    {existingTypes.length > 0 && existingTypes
                      .sort((a, b) => {
                        const aDisplay = a.includes(':') ? a.split(':')[1] : a;
                        const bDisplay = b.includes(':') ? b.split(':')[1] : b;
                        return aDisplay.localeCompare(bDisplay);
                      })
                      .map((type: string) => (
                        <SelectItem key={type} value={type}>
                          {type.includes(':') ? type.split(':')[1] : type}
                        </SelectItem>
                      ))}
                    {/* Separator if we have existing types */}
                    {existingTypes.length > 0 && <div className="border-t my-1"></div>}
                    {/* Common RDF types - alphabetically sorted */}
                    <SelectItem value="building:Building">building:Building</SelectItem>
                    <SelectItem value="doc:Document">doc:Document</SelectItem>
                    <SelectItem value="building:Element">building:Element</SelectItem>
                    <SelectItem value="building:Facade">building:Facade</SelectItem>
                    <SelectItem value="building:Foundation">building:Foundation</SelectItem>
                    <SelectItem value="material:Material">material:Material</SelectItem>
                    <SelectItem value="schema:Organization">schema:Organization</SelectItem>
                    <SelectItem value="schema:Person">schema:Person</SelectItem>
                    <SelectItem value="schema:Place">schema:Place</SelectItem>
                    <SelectItem value="building:Structure">building:Structure</SelectItem>
                    <div className="border-t my-1"></div>
                    <SelectItem value="custom">+ Nieuw type aanmaken</SelectItem>
                  </SelectContent>
                </Select>
                
                {showCustomTypeInput && (
                  <div className="space-y-2 p-3 bg-blue-50 rounded border border-blue-200">
                    <Label className="text-sm font-medium text-blue-800">Nieuw RDF Type</Label>
                    <div className="text-xs text-blue-600 mb-2">
                      Voer een RDF type in met namespace:prefix formaat (bijv. building:NewType)
                    </div>
                    <Input
                      placeholder="namespace:TypeNaam (bijv. building:MyNewType)"
                      value={customType}
                      onChange={(e) => setCustomType(e.target.value)}
                      className="text-sm"
                    />
                    <div className="flex space-x-2">
                      <Button
                        onClick={() => {
                          if (customType.trim()) {
                            // Ensure proper namespace format
                            let rdfType = customType.trim();
                            if (!rdfType.includes(':')) {
                              rdfType = `custom:${rdfType}`;
                            }
                            setEditedNode(prev => ({ ...prev, type: rdfType }));
                            setShowCustomTypeInput(false);
                            setCustomType("");
                          }
                        }}
                        size="sm"
                        disabled={!customType.trim()}
                      >
                        Toevoegen
                      </Button>
                      <Button
                        onClick={() => {
                          setShowCustomTypeInput(false);
                          setCustomType("");
                        }}
                        variant="outline"
                        size="sm"
                      >
                        Annuleren
                      </Button>
                    </div>
                    <p className="text-xs text-blue-600">
                      Tip: Gebruik namespace prefixen zoals "building:", "element:", "schema:" etc.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Input value={editedNode.type} disabled />
                <Badge variant="secondary">{editedNode.type}</Badge>
              </div>
            )}
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
            {isEditing && (
              <Button
                onClick={handleAddProperty}
                variant="outline"
                size="sm"
                className="h-7 px-2"
              >
                <Plus className="h-3 w-3 mr-1" />
                Toevoegen
              </Button>
            )}
          </div>

          <div className="space-y-3">
            {Object.entries(editedNode.data).map(([key, value]) => (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Eigenschap</Label>
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
                  <div className="text-xs text-gray-600 font-mono bg-gray-100 px-2 py-1 rounded">
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
              <p className="text-sm text-gray-500 italic">
                Geen eigenschappen. {isEditing && "Klik op 'Toevoegen' om een eigenschap toe te voegen."}
              </p>
            )}
          </div>

          {isEditing && (
            <div className="space-y-2 p-3 bg-blue-50 rounded border border-blue-200">
              <Label className="text-sm font-medium text-blue-800">Nieuwe Eigenschap</Label>
              <div className="space-y-2">
                <Select 
                  value={showCustomPropertyInput ? "custom" : newPropertyKey} 
                  onValueChange={(value) => {
                    if (value === "custom") {
                      setShowCustomPropertyInput(true);
                      setCustomPropertyKey("");
                    } else {
                      setShowCustomPropertyInput(false);
                      setNewPropertyKey(value);
                    }
                  }}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Selecteer eigenschap type" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Building/Construction Properties - alphabetically sorted */}
                    <SelectItem value="property:acousticRating">Acoustic Rating</SelectItem>
                    <SelectItem value="property:area">Area</SelectItem>
                    <SelectItem value="property:columnSpacing">Column Spacing</SelectItem>
                    <SelectItem value="property:cost">Cost</SelectItem>
                    <SelectItem value="property:facadeArea">Facade Area</SelectItem>
                    <SelectItem value="property:fireRating">Fire Rating</SelectItem>
                    <SelectItem value="property:foundationDepth">Foundation Depth</SelectItem>
                    <SelectItem value="property:height">Height</SelectItem>
                    <SelectItem value="property:installationDate">Installation Date</SelectItem>
                    <SelectItem value="property:length">Length</SelectItem>
                    <SelectItem value="property:loadCapacity">Load Capacity</SelectItem>
                    <SelectItem value="property:maintenanceSchedule">Maintenance Schedule</SelectItem>
                    <SelectItem value="property:manufacturer">Manufacturer</SelectItem>
                    <SelectItem value="property:materialStrength">Material Strength</SelectItem>
                    <SelectItem value="property:materialType">Material Type</SelectItem>
                    <SelectItem value="property:modelNumber">Model Number</SelectItem>
                    <SelectItem value="property:numberOfPiles">Number of Piles</SelectItem>
                    <SelectItem value="property:pileType">Pile Type</SelectItem>
                    <SelectItem value="property:structuralSystem">Structural System</SelectItem>
                    <SelectItem value="property:supplier">Supplier</SelectItem>
                    <SelectItem value="property:thermalResistance">Thermal Resistance</SelectItem>
                    <SelectItem value="property:volume">Volume</SelectItem>
                    <SelectItem value="property:warranty">Warranty</SelectItem>
                    <SelectItem value="property:weight">Weight</SelectItem>
                    <SelectItem value="property:width">Width</SelectItem>
                    {/* Generic Properties - alphabetically sorted */}
                    <SelectItem value="rdfs:comment">Comment</SelectItem>
                    <SelectItem value="schema:description">Description</SelectItem>
                    <SelectItem value="schema:identifier">Identifier</SelectItem>
                    <SelectItem value="rdfs:label">Label</SelectItem>
                    <SelectItem value="schema:name">Name</SelectItem>
                    <SelectItem value="schema:url">URL</SelectItem>
                    <div className="border-t my-1"></div>
                    <SelectItem value="custom">+ Aangepaste eigenschap</SelectItem>
                  </SelectContent>
                </Select>
                
                {showCustomPropertyInput && (
                  <div className="space-y-2 p-2 bg-gray-50 rounded border">
                    <Label className="text-xs text-gray-700">Aangepaste Eigenschap</Label>
                    <Input
                      placeholder="namespace:propertyName (bijv. property:customField)"
                      value={customPropertyKey}
                      onChange={(e) => setCustomPropertyKey(e.target.value)}
                      className="text-sm"
                    />
                    <div className="flex space-x-2">
                      <Button
                        onClick={() => {
                          if (customPropertyKey.trim()) {
                            let propertyKey = customPropertyKey.trim();
                            if (!propertyKey.includes(':')) {
                              propertyKey = `property:${propertyKey}`;
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
                
                <Input
                  placeholder="Waarde"
                  value={newPropertyValue}
                  onChange={(e) => setNewPropertyValue(e.target.value)}
                  className="text-sm"
                />
                <Button
                  onClick={handleAddProperty}
                  size="sm"
                  className="w-full"
                  disabled={!newPropertyKey.trim() || !newPropertyValue.trim()}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Eigenschap Toevoegen
                </Button>
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