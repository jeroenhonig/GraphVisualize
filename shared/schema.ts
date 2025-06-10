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

export const insertGraphNodeSchema = createInsertSchema(graphNodes).omit({
  id: true,
  createdAt: true,
});

export const insertGraphEdgeSchema = createInsertSchema(graphEdges).omit({
  id: true,
  createdAt: true,
});

export const insertGraphSchema = createInsertSchema(graphs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertGraphNode = z.infer<typeof insertGraphNodeSchema>;
export type InsertGraphEdge = z.infer<typeof insertGraphEdgeSchema>;
export type InsertGraph = z.infer<typeof insertGraphSchema>;

export type GraphNode = typeof graphNodes.$inferSelect;
export type GraphEdge = typeof graphEdges.$inferSelect;
export type Graph = typeof graphs.$inferSelect;

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
  name: string;
  description?: string;
  nodes: VisualizationNode[];
  edges: VisualizationEdge[];
  nodeCount: number;
  edgeCount: number;
}
