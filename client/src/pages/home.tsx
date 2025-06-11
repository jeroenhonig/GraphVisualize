import { useState } from "react";
import GraphVisualizer from "@/components/graph-visualizer";
import CodeReviewer from "@/components/code-reviewer";
import { Button } from "@/components/ui/button";
import { Code, BarChart3 } from "lucide-react";

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<'graph' | 'reviewer'>('graph');

  return (
    <div className="h-screen flex flex-col">
      <div className="border-b bg-white">
        <div className="flex items-center gap-2 p-4">
          <Button
            variant={activeTab === 'graph' ? 'default' : 'outline'}
            onClick={() => setActiveTab('graph')}
            className="flex items-center gap-2"
          >
            <BarChart3 className="h-4 w-4" />
            Graph Visualizer
          </Button>
          <Button
            variant={activeTab === 'reviewer' ? 'default' : 'outline'}
            onClick={() => setActiveTab('reviewer')}
            className="flex items-center gap-2"
          >
            <Code className="h-4 w-4" />
            Code Reviewer
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'graph' && <GraphVisualizer />}
        {activeTab === 'reviewer' && (
          <div className="h-full overflow-auto p-6">
            <CodeReviewer />
          </div>
        )}
      </div>
    </div>
  );
}