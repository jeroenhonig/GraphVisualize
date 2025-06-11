import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, FileText } from "lucide-react";

interface FileUploadProps {
  onGraphCreated?: (graphId: string) => void;
}

export default function FileUpload({ onGraphCreated }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      // Determine endpoint based on file type
      const isRDFFile = file.name.toLowerCase().match(/\.(ttl|rdf|n3|nt)$/);
      const endpoint = isRDFFile ? '/api/upload-rdf' : '/api/upload';
      
      // For RDF files, add required name parameter
      if (isRDFFile) {
        const graphName = file.name.replace(/\.(ttl|rdf|n3|nt)$/i, '');
        formData.append('name', graphName);
        formData.append('description', `Imported from ${file.name}`);
      }
      
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      const isRDF = data.success && data.message?.includes('RDF');
      const fileType = isRDF ? 'RDF' : 'Excel';
      
      toast({
        title: `${fileType} Bestand Geüpload`,
        description: isRDF 
          ? `Graph "${data.graph.name}" succesvol aangemaakt uit RDF bestand`
          : `Graph "${data.graph.name}" succesvol aangemaakt met ${data.nodeCount} knopen en ${data.edgeCount} kanten`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/graphs"] });
      if (onGraphCreated) {
        onGraphCreated(data.graph.graphId);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Fout",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|ttl|rdf|n3|nt)$/i)) {
      toast({
        title: "Ongeldig Bestandstype",
        description: "Alleen Excel (.xlsx, .xls) of RDF (.ttl, .rdf, .n3, .nt) bestanden zijn toegestaan",
        variant: "destructive",
      });
      return;
    }

    uploadMutation.mutate(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  return (
    <div className="space-y-4">
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          isDragging
            ? 'border-blue-400 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div className="flex justify-center items-center space-x-4 mb-4">
          <FileSpreadsheet className="h-8 w-8 text-gray-400" />
          <FileText className="h-8 w-8 text-gray-400" />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-900">
            Sleep bestanden hier of klik om te uploaden
          </p>
          <p className="text-xs text-gray-500">
            Excel: .xlsx, .xls | RDF: .ttl, .rdf, .n3, .nt
          </p>
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.ttl,.rdf,.n3,.nt"
          onChange={handleFileInputChange}
          className="hidden"
        />
        
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadMutation.isPending}
          className="mt-4"
        >
          <Upload className="h-4 w-4 mr-2" />
          {uploadMutation.isPending ? "Uploaden..." : "Bestand Selecteren"}
        </Button>
      </div>
      
      {uploadMutation.isPending && (
        <div className="text-center">
          <div className="inline-flex items-center px-4 py-2 font-semibold leading-6 text-sm shadow rounded-md text-blue-500 bg-blue-100">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Bestand wordt verwerkt...
          </div>
        </div>
      )}
    </div>
  );
}