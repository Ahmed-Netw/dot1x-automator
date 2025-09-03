import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { saveJuniperUpload, loadJuniperUpload, saveJuniperMultiUpload, loadJuniperMultiUpload } from '@/lib/storage';
import { Button } from '@/components/ui/button';

import { SwitchInfo } from '@/components/SwitchInfo';
import { InterfaceList } from '@/components/InterfaceList';
import { ConfigurationOutput } from '@/components/ConfigurationOutput';
import { ConfigurationParser } from '@/components/ConfigurationParser';
import { FileUpload } from '@/components/FileUpload';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Router, Network, Bug, ChevronDown, X, Trash2 } from 'lucide-react';

interface ParsedResult {
  filename: string;
  configContent: string;
  parser: ConfigurationParser;
  switchInfo: any;
  interfaces: any[];
  dot1xConfig: string;
  cleanupConfig: string;
  radiusConfig: string;
  debugInfo: any;
}

const Index = () => {
  const [results, setResults] = useState<ParsedResult[]>([]);
  const location = useLocation();

  const createParsedResult = (content: string, filename: string): ParsedResult => {
    const parser = new ConfigurationParser(content);
    const switchInfo = parser.getSwitchInfo();
    const interfaces = parser.getInterfaces();
    const dot1xConfig = parser.generateDot1xConfigWildcard(interfaces);
    const cleanupConfig = parser.generateCleanupConfigWildcard(interfaces);
    const radiusConfig = parser.getRadiusConfig(switchInfo?.managementIp);
    
    const lines = content.split('\n');
    const vlan160Lines = lines.filter(line => line.includes('irb.160') || line.includes('vlan.160') || line.includes('vlan unit 160'));
    const accessLines = lines.filter(line => 
      line.includes('ethernet-switching') && 
      (line.includes('port-mode access') || line.includes('interface-mode access'))
    );
    const interfaceLines = lines.filter(line => 
      line.match(/^set interfaces (ge|xe|et)-\d+\/\d+\/\d+/)
    );
    
    const debugInfo = {
      totalLines: lines.length,
      vlan160Matches: vlan160Lines.length,
      vlan160Samples: vlan160Lines.slice(0, 3),
      accessMatches: accessLines.length,
      accessSamples: accessLines.slice(0, 5),
      interfaceMatches: interfaceLines.length,
      interfaceTypes: {
        ge: interfaceLines.filter(l => l.includes('ge-')).length,
        xe: interfaceLines.filter(l => l.includes('xe-')).length,
        et: interfaceLines.filter(l => l.includes('et-')).length,
      }
    };

    return {
      filename,
      configContent: content,
      parser,
      switchInfo,
      interfaces,
      dot1xConfig,
      cleanupConfig,
      radiusConfig,
      debugInfo
    };
  };

  const handleFileRead = (content: string, name: string) => {
    const result = createParsedResult(content, name);
    setResults([result]);
    // Save single file for compatibility
    saveJuniperUpload({ configContent: content, filename: name });
    // Save as multi-file format
    saveJuniperMultiUpload({ files: [{ configContent: content, filename: name }] });
  };

  const handleFilesRead = (files: { content: string; filename: string }[]) => {
    const newResults = files.map(file => createParsedResult(file.content, file.filename));
    setResults(newResults);
    // Save to multi-file storage
    saveJuniperMultiUpload({ 
      files: files.map(f => ({ configContent: f.content, filename: f.filename }))
    });
  };

  const removeResult = (index: number) => {
    const newResults = results.filter((_, i) => i !== index);
    setResults(newResults);
    // Update storage
    if (newResults.length > 0) {
      saveJuniperMultiUpload({
        files: newResults.map(r => ({ configContent: r.configContent, filename: r.filename }))
      });
    }
  };

  const clearAllResults = () => {
    setResults([]);
    saveJuniperMultiUpload({ files: [] });
  };

  // Load saved data and check for transferred data
  useEffect(() => {
    // Priority 1: Data transferred from DeviceConnection via navigation state
    if (location.state) {
      const content = location.state.content || location.state.fileContent;
      const filename = location.state.filename;
      
      if (content && filename) {
        handleFileRead(content, filename);
        return;
      }
    }
    
    // Priority 2: Load multi-file uploads from storage
    const savedMultiUpload = loadJuniperMultiUpload();
    if (savedMultiUpload && savedMultiUpload.files.length > 0) {
      const loadedResults = savedMultiUpload.files.map(file => 
        createParsedResult(file.configContent, file.filename)
      );
      setResults(loadedResults);
      return;
    }
    
    // Priority 3: Load single file upload for backward compatibility
    const savedUpload = loadJuniperUpload();
    if (savedUpload) {
      const result = createParsedResult(savedUpload.configContent, savedUpload.filename);
      setResults([result]);
    }
  }, [location.state]);


  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Router className="h-8 w-8 text-tech-primary" />
            <h1 className="text-3xl font-bold">Juniper Configuration Tool</h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Outil de configuration automatique pour switches Juniper - 
            Ajout de 802.1X et configuration RADIUS
          </p>
          
          <div className="flex justify-center gap-4 mt-6">
            <Link to="/connection">
              <Button variant="outline" className="flex items-center gap-2">
                <Network className="h-4 w-4" />
                Connexion SSH aux Équipements
              </Button>
            </Link>
          </div>
        </div>

        <div className="space-y-8">
          {/* File Upload */}
          <FileUpload 
            onFileRead={handleFileRead}
            onFilesRead={handleFilesRead}
            multiple={true}
          />

          {/* Show results only if files are uploaded */}
          {results.length > 0 && (
            <>
              {/* Results Header with Clear All Button */}
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">
                  Résultats de l'analyse ({results.length} fichier{results.length > 1 ? 's' : ''})
                </h2>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={clearAllResults}
                  className="flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Tout effacer
                </Button>
              </div>

              {/* Results Accordion */}
              <Accordion type="multiple" className="space-y-4">
                {results.map((result, index) => (
                  <AccordionItem key={`${result.filename}-${index}`} value={`item-${index}`}>
                    <Card>
                      <AccordionTrigger className="px-6 py-4 hover:no-underline">
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-tech-success"></div>
                            <div className="text-left">
                              <p className="font-medium">{result.filename}</p>
                              <p className="text-sm text-muted-foreground">
                                {result.interfaces.length} interfaces détectées
                                {result.switchInfo?.hostname && ` • ${result.switchInfo.hostname}`}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeResult(index);
                            }}
                            className="ml-2 hover:bg-destructive/10 hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </AccordionTrigger>
                      
                      <AccordionContent className="px-6 pb-6">
                        <div className="space-y-6">
                          {/* Debug Panel */}
                          <Collapsible>
                            <CollapsibleTrigger asChild>
                              <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
                                <CardHeader className="pb-3">
                                  <CardTitle className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                      <Bug className="h-4 w-4 text-orange-500" />
                                      Debug Parsing ({result.debugInfo?.totalLines} lignes analysées)
                                    </div>
                                    <ChevronDown className="h-4 w-4" />
                                  </CardTitle>
                                </CardHeader>
                              </Card>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <Card>
                                <CardContent className="pt-6">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <h4 className="font-semibold mb-2">VLAN 160 Detection</h4>
                                      <p>Lignes trouvées: <span className="font-mono">{result.debugInfo?.vlan160Matches}</span></p>
                                      {result.debugInfo?.vlan160Samples.map((line: string, i: number) => (
                                        <p key={i} className="font-mono text-xs bg-muted p-1 rounded mt-1 truncate">
                                          {line.trim()}
                                        </p>
                                      ))}
                                    </div>
                                    <div>
                                      <h4 className="font-semibold mb-2">Access Ports Detection</h4>
                                      <p>Lignes access trouvées: <span className="font-mono">{result.debugInfo?.accessMatches}</span></p>
                                      {result.debugInfo?.accessSamples.map((line: string, i: number) => (
                                        <p key={i} className="font-mono text-xs bg-muted p-1 rounded mt-1 truncate">
                                          {line.trim()}
                                        </p>
                                      ))}
                                    </div>
                                    <div>
                                      <h4 className="font-semibold mb-2">Interfaces Types</h4>
                                      <p>GE: <span className="font-mono">{result.debugInfo?.interfaceTypes.ge}</span></p>
                                      <p>XE: <span className="font-mono">{result.debugInfo?.interfaceTypes.xe}</span></p>
                                      <p>ET: <span className="font-mono">{result.debugInfo?.interfaceTypes.et}</span></p>
                                    </div>
                                    <div>
                                      <h4 className="font-semibold mb-2">Parsing Results</h4>
                                      <p>Hostname: <span className="font-mono">{result.switchInfo?.hostname || 'Non trouvé'}</span></p>
                                      <p>Management IP: <span className="font-mono">{result.switchInfo?.managementIp || 'Non trouvé'}</span></p>
                                      <p>VLAN 160 IP: <span className="font-mono">{result.switchInfo?.vlan160Ip || 'Non trouvé'}</span></p>
                                      <p>Interfaces access: <span className="font-mono">{result.interfaces.length}</span></p>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            </CollapsibleContent>
                          </Collapsible>

                          {/* Switch Information */}
                          <SwitchInfo 
                            hostname={result.switchInfo?.hostname}
                            managementIp={result.switchInfo?.managementIp}
                            vlan160Ip={result.switchInfo?.vlan160Ip}
                            vlan160NetworkCidr={result.switchInfo?.vlan160NetworkCidr}
                            interfaceCount={result.interfaces.length}
                          />

                          {/* Interface List */}
                          <InterfaceList interfaces={result.interfaces} />

                          {/* Configuration Output */}
                          {result.interfaces.length > 0 && (
                            <ConfigurationOutput
                              dot1xConfig={result.dot1xConfig}
                              cleanupConfig={result.cleanupConfig}
                              radiusConfig={result.radiusConfig}
                            />
                          )}
                        </div>
                      </AccordionContent>
                    </Card>
                  </AccordionItem>
                ))}
              </Accordion>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
