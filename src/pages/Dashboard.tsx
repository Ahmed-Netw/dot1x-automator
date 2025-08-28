import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Router, Network, Activity, Users, Download, Monitor } from "lucide-react";
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';

const Dashboard = () => {
  return (
    <div className="p-6">
      <PWAInstallPrompt />
      
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Vue d'ensemble des outils de gestion réseau
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Équipements Connectés
            </CardTitle>
            <Network className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              Aucune connexion active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Configurations
            </CardTitle>
            <Router className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              Configurations traitées
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Statut Système
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">En ligne</div>
            <p className="text-xs text-muted-foreground">
              Tous les services opérationnels
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Utilisateurs
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1</div>
            <p className="text-xs text-muted-foreground">
              Session active
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              Application Desktop
            </CardTitle>
            <CardDescription>
              Téléchargez l'application native pour Windows
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              <p>✅ Connexions SSH réelles</p>
              <p>✅ Aucune installation requise</p>
              <p>✅ Fonctionne hors ligne</p>
            </div>
            <Button 
              className="w-full" 
              onClick={() => {
                // Créer un lien vers le fichier de build guide qui contient les instructions
                const link = document.createElement('a');
                link.href = '/BUILD-GUIDE.md';
                link.download = 'BUILD-GUIDE.md';
                link.click();
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Télécharger Guide de Construction
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Suivez les instructions pour compiler votre .exe portable
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Connexions Récentes</CardTitle>
            <CardDescription>
              Historique des dernières connexions SSH
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center text-muted-foreground py-8">
              Aucune connexion récente
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activité Système</CardTitle>
            <CardDescription>
              Logs et événements récents
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                <span className="text-sm">Application démarrée</span>
                <span className="text-xs text-muted-foreground">Maintenant</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;