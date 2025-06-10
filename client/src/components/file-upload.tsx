import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { FileSpreadsheet, Upload, CheckCircle, AlertCircle } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface FileUploadProps {
  onGraphCreated?: (graphId: string) => void;
}

export default function FileUpload({ onGraphCreated }: FileUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await apiRequest('POST', '/api/graphs/upload', formData);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/graphs'] });
      toast({
        title: "Bestand succesvol geladen",
        description: `${data.nodeCount} nodes en ${data.edgeCount} edges zijn verwerkt`,
      });
      onGraphCreated?.(data.graph.graphId);
      setUploadProgress(0);
    },
    onError: (error: Error) => {
      toast({
        title: "Upload mislukt",
        description: error.message,
        variant: "destructive",
      });
      setUploadProgress(0);
    },
  });

  const handleFileSelect = (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast({
        title: "Ongeldig bestand",
        description: "Selecteer een Excel bestand (.xlsx of .xls)",
        variant: "destructive",
      });
      return;
    }

    // Simulate upload progress
    setUploadProgress(10);
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + 10;
      });
    }, 200);

    uploadMutation.mutate(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const isUploading = uploadMutation.isPending || uploadProgress > 0;

  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Excel Bestand Uploaden</h2>
        
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            dragOver 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={triggerFileSelect}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
            }}
          />
          
          {isUploading ? (
            <div className="space-y-3">
              <div className="animate-spin mx-auto">
                <Upload className="h-8 w-8 text-blue-500" />
              </div>
              <p className="text-sm text-gray-600">Bestand wordt verwerkt...</p>
              <Progress value={uploadProgress} className="w-full" />
            </div>
          ) : (
            <>
              <FileSpreadsheet className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <p className="text-sm text-gray-600 mb-2">Sleep uw Excel bestand hier naartoe</p>
              <p className="text-xs text-gray-500 mb-3">of klik om te selecteren</p>
              <Button variant="outline" size="sm">
                Bestand Kiezen
              </Button>
            </>
          )}
        </div>

        {uploadMutation.isError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center">
            <AlertCircle className="h-4 w-4 text-red-500 mr-2" />
            <span className="text-sm text-red-700">
              {uploadMutation.error?.message || "Upload mislukt"}
            </span>
          </div>
        )}

        {uploadMutation.isSuccess && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center">
            <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
            <span className="text-sm text-green-700">
              Bestand succesvol verwerkt
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
