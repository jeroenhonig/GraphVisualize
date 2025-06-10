import { useState, useEffect } from "react";
import GraphSidebar from "./graph-sidebar";
import GraphCanvas from "./graph-canvas";
import SparqlQueryPanel from "./sparql-query-panel";
import GraphStatistics from "./graph-statistics";
import FileUpload from "./file-upload";
import GraphCreator from "./graph-creator";
import SaveViewDialog from "./save-view-dialog";
import LayoutPanel from "./layout-panel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RotateCcw, Download, Settings, Maximize, Search, Upload, FileText, BarChart3, Database, Network, TrendingUp, ChevronDown, ChevronRight, Save, Eye, Trash2, Layout } from "lucide-react";
import { useGraph } from "@/hooks/use-graph";
import { useLayoutPreferences } from "@/hooks/use-layout-preferences";
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
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [analyticsModalOpen, setAnalyticsModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [expandedTreeItems, setExpandedTreeItems] = useState<Set<string>>(new Set(['nodes', 'relations', 'saved-views']));
  const [saveViewDialogOpen, setSaveViewDialogOpen] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Layout preferences for 3-position system
  const {
    preferences,
    rotateLayout,
    togglePanelCollapse,
    getCurrentPositions,
  } = useLayoutPreferences();

  const positions = getCurrentPositions();

  // Fetch all graphs
  const { data: graphs = [] } = useQuery({
    queryKey: ["/api/graphs"],
  });

  // Fetch saved views for current graph
  const { data: savedViews = [] } = useQuery({
    queryKey: ["/api/graphs", currentGraph?.graphId, "saved-views"],
    enabled: !!currentGraph?.graphId,
  });

  // Mutations for saved views
  const deleteSavedViewMutation = useMutation({
    mutationFn: async (viewId: string) => {
      const response = await apiRequest(`/api/saved-views/${viewId}`, {
        method: "DELETE",
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/graphs", currentGraph?.graphId, "saved-views"],
      });
      toast({
        title: "View verwijderd",
        description: "De opgeslagen view is succesvol verwijderd.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Fout bij verwijderen",
        description: error.message || "Kon de view niet verwijderen.",
      });
    },
  });

  const applySavedViewMutation = useMutation({
    mutationFn: async (viewId: string) => {
      const response = await apiRequest(`/api/saved-views/${viewId}/apply`, {
        method: "POST",
      });
      return response;
    },
    onSuccess: (data) => {
      setVisibleNodes(new Set(data.visibleNodeIds));
      if (data.transform) {
        setTransform(JSON.parse(data.transform));
      }
      toast({
        title: "View toegepast",
        description: "De opgeslagen view is succesvol geladen.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Fout bij laden",
        description: error.message || "Kon de view niet laden.",
      });
    },
  });

  const selectGraph = (graphId: string) => {
    const graph = graphs.find(g => g.graphId === graphId);
    if (graph) {
      window.location.href = `/?graph=${graphId}`;
    }
  };

  const toggleTreeItem = (item: string) => {
    const newExpanded = new Set(expandedTreeItems);
    if (newExpanded.has(item)) {
      newExpanded.delete(item);
    } else {
      newExpanded.add(item);
    }
    setExpandedTreeItems(newExpanded);
  };

  const deleteSavedView = (viewId: string) => {
    deleteSavedViewMutation.mutate(viewId);
  };

  const applySavedView = (viewId: string) => {
    applySavedViewMutation.mutate(viewId);
  };

  const handleSparqlVisibilityChange = (visibleNodeIds: string[]) => {
    setVisibleNodes(new Set(visibleNodeIds));
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <Network className="h-8 w-8 text-blue-600 mr-3" />
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Graph Visualizer</h1>
            </div>
            
            {currentGraph && (
              <div className="flex items-center space-x-2 px-3 py-1 bg-blue-50 dark:bg-blue-900/20 rounded-full">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  {currentGraph.name}
                </span>
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1">
              <Button
                variant="ghost"
                onClick={() => setImportModalOpen(true)}
                className="px-4 py-2 text-blue-600 hover:text-blue-900 hover:bg-blue-50"
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
                onClick={rotateLayout}
                className="px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                title="Layout roteren"
              >
                <Layout className="h-4 w-4 mr-2" />
                Roteer Layout
              </Button>
              <Button
                variant="ghost"
                onClick={() => setExportModalOpen(true)}
                className="px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                disabled={!currentGraph}
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
      {/* Main Layout - Allow scrolling */}
      <div className="min-h-screen pt-16 relative bg-graph-background overflow-y-auto">
        {/* Main Graph Area - Full Screen */}
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
          panelConstraints={{
            leftPanel: {
              x: 20,
              y: 100,
              width: 320,
              collapsed: preferences.collapsed.navigation
            },
            rightPanel: {
              x: window.innerWidth - 340,
              y: 100,
              width: 320,
              collapsed: preferences.collapsed.details
            }
          }}
        />

        {/* Graph Controls Overlay */}
        <div className="absolute bottom-6 right-6 flex flex-col space-y-2 z-20">
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

        {/* Navigation Panel */}
        <LayoutPanel
          title="Graph Navigatie"
          panelType="navigation"
          position={positions.navigation}
          collapsed={preferences.collapsed.navigation}
          onToggleCollapse={() => togglePanelCollapse('navigation')}
          onRotateLayout={rotateLayout}
        >
          <div className="h-full flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              {/* Graph Selector */}
              <div className="mb-4">
                <Label htmlFor="graph-select" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Actieve Graph
                </Label>
                <Select value={currentGraph?.graphId || ""} onValueChange={selectGraph}>
                  <SelectTrigger className="w-full mt-1">
                    <SelectValue placeholder="Selecteer een graph" />
                  </SelectTrigger>
                  <SelectContent>
                    {graphs.map((graph) => (
                      <SelectItem key={graph.graphId} value={graph.graphId}>
                        {graph.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Quick Actions */}
              <div className="flex flex-wrap gap-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setImportModalOpen(true)}
                  className="flex-1"
                >
                  <Upload className="h-3 w-3 mr-1" />
                  Import
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setCreateModalOpen(true)}
                  className="flex-1"
                >
                  <Network className="h-3 w-3 mr-1" />
                  Nieuw
                </Button>
              </div>
            </div>

            {/* Tabs for different content */}
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
              
              <TabsContent value="tree" className="flex-1 overflow-y-auto p-4">
                {currentGraph && (
                  <div className="space-y-4">
                    {/* Nodes Section */}
                    <div>
                      <button
                        onClick={() => toggleTreeItem('nodes')}
                        className="flex items-center w-full text-left p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
                      >
                        {expandedTreeItems.has('nodes') ? (
                          <ChevronDown className="h-4 w-4 mr-2" />
                        ) : (
                          <ChevronRight className="h-4 w-4 mr-2" />
                        )}
                        <Database className="h-4 w-4 mr-2" />
                        <span className="font-medium">Nodes ({currentGraph.nodeCount})</span>
                      </button>
                      
                      {expandedTreeItems.has('nodes') && (
                        <div className="ml-8 mt-2 space-y-1">
                          {Array.from(new Set(currentGraph.nodes.map(n => n.type))).map((type: string) => (
                            <div key={type} className="flex items-center justify-between p-2 text-sm bg-gray-50 dark:bg-gray-800 rounded">
                              <span className="text-gray-700 dark:text-gray-300">{type}</span>
                              <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                                {currentGraph.nodes.filter(n => n.type === type).length}
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
                        className="flex items-center w-full text-left p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
                      >
                        {expandedTreeItems.has('relations') ? (
                          <ChevronDown className="h-4 w-4 mr-2" />
                        ) : (
                          <ChevronRight className="h-4 w-4 mr-2" />
                        )}
                        <TrendingUp className="h-4 w-4 mr-2" />
                        <span className="font-medium">Relaties ({currentGraph.edgeCount})</span>
                      </button>
                      
                      {expandedTreeItems.has('relations') && (
                        <div className="ml-8 mt-2 space-y-1">
                          {Array.from(new Set(currentGraph.edges.map(e => e.type))).map((type: string) => (
                            <div key={type} className="flex items-center justify-between p-2 text-sm bg-gray-50 dark:bg-gray-800 rounded">
                              <span className="text-gray-700 dark:text-gray-300">{type}</span>
                              <span className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded">
                                {currentGraph.edges.filter(e => e.type === type).length}
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
                        className="flex items-center w-full text-left p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
                      >
                        {expandedTreeItems.has('saved-views') ? (
                          <ChevronDown className="h-4 w-4 mr-2" />
                        ) : (
                          <ChevronRight className="h-4 w-4 mr-2" />
                        )}
                        <Eye className="h-4 w-4 mr-2" />
                        <span className="font-medium">Opgeslagen Views ({savedViews.length})</span>
                      </button>
                      
                      {expandedTreeItems.has('saved-views') && (
                        <div className="ml-8 mt-2 space-y-1">
                          {savedViews.map((view) => (
                            <div 
                              key={view.id} 
                              className="flex items-center justify-between p-2 text-sm bg-gray-50 dark:bg-gray-800 rounded group hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                              <button
                                onClick={() => applySavedView(view.id)}
                                className="flex-1 text-left text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                title={`Klik om view '${view.name}' toe te passen`}
                              >
                                {view.name}
                                {view.name === 'Alle Nodes & Relaties' && (
                                  <span className="text-xs text-gray-500 ml-1">(standaard)</span>
                                )}
                              </button>
                              {view.name !== 'Alle Nodes & Relaties' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteSavedView(view.id);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 text-red-600 hover:text-red-800 transition-all"
                                  title={`View '${view.name}' verwijderen`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Graph Statistics */}
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                      <GraphStatistics graphData={currentGraph} />
                    </div>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="sparql" className="flex-1 overflow-hidden p-4">
                {currentGraph && (
                  <SparqlQueryPanel
                    graphId={currentGraph.graphId}
                    onVisibilityChange={handleSparqlVisibilityChange}
                  />
                )}
              </TabsContent>
            </Tabs>
          </div>
        </LayoutPanel>

        {/* View Panel */}
        <LayoutPanel
          title="Graph Weergave"
          panelType="view"
          position={positions.view}
          collapsed={preferences.collapsed.view}
          onToggleCollapse={() => togglePanelCollapse('view')}
          onRotateLayout={rotateLayout}
        >
          <div className="p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Graph visualisatie in het hoofdvenster
            </p>
          </div>
        </LayoutPanel>

        {/* Details Panel */}
        <LayoutPanel
          title="Node Details"
          panelType="details"
          position={positions.details}
          collapsed={preferences.collapsed.details}
          onToggleCollapse={() => togglePanelCollapse('details')}
          onRotateLayout={rotateLayout}
        >
          <GraphSidebar
            currentGraph={currentGraph}
            selectedNode={selectedNode}
            onNodeSelect={setSelectedNode}
            onNodeExpand={expandNode}
            onNodeCollapse={collapseNode}
            editMode={editMode}
            onEditModeChange={setEditMode}
          />
        </LayoutPanel>
      </div>
      {/* Import Modal */}
      <Dialog open={importModalOpen} onOpenChange={setImportModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Data Importeren</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Tabs defaultValue="upload" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upload">
                  <Upload className="h-4 w-4 mr-2" />
                  Bestand Upload
                </TabsTrigger>
                <TabsTrigger value="create">
                  <Network className="h-4 w-4 mr-2" />
                  Handmatig Maken
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="upload" className="space-y-4">
                <FileUpload onGraphCreated={() => setImportModalOpen(false)} />
              </TabsContent>
              
              <TabsContent value="create" className="space-y-4">
                <GraphCreator onGraphCreated={() => setImportModalOpen(false)} />
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>
      {/* Create Modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nieuwe Graph Maken</DialogTitle>
          </DialogHeader>
          <GraphCreator onGraphCreated={() => setCreateModalOpen(false)} />
        </DialogContent>
      </Dialog>
      {/* Save View Dialog */}
      {currentGraph && (
        <SaveViewDialog
          open={saveViewDialogOpen}
          onOpenChange={setSaveViewDialogOpen}
          graphId={currentGraph.graphId}
          visibleNodeIds={Array.from(visibleNodes)}
          transform={transform}
          nodePositions={{}} // TODO: Get actual node positions
        />
      )}
      {/* Export Modal */}
      <Dialog open={exportModalOpen} onOpenChange={setExportModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Graph Exporteren</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="export-format">Export Formaat</Label>
              <Select value={exportFormat} onValueChange={setExportFormat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="png">PNG Afbeelding</SelectItem>
                  <SelectItem value="svg">SVG Vector</SelectItem>
                  <SelectItem value="pdf">PDF Document</SelectItem>
                  <SelectItem value="json">JSON Data</SelectItem>
                  <SelectItem value="rdf">RDF/Turtle</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {(exportFormat === "png" || exportFormat === "pdf") && (
              <div>
                <Label htmlFor="export-quality">Kwaliteit</Label>
                <RadioGroup value={exportQuality} onValueChange={setExportQuality}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="standard" id="standard" />
                    <Label htmlFor="standard">Standaard (1920x1080)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="high" id="high" />
                    <Label htmlFor="high">Hoge kwaliteit (3840x2160)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="print" id="print" />
                    <Label htmlFor="print">Print kwaliteit (300 DPI)</Label>
                  </div>
                </RadioGroup>
              </div>
            )}
            
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setExportModalOpen(false)}>
                Annuleren
              </Button>
              <Button onClick={() => setExportModalOpen(false)}>
                <Download className="h-4 w-4 mr-2" />
                Exporteren
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Analytics Modal */}
      <Dialog open={analyticsModalOpen} onOpenChange={setAnalyticsModalOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Graph Analytics</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {currentGraph && <GraphStatistics graphData={currentGraph} />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}