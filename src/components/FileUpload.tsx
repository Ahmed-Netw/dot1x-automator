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
    if (files.length > 0 && files[0].type === 'text/plain') {
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
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-tech-primary" />
          Configuration Juniper
        </CardTitle>
        <CardDescription>
          Téléchargez le fichier de configuration de votre switch Juniper
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
            isDragging
              ? "border-tech-primary bg-tech-primary/5"
              : uploadedFile
                ? "border-tech-success bg-tech-success/5"
                : "border-border hover:border-tech-primary/50"
          )}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onDragEnter={() => setIsDragging(true)}
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
              <Check className="h-12 w-12 text-tech-success mx-auto" />
              <p className="text-tech-success font-medium">{uploadedFile}</p>
              <p className="text-sm text-muted-foreground">
                Fichier chargé avec succès
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="h-12 w-12 text-muted-foreground mx-auto" />
              <p className="text-lg font-medium">
                Glissez-déposez votre fichier de configuration
              </p>
              <p className="text-sm text-muted-foreground">
                ou cliquez pour sélectionner un fichier (.txt, .conf, .cfg)
              </p>
            </div>
          )}
        </div>
        
        {uploadedFile && (
          <Button 
            className="w-full mt-4" 
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
          >
            Changer de fichier
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default FileUpload;