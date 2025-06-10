-- Add saved_views table for storing view states with SPARQL queries
CREATE TABLE IF NOT EXISTS "saved_views" (
	"id" serial PRIMARY KEY NOT NULL,
	"view_id" text NOT NULL,
	"graph_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"sparql_query" text NOT NULL,
	"visible_node_ids" text[] DEFAULT '{}' NOT NULL,
	"transform" text DEFAULT '{"scale": 1, "translateX": 0, "translateY": 0}' NOT NULL,
	"node_positions" text DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "saved_views_view_id_unique" UNIQUE("view_id")
);