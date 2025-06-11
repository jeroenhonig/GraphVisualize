import { useState, useEffect } from "react";
import GraphSidebar from "./graph-sidebar";
import RDFGraphCanvas from "./rdf-graph-canvas";
import SparqlQueryPanel from "./sparql-query-panel";
import GraphStatistics from "./graph-statistics";
import FileUpload from "./file-upload";
import GraphCreator from "./graph-creator";
import SaveViewDialog from "./save-view-dialog";
import ColorLegend from "./color-legend";
import LayoutPanel from "./layout-panel";
import NodeEditor from "./node-editor";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RotateCcw, Download, Settings, Maximize, Search, Upload, FileText, BarChart3, Database, Network, TrendingUp, ChevronDown, ChevronRight, Save, Eye, Trash2, Layout } from "lucide-react";
import { getNodeTypeColor } from "@/lib/color-utils";
import { useGraph } from "@/hooks/use-graph";
import { useLayoutPreferences } from "@/hooks/use-layout-preferences";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import ErrorBoundary from "./error-boundary";

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
  const [behaviorMode, setBehaviorMode] = useState<'default' | 'connect' | 'select' | 'edit' | 'readonly'>('default');
  const [selectedNodes, setSelectedNodes] = useState<any[]>([]);
  const [expandedTreeItems, setExpandedTreeItems] = useState<Set<string>>(new Set(['nodes', 'relations', 'saved-views']));
  const [saveViewDialogOpen, setSaveViewDialogOpen] = useState(false);
  const [nodeDetailsModalOpen, setNodeDetailsModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<any>(null);

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
      return await apiRequest("DELETE", `/api/saved-views/${viewId}`);
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
      const response = await apiRequest("POST", `/api/saved-views/${viewId}/apply`);
      return await response.json();
    },
    onSuccess: (data: any) => {
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
    const graph = (graphs as any)?.find((g: any) => g.graphId === graphId);
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

  const handleNodeEdit = (node: any) => {
    setEditingNode(node);
    setNodeDetailsModalOpen(true);
  };

  // D3 Behavior handlers
  const handleNodesSelected = (nodes: any[]) => {
    setSelectedNodes(nodes);
    console.log('Multiple nodes selected:', nodes.length);
  };

  const handleEdgeCreated = (source: string, target: string) => {
    console.log('Edge created:', { source, target });
    toast({
      title: "Connectie gemaakt",
      description: `Nieuwe verbinding tussen ${source} en ${target}`,
    });
  };

  const changeBehaviorMode = (mode: 'default' | 'connect' | 'select' | 'edit' | 'readonly') => {
    setBehaviorMode(mode);
    setSelectedNodes([]); // Clear selection when changing modes
    toast({
      title: "Interactie modus gewijzigd",
      description: `Modus: ${mode}`,
    });
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


          </div>

          <div className="flex items-center space-x-3">
            {/* Layout Rotation Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={rotateLayout}
              className="p-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
              title="Roteer layout"
            >
              <Layout className="h-4 w-4" />
            </Button>

            {/* Graph Dropdown Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800">
                  <Network className="h-4 w-4 mr-2" />
                  <div className="flex flex-col items-start text-left">
                    <span className="font-medium text-sm">
                      {currentGraph ? currentGraph.name : "Geen graph geselecteerd"}
                    </span>
                    {currentGraph && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {currentGraph.nodeCount} nodes • {currentGraph.edgeCount} edges
                      </span>
                    )}
                  </div>
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <div className="px-2 py-1.5 text-sm font-semibold">Graph Operaties</div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setImportModalOpen(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Data Importeren
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setExportModalOpen(true)}
                  disabled={!currentGraph}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exporteren
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setSaveViewDialogOpen(true)}
                  disabled={!currentGraph}
                >
                  <Save className="h-4 w-4 mr-2" />
                  View Opslaan
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setAnalyticsModalOpen(true)}>
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Analytics
                </DropdownMenuItem>
                <DropdownMenuItem onClick={rotateLayout}>
                  <Layout className="h-4 w-4 mr-2" />
                  Layout Roteren
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSettingsModalOpen(true)}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
              title="Instellingen"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      {/* Main Layout - Allow scrolling */}
      <div className="min-h-screen pt-16 relative bg-graph-background overflow-y-auto">
        {/* Direct Graph Canvas - Bypass LayoutPanel mounting issues */}
        <div
          className="fixed bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20"
          style={{
            left: positions.view.x,
            top: positions.view.y,
            width: positions.view.width,
            height: positions.view.height
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <div className="flex items-center space-x-2">
              <div className="text-sm font-medium text-gray-900 dark:text-white">Graph Weergave</div>
              {currentGraph && (
                <div className="text-xs text-gray-500">
                  {visibleNodes.size} van {currentGraph.nodeCount} nodes
                </div>
              )}
            </div>
          </div>

          {/* Graph Canvas Container */}
          <div 
            className="w-full bg-white dark:bg-gray-900"
            style={{ height: 'calc(100% - 56px)' }}
          >
            <ErrorBoundary>
              <RDFGraphCanvas
                graph={currentGraph}
                selectedNode={selectedNode}
                onNodeSelect={setSelectedNode}
                onNodeExpand={expandNode}
                onNodeEdit={handleNodeEdit}
                visibleNodes={visibleNodes}
                onVisibleNodesChange={setVisibleNodes}
                transform={transform}
                onTransformChange={setTransform}
                editMode={editMode}
                behaviorMode={behaviorMode}
                onNodesSelected={handleNodesSelected}
                onEdgeCreated={handleEdgeCreated}
              />
            </ErrorBoundary>
          </div>
        </div>

        {/* Graph Controls Overlay - Fixed positioning to be always visible */}
        <div className="fixed bottom-6 right-6 flex flex-col space-y-2 z-50">
          <Button
            onClick={resetView}
            className="p-3 bg-white dark:bg-gray-800 shadow-lg rounded-lg hover:shadow-xl transition-shadow text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white border border-gray-200 dark:border-gray-700"
            size="sm"
            title="Reset weergave en toon alle nodes"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            onClick={fitToScreen}
            className="p-3 bg-white dark:bg-gray-800 shadow-lg rounded-lg hover:shadow-xl transition-shadow text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white border border-gray-200 dark:border-gray-700"
            size="sm"
            title="Centreer alle nodes"
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
                    {(graphs as any)?.map((graph: any) => (
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
                  onClick={() => setCreateModalOpen(true)}
                  className="w-full"
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
                          {Array.from(new Set(currentGraph.nodes.map((n: any) => n.type)) as Set<string>).map((type: string) => {
                            const typeColors = getNodeTypeColor(type);
                            return (
                              <div key={type} className="flex items-center justify-between p-2 text-sm bg-gray-50 dark:bg-gray-800 rounded">
                                <div className="flex items-center space-x-2">
                                  <div 
                                    className="w-3 h-3 rounded-full border border-gray-300"
                                    style={{ backgroundColor: typeColors.primary }}
                                  />
                                  <span className="text-gray-700 dark:text-gray-300">{type}</span>
                                </div>
                                <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                                  {currentGraph.nodes.filter((n: any) => n.type === type).length}
                                </span>
                              </div>
                            );
                          })}
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
                          {Array.from(new Set(currentGraph.edges.map((e: any) => e.type)) as Set<string>).map((type: string) => (
                            <div key={type} className="flex items-center justify-between p-2 text-sm bg-gray-50 dark:bg-gray-800 rounded">
                              <span className="text-gray-700 dark:text-gray-300">{type}</span>
                              <span className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded">
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
                        className="flex items-center w-full text-left p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
                      >
                        {expandedTreeItems.has('saved-views') ? (
                          <ChevronDown className="h-4 w-4 mr-2" />
                        ) : (
                          <ChevronRight className="h-4 w-4 mr-2" />
                        )}
                        <Eye className="h-4 w-4 mr-2" />
                        <span className="font-medium">Opgeslagen Views ({(savedViews as any)?.length || 0})</span>
                      </button>

                      {expandedTreeItems.has('saved-views') && (
                        <div className="ml-8 mt-2 space-y-1">
                          {(savedViews as any)?.map((view: any) => (
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

                    {/* Color Legend */}
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                      <ColorLegend nodes={currentGraph.nodes} />
                    </div>

                    {/* Selected Node Info */}
                    {selectedNode && (
                      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-sm">Geselecteerde Node</h4>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setNodeDetailsModalOpen(true)}
                          >
                            Details
                          </Button>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800 rounded p-3">
                          <div className="flex items-center mb-1">
                            <div className="w-3 h-3 bg-blue-500 rounded mr-2"></div>
                            <span className="font-medium text-sm">{selectedNode.label}</span>
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            <div>Type: {selectedNode.type}</div>
                            <div>ID: {selectedNode.id}</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="sparql" className="flex-1 overflow-hidden p-4">
                {currentGraph && (
                  <SparqlQueryPanel
                    graphId={currentGraph.graphId}
                    onVisibilityChange={handleSparqlVisibilityChange}
                    visibleNodeIds={Array.from(visibleNodes)}
                  />
                )}
              </TabsContent>
            </Tabs>
          </div>
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
      {/* Node Details Modal */}
      <Dialog open={nodeDetailsModalOpen} onOpenChange={setNodeDetailsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Node Details</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <GraphSidebar
              currentGraph={currentGraph}
              selectedNode={selectedNode}
              onNodeSelect={setSelectedNode}
              onNodeExpand={(nodeId) => {
                expandNode(nodeId);
                setNodeDetailsModalOpen(false);
              }}
              onNodeCollapse={(nodeId) => {
                collapseNode(nodeId);
                setNodeDetailsModalOpen(false);
              }}
              editMode={editMode}
              onEditModeChange={setEditMode}
            />
          </div>
        </DialogContent>
      </Dialog>
      {/* Settings Modal */}
      <Dialog open={settingsModalOpen} onOpenChange={setSettingsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Instellingen</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Account</h3>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                    U
                  </div>
                  <div>
                    <div className="font-medium">Gebruiker</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">gebruiker@example.com</div>
                  </div>
                </div>
                <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => window.location.href = "/api/login"}
                    className="w-full"
                  >
                    Inloggen met Replit
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">Voorkeuren</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="dark-mode">Donkere modus</Label>
                  <Button variant="outline" size="sm">
                    Systeem
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="notifications">Meldingen</Label>
                  <Button variant="outline" size="sm">
                    Aan
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">Data</h3>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start">
                  <Download className="h-4 w-4 mr-2" />
                  Export alle data
                </Button>
                <Button variant="outline" className="w-full justify-start text-red-600 hover:text-red-700">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Wis alle data
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Node Editor Dialog */}
      <Dialog open={nodeDetailsModalOpen} onOpenChange={setNodeDetailsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Node Details</DialogTitle>
          </DialogHeader>
          {editingNode && (
            <NodeEditor 
              node={editingNode} 
              onNodeUpdate={() => {
                setNodeDetailsModalOpen(false);
                setEditingNode(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}