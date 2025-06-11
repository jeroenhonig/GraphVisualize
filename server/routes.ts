import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertGraphSchema, insertRdfTripleSchema, insertVisibilitySetSchema, insertSavedViewSchema } from "@shared/schema";
import { nanoid } from "nanoid";
import multer from "multer";

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Enhanced TTL/RDF parser function
async function parseRdfAndCreateTriples(content: string, format: string, graphId: string) {
  const lines = content.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));
  const prefixes = new Map<string, string>();
  const subjects = new Set<string>();
  const statements: { subject: string, predicate: string, object: string, objectType: string }[] = [];
  
  // Parse prefixes and collect statements
  let currentSubject = '';
  let currentStatements: string[] = [];
  
  for (const line of lines) {
    // Handle @prefix declarations
    if (line.startsWith('@prefix')) {
      const match = line.match(/@prefix\s+([^:]*):?\s*<([^>]+)>\s*\./);
      if (match) {
        const prefix = match[1].trim();
        const uri = match[2];
        prefixes.set(prefix, uri);
      }
      continue;
    }
    
    // Skip comments and empty lines
    if (line.startsWith('#') || !line) continue;
    
    // Handle multi-line statements
    if (line.includes('rdf:type') || line.includes('rdfs:') || line.includes('prop:') || line.includes('owl:')) {
      // Start of new subject definition
      if (currentSubject && currentStatements.length > 0) {
        // Process previous subject's statements
        await processSubjectStatements(currentSubject, currentStatements, prefixes, statements, subjects);
      }
      
      // Start new subject
      const parts = line.split(/\s+/);
      if (parts.length >= 1) {
        currentSubject = expandPrefix(parts[0], prefixes);
        currentStatements = [line];
      }
    } else if (currentSubject && (line.includes(':') || line.includes('.'))) {
      // Continue current subject's statements
      currentStatements.push(line);
    }
    
    // Process complete statement block ending with '.'
    if (line.endsWith('.')) {
      if (currentSubject && currentStatements.length > 0) {
        await processSubjectStatements(currentSubject, currentStatements, prefixes, statements, subjects);
        currentSubject = '';
        currentStatements = [];
      }
    }
  }
  
  // Process any remaining statements
  if (currentSubject && currentStatements.length > 0) {
    await processSubjectStatements(currentSubject, currentStatements, prefixes, statements, subjects);
  }
  
  // Create position assignments for subjects
  const subjectPositions = new Map<string, {x: number, y: number}>();
  let nodeIndex = 0;
  for (const subject of Array.from(subjects)) {
    const radius = 200 + (Math.floor(nodeIndex / 8) * 100);
    const angle = (nodeIndex % 8) * (2 * Math.PI / 8);
    const x = Math.round(600 + radius * Math.cos(angle));
    const y = Math.round(400 + radius * Math.sin(angle));
    subjectPositions.set(subject, { x, y });
    nodeIndex++;
  }
  
  // Create all RDF triples
  for (const stmt of statements) {
    await storage.createRdfTriple({
      graphId,
      subject: stmt.subject,
      predicate: stmt.predicate,
      object: stmt.object,
      objectType: stmt.objectType
    });
  }
  
  // Add position information for all subjects
  for (const [subject, position] of Array.from(subjectPositions.entries())) {
    await storage.createRdfTriple({
      graphId,
      subject,
      predicate: 'graph:positionX',
      object: position.x.toString(),
      objectType: 'literal'
    });
    
    await storage.createRdfTriple({
      graphId,
      subject,
      predicate: 'graph:positionY', 
      object: position.y.toString(),
      objectType: 'literal'
    });
  }
}

// Helper function to expand prefixed URIs
function expandPrefix(term: string, prefixes: Map<string, string>): string {
  if (term.includes(':') && !term.startsWith('<')) {
    const [prefix, local] = term.split(':', 2);
    const baseUri = prefixes.get(prefix);
    if (baseUri) {
      return `${baseUri}${local}`;
    }
  }
  return term.replace(/[<>]/g, '');
}

// Helper function to parse object value and determine type
function parseObjectValue(objectStr: string, prefixes: Map<string, string>): { value: string, type: string } {
  objectStr = objectStr.trim();
  
  // Handle URIs
  if (objectStr.startsWith('<') && objectStr.endsWith('>')) {
    return { value: objectStr.slice(1, -1), type: 'uri' };
  }
  
  // Handle prefixed URIs
  if (objectStr.includes(':') && !objectStr.startsWith('"')) {
    return { value: expandPrefix(objectStr, prefixes), type: 'uri' };
  }
  
  // Handle literals with language tags or datatypes
  if (objectStr.startsWith('"')) {
    let value = objectStr;
    // Remove quotes and language tags/datatypes
    if (value.includes('"@') || value.includes('"^^')) {
      value = value.split('"')[1];
    } else {
      value = value.replace(/"/g, '');
    }
    return { value, type: 'literal' };
  }
  
  return { value: objectStr, type: 'literal' };
}

// Helper function to process statements for a subject
async function processSubjectStatements(
  subject: string, 
  statements: string[], 
  prefixes: Map<string, string>, 
  outputStatements: { subject: string, predicate: string, object: string, objectType: string }[],
  subjects: Set<string>
) {
  subjects.add(subject);
  
  // Join all statements and parse them
  const fullStatement = statements.join(' ').replace(/\s+/g, ' ');
  
  // Split by semicolons to get individual predicate-object pairs
  const parts = fullStatement.split(';');
  
  for (let i = 0; i < parts.length; i++) {
    let part = parts[i].trim();
    
    // Remove trailing dot from last part
    if (i === parts.length - 1) {
      part = part.replace(/\.$/, '').trim();
    }
    
    // Parse predicate and object
    const match = part.match(/^([^\s]+)\s+(.+)$/);
    if (match) {
      const predicate = expandPrefix(match[1], prefixes);
      const objectStr = match[2].trim();
      
      // Handle multiple objects separated by commas
      const objects = objectStr.split(',').map(o => o.trim());
      
      for (const obj of objects) {
        const { value, type } = parseObjectValue(obj, prefixes);
        
        outputStatements.push({
          subject,
          predicate,
          object: value,
          objectType: type
        });
      }
    }
  }
}

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

  // Get all existing node types from the dataset (RDF-compliant)
  app.get("/api/node-types", async (req, res) => {
    try {
      const nodeTypes = await storage.getExistingNodeTypes();
      res.json(nodeTypes);
    } catch (error) {
      console.error('Node types fetch error:', error);
      res.status(500).json({ message: "Failed to fetch node types" });
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

      const success = await storage.updateNodePosition(nodeId, x, y);
      
      if (success) {
        // Return the exact coordinates that were saved
        res.json({ success: true, x: Math.round(x), y: Math.round(y) });
      } else {
        res.status(404).json({ message: "Node not found" });
      }
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

  // Upload RDF/TTL file
  app.post("/api/upload-rdf", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const { name, description } = req.body;
      if (!name) {
        return res.status(400).json({ message: "Graph name is required" });
      }

      const fileContent = req.file.buffer.toString('utf8');
      const fileExtension = req.file.originalname.split('.').pop()?.toLowerCase();

      // Validate file type
      if (!['ttl', 'rdf', 'n3', 'nt'].includes(fileExtension || '')) {
        return res.status(400).json({ message: "Unsupported file format. Only TTL, RDF, N3, and NT files are supported." });
      }

      // Create new graph
      const graphId = nanoid();
      const graph = await storage.createGraph({
        name,
        description: description || `Imported from ${req.file.originalname}`,
        graphId,
      });

      // Parse RDF content and create triples
      await parseRdfAndCreateTriples(fileContent, fileExtension || 'ttl', graphId);

      res.json({ 
        success: true, 
        message: "RDF file uploaded successfully",
        graphId: graph.graphId,
        graph 
      });
    } catch (error) {
      console.error('RDF upload error:', error);
      res.status(500).json({ 
        message: "Failed to upload RDF file", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
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

  // Saved Views API endpoints
  
  // Create a saved view
  app.post("/api/graphs/:graphId/saved-views", async (req, res) => {
    try {
      const { graphId } = req.params;
      console.log('Received saved view data:', JSON.stringify(req.body, null, 2));
      
      const result = insertSavedViewSchema.safeParse(req.body);
      if (!result.success) {
        console.log('Validation errors:', result.error.errors);
        return res.status(400).json({ message: "Invalid saved view data", errors: result.error.errors });
      }

      const viewId = nanoid();
      const savedView = await storage.createSavedView({
        ...result.data,
        graphId,
      });

      res.json(savedView);
    } catch (error) {
      console.error('Saved view creation error:', error);
      res.status(500).json({ message: "Failed to create saved view" });
    }
  });

  // Get all saved views for a graph
  app.get("/api/graphs/:graphId/saved-views", async (req, res) => {
    try {
      const { graphId } = req.params;
      const savedViews = await storage.getSavedViewsByGraph(graphId);
      res.json(savedViews);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch saved views" });
    }
  });

  // Get specific saved view
  app.get("/api/saved-views/:viewId", async (req, res) => {
    try {
      const { viewId } = req.params;
      const savedView = await storage.getSavedView(viewId);
      if (!savedView) {
        return res.status(404).json({ message: "Saved view not found" });
      }
      res.json(savedView);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch saved view" });
    }
  });

  // Apply saved view
  app.post("/api/saved-views/:viewId/apply", async (req, res) => {
    try {
      const { viewId } = req.params;
      const viewData = await storage.applySavedView(viewId);
      res.json(viewData);
    } catch (error) {
      console.error('Apply saved view error:', error);
      res.status(500).json({ message: "Failed to apply saved view" });
    }
  });

  // Update saved view
  app.patch("/api/saved-views/:viewId", async (req, res) => {
    try {
      const { viewId } = req.params;
      const updatedView = await storage.updateSavedView(viewId, req.body);
      if (!updatedView) {
        return res.status(404).json({ message: "Saved view not found" });
      }
      res.json(updatedView);
    } catch (error) {
      res.status(500).json({ message: "Failed to update saved view" });
    }
  });

  // Delete saved view
  app.delete("/api/saved-views/:viewId", async (req, res) => {
    try {
      const { viewId } = req.params;
      const deleted = await storage.deleteSavedView(viewId);
      if (!deleted) {
        return res.status(404).json({ message: "Saved view not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete saved view" });
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

  // Get all unique node types from all graphs (RDF-compliant)
  app.get("/api/node-types", async (req, res) => {
    try {
      const graphs = await storage.getAllGraphs();
      const allTypes = new Set<string>();
      
      for (const graph of graphs) {
        const graphData = await storage.getVisualizationData(graph.graphId);
        graphData.nodes.forEach(node => {
          // Ensure RDF compliance - all types should be rdf:type
          const rdfType = node.type.startsWith('rdf:type') ? node.type : `rdf:type/${node.type}`;
          allTypes.add(rdfType);
        });
      }
      
      res.json(Array.from(allTypes).sort());
    } catch (error) {
      console.error("Failed to get node types:", error);
      res.status(500).json({ error: "Failed to get node types" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}