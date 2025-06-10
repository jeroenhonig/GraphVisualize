import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { GraphTransform } from "@/lib/graph-utils";

interface SaveViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  graphId: string;
  visibleNodeIds: string[];
  transform: GraphTransform;
  nodePositions: Record<string, { x: number; y: number }>;
}

export default function SaveViewDialog({
  open,
  onOpenChange,
  graphId,
  visibleNodeIds,
  transform,
  nodePositions
}: SaveViewDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Generate SPARQL query based on current view state
  const generateSparqlQuery = (): string => {
    if (visibleNodeIds.length === 0) {
      return "SELECT ?subject WHERE { ?subject rdf:type graph:Node . }";
    }

    // Create a basic SPARQL query that would return the visible nodes
    const nodeFilters = visibleNodeIds.map(id => `"${id}"`).join(" ");
    return `SELECT ?subject WHERE { 
      ?subject rdf:type graph:Node . 
      FILTER (?subject IN (${nodeFilters}))
    }`;
  };

  const saveViewMutation = useMutation({
    mutationFn: async () => {
      const sparqlQuery = generateSparqlQuery();
      
      return await apiRequest("POST", `/api/graphs/${graphId}/saved-views`, {
        name,
        description,
        sparqlQuery,
        visibleNodeIds,
        transform: JSON.stringify(transform),
        nodePositions: JSON.stringify(nodePositions)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/graphs", graphId, "saved-views"] });
      toast({
        title: "View opgeslagen",
        description: `View "${name}" is succesvol opgeslagen`,
      });
      setName("");
      setDescription("");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Fout",
        description: "Kon view niet opslaan",
        variant: "destructive",
      });
    }
  });

  const handleSave = () => {
    if (!name.trim()) {
      toast({
        title: "Fout",
        description: "Voer een naam in voor de view",
        variant: "destructive",
      });
      return;
    }
    saveViewMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>View Opslaan</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="viewName">View Naam</Label>
            <Input
              id="viewName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Voer een naam in voor deze view..."
            />
          </div>
          <div>
            <Label htmlFor="viewDescription">Beschrijving (optioneel)</Label>
            <Textarea
              id="viewDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Beschrijf wat deze view toont..."
              rows={3}
            />
          </div>
          <div className="bg-gray-50 p-3 rounded text-sm">
            <div className="font-medium mb-2">View Details:</div>
            <div>• {visibleNodeIds.length} zichtbare nodes</div>
            <div>• Camera positie en zoom: {transform.scale.toFixed(2)}x</div>
            <div>• Node posities worden opgeslagen</div>
            <div>• SPARQL query wordt automatisch gegenereerd</div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annuleren
            </Button>
            <Button onClick={handleSave} disabled={saveViewMutation.isPending}>
              {saveViewMutation.isPending ? "Opslaan..." : "View Opslaan"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}