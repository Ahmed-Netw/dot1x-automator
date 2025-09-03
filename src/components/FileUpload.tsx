import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  onFileRead?: (content: string, filename: string) => void;
  onFilesRead?: (files: { content: string; filename: string }[]) => void;
  multiple?: boolean;
}

export const FileUpload = ({ onFileRead, onFilesRead, multiple = false }: FileUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileRead = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      onFileRead?.(content, file.name);
      setUploadedFile(file.name);
    };
    reader.readAsText(file);
  };

  const handleMultipleFileRead = async (files: File[]) => {
    const filePromises = files.map(file => {
      return new Promise<{ content: string; filename: string }>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          resolve({ content, filename: file.name });
        };
        reader.readAsText(file);
      });
    });

    const results = await Promise.all(filePromises);
    onFilesRead?.(results);
    setUploadedFiles(results.map(r => r.filename));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      if (multiple && files.length > 1) {
        handleMultipleFileRead(files);
      } else {
        handleFileRead(files[0]);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const fileArray = Array.from(files);
      if (multiple && fileArray.length > 1) {
        handleMultipleFileRead(fileArray);
      } else if (fileArray[0]) {
        handleFileRead(fileArray[0]);
      }
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
            multiple={multiple}
            onChange={handleFileSelect}
            className="hidden"
          />
          
          {(uploadedFile || uploadedFiles.length > 0) ? (
            <div className="space-y-2">
              <Check className="h-12 w-12 text-green-500 mx-auto" />
              <p className="text-lg font-medium text-green-700">
                {uploadedFiles.length > 0 
                  ? `${uploadedFiles.length} fichiers téléchargés avec succès`
                  : 'Fichier téléchargé avec succès'
                }
              </p>
              {uploadedFiles.length > 0 ? (
                <div className="space-y-1">
                  {uploadedFiles.map((filename, index) => (
                    <p key={index} className="text-sm text-green-600 font-mono">
                      {filename}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-green-600 font-mono">
                  {uploadedFile}
                </p>
              )}
              <Button 
                variant="outline" 
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setUploadedFile(null);
                  setUploadedFiles([]);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
              >
                {uploadedFiles.length > 0 ? 'Changer les fichiers' : 'Changer de fichier'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto" />
              <div>
                <p className="text-lg font-medium">
                  {multiple 
                    ? 'Glissez vos fichiers de configuration ici'
                    : 'Glissez votre fichier de configuration ici'
                  }
                </p>
                <p className="text-sm text-muted-foreground">
                  {multiple 
                    ? 'ou cliquez pour sélectionner des fichiers'
                    : 'ou cliquez pour sélectionner un fichier'
                  }
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