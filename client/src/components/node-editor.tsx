import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Save, Plus, Trash2, Edit3 } from "lucide-react";
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
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    setEditedNode(node);
    setIsEditing(false);
  }, [node]);

  const updateNodeMutation = useMutation({
    mutationFn: async (updates: { label?: string; type?: string; data?: Record<string, any> }) => {
      // In een RDF-triple systeem zouden we hier de individuele triples updaten
      // Voor nu simuleren we dit door de positie bij te werken (wat al werkt)
      // TODO: Implementeer volledige node update via RDF triples
      
      const response = await apiRequest("PATCH", `/api/nodes/${node.id}`, updates);
      return response.json();
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
      toast({
        title: "Update Fout",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateNodeMutation.mutate({
      label: editedNode.label,
      type: editedNode.type,
      data: editedNode.data,
    });
  };

  const handleCancel = () => {
    setEditedNode(node);
    setIsEditing(false);
  };

  const handleAddProperty = () => {
    // If we have pending new property values, add them
    if (newPropertyKey.trim() && newPropertyValue.trim()) {
      setEditedNode(prev => ({
        ...prev,
        data: {
          ...prev.data,
          [newPropertyKey]: newPropertyValue
        }
      }));

      setNewPropertyKey("");
      setNewPropertyValue("");
      return;
    }

    // Otherwise add a default property to start editing
    const defaultKey = `eigenschap${Object.keys(editedNode.data).length + 1}`;
    setEditedNode(prev => ({
      ...prev,
      data: {
        ...prev.data,
        [defaultKey]: ""
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
            <Label htmlFor="node-type">Type</Label>
            {isEditing ? (
              <Select
                value={editedNode.type}
                onValueChange={(value) => setEditedNode(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Person">Persoon</SelectItem>
                  <SelectItem value="Organization">Organisatie</SelectItem>
                  <SelectItem value="Location">Locatie</SelectItem>
                  <SelectItem value="Concept">Concept</SelectItem>
                  <SelectItem value="Event">Gebeurtenis</SelectItem>
                  <SelectItem value="Document">Document</SelectItem>
                </SelectContent>
              </Select>
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
                  <Label htmlFor={`prop-${key}`} className="text-sm font-medium capitalize">
                    {key}
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
                <Input
                  id={`prop-${key}`}
                  value={String(value)}
                  onChange={(e) => handlePropertyValueChange(key, e.target.value)}
                  disabled={!isEditing}
                  className="text-sm"
                />
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
                <Input
                  placeholder="Eigenschap naam (bijv. leeftijd, stad)"
                  value={newPropertyKey}
                  onChange={(e) => setNewPropertyKey(e.target.value)}
                  className="text-sm"
                />
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