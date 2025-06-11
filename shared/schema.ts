import { pgTable, text, serial, timestamp, varchar, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

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

// Saved views for storing graph states with SPARQL queries
export const savedViews = pgTable("saved_views", {
  id: serial("id").primaryKey(),
  viewId: text("view_id").notNull().unique(),
  graphId: text("graph_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  sparqlQuery: text("sparql_query").notNull(),
  visibleNodeIds: text("visible_node_ids").array().notNull(),
  transform: text("transform").notNull().default('{"scale": 1, "translateX": 0, "translateY": 0}'),
  nodePositions: text("node_positions").default('{}'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
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

export const insertSavedViewSchema = createInsertSchema(savedViews).omit({
  id: true,
  viewId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertGraphSchema = createInsertSchema(graphs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Type definitions
// User types for Replit Auth
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export type Graph = typeof graphs.$inferSelect;
export type RdfTriple = typeof rdfTriples.$inferSelect;
export type VisibilitySet = typeof visibilitySets.$inferSelect;
export type SavedView = typeof savedViews.$inferSelect;

export type InsertGraph = z.infer<typeof insertGraphSchema>;
export type InsertRdfTriple = z.infer<typeof insertRdfTripleSchema>;
export type InsertVisibilitySet = z.infer<typeof insertVisibilitySetSchema>;
export type InsertSavedView = z.infer<typeof insertSavedViewSchema>;

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
  CONNECTS_TO: "graph:connectsTo",
  POSITION_X: "graph:positionX",
  POSITION_Y: "graph:positionY",
  NODE_TYPE: "graph:nodeType",
  EDGE_TYPE: "graph:edgeType",
  // Standard schema.org properties
  NAME: "schema:name",
  AGE: "schema:age",
  ADDRESS: "schema:address",
  EMAIL: "schema:email",
  PHONE: "schema:telephone",
  ORGANIZATION: "schema:affiliation",
  JOB_TITLE: "schema:jobTitle",
  BIRTH_DATE: "schema:birthDate",
  DESCRIPTION: "schema:description",
  URL: "schema:url",
  // Dublin Core properties
  TITLE: "dc:title",
  CREATOR: "dc:creator",
  DATE: "dc:date",
  SUBJECT: "dc:subject",
  // FOAF properties for people
  KNOWS: "foaf:knows",
  GIVEN_NAME: "foaf:givenName",
  FAMILY_NAME: "foaf:familyName",
  NICKNAME: "foaf:nick",
  // Custom domain properties with proper namespace
  CITY: "ex:city",
  COUNTRY: "ex:country",
  COMPANY: "ex:company",
  DEPARTMENT: "ex:department"
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