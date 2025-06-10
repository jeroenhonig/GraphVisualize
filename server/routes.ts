import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertGraphSchema, insertGraphNodeSchema, insertGraphEdgeSchema } from "@shared/schema";
import multer from "multer";
import * as XLSX from "xlsx";
import { nanoid } from "nanoid";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (allowedMimes.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls)$/)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files are allowed'));
    }
  },
});

function parseExcelToGraph(buffer: Buffer, filename: string) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetNames = workbook.SheetNames;
  
  if (sheetNames.length === 0) {
    throw new Error('Excel file contains no sheets');
  }

  // Try to find nodes and edges sheets, or use the first sheet for nodes
  let nodesSheet = workbook.Sheets[sheetNames[0]];
  let edgesSheet = workbook.Sheets[sheetNames.length > 1 ? sheetNames[1] : sheetNames[0]];

  // Check for specific sheet names
  const nodesSheetName = sheetNames.find(name => 
    name.toLowerCase().includes('node') || 
    name.toLowerCase().includes('vertex') || 
    name.toLowerCase().includes('entity')
  );
  
  const edgesSheetName = sheetNames.find(name => 
    name.toLowerCase().includes('edge') || 
    name.toLowerCase().includes('relation') || 
    name.toLowerCase().includes('connection') ||
    name.toLowerCase().includes('link')
  );

  if (nodesSheetName) nodesSheet = workbook.Sheets[nodesSheetName];
  if (edgesSheetName) edgesSheet = workbook.Sheets[edgesSheetName];

  // Parse nodes
  const nodesData = XLSX.utils.sheet_to_json(nodesSheet, { header: 1 }) as any[][];
  if (nodesData.length < 2) {
    throw new Error('Nodes sheet must have at least a header row and one data row');
  }

  const nodeHeaders = nodesData[0];
  const idColumn = nodeHeaders.findIndex((h: string) => 
    h && h.toString().toLowerCase().match(/^(id|identifier|node_?id|key)$/));
  const labelColumn = nodeHeaders.findIndex((h: string) => 
    h && h.toString().toLowerCase().match(/^(label|name|title|description)$/));
  const typeColumn = nodeHeaders.findIndex((h: string) => 
    h && h.toString().toLowerCase().match(/^(type|category|kind|class)$/));

  if (idColumn === -1) {
    throw new Error('Nodes sheet must have an ID column (id, identifier, node_id, or key)');
  }

  const nodes = nodesData.slice(1)
    .filter(row => row[idColumn] && row[idColumn].toString().trim())
    .map((row, index) => ({
      nodeId: row[idColumn].toString().trim(),
      label: labelColumn !== -1 ? (row[labelColumn] || row[idColumn]).toString() : row[idColumn].toString(),
      type: typeColumn !== -1 ? (row[typeColumn] || 'default').toString() : 'default',
      data: Object.fromEntries(
        nodeHeaders.map((header, idx) => [header.toString(), row[idx] || ''])
      ),
      x: Math.random() * 800 + 100,
      y: Math.random() * 600 + 100,
    }));

  // Parse edges
  const edgesData = XLSX.utils.sheet_to_json(edgesSheet, { header: 1 }) as any[][];
  let edges: any[] = [];

  if (edgesData.length >= 2) {
    const edgeHeaders = edgesData[0];
    const sourceColumn = edgeHeaders.findIndex((h: string) => 
      h && h.toString().toLowerCase().match(/^(source|from|source_?id|start)$/));
    const targetColumn = edgeHeaders.findIndex((h: string) => 
      h && h.toString().toLowerCase().match(/^(target|to|target_?id|end|destination)$/));
    const edgeLabelColumn = edgeHeaders.findIndex((h: string) => 
      h && h.toString().toLowerCase().match(/^(label|relationship|relation|type|name)$/));

    if (sourceColumn !== -1 && targetColumn !== -1) {
      edges = edgesData.slice(1)
        .filter(row => row[sourceColumn] && row[targetColumn])
        .map(row => ({
          edgeId: nanoid(),
          sourceId: row[sourceColumn].toString().trim(),
          targetId: row[targetColumn].toString().trim(),
          label: edgeLabelColumn !== -1 ? (row[edgeLabelColumn] || '').toString() : '',
          type: 'default',
          data: Object.fromEntries(
            edgeHeaders.map((header, idx) => [header.toString(), row[idx] || ''])
          ),
        }));
    }
  }

  // If no explicit edges, try to create them from node relationships
  if (edges.length === 0 && nodes.length > 1) {
    // Look for columns that might reference other nodes
    const referenceColumns = nodeHeaders
      .map((header, idx) => ({ header: header.toString(), idx }))
      .filter(({ header }) => 
        header.toLowerCase().includes('parent') ||
        header.toLowerCase().includes('manager') ||
        header.toLowerCase().includes('owner') ||
        header.toLowerCase().includes('related') ||
        header.toLowerCase().includes('ref')
      );

    for (const { header, idx } of referenceColumns) {
      for (const node of nodes) {
        const targetId = node.data[header];
        if (targetId && targetId.toString().trim() && nodes.some(n => n.nodeId === targetId.toString().trim())) {
          edges.push({
            edgeId: nanoid(),
            sourceId: node.nodeId,
            targetId: targetId.toString().trim(),
            label: header.replace(/_/g, ' '),
            type: 'reference',
            data: { relationship: header },
          });
        }
      }
    }
  }

  return {
    name: filename.replace(/\.(xlsx|xls)$/i, ''),
    description: `Imported from ${filename}`,
    nodes,
    edges,
    nodeCount: nodes.length,
    edgeCount: edges.length,
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Create empty graph manually
  app.post("/api/graphs", async (req, res) => {
    try {
      const result = insertGraphSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid graph data", errors: result.error.errors });
      }

      const graphId = nanoid();
      const graph = await storage.createGraph({
        ...result.data,
        graphId,
      });

      res.json(graph);
    } catch (error) {
      console.error('Graph creation error:', error);
      res.status(500).json({ message: "Failed to create graph" });
    }
  });

  // Add node to graph
  app.post("/api/graphs/:graphId/nodes", async (req, res) => {
    try {
      const { graphId } = req.params;
      
      const graph = await storage.getGraph(graphId);
      if (!graph) {
        return res.status(404).json({ message: "Graph not found" });
      }

      const result = insertGraphNodeSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid node data", errors: result.error.errors });
      }

      const nodeId = result.data.nodeId || nanoid();
      const node = await storage.createNode({
        ...result.data,
        nodeId,
        graphId,
      });

      // Update graph node count
      await storage.updateGraph(graphId, {
        nodeCount: graph.nodeCount + 1,
      });

      res.json(node);
    } catch (error) {
      console.error('Node creation error:', error);
      res.status(500).json({ message: "Failed to create node" });
    }
  });

  // Add edge to graph
  app.post("/api/graphs/:graphId/edges", async (req, res) => {
    try {
      const { graphId } = req.params;
      
      const graph = await storage.getGraph(graphId);
      if (!graph) {
        return res.status(404).json({ message: "Graph not found" });
      }

      const result = insertGraphEdgeSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid edge data", errors: result.error.errors });
      }

      // Verify source and target nodes exist
      const sourceNode = await storage.getNode(result.data.sourceId);
      const targetNode = await storage.getNode(result.data.targetId);
      
      if (!sourceNode || !targetNode) {
        return res.status(400).json({ message: "Source or target node not found" });
      }

      if (sourceNode.graphId !== graphId || targetNode.graphId !== graphId) {
        return res.status(400).json({ message: "Nodes must belong to the same graph" });
      }

      const edgeId = result.data.edgeId || nanoid();
      const edge = await storage.createEdge({
        ...result.data,
        edgeId,
        graphId,
      });

      // Update graph edge count
      await storage.updateGraph(graphId, {
        edgeCount: graph.edgeCount + 1,
      });

      res.json(edge);
    } catch (error) {
      console.error('Edge creation error:', error);
      res.status(500).json({ message: "Failed to create edge" });
    }
  });

  // Update node
  app.patch("/api/nodes/:nodeId", async (req, res) => {
    try {
      const { nodeId } = req.params;
      
      const node = await storage.getNode(nodeId);
      if (!node) {
        return res.status(404).json({ message: "Node not found" });
      }

      const allowedUpdates = ['label', 'type', 'data', 'x', 'y'];
      const updates = Object.keys(req.body)
        .filter(key => allowedUpdates.includes(key))
        .reduce((obj, key) => {
          obj[key] = req.body[key];
          return obj;
        }, {} as any);

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "No valid updates provided" });
      }

      const updatedNode = await storage.updateNode(nodeId, updates);
      res.json(updatedNode);
    } catch (error) {
      console.error('Node update error:', error);
      res.status(500).json({ message: "Failed to update node" });
    }
  });

  // Delete node
  app.delete("/api/nodes/:nodeId", async (req, res) => {
    try {
      const { nodeId } = req.params;
      
      const node = await storage.getNode(nodeId);
      if (!node) {
        return res.status(404).json({ message: "Node not found" });
      }

      const deleted = await storage.deleteNode(nodeId);
      if (deleted) {
        // Update graph node count
        const graph = await storage.getGraph(node.graphId);
        if (graph) {
          await storage.updateGraph(node.graphId, {
            nodeCount: Math.max(0, graph.nodeCount - 1),
          });
        }
      }

      res.json({ success: deleted });
    } catch (error) {
      console.error('Node deletion error:', error);
      res.status(500).json({ message: "Failed to delete node" });
    }
  });

  // Delete edge
  app.delete("/api/edges/:edgeId", async (req, res) => {
    try {
      const { edgeId } = req.params;
      
      const edge = await storage.getEdge(edgeId);
      if (!edge) {
        return res.status(404).json({ message: "Edge not found" });
      }

      const deleted = await storage.deleteEdge(edgeId);
      if (deleted) {
        // Update graph edge count
        const graph = await storage.getGraph(edge.graphId);
        if (graph) {
          await storage.updateGraph(edge.graphId, {
            edgeCount: Math.max(0, graph.edgeCount - 1),
          });
        }
      }

      res.json({ success: deleted });
    } catch (error) {
      console.error('Edge deletion error:', error);
      res.status(500).json({ message: "Failed to delete edge" });
    }
  });

  // Upload and parse Excel file
  app.post("/api/graphs/upload", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const graphData = parseExcelToGraph(req.file.buffer, req.file.originalname);
      const graphId = nanoid();

      // Create graph
      const graph = await storage.createGraph({
        graphId,
        name: graphData.name,
        description: graphData.description,
        nodeCount: graphData.nodeCount,
        edgeCount: graphData.edgeCount,
      });

      // Create nodes
      for (const nodeData of graphData.nodes) {
        await storage.createNode({
          ...nodeData,
          graphId,
        });
      }

      // Create edges
      for (const edgeData of graphData.edges) {
        await storage.createEdge({
          ...edgeData,
          graphId,
        });
      }

      res.json({
        success: true,
        graph,
        nodeCount: graphData.nodeCount,
        edgeCount: graphData.edgeCount,
      });
    } catch (error) {
      console.error('File upload error:', error);
      res.status(400).json({ 
        message: error instanceof Error ? error.message : "Failed to process file" 
      });
    }
  });

  // Get all graphs
  app.get("/api/graphs", async (req, res) => {
    try {
      const graphs = await storage.getAllGraphs();
      res.json(graphs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch graphs" });
    }
  });

  // Get specific graph with nodes and edges
  app.get("/api/graphs/:graphId", async (req, res) => {
    try {
      const { graphId } = req.params;
      
      const graph = await storage.getGraph(graphId);
      if (!graph) {
        return res.status(404).json({ message: "Graph not found" });
      }

      const nodes = await storage.getNodesByGraph(graphId);
      const edges = await storage.getEdgesByGraph(graphId);

      res.json({
        ...graph,
        nodes: nodes.map(node => ({
          id: node.nodeId,
          label: node.label,
          type: node.type,
          data: node.data,
          x: node.x || 0,
          y: node.y || 0,
          visible: true,
          expanded: false,
        })),
        edges: edges.map(edge => ({
          id: edge.edgeId,
          source: edge.sourceId,
          target: edge.targetId,
          label: edge.label,
          type: edge.type,
          data: edge.data,
        })),
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch graph" });
    }
  });

  // Update node position
  app.patch("/api/nodes/:nodeId/position", async (req, res) => {
    try {
      const { nodeId } = req.params;
      const { x, y } = req.body;

      if (typeof x !== 'number' || typeof y !== 'number') {
        return res.status(400).json({ message: "Invalid coordinates" });
      }

      const updatedNode = await storage.updateNode(nodeId, { x, y });
      if (!updatedNode) {
        return res.status(404).json({ message: "Node not found" });
      }

      res.json(updatedNode);
    } catch (error) {
      res.status(500).json({ message: "Failed to update node position" });
    }
  });

  // Get node connections
  app.get("/api/nodes/:nodeId/connections", async (req, res) => {
    try {
      const { nodeId } = req.params;
      
      const node = await storage.getNode(nodeId);
      if (!node) {
        return res.status(404).json({ message: "Node not found" });
      }

      const edges = await storage.getEdgesByNode(nodeId);
      const connectedNodeIds = new Set<string>();
      
      edges.forEach(edge => {
        if (edge.sourceId !== nodeId) connectedNodeIds.add(edge.sourceId);
        if (edge.targetId !== nodeId) connectedNodeIds.add(edge.targetId);
      });

      const connectedNodes = await Promise.all(
        Array.from(connectedNodeIds).map(id => storage.getNode(id))
      );

      res.json({
        node: {
          id: node.nodeId,
          label: node.label,
          type: node.type,
          data: node.data,
        },
        connections: connectedNodes.filter(Boolean).map(n => ({
          id: n!.nodeId,
          label: n!.label,
          type: n!.type,
          relationship: edges.find(e => 
            (e.sourceId === nodeId && e.targetId === n!.nodeId) ||
            (e.targetId === nodeId && e.sourceId === n!.nodeId)
          )?.label || edges.find(e => 
            (e.sourceId === nodeId && e.targetId === n!.nodeId) ||
            (e.targetId === nodeId && e.sourceId === n!.nodeId)
          )?.type || 'connected',
        })),
        edges: edges.map(edge => ({
          id: edge.edgeId,
          source: edge.sourceId,
          target: edge.targetId,
          label: edge.label,
          type: edge.type,
        })),
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch node connections" });
    }
  });

  // Delete graph
  app.delete("/api/graphs/:graphId", async (req, res) => {
    try {
      const { graphId } = req.params;
      
      const deleted = await storage.deleteGraph(graphId);
      if (!deleted) {
        return res.status(404).json({ message: "Graph not found" });
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete graph" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
