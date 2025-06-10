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
import { eq, and, not, or } from "drizzle-orm";
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
  updateNodeProperties(nodeId: string, properties: { label?: string; type?: string; data?: Record<string, any> }): Promise<boolean>;
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
  
  // Data management
  clearAllData(): Promise<void>;
  loadBuildingDataset(): Promise<void>;
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
        predicate: key,
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

  async updateNodeProperties(nodeId: string, properties: { label?: string; type?: string; data?: Record<string, any> }): Promise<boolean> {
    try {
      // Update label if provided
      if (properties.label !== undefined) {
        await db
          .update(rdfTriples)
          .set({ object: properties.label })
          .where(
            and(
              eq(rdfTriples.subject, nodeId),
              eq(rdfTriples.predicate, RDF_PREDICATES.LABEL)
            )
          );
      }

      // Update type if provided
      if (properties.type !== undefined) {
        await db
          .update(rdfTriples)
          .set({ object: properties.type })
          .where(
            and(
              eq(rdfTriples.subject, nodeId),
              eq(rdfTriples.predicate, RDF_PREDICATES.TYPE)
            )
          );
      }

      // Update data properties if provided
      if (properties.data !== undefined) {
        // Get the graphId for this node
        const nodeTriples = await db
          .select({ graphId: rdfTriples.graphId })
          .from(rdfTriples)
          .where(eq(rdfTriples.subject, nodeId))
          .limit(1);
        
        const graphId = nodeTriples[0]?.graphId || '';

        // Delete existing custom data properties (keep system properties)
        const systemPredicates = [
          RDF_PREDICATES.LABEL,
          RDF_PREDICATES.TYPE,
          RDF_PREDICATES.POSITION_X,
          RDF_PREDICATES.POSITION_Y
        ];

        // Get all existing triples for this node
        const existingTriples = await db
          .select()
          .from(rdfTriples)
          .where(eq(rdfTriples.subject, nodeId));

        // Delete non-system properties
        for (const triple of existingTriples) {
          const isSystemProperty = systemPredicates.some(sysPred => sysPred === triple.predicate);
          if (!isSystemProperty) {
            await db
              .delete(rdfTriples)
              .where(
                and(
                  eq(rdfTriples.subject, nodeId),
                  eq(rdfTriples.predicate, triple.predicate)
                )
              );
          }
        }

        // Insert new data properties
        for (const [key, value] of Object.entries(properties.data)) {
          await db.insert(rdfTriples).values({
            subject: nodeId,
            predicate: key,
            object: String(value),
            graphId: graphId,
          });
        }
      }

      return true;
    } catch (error) {
      console.error('Error updating node properties:', error);
      return false;
    }
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
    return (result.rowCount ?? 0) > 0;
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
    for (const [subject, subjectTripleList] of Array.from(subjectTriples.entries())) {
      const typeTriple = subjectTripleList.find((t: any) => t.predicate === RDF_PREDICATES.TYPE);
      
      // Treat any subject with properties as a node (not just RDF_TYPES.NODE)
      const labelTriple = subjectTripleList.find((t: any) => t.predicate === RDF_PREDICATES.LABEL);
      const xTriple = subjectTripleList.find((t: any) => t.predicate === RDF_PREDICATES.POSITION_X);
      const yTriple = subjectTripleList.find((t: any) => t.predicate === RDF_PREDICATES.POSITION_Y);

      // Collect data properties (all predicates that are not system predicates)
      const systemPredicates = [
        RDF_PREDICATES.TYPE,
        RDF_PREDICATES.LABEL,
        RDF_PREDICATES.POSITION_X,
        RDF_PREDICATES.POSITION_Y,
        RDF_PREDICATES.CONNECTS_TO
      ];
      
      const data: Record<string, any> = {};
      subjectTripleList
        .filter((t: any) => !systemPredicates.includes(t.predicate))
        .forEach((t: any) => {
          try {
            data[t.predicate] = JSON.parse(t.object);
          } catch {
            data[t.predicate] = t.object;
          }
        });

      nodes.push({
        id: subject,
        label: labelTriple?.object || subject,
        type: typeTriple?.object || "unknown",
        data,
        x: parseInt(xTriple?.object || "400"),
        y: parseInt(yTriple?.object || "300"),
        visible: true
      });

      // Find relationships to other nodes (edges)
      for (const triple of subjectTripleList) {
        // Skip system predicates and literal values
        if (systemPredicates.includes(triple.predicate)) continue;
        
        // Check if this is a relationship to another node
        if (subjectTriples.has(triple.object)) {
          const edgeId = `${subject}-${triple.predicate}-${triple.object}`;
          if (!processedEdges.has(edgeId)) {
            edges.push({
              id: edgeId,
              source: subject,
              target: triple.object,
              label: triple.predicate,
              type: triple.predicate,
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

    return (result.rowCount ?? 0) > 0;
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

  async clearAllData(): Promise<void> {
    // Delete all data from all tables
    await db.delete(visibilitySets);
    await db.delete(rdfTriples);
    await db.delete(graphs);
  }

  async loadBuildingDataset(): Promise<void> {
    const graphId = nanoid();
    
    // Create the main graph
    await this.createGraph({
      graphId,
      name: "Building RDF Dataset",
      description: "Complete building information dataset with RDF triples"
    });

    // Define building dataset triples based on the RDF file
    const buildingTriples = [
      // Main building
      {
        graphId,
        subject: "building:KantoorgebouwCentrum",
        predicate: RDF_PREDICATES.TYPE,
        object: "building:Office",
        objectType: "uri" as const
      },
      {
        graphId,
        subject: "building:KantoorgebouwCentrum",
        predicate: RDF_PREDICATES.LABEL,
        object: "Kantoorgebouw Centrum Amsterdam",
        objectType: "literal" as const
      },
      {
        graphId,
        subject: "building:KantoorgebouwCentrum",
        predicate: "property:buildingHeight",
        object: "45.5",
        objectType: "literal" as const
      },
      {
        graphId,
        subject: "building:KantoorgebouwCentrum",
        predicate: "property:grossFloorArea",
        object: "8500.0",
        objectType: "literal" as const
      },
      {
        graphId,
        subject: "building:KantoorgebouwCentrum",
        predicate: "property:numberOfFloors",
        object: "12",
        objectType: "literal" as const
      },
      {
        graphId,
        subject: "building:KantoorgebouwCentrum",
        predicate: "property:constructionYear",
        object: "2019",
        objectType: "literal" as const
      },
      {
        graphId,
        subject: "building:KantoorgebouwCentrum",
        predicate: "property:energyLabel",
        object: "A",
        objectType: "literal" as const
      },
      {
        graphId,
        subject: "building:KantoorgebouwCentrum",
        predicate: "property:address",
        object: "Damrak 123, 1012 LP Amsterdam, Nederland",
        objectType: "literal" as const
      },
      {
        graphId,
        subject: "building:KantoorgebouwCentrum",
        predicate: RDF_PREDICATES.POSITION_X,
        object: "500",
        objectType: "literal" as const
      },
      {
        graphId,
        subject: "building:KantoorgebouwCentrum",
        predicate: RDF_PREDICATES.POSITION_Y,
        object: "350",
        objectType: "literal" as const
      },

      // Foundation element - positioned far left bottom
      {
        graphId,
        subject: "element:Foundation001",
        predicate: RDF_PREDICATES.TYPE,
        object: "building:Foundation",
        objectType: "uri" as const
      },
      {
        graphId,
        subject: "element:Foundation001",
        predicate: RDF_PREDICATES.LABEL,
        object: "Hoofdfundering",
        objectType: "literal" as const
      },
      {
        graphId,
        subject: "element:Foundation001",
        predicate: "property:foundationDepth",
        object: "18.5",
        objectType: "literal" as const
      },
      {
        graphId,
        subject: "element:Foundation001",
        predicate: "property:numberOfPiles",
        object: "156",
        objectType: "literal" as const
      },
      {
        graphId,
        subject: "element:Foundation001",
        predicate: "property:pileType",
        object: "Prefab betonpalen",
        objectType: "literal" as const
      },
      {
        graphId,
        subject: "element:Foundation001",
        predicate: RDF_PREDICATES.POSITION_X,
        object: "200",
        objectType: "literal" as const
      },
      {
        graphId,
        subject: "element:Foundation001",
        predicate: RDF_PREDICATES.POSITION_Y,
        object: "600",
        objectType: "literal" as const
      },

      // Structure element - positioned far right
      {
        graphId,
        subject: "element:Structure001",
        predicate: RDF_PREDICATES.TYPE,
        object: "building:Structure",
        objectType: "uri" as const
      },
      {
        graphId,
        subject: "element:Structure001",
        predicate: RDF_PREDICATES.LABEL,
        object: "Hoofddraagstructuur",
        objectType: "literal" as const
      },
      {
        graphId,
        subject: "element:Structure001",
        predicate: "property:structuralSystem",
        object: "Stalen frame met betonnen vloeren",
        objectType: "literal" as const
      },
      {
        graphId,
        subject: "element:Structure001",
        predicate: "property:columnSpacing",
        object: "7.2",
        objectType: "literal" as const
      },
      {
        graphId,
        subject: "element:Structure001",
        predicate: RDF_PREDICATES.POSITION_X,
        object: "900",
        objectType: "literal" as const
      },
      {
        graphId,
        subject: "element:Structure001",
        predicate: RDF_PREDICATES.POSITION_Y,
        object: "350",
        objectType: "literal" as const
      },

      // Facade element - positioned top center
      {
        graphId,
        subject: "element:Facade001",
        predicate: RDF_PREDICATES.TYPE,
        object: "building:Facade",
        objectType: "uri" as const
      },
      {
        graphId,
        subject: "element:Facade001",
        predicate: RDF_PREDICATES.LABEL,
        object: "Hoofdgevel",
        objectType: "literal" as const
      },
      {
        graphId,
        subject: "element:Facade001",
        predicate: "property:facadeArea",
        object: "2850.0",
        objectType: "literal" as const
      },
      {
        graphId,
        subject: "element:Facade001",
        predicate: "property:glazingRatio",
        object: "0.65",
        objectType: "literal" as const
      },
      {
        graphId,
        subject: "element:Facade001",
        predicate: RDF_PREDICATES.POSITION_X,
        object: "500",
        objectType: "literal" as const
      },
      {
        graphId,
        subject: "element:Facade001",
        predicate: RDF_PREDICATES.POSITION_Y,
        object: "150",
        objectType: "literal" as const
      },

      // Materials - positioned bottom far apart
      {
        graphId,
        subject: "material:Concrete_C30_37",
        predicate: RDF_PREDICATES.TYPE,
        object: "building:Material",
        objectType: "uri" as const
      },
      {
        graphId,
        subject: "material:Concrete_C30_37",
        predicate: RDF_PREDICATES.LABEL,
        object: "Beton C30/37",
        objectType: "literal" as const
      },
      {
        graphId,
        subject: "material:Concrete_C30_37",
        predicate: "property:compressiveStrength",
        object: "30",
        objectType: "literal" as const
      },
      {
        graphId,
        subject: "material:Concrete_C30_37",
        predicate: "property:density",
        object: "2400",
        objectType: "literal" as const
      },
      {
        graphId,
        subject: "material:Concrete_C30_37",
        predicate: RDF_PREDICATES.POSITION_X,
        object: "100",
        objectType: "literal" as const
      },
      {
        graphId,
        subject: "material:Concrete_C30_37",
        predicate: RDF_PREDICATES.POSITION_Y,
        object: "500",
        objectType: "literal" as const
      },

      {
        graphId,
        subject: "material:Steel_S355",
        predicate: RDF_PREDICATES.TYPE,
        object: "building:Material",
        objectType: "uri" as const
      },
      {
        graphId,
        subject: "material:Steel_S355",
        predicate: RDF_PREDICATES.LABEL,
        object: "Constructiestaal S355",
        objectType: "literal" as const
      },
      {
        graphId,
        subject: "material:Steel_S355",
        predicate: "property:yieldStrength",
        object: "355",
        objectType: "literal" as const
      },
      {
        graphId,
        subject: "material:Steel_S355",
        predicate: "property:recycledContent",
        object: "0.85",
        objectType: "literal" as const
      },
      {
        graphId,
        subject: "material:Steel_S355",
        predicate: RDF_PREDICATES.POSITION_X,
        object: "1000",
        objectType: "literal" as const
      },
      {
        graphId,
        subject: "material:Steel_S355",
        predicate: RDF_PREDICATES.POSITION_Y,
        object: "550",
        objectType: "literal" as const
      },

      // Documents - positioned top right
      {
        graphId,
        subject: "doc:ArchitecturalDrawings",
        predicate: RDF_PREDICATES.TYPE,
        object: "schema:DigitalDocument",
        objectType: "uri" as const
      },
      {
        graphId,
        subject: "doc:ArchitecturalDrawings",
        predicate: RDF_PREDICATES.LABEL,
        object: "Architecturale tekeningen",
        objectType: "literal" as const
      },
      {
        graphId,
        subject: "doc:ArchitecturalDrawings",
        predicate: "dcterms:title",
        object: "Kantoorgebouw Centrum - Architecturale tekeningen v2.1",
        objectType: "literal" as const
      },
      {
        graphId,
        subject: "doc:ArchitecturalDrawings",
        predicate: "dcterms:format",
        object: "application/pdf",
        objectType: "literal" as const
      },
      {
        graphId,
        subject: "doc:ArchitecturalDrawings",
        predicate: RDF_PREDICATES.POSITION_X,
        object: "800",
        objectType: "literal" as const
      },
      {
        graphId,
        subject: "doc:ArchitecturalDrawings",
        predicate: RDF_PREDICATES.POSITION_Y,
        object: "150",
        objectType: "literal" as const
      },

      // Relationships - building has elements
      {
        graphId,
        subject: "building:KantoorgebouwCentrum",
        predicate: "building:hasElement",
        object: "element:Foundation001",
        objectType: "uri" as const
      },
      {
        graphId,
        subject: "building:KantoorgebouwCentrum",
        predicate: "building:hasElement",
        object: "element:Structure001",
        objectType: "uri" as const
      },
      {
        graphId,
        subject: "building:KantoorgebouwCentrum",
        predicate: "building:hasElement",
        object: "element:Facade001",
        objectType: "uri" as const
      },

      // Elements have materials
      {
        graphId,
        subject: "element:Foundation001",
        predicate: "building:hasMaterial",
        object: "material:Concrete_C30_37",
        objectType: "uri" as const
      },
      {
        graphId,
        subject: "element:Structure001",
        predicate: "building:hasMaterial",
        object: "material:Steel_S355",
        objectType: "uri" as const
      },

      // Building has documents
      {
        graphId,
        subject: "building:KantoorgebouwCentrum",
        predicate: "building:hasDocument",
        object: "doc:ArchitecturalDrawings",
        objectType: "uri" as const
      }
    ];

    // Insert all triples
    await db.insert(rdfTriples).values(buildingTriples);
  }
}

export const storage = new DatabaseStorage();