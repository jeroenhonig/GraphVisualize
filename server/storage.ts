import { 
  graphs, 
  rdfTriples, 
  visibilitySets, 
  type Graph, 
  type RdfTriple, 
  type VisibilitySet, 
  type InsertGraph, 
  type InsertRdfTriple, 
  type InsertVisibilitySet,
  type VisualizationNode,
  type VisualizationEdge,
  type GraphData,
  RDF_PREDICATES,
  RDF_TYPES
} from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

export interface IStorage {
  // Graph operations
  createGraph(graph: InsertGraph): Promise<Graph>;
  getGraph(graphId: string): Promise<Graph | undefined>;
  getAllGraphs(): Promise<Graph[]>;
  updateGraph(graphId: string, updates: Partial<InsertGraph>): Promise<Graph | undefined>;
  deleteGraph(graphId: string): Promise<boolean>;

  // RDF Triple operations (core data storage)
  createRdfTriple(triple: InsertRdfTriple): Promise<RdfTriple>;
  getRdfTriplesByGraph(graphId: string): Promise<RdfTriple[]>;
  deleteRdfTriplesByGraph(graphId: string): Promise<boolean>;
  
  // Node operations via RDF triples
  createNodeFromTriples(graphId: string, nodeId: string, label: string, type: string, data: Record<string, any>, x?: number, y?: number): Promise<void>;
  updateNodePosition(nodeId: string, x: number, y: number): Promise<boolean>;
  deleteNodeFromTriples(nodeId: string): Promise<boolean>;
  
  // Edge operations via RDF triples
  createEdgeFromTriples(graphId: string, edgeId: string, sourceId: string, targetId: string, label?: string, type?: string): Promise<void>;
  deleteEdgeFromTriples(edgeId: string): Promise<boolean>;
  
  // Convert RDF triples to visualization format
  getVisualizationData(graphId: string): Promise<GraphData>;
  
  // Visibility Set operations
  createVisibilitySet(visibilitySet: InsertVisibilitySet): Promise<VisibilitySet>;
  getVisibilitySetsByGraph(graphId: string): Promise<VisibilitySet[]>;
  getActiveVisibilitySet(graphId: string): Promise<VisibilitySet | undefined>;
  setActiveVisibilitySet(graphId: string, setId: string): Promise<boolean>;
  executeVisibilityQuery(graphId: string, sparqlQuery: string): Promise<string[]>;
}

export class DatabaseStorage implements IStorage {
  async createGraph(insertGraph: InsertGraph): Promise<Graph> {
    const [graph] = await db
      .insert(graphs)
      .values(insertGraph)
      .returning();
    return graph;
  }

  async getGraph(graphId: string): Promise<Graph | undefined> {
    const [graph] = await db.select().from(graphs).where(eq(graphs.graphId, graphId));
    return graph || undefined;
  }

  async getAllGraphs(): Promise<Graph[]> {
    return await db.select().from(graphs);
  }

  async updateGraph(graphId: string, updates: Partial<InsertGraph>): Promise<Graph | undefined> {
    const [updated] = await db
      .update(graphs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(graphs.graphId, graphId))
      .returning();
    return updated || undefined;
  }

  async deleteGraph(graphId: string): Promise<boolean> {
    // Delete all RDF triples for this graph
    await this.deleteRdfTriplesByGraph(graphId);
    
    // Delete visibility sets
    await db.delete(visibilitySets).where(eq(visibilitySets.graphId, graphId));
    
    // Delete the graph
    const result = await db.delete(graphs).where(eq(graphs.graphId, graphId));
    return (result.rowCount ?? 0) > 0;
  }

  async createRdfTriple(triple: InsertRdfTriple): Promise<RdfTriple> {
    const [created] = await db
      .insert(rdfTriples)
      .values(triple)
      .returning();
    return created;
  }

  async getRdfTriplesByGraph(graphId: string): Promise<RdfTriple[]> {
    return await db
      .select()
      .from(rdfTriples)
      .where(eq(rdfTriples.graphId, graphId));
  }

  async deleteRdfTriplesByGraph(graphId: string): Promise<boolean> {
    const result = await db.delete(rdfTriples).where(eq(rdfTriples.graphId, graphId));
    return (result.rowCount ?? 0) > 0;
  }

  async createNodeFromTriples(
    graphId: string, 
    nodeId: string, 
    label: string, 
    type: string, 
    data: Record<string, any>, 
    x: number = 0, 
    y: number = 0
  ): Promise<void> {
    const triples: InsertRdfTriple[] = [
      // Node existence and type
      {
        graphId,
        subject: nodeId,
        predicate: RDF_PREDICATES.TYPE,
        object: RDF_TYPES.NODE,
        objectType: "uri"
      },
      {
        graphId,
        subject: nodeId,
        predicate: RDF_PREDICATES.NODE_TYPE,
        object: type,
        objectType: "literal"
      },
      {
        graphId,
        subject: nodeId,
        predicate: RDF_PREDICATES.LABEL,
        object: label,
        objectType: "literal"
      },
      // Position
      {
        graphId,
        subject: nodeId,
        predicate: RDF_PREDICATES.POSITION_X,
        object: x.toString(),
        objectType: "literal"
      },
      {
        graphId,
        subject: nodeId,
        predicate: RDF_PREDICATES.POSITION_Y,
        object: y.toString(),
        objectType: "literal"
      }
    ];

    // Add data properties
    for (const [key, value] of Object.entries(data)) {
      triples.push({
        graphId,
        subject: nodeId,
        predicate: `${RDF_PREDICATES.DATA_PROPERTY}:${key}`,
        object: typeof value === 'string' ? value : JSON.stringify(value),
        objectType: "literal"
      });
    }

    // Insert all triples
    await db.insert(rdfTriples).values(triples);
  }

  async updateNodePosition(nodeId: string, x: number, y: number): Promise<boolean> {
    // Update X position
    await db
      .update(rdfTriples)
      .set({ object: x.toString() })
      .where(
        and(
          eq(rdfTriples.subject, nodeId),
          eq(rdfTriples.predicate, RDF_PREDICATES.POSITION_X)
        )
      );

    // Update Y position
    await db
      .update(rdfTriples)
      .set({ object: y.toString() })
      .where(
        and(
          eq(rdfTriples.subject, nodeId),
          eq(rdfTriples.predicate, RDF_PREDICATES.POSITION_Y)
        )
      );

    return true;
  }

  async deleteNodeFromTriples(nodeId: string): Promise<boolean> {
    // Delete all triples where this node is the subject
    const result = await db.delete(rdfTriples).where(eq(rdfTriples.subject, nodeId));
    
    // Also delete triples where this node is the object (connections)
    await db.delete(rdfTriples).where(eq(rdfTriples.object, nodeId));
    
    return (result.rowCount ?? 0) > 0;
  }

  async createEdgeFromTriples(
    graphId: string, 
    edgeId: string, 
    sourceId: string, 
    targetId: string, 
    label?: string, 
    type: string = "connects"
  ): Promise<void> {
    const triples: InsertRdfTriple[] = [
      // Edge existence and type
      {
        graphId,
        subject: edgeId,
        predicate: RDF_PREDICATES.TYPE,
        object: RDF_TYPES.EDGE,
        objectType: "uri"
      },
      {
        graphId,
        subject: edgeId,
        predicate: RDF_PREDICATES.EDGE_TYPE,
        object: type,
        objectType: "literal"
      },
      // Connection between nodes
      {
        graphId,
        subject: sourceId,
        predicate: RDF_PREDICATES.CONNECTS_TO,
        object: targetId,
        objectType: "uri"
      }
    ];

    if (label) {
      triples.push({
        graphId,
        subject: edgeId,
        predicate: RDF_PREDICATES.LABEL,
        object: label,
        objectType: "literal"
      });
    }

    await db.insert(rdfTriples).values(triples);
  }

  async deleteEdgeFromTriples(edgeId: string): Promise<boolean> {
    const result = await db.delete(rdfTriples).where(eq(rdfTriples.subject, edgeId));
    return result.rowCount > 0;
  }

  async getVisualizationData(graphId: string): Promise<GraphData> {
    const graph = await this.getGraph(graphId);
    if (!graph) {
      throw new Error("Graph not found");
    }

    const allTriples = await this.getRdfTriplesByGraph(graphId);
    
    // Group triples by subject to construct nodes and edges
    const subjectTriples = new Map<string, RdfTriple[]>();
    for (const triple of allTriples) {
      if (!subjectTriples.has(triple.subject)) {
        subjectTriples.set(triple.subject, []);
      }
      subjectTriples.get(triple.subject)!.push(triple);
    }

    const nodes: VisualizationNode[] = [];
    const edges: VisualizationEdge[] = [];
    const processedEdges = new Set<string>();

    // Process each subject (potential node or edge)
    for (const [subject, subjectTripleList] of subjectTriples) {
      const typeTriple = subjectTripleList.find(t => t.predicate === RDF_PREDICATES.TYPE);
      
      if (typeTriple?.object === RDF_TYPES.NODE) {
        // This is a node
        const labelTriple = subjectTripleList.find(t => t.predicate === RDF_PREDICATES.LABEL);
        const nodeTypeTriple = subjectTripleList.find(t => t.predicate === RDF_PREDICATES.NODE_TYPE);
        const xTriple = subjectTripleList.find(t => t.predicate === RDF_PREDICATES.POSITION_X);
        const yTriple = subjectTripleList.find(t => t.predicate === RDF_PREDICATES.POSITION_Y);

        // Collect data properties
        const data: Record<string, any> = {};
        subjectTripleList
          .filter(t => t.predicate.startsWith(RDF_PREDICATES.DATA_PROPERTY))
          .forEach(t => {
            const key = t.predicate.split(':').pop() || 'unknown';
            try {
              data[key] = JSON.parse(t.object);
            } catch {
              data[key] = t.object;
            }
          });

        nodes.push({
          id: subject,
          label: labelTriple?.object || subject,
          type: nodeTypeTriple?.object || "unknown",
          data,
          x: parseInt(xTriple?.object || "0"),
          y: parseInt(yTriple?.object || "0"),
          visible: true
        });

        // Find connections from this node
        const connections = subjectTripleList.filter(t => t.predicate === RDF_PREDICATES.CONNECTS_TO);
        for (const conn of connections) {
          const edgeId = `${subject}-${conn.object}`;
          if (!processedEdges.has(edgeId)) {
            edges.push({
              id: edgeId,
              source: subject,
              target: conn.object,
              type: "connects",
              data: {}
            });
            processedEdges.add(edgeId);
          }
        }
      }
    }

    return {
      id: graph.id.toString(),
      graphId: graph.graphId,
      name: graph.name,
      description: graph.description || undefined,
      nodes,
      edges,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      visibleNodeIds: nodes.map(n => n.id)
    };
  }

  async createVisibilitySet(visibilitySet: InsertVisibilitySet): Promise<VisibilitySet> {
    const [created] = await db
      .insert(visibilitySets)
      .values(visibilitySet)
      .returning();
    return created;
  }

  async getVisibilitySetsByGraph(graphId: string): Promise<VisibilitySet[]> {
    return await db
      .select()
      .from(visibilitySets)
      .where(eq(visibilitySets.graphId, graphId));
  }

  async getActiveVisibilitySet(graphId: string): Promise<VisibilitySet | undefined> {
    const [active] = await db
      .select()
      .from(visibilitySets)
      .where(
        and(
          eq(visibilitySets.graphId, graphId),
          eq(visibilitySets.isActive, "true")
        )
      );
    return active || undefined;
  }

  async setActiveVisibilitySet(graphId: string, setId: string): Promise<boolean> {
    // Deactivate all sets for this graph
    await db
      .update(visibilitySets)
      .set({ isActive: "false" })
      .where(eq(visibilitySets.graphId, graphId));

    // Activate the specified set
    const result = await db
      .update(visibilitySets)
      .set({ isActive: "true" })
      .where(
        and(
          eq(visibilitySets.graphId, graphId),
          eq(visibilitySets.setId, setId)
        )
      );

    return result.rowCount > 0;
  }

  async executeVisibilityQuery(graphId: string, sparqlQuery: string): Promise<string[]> {
    // Simple SPARQL-like query processing for RDF triples
    // This is a basic implementation - in production you'd use a proper SPARQL engine
    
    const allTriples = await this.getRdfTriplesByGraph(graphId);
    
    // Basic pattern matching for common queries
    if (sparqlQuery.includes("SELECT * WHERE")) {
      // Return all nodes
      const nodes = new Set<string>();
      allTriples
        .filter(t => t.predicate === RDF_PREDICATES.TYPE && t.object === RDF_TYPES.NODE)
        .forEach(t => nodes.add(t.subject));
      return Array.from(nodes);
    }
    
    if (sparqlQuery.includes("rdf:type")) {
      const typeMatch = sparqlQuery.match(/rdf:type\s+(\w+)/);
      if (typeMatch) {
        const targetType = typeMatch[1];
        const nodes = new Set<string>();
        allTriples
          .filter(t => 
            t.predicate === RDF_PREDICATES.NODE_TYPE && 
            t.object.toLowerCase().includes(targetType.toLowerCase())
          )
          .forEach(t => nodes.add(t.subject));
        return Array.from(nodes);
      }
    }
    
    if (sparqlQuery.includes("hasProperty")) {
      const propMatch = sparqlQuery.match(/hasProperty\s+"([^"]+)"/);
      if (propMatch) {
        const propertyName = propMatch[1];
        const nodes = new Set<string>();
        allTriples
          .filter(t => 
            t.predicate.includes(RDF_PREDICATES.DATA_PROPERTY) &&
            t.predicate.includes(propertyName)
          )
          .forEach(t => nodes.add(t.subject));
        return Array.from(nodes);
      }
    }
    
    // Default: return all nodes
    const nodes = new Set<string>();
    allTriples
      .filter(t => t.predicate === RDF_PREDICATES.TYPE && t.object === RDF_TYPES.NODE)
      .forEach(t => nodes.add(t.subject));
    return Array.from(nodes);
  }
}

export const storage = new DatabaseStorage();