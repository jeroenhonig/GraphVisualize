DROP TABLE "graph_edges" CASCADE;--> statement-breakpoint
DROP TABLE "graph_nodes" CASCADE;--> statement-breakpoint
ALTER TABLE "graphs" DROP COLUMN "node_count";--> statement-breakpoint
ALTER TABLE "graphs" DROP COLUMN "edge_count";--> statement-breakpoint
ALTER TABLE "visibility_sets" DROP COLUMN "updated_at";