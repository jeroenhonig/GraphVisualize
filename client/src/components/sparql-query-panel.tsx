import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Play, Save, Eye } from "lucide-react";

interface SparqlQueryPanelProps {
  graphId: string;
  onVisibilityChange: (visibleNodeIds: string[]) => void;
  visibleNodeIds?: string[];
}

export default function SparqlQueryPanel({ graphId, onVisibilityChange, visibleNodeIds = [] }: SparqlQueryPanelProps) {
  const [currentQuery, setCurrentQuery] = useState("");
  const [queryName, setQueryName] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Preset SPARQL queries
  const presetQueries = [
    {
      id: "all",
      name: "Alle Knopen",
      query: "SELECT * WHERE { ?node ?predicate ?object }",
    },
    {
      id: "typed",
      name: "Getypeerde Knopen",
      query: "SELECT ?node WHERE { ?node rdf:type ?type }",
    },
    {
      id: "persons",
      name: "Personen",
      query: "SELECT ?node WHERE { ?node rdf:type Person }",
    },
    {
      id: "organizations",
      name: "Organisaties",
      query: "SELECT ?node WHERE { ?node rdf:type Organization }",
    },
    {
      id: "with_name",
      name: "Met Naam Property",
      query: 'SELECT ?node WHERE { ?node hasProperty "name" }',
    },
  ];

  // Fetch visibility sets for this graph
  const { data: visibilitySets = [] } = useQuery({
    queryKey: ["/api/graphs", graphId, "visibility-sets"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/graphs/${graphId}/visibility-sets`);
      return res.json();
    },
  });

  // Execute SPARQL query mutation
  const executeSparqlMutation = useMutation({
    mutationFn: async (query: string) => {
      const res = await apiRequest("POST", `/api/graphs/${graphId}/sparql`, { query });
      return res.json();
    },
    onSuccess: (data) => {
      onVisibilityChange(data.visibleNodeIds);
      toast({
        title: "SPARQL Query Uitgevoerd",
        description: `${data.visibleNodeIds.length} knopen zichtbaar gemaakt`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "SPARQL Fout",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Save visibility set mutation
  const saveVisibilitySetMutation = useMutation({
    mutationFn: async ({ name, sparqlQuery }: { name: string; sparqlQuery: string }) => {
      const res = await apiRequest("POST", `/api/graphs/${graphId}/visibility-sets`, {
        name,
        sparqlQuery,
        isActive: "false",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/graphs", graphId, "visibility-sets"] });
      setQueryName("");
      toast({
        title: "Zichtbaarheidsset Opgeslagen",
        description: "De SPARQL query is opgeslagen als herbruikbare set",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Fout bij Opslaan",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Activate visibility set mutation
  const activateVisibilitySetMutation = useMutation({
    mutationFn: async (setId: string) => {
      const res = await apiRequest("POST", `/api/graphs/${graphId}/visibility-sets/${setId}/activate`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/graphs", graphId, "visibility-sets"] });
      toast({
        title: "Zichtbaarheidsset Geactiveerd",
        description: "De geselecteerde set is nu actief",
      });
    },
  });

  const handleExecuteQuery = () => {
    if (!currentQuery.trim()) {
      toast({
        title: "Lege Query",
        description: "Voer een SPARQL query in",
        variant: "destructive",
      });
      return;
    }
    executeSparqlMutation.mutate(currentQuery);
  };

  const generateQueryFromView = () => {
    if (visibleNodeIds.length === 0) {
      toast({
        title: "Geen Nodes Zichtbaar",
        description: "Er zijn geen nodes zichtbaar om een query van te genereren",
        variant: "destructive",
      });
      return;
    }

    // Generate SPARQL query that selects the currently visible nodes
    const nodeFilters = visibleNodeIds.map(nodeId => `"${nodeId}"`).join(", ");
    const generatedQuery = `SELECT ?node ?property ?value WHERE {
  ?node ?property ?value .
  FILTER(?node IN (${nodeFilters}))
}
ORDER BY ?node ?property`;

    setCurrentQuery(generatedQuery);
    setQueryName(`View Query - ${new Date().toLocaleString("nl-NL", { 
      year: "numeric", 
      month: "2-digit", 
      day: "2-digit", 
      hour: "2-digit", 
      minute: "2-digit" 
    })}`);

    toast({
      title: "Query Gegenereerd",
      description: `SPARQL query gegenereerd voor ${visibleNodeIds.length} zichtbare nodes`,
    });
  };

  const handleSaveQuery = () => {
    if (!queryName.trim() || !currentQuery.trim()) {
      toast({
        title: "Onvolledige Gegevens",
        description: "Voer zowel een naam als een query in",
        variant: "destructive",
      });
      return;
    }
    saveVisibilitySetMutation.mutate({
      name: queryName,
      sparqlQuery: currentQuery,
    });
  };

  const handlePresetSelect = (presetId: string) => {
    const preset = presetQueries.find(p => p.id === presetId);
    if (preset) {
      setCurrentQuery(preset.query);
      setSelectedPreset(presetId);
    }
  };

  const handleActivateSet = (setId: string) => {
    activateVisibilitySetMutation.mutate(setId);
  };

  return (
    <div className="space-y-4">
      {/* Preset Queries */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">SPARQL Presets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value={selectedPreset} onValueChange={handlePresetSelect}>
            <SelectTrigger>
              <SelectValue placeholder="Kies een preset query..." />
            </SelectTrigger>
            <SelectContent>
              {presetQueries.map((preset) => (
                <SelectItem key={preset.id} value={preset.id}>
                  {preset.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Query Editor */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">SPARQL Query Editor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="sparql-query">Query</Label>
            <Textarea
              id="sparql-query"
              value={currentQuery}
              onChange={(e) => setCurrentQuery(e.target.value)}
              placeholder="SELECT ?node WHERE { ?node rdf:type ?type }"
              rows={4}
              className="font-mono text-sm"
            />
          </div>
          
          <div className="flex flex-col space-y-2">
            <Button 
              onClick={generateQueryFromView}
              variant="secondary"
              size="sm"
              className="w-full"
            >
              <Eye className="h-4 w-4 mr-1" />
              Genereer Query van Huidige View ({visibleNodeIds.length} nodes)
            </Button>
            
            <div className="flex space-x-2">
              <Button 
                onClick={handleExecuteQuery}
                disabled={executeSparqlMutation.isPending}
                size="sm"
                className="flex-1"
              >
                <Play className="h-4 w-4 mr-1" />
                {executeSparqlMutation.isPending ? "Uitvoeren..." : "Uitvoeren"}
              </Button>
              
              <Button 
                onClick={handleSaveQuery}
                disabled={saveVisibilitySetMutation.isPending}
                variant="outline"
                size="sm"
              >
                <Save className="h-4 w-4 mr-1" />
                Opslaan
              </Button>
            </div>
          </div>

          <div>
            <Label htmlFor="query-name">Naam voor Opslaan</Label>
            <Input
              id="query-name"
              value={queryName}
              onChange={(e) => setQueryName(e.target.value)}
              placeholder="Mijn custom query..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Saved Visibility Sets */}
      {visibilitySets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Opgeslagen Zichtbaarheidssets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {visibilitySets.map((set: any) => (
              <div key={set.setId} className="flex items-center justify-between p-2 border rounded">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium">{set.name}</span>
                    {set.isActive === 'true' && (
                      <Badge variant="default" className="text-xs">
                        Actief
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1 font-mono">
                    {set.sparqlQuery.substring(0, 50)}...
                  </p>
                </div>
                
                <Button
                  onClick={() => handleActivateSet(set.setId)}
                  disabled={activateVisibilitySetMutation.isPending || set.isActive === 'true'}
                  size="sm"
                  variant="outline"
                >
                  <Eye className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* SPARQL Help */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">SPARQL Hulp</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-gray-600 space-y-2">
          <div>
            <strong>Basis patronen:</strong>
            <ul className="mt-1 space-y-1 ml-3">
              <li>• <code>?node rdf:type Person</code> - Alle personen</li>
              <li>• <code>?node hasProperty "name"</code> - Nodes met naam property</li>
              <li>• <code>SELECT *</code> - Alle nodes tonen</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}