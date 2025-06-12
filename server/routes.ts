import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertGraphSchema, insertRdfTripleSchema, insertVisibilitySetSchema, insertSavedViewSchema } from "@shared/schema";
import { nanoid } from "nanoid";
import multer from "multer";
import { body, validationResult } from "express-validator";

// Configure multer for file uploads with enhanced security
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1 // Only allow 1 file
  },
  fileFilter: (req, file, cb) => {
    // Whitelist allowed file types
    const allowedMimes = [
      'text/turtle',
      'application/rdf+xml', 
      'text/plain',
      'application/n-triples',
      'text/n3'
    ];
    
    const allowedExtensions = ['ttl', 'rdf', 'n3', 'nt', 'txt'];
    const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
    
    if (allowedMimes.includes(file.mimetype) || 
        (fileExtension && allowedExtensions.includes(fileExtension))) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only TTL, RDF, N3, and NT files are allowed.'));
    }
  }
});

// TTL validator function
function validateTTLSyntax(content: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const lines = content.split('\n');

  let inStatement = false;
  let statementDepth = 0;
  let inString = false;
  let stringChar = '';

  // Basic validation checks
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNum = i + 1;

    if (!line || line.startsWith('#')) continue;

    // Check prefix declarations
    if (line.startsWith('@prefix')) {
      const prefixMatch = line.match(/@prefix\s+([^:]*):?\s*<([^>]+)>\s*\./);
      if (!prefixMatch) {
        errors.push(`Line ${lineNum}: Invalid @prefix declaration syntax`);
      }
      continue;
    }

    // Check for basic TTL syntax issues
    if (line.includes(';;')) {
      errors.push(`Line ${lineNum}: Double semicolon found - invalid syntax`);
    }

    // Check for unclosed strings
    let lineInString = false;
    let lineStringChar = '';
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      const prevChar = j > 0 ? line[j - 1] : '';

      if (!lineInString && (char === '"' || char === "'")) {
        lineInString = true;
        lineStringChar = char;
      } else if (lineInString && char === lineStringChar && prevChar !== '\\') {
        lineInString = false;
        lineStringChar = '';
      }
    }

    if (lineInString) {
      errors.push(`Line ${lineNum}: Unclosed string literal`);
    }
  }

  // Check overall structure
  const prefixCount = (content.match(/@prefix/g) || []).length;
  const statementCount = content.split('.').filter(s => s.trim() && !s.includes('@prefix')).length;

  if (prefixCount === 0) {
    errors.push('No @prefix declarations found - TTL files typically require namespace prefixes');
  }

  if (statementCount === 0) {
    errors.push('No RDF statements found in the file');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// Minimal working TTL parser for basic RDF statements
async function parseRdfAndCreateTriples(content: string, format: string, graphId: string) {
  console.log('Starting TTL parsing for graph:', graphId);

  const prefixes = new Map<string, string>();
  const statements: { subject: string, predicate: string, object: string, objectType: string }[] = [];

  try {
    // Extract prefixes
    const prefixRegex = /@prefix\s+([^:]*):?\s*<([^>]+)>\s*\./g;
    let match;
    while ((match = prefixRegex.exec(content)) !== null) {
      const prefix = match[1].trim();
      const uri = match[2];
      prefixes.set(prefix, uri);
      console.log(`Found prefix: ${prefix} -> ${uri}`);
    }

    // Process TTL content line by line
    const lines = content.split('\n');
    let currentSubject = '';
    let statementBuffer = '';

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines, comments, and prefixes
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('@prefix')) {
        continue;
      }

      statementBuffer += ' ' + trimmed;

      // Check if statement is complete (ends with .)
      if (trimmed.endsWith('.')) {
        const statement = statementBuffer.trim().replace(/\.$/, '');
        if (statement) {
          const parsed = parseBasicStatement(statement, prefixes);
          if (parsed) {
            statements.push(parsed);
          }
        }
        statementBuffer = '';
      }
    }

    console.log(`Parsed ${statements.length} RDF statements`);

    // Get unique subjects for positioning
    const subjects = new Set(statements.map(s => s.subject));
    const subjectArray = Array.from(subjects);

    // Create circular positioning
    const positions = new Map<string, {x: number, y: number}>();
    for (let i = 0; i < subjectArray.length; i++) {
      const radius = 200 + (Math.floor(i / 8) * 100);
      const angle = (i % 8) * (2 * Math.PI / 8);
      const x = Math.round(600 + radius * Math.cos(angle));
      const y = Math.round(400 + radius * Math.sin(angle));
      positions.set(subjectArray[i], { x, y });
    }

    // Store triples in database
    for (const stmt of statements) {
      await storage.createRdfTriple({
        graphId,
        subject: stmt.subject,
        predicate: stmt.predicate,
        object: stmt.object,
        objectType: stmt.objectType
      });
    }

    // Add position data
    for (const [subject, position] of Array.from(positions.entries())) {
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

    console.log('TTL parsing completed successfully');

  } catch (error) {
    console.error('TTL parsing failed:', error);
    throw error;
  }
}

// Parse a basic RDF statement (subject predicate object)
function parseBasicStatement(
  statement: string, 
  prefixes: Map<string, string>
): { subject: string, predicate: string, object: string, objectType: string } | null {
  try {
    // Handle statements with semicolons (multiple predicates)
    if (statement.includes(';')) {
      const parts = statement.split(';');
      const firstPart = parts[0].trim();
      const tokens = firstPart.split(/\s+/);

      if (tokens.length >= 3) {
        const subject = expandPrefix(tokens[0], prefixes);
        const predicate = expandPrefix(tokens[1], prefixes);
        const objectStr = tokens.slice(2).join(' ');
        const { value, type } = parseObjectValue(objectStr, prefixes);

        return { subject, predicate, object: value, objectType: type };
      }
    } else {
      // Simple statement
      const tokens = statement.split(/\s+/);
      if (tokens.length >= 3) {
        const subject = expandPrefix(tokens[0], prefixes);
        const predicate = expandPrefix(tokens[1], prefixes);
        const objectStr = tokens.slice(2).join(' ');
        const { value, type } = parseObjectValue(objectStr, prefixes);

        return { subject, predicate, object: value, objectType: type };
      }
    }
  } catch (error) {
    console.error('Error parsing basic statement:', error);
  }

  return null;
}

// Split content into individual statements
function splitStatements(content: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const prevChar = i > 0 ? content[i - 1] : '';

    if (!inQuotes && (char === '"' || char === "'")) {
      inQuotes = true;
      quoteChar = char;
    } else if (inQuotes && char === quoteChar && prevChar !== '\\') {
      inQuotes = false;
      quoteChar = '';
    } else if (!inQuotes && char === '.') {
      // Check if this is end of statement (not part of a URI or literal)
      const nextChar = i < content.length - 1 ? content[i + 1] : '';
      if (nextChar === '' || /\s/.test(nextChar)) {
        if (current.trim()) {
          statements.push(current.trim());
        }
        current = '';
        continue;
      }
    }

    current += char;
  }

  if (current.trim()) {
    statements.push(current.trim());
  }

  return statements;
}

// Enhanced statement parser with better error handling
function parseStatement(
  statement: string,
  prefixes: Map<string, string>,
  statements: { subject: string, predicate: string, object: string, objectType: string }[],
  subjects: Set<string>
) {
  try {
    const normalized = statement.replace(/\s+/g, ' ').trim();

    // Skip empty statements
    if (!normalized) return;

    // Split into tokens, being careful with quoted strings
    const tokens = tokenizeStatement(normalized);
    if (tokens.length < 3) return;

    const subject = expandPrefix(tokens[0], prefixes);
    if (!subject) return;

    subjects.add(subject);

    // Parse predicate-object pairs
    let i = 1;
    while (i < tokens.length) {
      if (i + 1 >= tokens.length) break;

      const predicate = expandPrefix(tokens[i], prefixes);
      if (!predicate) {
        i++;
        continue;
      }

      const objectStr = tokens[i + 1];
      const { value, type } = parseObjectValue(objectStr, prefixes);

      statements.push({
        subject,
        predicate,
        object: value,
        objectType: type
      });

      i += 2;

      // Skip semicolon if present
      if (i < tokens.length && tokens[i] === ';') {
        i++;
      }
    }
  } catch (error) {
    console.error('Error parsing statement:', statement.substring(0, 100), error);
  }
}

// Better tokenizer that handles TTL syntax properly
function tokenizeStatement(statement: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';

  for (let i = 0; i < statement.length; i++) {
    const char = statement[i];
    const prevChar = i > 0 ? statement[i - 1] : '';

    if (!inQuotes && (char === '"' || char === "'")) {
      inQuotes = true;
      quoteChar = char;
      current += char;
    } else if (inQuotes && char === quoteChar && prevChar !== '\\') {
      inQuotes = false;
      quoteChar = '';
      current += char;
    } else if (!inQuotes && /\s/.test(char)) {
      if (current.trim()) {
        tokens.push(current.trim());
        current = '';
      }
    } else if (!inQuotes && char === ';') {
      if (current.trim()) {
        tokens.push(current.trim());
        current = '';
      }
      tokens.push(';');
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    tokens.push(current.trim());
  }

  return tokens;
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

// Complex statement parser for TTL format with semicolon support
function parseComplexStatement(
  statement: string,
  prefixes: Map<string, string>,
  statements: { subject: string, predicate: string, object: string, objectType: string }[],
  subjects: Set<string>
) {
  if (!statement.trim()) return;

  // Extract subject (first term)
  const tokens = statement.trim().split(/\s+/);
  if (tokens.length < 3) return;

  const subject = expandPrefix(tokens[0], prefixes);
  subjects.add(subject);

  // Remove subject from statement and process predicates
  const predicateSection = tokens.slice(1).join(' ');

  // Split by semicolons to handle multiple predicates
  const predicateParts = predicateSection.split(';');

  for (const part of predicateParts) {
    const trimmedPart = part.trim();
    if (!trimmedPart) continue;

    // Split into predicate and object(s)
    const partTokens = trimmedPart.split(/\s+/);
    if (partTokens.length < 2) continue;

    const predicate = expandPrefix(partTokens[0], prefixes);
    const objectStr = partTokens.slice(1).join(' ');

    // Handle multiple objects separated by commas
    const objects = splitObjectsByComma(objectStr);

    for (const obj of objects) {
      const { value, type } = parseObjectValue(obj.trim(), prefixes);

      statements.push({
        subject,
        predicate,
        object: value,
        objectType: type
      });
    }
  }
}

// Helper function to split objects by commas while respecting quotes
function splitObjectsByComma(objectsStr: string): string[] {
  const objects: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';

  for (let i = 0; i < objectsStr.length; i++) {
    const char = objectsStr[i];
    const prevChar = i > 0 ? objectsStr[i - 1] : '';

    if (!inQuotes && (char === '"' || char === "'")) {
      inQuotes = true;
      quoteChar = char;
      current += char;
    } else if (inQuotes && char === quoteChar && prevChar !== '\\') {
      inQuotes = false;
      quoteChar = '';
      current += char;
    } else if (!inQuotes && char === ',') {
      if (current.trim()) {
        objects.push(current.trim());
      }
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    objects.push(current.trim());
  }

  return objects.length > 0 ? objects : [objectsStr];
}

// Helper function to split objects while respecting quoted strings
function splitObjects(objectsStr: string): string[] {
  const objects: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < objectsStr.length) {
    const char = objectsStr[i];

    if (char === '"' && (i === 0 || objectsStr[i-1] !== '\\')) {
      inQuotes = !inQuotes;
      current += char;
    } else if (char === ',' && !inQuotes) {
      if (current.trim()) {
        objects.push(current.trim());
      }
      current = '';
    } else {
      current += char;
    }

    i++;
  }

  if (current.trim()) {
    objects.push(current.trim());
  }

  return objects;
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
      // Decode the URL-encoded nodeId
      const nodeId = decodeURIComponent(req.params.nodeId);
      const { x, y } = req.body;

      console.log('Updating position for node:', nodeId, 'to coordinates:', { x, y });

      if (typeof x !== 'number' || typeof y !== 'number') {
        return res.status(400).json({ message: "Invalid coordinates" });
      }

      const success = await storage.updateNodePosition(nodeId, x, y);

      if (success) {
        // Return the exact coordinates that were saved
        res.json({ success: true, x: Math.round(x), y: Math.round(y) });
      } else {
        console.error('Node not found for position update:', nodeId);
        res.status(404).json({ message: "Node not found" });
      }
    } catch (error) {
      console.error('Position update error:', error);
      res.status(500).json({ message: "Failed to update node position" });
    }
  });

  // Update node properties (label, type, data)
  app.patch("/api/nodes/:nodeId", async (req, res) => {
    try {
      // Decode the URL-encoded nodeId
      const nodeId = decodeURIComponent(req.params.nodeId);
      const { label, type, data } = req.body;

      console.log('Updating properties for node:', nodeId);
      console.log('Request body:', { label, type, data });

      // Validate input
      if (!nodeId) {
        return res.status(400).json({ message: "Node ID is required" });
      }

      // Ensure we have at least one field to update
      if (label === undefined && type === undefined && data === undefined) {
        return res.status(400).json({ message: "At least one field (label, type, or data) must be provided" });
      }

      const success = await storage.updateNodeProperties(nodeId, { label, type, data });

      if (!success) {
        console.error('Node not found for property update:', nodeId);
        return res.status(404).json({ message: "Node not found" });
      }

      console.log('Node properties updated successfully');
      res.json({ success: true });
    } catch (error) {
      console.error('Node property update error:', error);
      res.status(500).json({ message: "Failed to update node", error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // Delete node
  app.delete("/api/nodes/:nodeId", async (req, res) => {
    try {
      // Decode the URL-encoded nodeId
      const nodeId = decodeURIComponent(req.params.nodeId);

      console.log('Deleting node:', nodeId);

      const deleted = await storage.deleteNodeFromTriples(nodeId);

      if (!deleted) {
        console.error('Node not found for deletion:', nodeId);
        return res.status(404).json({ message: "Node not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Node deletion error:', error);
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

  // Upload RDF/TTL file to existing graph
  app.post("/api/graphs/:graphId/upload", upload.single('file'), async (req, res) => {
    try {
      const { graphId } = req.params;

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const fileContent = req.file.buffer.toString('utf8');
      const fileExtension = req.file.originalname.split('.').pop()?.toLowerCase();

      // Validate file type
      if (!['ttl', 'rdf', 'n3', 'nt'].includes(fileExtension || '')) {
        return res.status(400).json({ message: "Unsupported file format. Only TTL, RDF, N3, and NT files are supported." });
      }

      // Verify graph exists
      const graph = await storage.getGraph(graphId);
      if (!graph) {
        return res.status(404).json({ message: "Graph not found" });
      }

      // Parse RDF content and create triples
      await parseRdfAndCreateTriples(fileContent, fileExtension || 'ttl', graphId);

      res.json({ 
        success: true, 
        message: "RDF file uploaded successfully",
        graphId: graphId
      });
    } catch (error) {
      console.error('RDF upload error:', error);
      res.status(500).json({ 
        message: "Failed to upload RDF file", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // Upload RDF/TTL file (create new graph)
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

  // Validation middleware
  const validateCodeReview = [
    body('code').isString().isLength({ min: 1, max: 50000 }).trim(),
    body('filename').isString().isLength({ min: 1, max: 255 }).trim(),
    body('language').isString().isIn(['typescript', 'javascript', 'python', 'java', 'cpp', 'rust', 'go']),
    body('context').optional().isString().isLength({ max: 1000 }).trim()
  ];

  // Code review routes
  app.post('/api/code-review', validateCodeReview, async (req, res) => {
    try {
      // Check validation results
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: errors.array() 
        });
      }

      const { code, filename, language } = req.body;

      if (!code || !filename || !language) {
        return res.status(400).json({ error: 'Missing required fields: code, filename, language' });
      }

      const review = await reviewCode({ code, filename, language });
      res.json(review);
    } catch (error) {
      console.error('Code review error:', error);
      res.status(500).json({ error: 'Failed to review code' });
    }
  });

  app.post('/api/fix-bugs', validateCodeReview, async (req, res) => {
    try {
      // Check validation results
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: errors.array() 
        });
      }

      const { code, filename, language } = req.body;

      if (!code || !filename || !language) {
        return res.status(400).json({ error: 'Missing required fields: code, filename, language' });
      }

      const fixedCode = await fixBugs(code, filename, language);
      res.json({ fixedCode });
    } catch (error) {
      console.error('Bug fixing error:', error);
      res.status(500).json({ error: 'Failed to fix bugs' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}