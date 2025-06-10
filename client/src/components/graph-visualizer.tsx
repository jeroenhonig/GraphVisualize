import { useState } from "react";
import GraphSidebar from "./graph-sidebar";
import GraphCanvas from "./graph-canvas";
import SparqlQueryPanel from "./sparql-query-panel";
import GraphStatistics from "./graph-statistics";
import FileUpload from "./file-upload";
import GraphCreator from "./graph-creator";
import SaveViewDialog from "./save-view-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RotateCcw, Download, Settings, Maximize, Search, Upload, FileText, BarChart3, Database, Network, TrendingUp, ChevronDown, ChevronRight, Save, Eye, Trash2 } from "lucide-react";
import { useGraph } from "@/hooks/use-graph";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function GraphVisualizer() {
  const {
    currentGraph,
    selectedNode,
    setSelectedNode,
    transform,
    setTransform,
    visibleNodes,
    setVisibleNodes,
    expandNode,
    collapseNode,
    resetView,
    fitToScreen
  } = useGraph();

  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState("png");
  const [exportQuality, setExportQuality] = useState("standard");
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [analyticsModalOpen, setAnalyticsModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [expandedTreeItems, setExpandedTreeItems] = useState<Set<string>>(new Set(['nodes', 'relations', 'saved-views']));
  const [saveViewDialogOpen, setSaveViewDialogOpen] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch saved views for current graph
  const { data: savedViews = [] } = useQuery({
    queryKey: ["/api/graphs", currentGraph?.graphId, "saved-views"],
    queryFn: async () => {
      if (!currentGraph?.graphId) return [];
      const response = await apiRequest("GET", `/api/graphs/${currentGraph.graphId}/saved-views`);
      return response.json();
    },
    enabled: !!currentGraph?.graphId
  });

  // Apply saved view mutation
  const applySavedViewMutation = useMutation({
    mutationFn: async (viewId: string) => {
      const response = await apiRequest("POST", `/api/saved-views/${viewId}/apply`);
      return response.json();
    },
    onSuccess: (viewData) => {
      setVisibleNodes(new Set(viewData.visibleNodeIds));
      setTransform(viewData.transform);
      // Apply node positions if available
      if (viewData.nodePositions && Object.keys(viewData.nodePositions).length > 0) {
        // Node positions would be applied through the graph canvas component
      }
      toast({
        title: "View toegepast",
        description: "Opgeslagen view is succesvol geladen",
      });
    },
    onError: () => {
      toast({
        title: "Fout",
        description: "Kon opgeslagen view niet laden",
        variant: "destructive",
      });
    }
  });

  // Delete saved view mutation
  const deleteSavedViewMutation = useMutation({
    mutationFn: async (viewId: string) => {
      const response = await apiRequest("DELETE", `/api/saved-views/${viewId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/graphs", currentGraph?.graphId, "saved-views"] });
      toast({
        title: "View verwijderd",
        description: "Opgeslagen view is verwijderd",
      });
    },
    onError: () => {
      toast({
        title: "Fout",
        description: "Kon view niet verwijderen",
        variant: "destructive",
      });
    }
  });

  const toggleTreeItem = (itemId: string) => {
    setExpandedTreeItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };



  const handleExport = () => {
    // Implementation would depend on the selected format
    console.log(`Exporting as ${exportFormat} with ${exportQuality} quality`);
    setExportModalOpen(false);
  };

  return (
    <div className="h-screen bg-gray-50 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 fixed w-full top-0 z-40">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-semibold text-gray-900">Graph Visualizer</h1>
            <span className="text-sm text-gray-500 font-mono">v1.0.0</span>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Import/Export/Analytics Section */}
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                onClick={() => setImportModalOpen(true)}
                className="px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              >
                <Upload className="h-4 w-4 mr-2" />
                Importeren
              </Button>
              <Button
                variant="ghost"
                onClick={() => setSaveViewDialogOpen(true)}
                className="px-4 py-2 text-purple-600 hover:text-purple-900 hover:bg-purple-50"
                disabled={!currentGraph}
                title="Huidige view opslaan"
              >
                <Save className="h-4 w-4 mr-2" />
                View Opslaan
              </Button>
              <Button
                variant="ghost"
                onClick={() => setExportModalOpen(true)}
                className="px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              >
                <Download className="h-4 w-4 mr-2" />
                Exporteren
              </Button>
              <Button
                variant="ghost"
                onClick={() => setAnalyticsModalOpen(true)}
                className="px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Analytics
              </Button>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex h-screen pt-16">
        {/* Sidebar with Tabs */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
          <Tabs defaultValue="tree" className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-2 mx-4 mt-4">
              <TabsTrigger value="tree">
                <Network className="h-4 w-4 mr-2" />
                Tree View
              </TabsTrigger>
              <TabsTrigger value="sparql">
                <Search className="h-4 w-4 mr-2" />
                SPARQL
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="tree" className="flex-1 overflow-hidden">
              <div className="p-4 space-y-2">
                {/* Nodes Section */}
                <div>
                  <button
                    onClick={() => toggleTreeItem('nodes')}
                    className="flex items-center w-full p-2 text-left hover:bg-gray-50 rounded"
                  >
                    {expandedTreeItems.has('nodes') ? (
                      <ChevronDown className="h-4 w-4 mr-2" />
                    ) : (
                      <ChevronRight className="h-4 w-4 mr-2" />
                    )}
                    <Network className="h-4 w-4 mr-2 text-blue-600" />
                    <span className="font-medium">Nodes</span>
                    {currentGraph && (
                      <span className="ml-auto text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        {currentGraph.nodeCount}
                      </span>
                    )}
                  </button>
                  
                  {expandedTreeItems.has('nodes') && currentGraph && (
                    <div className="ml-6 mt-2 space-y-1">
                      {Array.from(new Set(currentGraph.nodes.map((n: any) => n.type))).map((type: string) => (
                        <div
                          key={type}
                          className="flex items-center justify-between p-2 text-sm hover:bg-gray-50 rounded cursor-pointer"
                          onClick={() => {
                            // Filter nodes by type
                            const nodesOfType = currentGraph.nodes.filter((n: any) => n.type === type);
                            setVisibleNodes(new Set(nodesOfType.map((n: any) => n.id)));
                          }}
                        >
                          <div className="flex items-center">
                            <div className="w-3 h-3 bg-blue-500 rounded mr-2"></div>
                            <span>{type}</span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {currentGraph.nodes.filter((n: any) => n.type === type).length}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Relations Section */}
                <div>
                  <button
                    onClick={() => toggleTreeItem('relations')}
                    className="flex items-center w-full p-2 text-left hover:bg-gray-50 rounded"
                  >
                    {expandedTreeItems.has('relations') ? (
                      <ChevronDown className="h-4 w-4 mr-2" />
                    ) : (
                      <ChevronRight className="h-4 w-4 mr-2" />
                    )}
                    <Network className="h-4 w-4 mr-2 text-green-600" />
                    <span className="font-medium">Relations</span>
                    {currentGraph && (
                      <span className="ml-auto text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        {currentGraph.edgeCount}
                      </span>
                    )}
                  </button>
                  
                  {expandedTreeItems.has('relations') && currentGraph && (
                    <div className="ml-6 mt-2 space-y-1">
                      {Array.from(new Set(currentGraph.edges.map((e: any) => e.type))).map((type: string) => (
                        <div
                          key={type}
                          className="flex items-center justify-between p-2 text-sm hover:bg-gray-50 rounded cursor-pointer"
                          onClick={() => {
                            // Show all nodes that are connected by this relation type
                            const edgesOfType = currentGraph.edges.filter((e: any) => e.type === type);
                            const connectedNodeIds = new Set<string>();
                            edgesOfType.forEach((edge: any) => {
                              connectedNodeIds.add(edge.source);
                              connectedNodeIds.add(edge.target);
                            });
                            setVisibleNodes(connectedNodeIds);
                          }}
                        >
                          <div className="flex items-center">
                            <div className="w-3 h-3 bg-green-500 rounded mr-2"></div>
                            <span>{type}</span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {currentGraph.edges.filter((e: any) => e.type === type).length}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Saved Views Section */}
                <div>
                  <button
                    onClick={() => toggleTreeItem('saved-views')}
                    className="flex items-center w-full p-2 text-left hover:bg-gray-50 rounded"
                  >
                    {expandedTreeItems.has('saved-views') ? (
                      <ChevronDown className="h-4 w-4 mr-2" />
                    ) : (
                      <ChevronRight className="h-4 w-4 mr-2" />
                    )}
                    <Save className="h-4 w-4 mr-2 text-purple-600" />
                    <span className="font-medium">Opgeslagen Views</span>
                    <span className="ml-auto text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      {savedViews.length}
                    </span>
                  </button>
                  
                  {expandedTreeItems.has('saved-views') && (
                    <div className="ml-6 mt-2 space-y-1">
                      {/* Save Current View Button */}
                      <button
                        onClick={() => setSaveViewDialogOpen(true)}
                        className="flex items-center w-full p-2 text-sm text-blue-600 hover:bg-blue-50 rounded border border-blue-200 border-dashed"
                        disabled={!currentGraph}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Huidige View Opslaan
                      </button>
                      
                      {/* Saved Views List */}
                      {savedViews.map((view: any) => (
                        <div
                          key={view.viewId}
                          className="flex items-center justify-between p-2 text-sm hover:bg-gray-50 rounded group"
                        >
                          <div className="flex items-center min-w-0 flex-1">
                            <div className="w-3 h-3 bg-purple-500 rounded mr-2 flex-shrink-0"></div>
                            <div className="min-w-0 flex-1">
                              <div className="font-medium truncate">{view.name}</div>
                              {view.description && (
                                <div className="text-xs text-gray-500 truncate">{view.description}</div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => applySavedViewMutation.mutate(view.viewId)}
                              className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                              title="View toepassen"
                              disabled={applySavedViewMutation.isPending}
                            >
                              <Eye className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => deleteSavedViewMutation.mutate(view.viewId)}
                              className="p-1 text-red-600 hover:bg-red-100 rounded"
                              title="View verwijderen"
                              disabled={deleteSavedViewMutation.isPending}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                      
                      {savedViews.length === 0 && (
                        <div className="text-xs text-gray-500 p-2 text-center">
                          Geen opgeslagen views
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Selected Node Details */}
              {selectedNode && (
                <div className="border-t p-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Selected Node</h3>
                  <div className="bg-gray-50 rounded p-3">
                    <div className="flex items-center mb-2">
                      <div className="w-4 h-4 bg-blue-500 rounded mr-2"></div>
                      <span className="font-medium">{selectedNode.label}</span>
                    </div>
                    <div className="text-xs text-gray-600">
                      <div>Type: {selectedNode.type}</div>
                      <div>ID: {selectedNode.id}</div>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="sparql" className="flex-1 overflow-hidden p-4">
              {currentGraph && (
                <SparqlQueryPanel
                  graphId={currentGraph.graphId}
                  onVisibilityChange={(visibleNodeIds) => {
                    setVisibleNodes(new Set(visibleNodeIds));
                  }}
                />
              )}
            </TabsContent>
            

          </Tabs>
        </div>

        {/* Main Graph Area */}
        <div className="flex-1 relative bg-graph-background">
          <GraphCanvas
            graph={currentGraph}
            selectedNode={selectedNode}
            onNodeSelect={setSelectedNode}
            onNodeExpand={expandNode}
            visibleNodes={visibleNodes}
            onVisibleNodesChange={setVisibleNodes}
            transform={transform}
            onTransformChange={setTransform}
            editMode={editMode}
          />

          {/* Graph Controls Overlay */}
          <div className="absolute bottom-6 right-6 flex flex-col space-y-2">
            <Button
              onClick={resetView}
              className="p-3 bg-white shadow-lg rounded-lg hover:shadow-xl transition-shadow text-gray-600 hover:text-gray-900"
              size="sm"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              onClick={fitToScreen}
              className="p-3 bg-white shadow-lg rounded-lg hover:shadow-xl transition-shadow text-gray-600 hover:text-gray-900"
              size="sm"
            >
              <Maximize className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Import Modal */}
      <Dialog open={importModalOpen} onOpenChange={setImportModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Data Importeren of Grafiek Maken</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <Tabs defaultValue="upload" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upload">Bestanden Uploaden</TabsTrigger>
                <TabsTrigger value="create">Handmatig Maken</TabsTrigger>
              </TabsList>
              <TabsContent value="upload" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <div className="text-sm text-gray-600">
                    Ondersteunde formaten: Excel (.xlsx, .xls), RDF (.ttl, .rdf, .n3, .nt)
                  </div>
                  <FileUpload onGraphCreated={() => setImportModalOpen(false)} />
                </div>
              </TabsContent>
              <TabsContent value="create" className="space-y-4 mt-4">
                <GraphCreator onGraphCreated={() => setImportModalOpen(false)} />
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      {/* Export Modal */}
      <Dialog open={exportModalOpen} onOpenChange={setExportModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Grafiek Exporteren</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-2 block">
                Export Formaat
              </Label>
              <Select value={exportFormat} onValueChange={setExportFormat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="png">PNG Afbeelding</SelectItem>
                  <SelectItem value="svg">SVG Vector</SelectItem>
                  <SelectItem value="pdf">PDF Document</SelectItem>
                  <SelectItem value="json">JSON Data</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-2 block">
                Kwaliteit
              </Label>
              <RadioGroup value={exportQuality} onValueChange={setExportQuality}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="standard" id="standard" />
                  <Label htmlFor="standard">Standaard</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="high" id="high" />
                  <Label htmlFor="high">Hoge kwaliteit</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
          
          <div className="flex justify-end space-x-3 mt-6">
            <Button variant="ghost" onClick={() => setExportModalOpen(false)}>
              Annuleren
            </Button>
            <Button onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Exporteren
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Analytics Modal */}
      <Dialog open={analyticsModalOpen} onOpenChange={setAnalyticsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Graph Analytics & Data</DialogTitle>
          </DialogHeader>
          
          {currentGraph && (
            <div className="space-y-6 py-4">
              {/* Statistics Section */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Statistieken</h3>
                <GraphStatistics graphData={currentGraph} />
              </div>
              
              {/* Data Browser Section */}
              <div>
                <h3 className="text-lg font-semibold mb-4">RDF Data Browser</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
                      <div className="font-medium">Total Triples</div>
                      <div className="text-2xl font-bold text-blue-600">
                        {currentGraph.nodeCount + currentGraph.edgeCount}
                      </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
                      <div className="font-medium">Unique Node Types</div>
                      <div className="text-2xl font-bold text-green-600">
                        {new Set(currentGraph.nodes.map((n: any) => n.type)).size}
                      </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
                      <div className="font-medium">Unique Relations</div>
                      <div className="text-2xl font-bold text-purple-600">
                        {new Set(currentGraph.edges.map((e: any) => e.type)).size}
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium mb-3">Node Types</h4>
                      <div className="space-y-2 text-sm max-h-48 overflow-y-auto">
                        {Array.from(new Set(currentGraph.nodes.map((n: any) => n.type))).map((type: string) => (
                          <div key={type} className="flex justify-between items-center">
                            <span className="truncate">{type}</span>
                            <span className="text-gray-500 bg-gray-100 px-2 py-1 rounded text-xs ml-2">
                              {currentGraph.nodes.filter((n: any) => n.type === type).length}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium mb-3">Relation Types</h4>
                      <div className="space-y-2 text-sm max-h-48 overflow-y-auto">
                        {Array.from(new Set(currentGraph.edges.map((e: any) => e.type))).map((type: string) => (
                          <div key={type} className="flex justify-between items-center">
                            <span className="truncate">{type}</span>
                            <span className="text-gray-500 bg-gray-100 px-2 py-1 rounded text-xs ml-2">
                              {currentGraph.edges.filter((e: any) => e.type === type).length}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div className="flex justify-end pt-4">
            <Button variant="ghost" onClick={() => setAnalyticsModalOpen(false)}>
              Sluiten
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Save View Dialog */}
      <SaveViewDialog
        open={saveViewDialogOpen}
        onOpenChange={setSaveViewDialogOpen}
        graphId={currentGraph?.graphId || ""}
        visibleNodeIds={Array.from(visibleNodes)}
        transform={transform}
        nodePositions={{}} // Would need to pass actual node positions from graph canvas
      />
    </div>
  );
}
