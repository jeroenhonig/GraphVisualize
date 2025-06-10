import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertGraphSchema, insertRdfTripleSchema, insertVisibilitySetSchema } from "@shared/schema";
import { nanoid } from "nanoid";

export async function registerRoutes(app: Express): Promise<Server> {
  // Create empty graph
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

  // Get all graphs
  app.get("/api/graphs", async (req, res) => {
    try {
      const graphs = await storage.getAllGraphs();
      res.json(graphs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch graphs" });
    }
  });

  // Get specific graph with visualization data
  app.get("/api/graphs/:graphId", async (req, res) => {
    try {
      const { graphId } = req.params;
      const graphData = await storage.getVisualizationData(graphId);
      res.json(graphData);
    } catch (error) {
      console.error('Graph fetch error:', error);
      res.status(500).json({ message: "Failed to fetch graph" });
    }
  });

  // Add node to graph via RDF triples
  app.post("/api/graphs/:graphId/nodes", async (req, res) => {
    try {
      const { graphId } = req.params;
      const { label, type, data, x, y } = req.body;
      
      const graph = await storage.getGraph(graphId);
      if (!graph) {
        return res.status(404).json({ message: "Graph not found" });
      }

      if (!label || !type) {
        return res.status(400).json({ message: "Label and type are required" });
      }

      const nodeId = nanoid();
      await storage.createNodeFromTriples(
        graphId, 
        nodeId, 
        label, 
        type, 
        data || {}, 
        x || 0, 
        y || 0
      );

      res.json({ nodeId, label, type, data: data || {}, x: x || 0, y: y || 0 });
    } catch (error) {
      console.error('Node creation error:', error);
      res.status(500).json({ message: "Failed to create node" });
    }
  });

  // Add edge to graph via RDF triples
  app.post("/api/graphs/:graphId/edges", async (req, res) => {
    try {
      const { graphId } = req.params;
      const { sourceId, targetId, label, type } = req.body;
      
      if (!sourceId || !targetId) {
        return res.status(400).json({ message: "sourceId and targetId are required" });
      }

      const edgeId = nanoid();
      await storage.createEdgeFromTriples(
        graphId, 
        edgeId, 
        sourceId, 
        targetId, 
        label, 
        type || "connects"
      );

      res.json({ edgeId, sourceId, targetId, label, type: type || "connects" });
    } catch (error) {
      console.error('Edge creation error:', error);
      res.status(500).json({ message: "Failed to create edge" });
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

      await storage.updateNodePosition(nodeId, x, y);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to update node position" });
    }
  });

  // Update node properties (label, type, data)
  app.patch("/api/nodes/:nodeId", async (req, res) => {
    try {
      const { nodeId } = req.params;
      const { label, type, data } = req.body;

      const success = await storage.updateNodeProperties(nodeId, { label, type, data });
      
      if (!success) {
        return res.status(404).json({ message: "Node not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Node update error:', error);
      res.status(500).json({ message: "Failed to update node" });
    }
  });

  // Delete node
  app.delete("/api/nodes/:nodeId", async (req, res) => {
    try {
      const { nodeId } = req.params;
      const deleted = await storage.deleteNodeFromTriples(nodeId);
      
      if (!deleted) {
        return res.status(404).json({ message: "Node not found" });
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete node" });
    }
  });

  // Delete edge
  app.delete("/api/edges/:edgeId", async (req, res) => {
    try {
      const { edgeId } = req.params;
      const deleted = await storage.deleteEdgeFromTriples(edgeId);
      
      if (!deleted) {
        return res.status(404).json({ message: "Edge not found" });
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete edge" });
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

  // Clear all data and load test dataset
  app.post("/api/load-test-data", async (req, res) => {
    try {
      await storage.clearAllData();
      await storage.loadBuildingDataset();
      res.json({ success: true, message: "Test data loaded successfully" });
    } catch (error) {
      console.error('Error loading test data:', error);
      res.status(500).json({ message: "Failed to load test data" });
    }
  });

  // SPARQL-based visibility set management
  app.post("/api/graphs/:graphId/visibility-sets", async (req, res) => {
    try {
      const { graphId } = req.params;
      
      const result = insertVisibilitySetSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid visibility set data", errors: result.error.errors });
      }

      const setId = nanoid();
      const visibilitySet = await storage.createVisibilitySet({
        ...result.data,
        setId,
        graphId,
      });

      res.json(visibilitySet);
    } catch (error) {
      console.error('Visibility set creation error:', error);
      res.status(500).json({ message: "Failed to create visibility set" });
    }
  });

  // Get all visibility sets for a graph
  app.get("/api/graphs/:graphId/visibility-sets", async (req, res) => {
    try {
      const { graphId } = req.params;
      const visibilitySets = await storage.getVisibilitySetsByGraph(graphId);
      res.json(visibilitySets);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch visibility sets" });
    }
  });

  // Set active visibility set
  app.post("/api/graphs/:graphId/visibility-sets/:setId/activate", async (req, res) => {
    try {
      const { graphId, setId } = req.params;
      
      await storage.setActiveVisibilitySet(graphId, setId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to activate visibility set" });
    }
  });

  // Execute SPARQL query for visibility
  app.post("/api/graphs/:graphId/sparql", async (req, res) => {
    try {
      const { graphId } = req.params;
      const { query } = req.body;

      if (!query || typeof query !== 'string') {
        return res.status(400).json({ message: "SPARQL query is required" });
      }

      const visibleNodeIds = await storage.executeVisibilityQuery(graphId, query);
      res.json({ visibleNodeIds });
    } catch (error) {
      console.error('SPARQL query error:', error);
      res.status(500).json({ message: "Failed to execute SPARQL query" });
    }
  });

  // Get raw RDF triples for debugging
  app.get("/api/graphs/:graphId/rdf-triples", async (req, res) => {
    try {
      const { graphId } = req.params;
      const triples = await storage.getRdfTriplesByGraph(graphId);
      res.json(triples);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch RDF triples" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}