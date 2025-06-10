import { useState } from "react";
import GraphSidebar from "./graph-sidebar";
import GraphCanvas from "./graph-canvas";
import SparqlQueryPanel from "./sparql-query-panel";
import GraphStatistics from "./graph-statistics";
import FileUpload from "./file-upload";
import GraphCreator from "./graph-creator";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Minus, RotateCcw, Download, Settings, Maximize, Search, Upload, FileText, BarChart3, Database, Network, TrendingUp } from "lucide-react";
import { useGraph } from "@/hooks/use-graph";

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

  const handleZoomIn = () => {
    setTransform(prev => ({
      ...prev,
      scale: Math.min(prev.scale * 1.2, 3)
    }));
  };

  const handleZoomOut = () => {
    setTransform(prev => ({
      ...prev,
      scale: Math.max(prev.scale / 1.2, 0.1)
    }));
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
            {/* Graph controls */}
            <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleZoomIn}
                className="p-2 hover:bg-white rounded text-gray-600 hover:text-gray-900"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetView}
                className="p-2 hover:bg-white rounded text-gray-600 hover:text-gray-900"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleZoomOut}
                className="p-2 hover:bg-white rounded text-gray-600 hover:text-gray-900"
              >
                <Minus className="h-4 w-4" />
              </Button>
            </div>
            
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
          <Tabs defaultValue="nodes" className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-2 mx-4 mt-4">
              <TabsTrigger value="nodes">
                <Network className="h-4 w-4 mr-2" />
                Nodes
              </TabsTrigger>
              <TabsTrigger value="sparql">
                <Search className="h-4 w-4 mr-2" />
                SPARQL
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="nodes" className="flex-1 overflow-hidden">
              <GraphSidebar
                currentGraph={currentGraph}
                selectedNode={selectedNode}
                onNodeSelect={setSelectedNode}
                onNodeExpand={expandNode}
                onNodeCollapse={collapseNode}
                editMode={editMode}
                onEditModeChange={setEditMode}
              />
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
    </div>
  );
}
