import { pgTable, text, serial, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const graphNodes = pgTable("graph_nodes", {
  id: serial("id").primaryKey(),
  nodeId: text("node_id").notNull().unique(),
  label: text("label").notNull(),
  type: text("type").notNull(),
  data: jsonb("data").default({}),
  x: integer("x").default(0),
  y: integer("y").default(0),
  graphId: text("graph_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const graphEdges = pgTable("graph_edges", {
  id: serial("id").primaryKey(),
  edgeId: text("edge_id").notNull().unique(),
  sourceId: text("source_id").notNull(),
  targetId: text("target_id").notNull(),
  label: text("label"),
  type: text("type").notNull(),
  data: jsonb("data").default({}),
  graphId: text("graph_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const graphs = pgTable("graphs", {
  id: serial("id").primaryKey(),
  graphId: text("graph_id").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  nodeCount: integer("node_count").default(0),
  edgeCount: integer("edge_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// RDF Triple store for SPARQL support
export const rdfTriples = pgTable("rdf_triples", {
  id: serial("id").primaryKey(),
  graphId: text("graph_id").notNull(),
  subject: text("subject").notNull(),
  predicate: text("predicate").notNull(),
  object: text("object").notNull(),
  objectType: text("object_type").notNull().default("literal"), // literal, uri, bnode
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Visibility sets based on SPARQL queries
export const visibilitySets = pgTable("visibility_sets", {
  id: serial("id").primaryKey(),
  setId: text("set_id").notNull().unique(),
  graphId: text("graph_id").notNull(),
  name: text("name").notNull(),
  sparqlQuery: text("sparql_query").notNull(),
  isActive: text("is_active").notNull().default("false"), // Only one can be active per graph
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertGraphNodeSchema = createInsertSchema(graphNodes).omit({
  id: true,
  createdAt: true,
});

export const insertGraphEdgeSchema = createInsertSchema(graphEdges).omit({
  id: true,
  createdAt: true,
  graphId: true,
});

export const insertRdfTripleSchema = createInsertSchema(rdfTriples).omit({
  id: true,
  createdAt: true,
});

export const insertVisibilitySetSchema = createInsertSchema(visibilitySets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertGraphSchema = createInsertSchema(graphs).omit({
  id: true,
  graphId: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertGraphNode = z.infer<typeof insertGraphNodeSchema>;
export type InsertGraphEdge = z.infer<typeof insertGraphEdgeSchema>;
export type InsertGraph = z.infer<typeof insertGraphSchema>;
export type InsertRdfTriple = z.infer<typeof insertRdfTripleSchema>;
export type InsertVisibilitySet = z.infer<typeof insertVisibilitySetSchema>;

export type GraphNode = typeof graphNodes.$inferSelect;
export type GraphEdge = typeof graphEdges.$inferSelect;
export type Graph = typeof graphs.$inferSelect;
export type RdfTriple = typeof rdfTriples.$inferSelect;
export type VisibilitySet = typeof visibilitySets.$inferSelect;

// Client-side types for graph visualization
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
  visibleNodeIds: string[]; // Unified visibility system based on SPARQL results
}
