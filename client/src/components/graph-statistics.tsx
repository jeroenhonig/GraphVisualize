import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BarChart3, Users, Building, MapPin, FileText, Calendar, Layers } from "lucide-react";
import type { GraphData } from "@shared/schema";

interface GraphStatisticsProps {
  graphData?: GraphData;
}

export default function GraphStatistics({ graphData }: GraphStatisticsProps) {
  if (!graphData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Graaf Statistieken</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">Geen graph geselecteerd</p>
        </CardContent>
      </Card>
    );
  }

  // Bereken statistieken
  const nodeTypes = graphData.nodes.reduce((acc, node) => {
    acc[node.type] = (acc[node.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const edgeTypes = graphData.edges.reduce((acc, edge) => {
    acc[edge.type] = (acc[edge.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalConnections = graphData.edges.length;
  const avgConnectionsPerNode = graphData.nodeCount > 0 ? (totalConnections * 2) / graphData.nodeCount : 0;

  const getNodeTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'person': return <Users className="h-3 w-3" />;
      case 'organization': return <Building className="h-3 w-3" />;
      case 'location': return <MapPin className="h-3 w-3" />;
      case 'document': return <FileText className="h-3 w-3" />;
      case 'event': return <Calendar className="h-3 w-3" />;
      default: return <Layers className="h-3 w-3" />;
    }
  };

  const getNodeTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'person': return 'bg-blue-100 text-blue-800';
      case 'organization': return 'bg-green-100 text-green-800';
      case 'location': return 'bg-red-100 text-red-800';
      case 'document': return 'bg-yellow-100 text-yellow-800';
      case 'event': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-4">
      {/* Overview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center">
            <BarChart3 className="h-4 w-4 mr-2" />
            Overzicht
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50 p-3 rounded">
              <div className="text-2xl font-bold text-blue-600">{graphData.nodeCount}</div>
              <div className="text-xs text-blue-600">Knopen</div>
            </div>
            <div className="bg-green-50 p-3 rounded">
              <div className="text-2xl font-bold text-green-600">{graphData.edgeCount}</div>
              <div className="text-xs text-green-600">Kanten</div>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span>Gemiddelde Verbindingen</span>
              <span className="font-mono">{avgConnectionsPerNode.toFixed(1)}</span>
            </div>
            <Progress value={Math.min((avgConnectionsPerNode / 10) * 100, 100)} className="h-2" />
          </div>
        </CardContent>
      </Card>
      {/* Node Types */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Node Types</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {Object.entries(nodeTypes).length === 0 ? (
            <p className="text-xs text-gray-500">Geen knopen gevonden</p>
          ) : (
            Object.entries(nodeTypes)
              .sort(([,a], [,b]) => b - a)
              .map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className={`p-1 rounded ${getNodeTypeColor(type)}`}>
                      {getNodeTypeIcon(type)}
                    </div>
                    <span className="text-sm">{type}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {count}
                  </Badge>
                </div>
              ))
          )}
        </CardContent>
      </Card>
      {/* Edge Types */}
      {Object.keys(edgeTypes).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Relatie Types</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(edgeTypes)
              .sort(([,a], [,b]) => b - a)
              .map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-sm">{type}</span>
                  <Badge variant="outline" className="text-xs">
                    {count}
                  </Badge>
                </div>
              ))}
          </CardContent>
        </Card>
      )}
      {/* Graph Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Graph Informatie</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="space-y-1">
            <div className="text-xs text-gray-500">Naam</div>
            <div className="text-sm font-medium">{graphData.name}</div>
          </div>
          
          {graphData.description && (
            <div className="space-y-1">
              <div className="text-xs text-gray-500">Beschrijving</div>
              <div className="text-sm">{graphData.description}</div>
            </div>
          )}
          
          <div className="space-y-1">
            <div className="text-xs text-gray-500">Graph ID</div>
            <div className="text-xs font-mono bg-gray-100 p-1 rounded">
              {graphData.graphId}
            </div>
          </div>
        </CardContent>
      </Card>
      {/* Visibility Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Zichtbaarheid</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm">Zichtbare Nodes
</span>
            <Badge className="text-xs">
              {graphData.visibleNodeIds.length} / {graphData.nodeCount}
            </Badge>
          </div>
          
          <Progress 
            value={(graphData.visibleNodeIds.length / Math.max(graphData.nodeCount, 1)) * 100} 
            className="h-2" 
          />
          
          {graphData.activeVisibilitySet && (
            <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
              <div className="text-xs text-blue-600 font-medium">Actieve Filter</div>
              <div className="text-xs text-blue-800">{graphData.activeVisibilitySet.name}</div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}