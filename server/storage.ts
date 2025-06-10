import { 
  graphs, 
  graphNodes, 
  graphEdges,
  rdfTriples,
  visibilitySets,
  type Graph, 
  type GraphNode, 
  type GraphEdge, 
  type RdfTriple,
  type VisibilitySet,
  type InsertGraph, 
  type InsertGraphNode, 
  type InsertGraphEdge,
  type InsertRdfTriple,
  type InsertVisibilitySet
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

export interface IStorage {
  // Graph operations
  createGraph(graph: InsertGraph): Promise<Graph>;
  getGraph(graphId: string): Promise<Graph | undefined>;
  getAllGraphs(): Promise<Graph[]>;
  updateGraph(graphId: string, updates: Partial<InsertGraph>): Promise<Graph | undefined>;
  deleteGraph(graphId: string): Promise<boolean>;

  // Node operations
  createNode(node: InsertGraphNode): Promise<GraphNode>;
  getNode(nodeId: string): Promise<GraphNode | undefined>;
  getNodesByGraph(graphId: string): Promise<GraphNode[]>;
  updateNode(nodeId: string, updates: Partial<InsertGraphNode>): Promise<GraphNode | undefined>;
  deleteNode(nodeId: string): Promise<boolean>;
  deleteNodesByGraph(graphId: string): Promise<boolean>;

  // Edge operations
  createEdge(edge: InsertGraphEdge): Promise<GraphEdge>;
  getEdge(edgeId: string): Promise<GraphEdge | undefined>;
  getEdgesByGraph(graphId: string): Promise<GraphEdge[]>;
  getEdgesByNode(nodeId: string): Promise<GraphEdge[]>;
  updateEdge(edgeId: string, updates: Partial<InsertGraphEdge>): Promise<GraphEdge | undefined>;
  deleteEdge(edgeId: string): Promise<boolean>;
  deleteEdgesByGraph(graphId: string): Promise<boolean>;

  // RDF Triple operations for SPARQL support
  createRdfTriple(triple: InsertRdfTriple): Promise<RdfTriple>;
  getRdfTriplesByGraph(graphId: string): Promise<RdfTriple[]>;
  deleteRdfTriplesByGraph(graphId: string): Promise<boolean>;
  
  // Visibility Set operations
  createVisibilitySet(visibilitySet: InsertVisibilitySet): Promise<VisibilitySet>;
  getVisibilitySetsByGraph(graphId: string): Promise<VisibilitySet[]>;
  getActiveVisibilitySet(graphId: string): Promise<VisibilitySet | undefined>;
  setActiveVisibilitySet(graphId: string, setId: string): Promise<boolean>;
  executeVisibilityQuery(graphId: string, sparqlQuery: string): Promise<string[]>;
}

export class MemStorage implements IStorage {
  private graphs: Map<string, Graph>;
  private nodes: Map<string, GraphNode>;
  private edges: Map<string, GraphEdge>;
  private currentGraphId: number;
  private currentNodeId: number;
  private currentEdgeId: number;

  constructor() {
    this.graphs = new Map();
    this.nodes = new Map();
    this.edges = new Map();
    this.currentGraphId = 1;
    this.currentNodeId = 1;
    this.currentEdgeId = 1;
  }

  // Graph operations
  async createGraph(insertGraph: InsertGraph): Promise<Graph> {
    const id = this.currentGraphId++;
    const now = new Date();
    const graph: Graph = {
      ...insertGraph,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.graphs.set(graph.graphId, graph);
    return graph;
  }

  async getGraph(graphId: string): Promise<Graph | undefined> {
    return this.graphs.get(graphId);
  }

  async getAllGraphs(): Promise<Graph[]> {
    return Array.from(this.graphs.values());
  }

  async updateGraph(graphId: string, updates: Partial<InsertGraph>): Promise<Graph | undefined> {
    const graph = this.graphs.get(graphId);
    if (!graph) return undefined;

    const updatedGraph: Graph = {
      ...graph,
      ...updates,
      updatedAt: new Date(),
    };
    this.graphs.set(graphId, updatedGraph);
    return updatedGraph;
  }

  async deleteGraph(graphId: string): Promise<boolean> {
    const deleted = this.graphs.delete(graphId);
    if (deleted) {
      await this.deleteNodesByGraph(graphId);
      await this.deleteEdgesByGraph(graphId);
    }
    return deleted;
  }

  // Node operations
  async createNode(insertNode: InsertGraphNode): Promise<GraphNode> {
    const id = this.currentNodeId++;
    const now = new Date();
    const node: GraphNode = {
      ...insertNode,
      id,
      createdAt: now,
    };
    this.nodes.set(node.nodeId, node);
    return node;
  }

  async getNode(nodeId: string): Promise<GraphNode | undefined> {
    return this.nodes.get(nodeId);
  }

  async getNodesByGraph(graphId: string): Promise<GraphNode[]> {
    return Array.from(this.nodes.values()).filter(node => node.graphId === graphId);
  }

  async updateNode(nodeId: string, updates: Partial<InsertGraphNode>): Promise<GraphNode | undefined> {
    const node = this.nodes.get(nodeId);
    if (!node) return undefined;

    const updatedNode: GraphNode = {
      ...node,
      ...updates,
    };
    this.nodes.set(nodeId, updatedNode);
    return updatedNode;
  }

  async deleteNode(nodeId: string): Promise<boolean> {
    const deleted = this.nodes.delete(nodeId);
    if (deleted) {
      // Delete associated edges
      const edges = await this.getEdgesByNode(nodeId);
      for (const edge of edges) {
        await this.deleteEdge(edge.edgeId);
      }
    }
    return deleted;
  }

  async deleteNodesByGraph(graphId: string): Promise<boolean> {
    const nodes = await this.getNodesByGraph(graphId);
    for (const node of nodes) {
      this.nodes.delete(node.nodeId);
    }
    return true;
  }

  // Edge operations
  async createEdge(insertEdge: InsertGraphEdge): Promise<GraphEdge> {
    const id = this.currentEdgeId++;
    const now = new Date();
    const edge: GraphEdge = {
      ...insertEdge,
      id,
      createdAt: now,
    };
    this.edges.set(edge.edgeId, edge);
    return edge;
  }

  async getEdge(edgeId: string): Promise<GraphEdge | undefined> {
    return this.edges.get(edgeId);
  }

  async getEdgesByGraph(graphId: string): Promise<GraphEdge[]> {
    return Array.from(this.edges.values()).filter(edge => edge.graphId === graphId);
  }

  async getEdgesByNode(nodeId: string): Promise<GraphEdge[]> {
    return Array.from(this.edges.values()).filter(
      edge => edge.sourceId === nodeId || edge.targetId === nodeId
    );
  }

  async updateEdge(edgeId: string, updates: Partial<InsertGraphEdge>): Promise<GraphEdge | undefined> {
    const edge = this.edges.get(edgeId);
    if (!edge) return undefined;

    const updatedEdge: GraphEdge = {
      ...edge,
      ...updates,
    };
    this.edges.set(edgeId, updatedEdge);
    return updatedEdge;
  }

  async deleteEdge(edgeId: string): Promise<boolean> {
    return this.edges.delete(edgeId);
  }

  async deleteEdgesByGraph(graphId: string): Promise<boolean> {
    const edges = await this.getEdgesByGraph(graphId);
    for (const edge of edges) {
      this.edges.delete(edge.edgeId);
    }
    return true;
  }

  // RDF Triple operations (stub implementations for MemStorage)
  async createRdfTriple(triple: InsertRdfTriple): Promise<RdfTriple> {
    throw new Error("RDF triples not supported in memory storage");
  }

  async getRdfTriplesByGraph(graphId: string): Promise<RdfTriple[]> {
    return [];
  }

  async deleteRdfTriplesByGraph(graphId: string): Promise<boolean> {
    return true;
  }

  // Visibility Set operations (stub implementations for MemStorage)
  async createVisibilitySet(visibilitySet: InsertVisibilitySet): Promise<VisibilitySet> {
    throw new Error("Visibility sets not supported in memory storage");
  }

  async getVisibilitySetsByGraph(graphId: string): Promise<VisibilitySet[]> {
    return [];
  }

  async getActiveVisibilitySet(graphId: string): Promise<VisibilitySet | undefined> {
    return undefined;
  }

  async setActiveVisibilitySet(graphId: string, setId: string): Promise<boolean> {
    return false;
  }

  async executeVisibilityQuery(graphId: string, sparqlQuery: string): Promise<string[]> {
    // Simple fallback - return all node IDs
    const nodes = Array.from(this.nodes.values()).filter(node => node.graphId === graphId);
    return nodes.map(node => node.nodeId);
  }
}

export class DatabaseStorage implements IStorage {
  async getGraph(graphId: string): Promise<Graph | undefined> {
    const [graph] = await db.select().from(graphs).where(eq(graphs.graphId, graphId));
    return graph || undefined;
  }

  async getAllGraphs(): Promise<Graph[]> {
    return await db.select().from(graphs).orderBy(graphs.createdAt);
  }

  async createGraph(insertGraph: InsertGraph): Promise<Graph> {
    const [graph] = await db
      .insert(graphs)
      .values({
        graphId: nanoid(),
        ...insertGraph,
        description: insertGraph.description || null,
        nodeCount: insertGraph.nodeCount || 0,
        edgeCount: insertGraph.edgeCount || 0,
      })
      .returning();
    return graph;
  }

  async updateGraph(graphId: string, updates: Partial<InsertGraph>): Promise<Graph | undefined> {
    const [graph] = await db
      .update(graphs)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(graphs.graphId, graphId))
      .returning();
    return graph || undefined;
  }

  async deleteGraph(graphId: string): Promise<boolean> {
    const result = await db.delete(graphs).where(eq(graphs.graphId, graphId));
    if (result.rowCount && result.rowCount > 0) {
      await this.deleteNodesByGraph(graphId);
      await this.deleteEdgesByGraph(graphId);
      return true;
    }
    return false;
  }

  async getNode(nodeId: string): Promise<GraphNode | undefined> {
    const [node] = await db.select().from(graphNodes).where(eq(graphNodes.nodeId, nodeId));
    return node || undefined;
  }

  async getNodesByGraph(graphId: string): Promise<GraphNode[]> {
    return await db.select().from(graphNodes).where(eq(graphNodes.graphId, graphId));
  }

  async createNode(insertNode: InsertGraphNode): Promise<GraphNode> {
    const [node] = await db
      .insert(graphNodes)
      .values({
        nodeId: insertNode.nodeId,
        label: insertNode.label,
        type: insertNode.type,
        graphId: insertNode.graphId,
        data: insertNode.data || {},
        x: insertNode.x ?? null,
        y: insertNode.y ?? null,
      })
      .returning();
    return node;
  }

  async updateNode(nodeId: string, updates: Partial<InsertGraphNode>): Promise<GraphNode | undefined> {
    const [node] = await db
      .update(graphNodes)
      .set(updates)
      .where(eq(graphNodes.nodeId, nodeId))
      .returning();
    return node || undefined;
  }

  async deleteNode(nodeId: string): Promise<boolean> {
    const result = await db.delete(graphNodes).where(eq(graphNodes.nodeId, nodeId));
    if (result.rowCount && result.rowCount > 0) {
      // Delete associated edges
      await db.delete(graphEdges).where(
        eq(graphEdges.sourceId, nodeId)
      );
      await db.delete(graphEdges).where(
        eq(graphEdges.targetId, nodeId)
      );
      return true;
    }
    return false;
  }

  async deleteNodesByGraph(graphId: string): Promise<boolean> {
    await db.delete(graphNodes).where(eq(graphNodes.graphId, graphId));
    return true;
  }

  async getEdge(edgeId: string): Promise<GraphEdge | undefined> {
    const [edge] = await db.select().from(graphEdges).where(eq(graphEdges.edgeId, edgeId));
    return edge || undefined;
  }

  async getEdgesByGraph(graphId: string): Promise<GraphEdge[]> {
    return await db.select().from(graphEdges).where(eq(graphEdges.graphId, graphId));
  }

  async getEdgesByNode(nodeId: string): Promise<GraphEdge[]> {
    const sourceEdges = await db.select().from(graphEdges).where(eq(graphEdges.sourceId, nodeId));
    const targetEdges = await db.select().from(graphEdges).where(eq(graphEdges.targetId, nodeId));
    return [...sourceEdges, ...targetEdges];
  }

  async createEdge(insertEdge: InsertGraphEdge): Promise<GraphEdge> {
    const [edge] = await db
      .insert(graphEdges)
      .values({
        edgeId: insertEdge.edgeId,
        sourceId: insertEdge.sourceId,
        targetId: insertEdge.targetId,
        type: insertEdge.type,
        graphId: insertEdge.graphId,
        label: insertEdge.label ?? null,
        data: insertEdge.data || {},
      })
      .returning();
    return edge;
  }

  async updateEdge(edgeId: string, updates: Partial<InsertGraphEdge>): Promise<GraphEdge | undefined> {
    const [edge] = await db
      .update(graphEdges)
      .set(updates)
      .where(eq(graphEdges.edgeId, edgeId))
      .returning();
    return edge || undefined;
  }

  async deleteEdge(edgeId: string): Promise<boolean> {
    const result = await db.delete(graphEdges).where(eq(graphEdges.edgeId, edgeId));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async deleteEdgesByGraph(graphId: string): Promise<boolean> {
    await db.delete(graphEdges).where(eq(graphEdges.graphId, graphId));
    return true;
  }

  // RDF Triple operations for SPARQL support
  async createRdfTriple(triple: InsertRdfTriple): Promise<RdfTriple> {
    const [rdfTriple] = await db.insert(rdfTriples).values(triple).returning();
    return rdfTriple;
  }

  async getRdfTriplesByGraph(graphId: string): Promise<RdfTriple[]> {
    return await db.select().from(rdfTriples).where(eq(rdfTriples.graphId, graphId));
  }

  async deleteRdfTriplesByGraph(graphId: string): Promise<boolean> {
    await db.delete(rdfTriples).where(eq(rdfTriples.graphId, graphId));
    return true;
  }

  // Visibility Set operations
  async createVisibilitySet(visibilitySet: InsertVisibilitySet): Promise<VisibilitySet> {
    const [newSet] = await db.insert(visibilitySets).values(visibilitySet).returning();
    return newSet;
  }

  async getVisibilitySetsByGraph(graphId: string): Promise<VisibilitySet[]> {
    return await db.select().from(visibilitySets).where(eq(visibilitySets.graphId, graphId));
  }

  async getActiveVisibilitySet(graphId: string): Promise<VisibilitySet | undefined> {
    const [activeSet] = await db.select().from(visibilitySets)
      .where(and(eq(visibilitySets.graphId, graphId), eq(visibilitySets.isActive, 'true')));
    return activeSet || undefined;
  }

  async setActiveVisibilitySet(graphId: string, setId: string): Promise<boolean> {
    // First, deactivate all visibility sets for this graph
    await db.update(visibilitySets)
      .set({ isActive: 'false' })
      .where(eq(visibilitySets.graphId, graphId));
    
    // Then activate the specified set
    await db.update(visibilitySets)
      .set({ isActive: 'true' })
      .where(and(eq(visibilitySets.graphId, graphId), eq(visibilitySets.setId, setId)));
    
    return true;
  }

  async executeVisibilityQuery(graphId: string, sparqlQuery: string): Promise<string[]> {
    // Simple SPARQL-like query processor
    // For now, supports basic patterns like SELECT ?node WHERE { ?node rdf:type ?type }
    
    try {
      // Parse simple SPARQL queries and convert to SQL
      const visibleNodeIds: string[] = [];
      
      // Get all nodes for the graph
      const nodes = await this.getNodesByGraph(graphId);
      const triples = await this.getRdfTriplesByGraph(graphId);
      
      // Basic pattern matching for SPARQL queries
      if (sparqlQuery.includes('rdf:type')) {
        // Extract type from query pattern like "?node rdf:type ex:Person"
        const typeMatch = sparqlQuery.match(/rdf:type\s+(\w+:\w+|\w+)/);
        if (typeMatch) {
          const targetType = typeMatch[1].replace(/^\w+:/, ''); // Remove namespace prefix
          
          // Find nodes with matching type in RDF triples
          const matchingTriples = triples.filter(triple => 
            triple.predicate === 'rdf:type' && 
            triple.object.includes(targetType)
          );
          
          visibleNodeIds.push(...matchingTriples.map(triple => triple.subject));
        }
      } else if (sparqlQuery.includes('SELECT') && sparqlQuery.includes('*')) {
        // Show all nodes for SELECT * queries
        visibleNodeIds.push(...nodes.map(node => node.nodeId));
      } else if (sparqlQuery.includes('hasProperty')) {
        // Custom property-based filtering
        const propertyMatch = sparqlQuery.match(/hasProperty\s+"([^"]+)"/);
        if (propertyMatch) {
          const propertyName = propertyMatch[1];
          
          // Filter nodes based on data properties
          const matchingNodes = nodes.filter(node => {
            const data = node.data as any;
            return data && data[propertyName] !== undefined;
          });
          
          visibleNodeIds.push(...matchingNodes.map(node => node.nodeId));
        }
      }
      
      return [...new Set(visibleNodeIds)]; // Remove duplicates
    } catch (error) {
      console.error('Error executing SPARQL query:', error);
      return [];
    }
  }
}

export const storage = new DatabaseStorage();
