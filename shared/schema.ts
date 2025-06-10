import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Minimal graphs table - only basic metadata
export const graphs = pgTable("graphs", {
  id: serial("id").primaryKey(),
  graphId: text("graph_id").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Core RDF triples table - all graph data stored as subject-predicate-object
export const rdfTriples = pgTable("rdf_triples", {
  id: serial("id").primaryKey(),
  graphId: text("graph_id").notNull(),
  subject: text("subject").notNull(),
  predicate: text("predicate").notNull(),
  object: text("object").notNull(),
  objectType: text("object_type").notNull().default("literal"), // literal, uri, bnode
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// SPARQL visibility sets for managing view states
export const visibilitySets = pgTable("visibility_sets", {
  id: serial("id").primaryKey(),
  setId: text("set_id").notNull().unique(),
  graphId: text("graph_id").notNull(),
  name: text("name").notNull(),
  sparqlQuery: text("sparql_query").notNull(),
  isActive: text("is_active").notNull().default("false"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Zod schemas for validation
export const insertRdfTripleSchema = createInsertSchema(rdfTriples).omit({
  id: true,
  createdAt: true,
});

export const insertVisibilitySetSchema = createInsertSchema(visibilitySets).omit({
  id: true,
  createdAt: true,
});

export const insertGraphSchema = createInsertSchema(graphs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Type definitions
export type Graph = typeof graphs.$inferSelect;
export type RdfTriple = typeof rdfTriples.$inferSelect;
export type VisibilitySet = typeof visibilitySets.$inferSelect;

export type InsertGraph = z.infer<typeof insertGraphSchema>;
export type InsertRdfTriple = z.infer<typeof insertRdfTripleSchema>;
export type InsertVisibilitySet = z.infer<typeof insertVisibilitySetSchema>;

// Visualization interfaces for frontend
export interface VisualizationNode {
  id: string;
  label: string;
  type: string;
  data: Record<string, any>;
  x: number;
  y: number;
  expanded?: boolean;
  visible?: boolean;
}

export interface VisualizationEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type: string;
  data: Record<string, any>;
}

export interface GraphData {
  id: string;
  graphId: string;
  name: string;
  description?: string;
  nodes: VisualizationNode[];
  edges: VisualizationEdge[];
  nodeCount: number;
  edgeCount: number;
  activeVisibilitySet?: VisibilitySet;
  visibleNodeIds: string[];
}

// RDF Predicates for standard graph operations
export const RDF_PREDICATES = {
  TYPE: "rdf:type",
  LABEL: "rdfs:label", 
  HAS_PROPERTY: "graph:hasProperty",
  CONNECTS_TO: "graph:connectsTo",
  POSITION_X: "graph:positionX",
  POSITION_Y: "graph:positionY",
  NODE_TYPE: "graph:nodeType",
  EDGE_TYPE: "graph:edgeType",
  DATA_PROPERTY: "graph:dataProperty"
} as const;

// Standard RDF types for graph elements
export const RDF_TYPES = {
  NODE: "graph:Node",
  EDGE: "graph:Edge",
  PERSON: "schema:Person",
  ORGANIZATION: "schema:Organization",
  LOCATION: "schema:Place",
  CONCEPT: "skos:Concept"
} as const;