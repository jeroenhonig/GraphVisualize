CREATE TABLE "graph_edges" (
	"id" serial PRIMARY KEY NOT NULL,
	"edge_id" text NOT NULL,
	"source_id" text NOT NULL,
	"target_id" text NOT NULL,
	"label" text,
	"type" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb,
	"graph_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "graph_edges_edge_id_unique" UNIQUE("edge_id")
);
--> statement-breakpoint
CREATE TABLE "graph_nodes" (
	"id" serial PRIMARY KEY NOT NULL,
	"node_id" text NOT NULL,
	"label" text NOT NULL,
	"type" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb,
	"x" integer DEFAULT 0,
	"y" integer DEFAULT 0,
	"graph_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "graph_nodes_node_id_unique" UNIQUE("node_id")
);
--> statement-breakpoint
CREATE TABLE "graphs" (
	"id" serial PRIMARY KEY NOT NULL,
	"graph_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"node_count" integer DEFAULT 0,
	"edge_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "graphs_graph_id_unique" UNIQUE("graph_id")
);
--> statement-breakpoint
CREATE TABLE "rdf_triples" (
	"id" serial PRIMARY KEY NOT NULL,
	"graph_id" text NOT NULL,
	"subject" text NOT NULL,
	"predicate" text NOT NULL,
	"object" text NOT NULL,
	"object_type" text DEFAULT 'literal' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visibility_sets" (
	"id" serial PRIMARY KEY NOT NULL,
	"set_id" text NOT NULL,
	"graph_id" text NOT NULL,
	"name" text NOT NULL,
	"sparql_query" text NOT NULL,
	"is_active" text DEFAULT 'false' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "visibility_sets_set_id_unique" UNIQUE("set_id")
);
