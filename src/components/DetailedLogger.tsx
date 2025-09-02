import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Download, Copy, Trash2, Terminal } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'debug';
  category: 'network' | 'ssh' | 'system' | 'security';
  message: string;
  details?: string;
}

interface DetailedLoggerProps {
  isVisible: boolean;
  onToggle: () => void;
}

export default function DetailedLogger({ isVisible, onToggle }: DetailedLoggerProps) {
  const { toast } = useToast();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<'all' | LogEntry['level']>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | LogEntry['category']>('all');
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs are added
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [logs]);

  // Fonction publique pour ajouter des logs (sera utilisée par d'autres composants)
  const addLog = (level: LogEntry['level'], category: LogEntry['category'], message: string, details?: string) => {
    const newLog: LogEntry = {
      timestamp: new Date().toLocaleTimeString('fr-FR', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit'
      }) + '.' + new Date().getMilliseconds().toString().padStart(3, '0'),
      level,
      category,
      message,
      details
    };
    
    setLogs(prev => [...prev, newLog]);
  };

  // Exposer la fonction addLog globalement pour l'utiliser depuis d'autres composants
  useEffect(() => {
    (window as any).addDetailedLog = addLog;
    
    // Ajouter quelques logs de démarrage
    addLog('info', 'system', 'Logger initialisé', 'Système de logs détaillés activé');
    addLog('debug', 'system', 'Mode application détecté', (window as any).__TAURI__ ? 'Desktop (Tauri)' : 'Web (Navigateur)');
    
    return () => {
      delete (window as any).addDetailedLog;
    };
  }, []);

  const clearLogs = () => {
    setLogs([]);
    addLog('info', 'system', 'Logs effacés', 'Historique des logs vidé par l\'utilisateur');
    toast({
      title: "Logs effacés",
      description: "L'historique des logs a été vidé",
    });
  };

  const exportLogs = () => {
    const logText = logs.map(log => 
      `[${log.timestamp}] [${log.level.toUpperCase()}] [${log.category}] ${log.message}${log.details ? '\n  Details: ' + log.details : ''}`
    ).join('\n');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `dot1x-automator-logs-${timestamp}.txt`;
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    addLog('info', 'system', 'Logs exportés', `Fichier créé: ${filename}`);
    toast({
      title: "Export réussi",
      description: `Logs sauvegardés dans ${filename}`,
    });
  };

  const copyLogsToClipboard = () => {
    const logText = logs.map(log => 
      `[${log.timestamp}] [${log.level.toUpperCase()}] [${log.category}] ${log.message}${log.details ? ' - ' + log.details : ''}`
    ).join('\n');
    
    navigator.clipboard.writeText(logText).then(() => {
      addLog('info', 'system', 'Logs copiés', 'Contenu des logs copié dans le presse-papiers');
      toast({
        title: "Copié",
        description: "Logs copiés dans le presse-papiers",
      });
    });
  };

  const getLevelBadge = (level: LogEntry['level']) => {
    const variants = {
      info: 'default',
      warning: 'outline',
      error: 'destructive',
      debug: 'secondary'
    } as const;
    
    const colors = {
      info: 'text-blue-700 bg-blue-100',
      warning: 'text-yellow-700 bg-yellow-100', 
      error: 'text-red-700 bg-red-100',
      debug: 'text-gray-700 bg-gray-100'
    };
    
    return (
      <Badge variant={variants[level]} className={colors[level]}>
        {level.toUpperCase()}
      </Badge>
    );
  };

  const getCategoryBadge = (category: LogEntry['category']) => {
    const colors = {
      network: 'text-green-700 bg-green-100',
      ssh: 'text-purple-700 bg-purple-100',
      system: 'text-blue-700 bg-blue-100',
      security: 'text-red-700 bg-red-100'
    };
    
    return (
      <Badge variant="outline" className={colors[category]}>
        {category}
      </Badge>
    );
  };

  const filteredLogs = logs.filter(log => {
    const levelMatch = filter === 'all' || log.level === filter;
    const categoryMatch = categoryFilter === 'all' || log.category === categoryFilter;
    return levelMatch && categoryMatch;
  });

  if (!isVisible) {
    return (
      <Button 
        variant="outline" 
        size="sm" 
        onClick={onToggle}
        className="fixed bottom-4 right-4 z-40"
      >
        <Terminal className="h-4 w-4 mr-2" />
        Logs détaillés ({logs.length})
      </Button>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Journal d'activité détaillé
            </CardTitle>
            <CardDescription>
              Suivi en temps réel des opérations et diagnostics ({logs.length} entrées)
            </CardDescription>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={copyLogsToClipboard}>
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={exportLogs}>
              <Download className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={clearLogs}>
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onToggle}>
              ×
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Filtres */}
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Niveau:</span>
            {(['all', 'info', 'warning', 'error', 'debug'] as const).map(level => (
              <Button
                key={level}
                variant={filter === level ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(level)}
              >
                {level === 'all' ? 'Tous' : level}
              </Button>
            ))}
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Catégorie:</span>
            {(['all', 'network', 'ssh', 'system', 'security'] as const).map(category => (
              <Button
                key={category}
                variant={categoryFilter === category ? "default" : "outline"}
                size="sm"
                onClick={() => setCategoryFilter(category)}
              >
                {category === 'all' ? 'Toutes' : category}
              </Button>
            ))}
          </div>
        </div>

        {/* Zone de logs */}
        <ScrollArea className="h-64 w-full border rounded-md p-4" ref={scrollAreaRef}>
          <div className="space-y-2">
            {filteredLogs.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                Aucun log correspondant aux filtres sélectionnés
              </div>
            ) : (
              filteredLogs.map((log, index) => (
                <div key={index} className="flex items-start gap-3 text-sm border-b pb-2">
                  <span className="text-xs text-muted-foreground font-mono min-w-fit">
                    {log.timestamp}
                  </span>
                  <div className="flex gap-2 min-w-fit">
                    {getLevelBadge(log.level)}
                    {getCategoryBadge(log.category)}
                  </div>
                  <div className="flex-1">
                    <div>{log.message}</div>
                    {log.details && (
                      <div className="text-xs text-muted-foreground mt-1 ml-2 italic">
                        {log.details}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Statistiques */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>Total: {logs.length}</span>
          <span>Info: {logs.filter(l => l.level === 'info').length}</span>
          <span>Warning: {logs.filter(l => l.level === 'warning').length}</span>
          <span>Error: {logs.filter(l => l.level === 'error').length}</span>
          <span>Debug: {logs.filter(l => l.level === 'debug').length}</span>
        </div>
      </CardContent>
    </Card>
  );
}