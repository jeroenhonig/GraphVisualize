import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Save, Edit3 } from "lucide-react";
import type { VisualizationEdge } from "@shared/schema";

interface EdgeEditorProps {
  edge: VisualizationEdge;
  sourceNodeLabel?: string;
  targetNodeLabel?: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function EdgeEditor({ 
  edge, 
  sourceNodeLabel = "Bron", 
  targetNodeLabel = "Doel",
  isOpen,
  onClose
}: EdgeEditorProps) {
  const [editedEdge, setEditedEdge] = useState({
    label: edge.label || "",
    type: edge.type || "https://example.org/infrastructure/relationship/relatedTo"
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateEdgeMutation = useMutation({
    mutationFn: async (updates: { label?: string; type?: string }) => {
      const response = await apiRequest("PATCH", `/api/edges/${edge.id}`, updates);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Relatie Bijgewerkt",
        description: "De relatie gegevens zijn succesvol opgeslagen",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/graphs"] });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Update Fout",
        description: error.message || "Er is een fout opgetreden bij het bijwerken van de relatie",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateEdgeMutation.mutate({
      label: editedEdge.label,
      type: editedEdge.type,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit3 className="h-5 w-5" />
            Relatie Bewerken
          </DialogTitle>
          <DialogDescription>
            Bewerk de eigenschappen van deze relatie tussen nodes.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Edge Info */}
          <div className="space-y-3">
            <div>
              <Label>ID</Label>
              <Input
                value={edge.id}
                disabled
                className="font-mono text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Van</Label>
                <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded border">
                  <span className="text-sm font-medium">{sourceNodeLabel}</span>
                  <div className="text-xs text-gray-500 font-mono break-all">{edge.source}</div>
                </div>
              </div>
              <div>
                <Label>Naar</Label>
                <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded border">
                  <span className="text-sm font-medium">{targetNodeLabel}</span>
                  <div className="text-xs text-gray-500 font-mono break-all">{edge.target}</div>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="edge-label">Label (optioneel)</Label>
              <Input
                id="edge-label"
                value={editedEdge.label}
                onChange={(e) => setEditedEdge(prev => ({ ...prev, label: e.target.value }))}
                placeholder="Beschrijving van de relatie..."
              />
            </div>

            <div>
              <Label htmlFor="edge-type">Relatie Type</Label>
              <Select 
                value={editedEdge.type} 
                onValueChange={(value) => setEditedEdge(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {/* Infrastructure Relationships */}
                  <SelectItem value="https://example.org/infrastructure/relationship/connectsTo">
                    <div className="flex flex-col">
                      <span className="font-medium">Connects To</span>
                      <span className="text-xs text-gray-500 font-mono">infrastructure:connectsTo</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="https://example.org/infrastructure/relationship/partOf">
                    <div className="flex flex-col">
                      <span className="font-medium">Part Of</span>
                      <span className="text-xs text-gray-500 font-mono">infrastructure:partOf</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="https://example.org/infrastructure/relationship/hasComponent">
                    <div className="flex flex-col">
                      <span className="font-medium">Has Component</span>
                      <span className="text-xs text-gray-500 font-mono">infrastructure:hasComponent</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="https://example.org/infrastructure/relationship/adjacentTo">
                    <div className="flex flex-col">
                      <span className="font-medium">Adjacent To</span>
                      <span className="text-xs text-gray-500 font-mono">infrastructure:adjacentTo</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="https://example.org/infrastructure/relationship/relatedTo">
                    <div className="flex flex-col">
                      <span className="font-medium">Related To</span>
                      <span className="text-xs text-gray-500 font-mono">infrastructure:relatedTo</span>
                    </div>
                  </SelectItem>
                  
                  {/* Building Relationships */}
                  <SelectItem value="https://example.org/building/relationship/supportedBy">
                    <div className="flex flex-col">
                      <span className="font-medium">Supported By</span>
                      <span className="text-xs text-gray-500 font-mono">building:supportedBy</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="https://example.org/building/relationship/contains">
                    <div className="flex flex-col">
                      <span className="font-medium">Contains</span>
                      <span className="text-xs text-gray-500 font-mono">building:contains</span>
                    </div>
                  </SelectItem>
                  
                  {/* Standard RDF Relationships */}
                  <SelectItem value="http://www.w3.org/2000/01/rdf-schema#subClassOf">
                    <div className="flex flex-col">
                      <span className="font-medium">Subclass Of</span>
                      <span className="text-xs text-gray-500 font-mono">rdfs:subClassOf</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="http://www.w3.org/1999/02/22-rdf-syntax-ns#type">
                    <div className="flex flex-col">
                      <span className="font-medium">Type</span>
                      <span className="text-xs text-gray-500 font-mono">rdf:type</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="http://www.w3.org/2002/07/owl#sameAs">
                    <div className="flex flex-col">
                      <span className="font-medium">Same As</span>
                      <span className="text-xs text-gray-500 font-mono">owl:sameAs</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Huidige Type</Label>
              <div className="flex items-center space-x-2">
                <Badge variant="secondary" className="font-mono text-xs">
                  {editedEdge.type}
                </Badge>
              </div>
            </div>
          </div>

          {/* Properties from edge.data if any */}
          {edge.data && Object.keys(edge.data).length > 0 && (
            <div className="space-y-3">
              <Label className="text-base font-medium">Eigenschappen</Label>
              <div className="space-y-2">
                {Object.entries(edge.data).map(([key, value]) => (
                  <div key={key} className="border rounded-lg p-3 bg-gray-50 dark:bg-gray-800">
                    <div className="text-xs text-gray-500 font-mono bg-white dark:bg-gray-900 px-2 py-1 rounded border break-all mb-2">
                      {key}
                    </div>
                    <div className="text-sm">
                      {String(value)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex space-x-2 pt-3 border-t">
            <Button
              onClick={handleSave}
              disabled={updateEdgeMutation.isPending}
              className="flex-1"
            >
              <Save className="h-4 w-4 mr-2" />
              {updateEdgeMutation.isPending ? "Opslaan..." : "Opslaan"}
            </Button>
            <Button
              onClick={onClose}
              variant="outline"
              disabled={updateEdgeMutation.isPending}
            >
              Annuleren
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}