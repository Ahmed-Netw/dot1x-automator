import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  onFileRead: (content: string, filename: string) => void;
}

export const FileUpload = ({ onFileRead }: FileUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileRead = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      onFileRead(content, file.name);
      setUploadedFile(file.name);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileRead(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      handleFileRead(files[0]);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5 text-tech-primary" />
          Configuration Juniper
        </CardTitle>
        <CardDescription>
          Téléchargez votre fichier de configuration Juniper pour l'analyser et générer la configuration 802.1X
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
            isDragging 
              ? "border-tech-primary bg-tech-primary/10" 
              : uploadedFile 
                ? "border-green-500 bg-green-50" 
                : "border-muted-foreground/25 hover:border-tech-primary/50"
          )}
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.conf,.cfg"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          {uploadedFile ? (
            <div className="space-y-2">
              <Check className="h-12 w-12 text-green-500 mx-auto" />
              <p className="text-lg font-medium text-green-700">
                Fichier téléchargé avec succès
              </p>
              <p className="text-sm text-green-600 font-mono">
                {uploadedFile}
              </p>
              <Button 
                variant="outline" 
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setUploadedFile(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
              >
                Changer de fichier
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto" />
              <div>
                <p className="text-lg font-medium">
                  Glissez votre fichier de configuration ici
                </p>
                <p className="text-sm text-muted-foreground">
                  ou cliquez pour sélectionner un fichier
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Formats supportés: .txt, .conf, .cfg
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default FileUpload;