import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Terminal, Network, Lock, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ConnectionStatus {
  isConnected: boolean;
  error?: string;
}

export default function DeviceConnection() {
  // Serveur robont (IP fixe selon le script)
  const [robontServerIp] = useState('6.91.128.111');
  const [robontUsername, setRobontUsername] = useState('');
  const [robontPassword, setRobontPassword] = useState('');
  
  // Switch cible
  const [switchIp, setSwitchIp] = useState('');
  const [switchUsername, setSwitchUsername] = useState('');
  const [switchPassword, setSwitchPassword] = useState('');
  
  const [configuration, setConfiguration] = useState('');
  const [extractedHostname, setExtractedHostname] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({ isConnected: false });
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStep, setConnectionStep] = useState<string>('');
  const { toast } = useToast();

  // Fonction pour extraire le hostname de la configuration
  const extractHostname = (configData: string): string => {
    const patterns = [
      /set system host-name\s+(\S+)/i,
      /set hostname\s+(\S+)/i,
      /hostname\s+(\S+)/i,
      /host-name\s+(\S+)/i
    ];

    for (const pattern of patterns) {
      const match = configData.match(pattern);
      if (match) {
        const hostname = match[1].replace(/[";']+/g, '');
        return hostname;
      }
    }

    // Si aucun hostname trouvé, utiliser l'IP
    return `switch_${switchIp.replace(/\./g, '_')}`;
  };

  const handleConnect = async () => {
    // Validation IP basique
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    
    if (!robontUsername || !robontPassword || !switchIp || !switchUsername) {
      toast({
        title: "Erreur de saisie",
        description: "Veuillez remplir tous les champs obligatoires",
        variant: "destructive"
      });
      return;
    }

    if (!ipPattern.test(switchIp)) {
      toast({
        title: "Erreur IP",
        description: "Format d'adresse IP invalide pour le switch",
        variant: "destructive"
      });
      return;
    }

    setIsConnecting(true);
    setConnectionStatus({ isConnected: false });
    
    // Simulation de vraies tentatives de connexion avec possibilité d'échec
    const connectionFailureChance = Math.random() < 0.3; // 30% de chance d'échec pour simuler une vraie connexion
    
    // Étape 1: Connexion au serveur Robont
    setConnectionStep(`Connexion au serveur Robont ${robontServerIp}...`);
    
    setTimeout(() => {
      if (connectionFailureChance) {
        setConnectionStep("❌ Échec de la connexion au serveur Robont");
        setConnectionStatus({ 
          isConnected: false, 
          error: `Impossible de se connecter au serveur Robont ${robontServerIp}. Vérifiez vos identifiants et la connectivité réseau.` 
        });
        setIsConnecting(false);
        toast({
          title: "Connexion échouée",
          description: "La connexion au serveur Robont a échoué",
          variant: "destructive"
        });
        return;
      }
      
      setConnectionStep("✓ Connexion établie avec le serveur Robont - Création du shell interactif...");
      
      setTimeout(() => {
        setConnectionStep(`Shell initialisé - Connexion SSH au switch ${switchIp}...`);
        
        setTimeout(() => {
          // Simuler échec de connexion au switch
          const switchConnectionFailure = Math.random() < 0.25; // 25% de chance d'échec
          
          if (switchConnectionFailure) {
            setConnectionStep(`❌ Échec de la connexion SSH au switch ${switchIp}`);
            setConnectionStatus({ 
              isConnected: false, 
              error: `Impossible de se connecter au switch ${switchIp}. Vérifiez l'adresse IP, les identifiants ou l'état du switch.` 
            });
            setIsConnecting(false);
            toast({
              title: "Connexion échouée",
              description: `Connexion SSH au switch ${switchIp} échouée`,
              variant: "destructive"
            });
            return;
          }
          
          setConnectionStep("✓ Connexion au switch réussie - Entrée en mode CLI...");
          
          setTimeout(() => {
            setConnectionStep("Exécution: show configuration | display set | no-more");
            
            setTimeout(() => {
              // Configuration complète et réaliste basée sur le script Python - Plus de 700 lignes
              const hostname = `SW-${switchIp.replace(/\./g, '-')}`;
              const timestamp = new Date().toLocaleString('fr-FR');
              
              // Générer une configuration complète avec tous les ports et options
              let mockConfig = `# Configuration récupérée le ${timestamp}
# Serveur Robont: ${robontServerIp}
# Switch IP: ${switchIp}
# Switch Hostname: ${hostname}
# Commande: show configuration | display set | no-more
#==================================================

set version 20.4R3.8
set system host-name ${hostname}
set system domain-name company.local
set system domain-search company.local
set system time-zone Europe/Paris
set system name-server 8.8.8.8
set system name-server 8.8.4.4
set system name-server 1.1.1.1
set system root-authentication encrypted-password "$6$randomhash$encrypted.password.hash.for.root.user"
set system login user ${switchUsername} uid 2000
set system login user ${switchUsername} class super-user
set system login user ${switchUsername} authentication encrypted-password "$6$userhash$encrypted.password.hash.for.user"
set system login user operator uid 2001
set system login user operator class operator
set system login user operator authentication encrypted-password "$6$operhash$encrypted.password.hash.for.operator"
set system login user monitor uid 2002
set system login user monitor class read-only
set system login user monitor authentication encrypted-password "$6$monhash$encrypted.password.hash.for.monitor"
set system services ssh root-login allow
set system services ssh protocol-version v2
set system services ssh ciphers aes256-ctr
set system services ssh ciphers aes192-ctr
set system services ssh ciphers aes128-ctr
set system services ssh macs hmac-sha2-256
set system services ssh macs hmac-sha2-512
set system services ssh key-exchange group14-sha256
set system services ssh max-sessions-per-connection 32
set system services netconf ssh
set system services netconf rfc-compliant
set system services web-management http interface ge-0/0/0.0
set system services web-management https system-generated-certificate
set system services web-management https interface ge-0/0/0.0
set system services dhcp-local-server dhcpv6 group jdhcp-group interface ge-0/0/0.0
set system services dhcp-local-server dhcpv6 group jdhcp-group interface ge-0/0/1.0
set system services dhcp-local-server dhcpv6 group jdhcp-group interface ge-0/0/2.0
set system syslog user * any emergency
set system syslog host 192.168.1.200 any notice
set system syslog host 192.168.1.200 authorization info
set system syslog host 192.168.1.200 daemon info
set system syslog host 192.168.1.200 kernel info
set system syslog file messages any notice
set system syslog file messages authorization info
set system syslog file interactive-commands interactive-commands any
set system syslog file default-log-messages any info
set system syslog file default-log-messages match "(requested 'commit' operation)|(copying configuration to juniper.save)|(commit complete)|ifAdminStatus|(FRU power)|(FRU removal)|(FRU insertion)|(link UP)|transitioned|Transferred|transfer-file|(license add)|(license delete)|(package -X update)|(package -X delete)|(FRU Online)|(FRU Offline)|(plugged in)|(unplugged)|GRES"
set system syslog file security authorization any
set system syslog file security interactive-commands any
set system archival configuration transfer-on-commit
set system archival configuration archive-sites "scp://backup@backup-server.company.local:/var/backups/switches/"
set system archival configuration archive-sites "ftp://backup:password@ftp-server.company.local/switches/"
set system ntp server 0.pool.ntp.org prefer
set system ntp server 1.pool.ntp.org
set system ntp server 2.pool.ntp.org
set system ntp server time.google.com
set system ntp source-address ${switchIp}
set system ntp authentication-key 1 type md5
set system ntp authentication-key 1 value "$9$PTQnhclvMX-VwgJDjqmfz/AtOBIRhSyv"
set system ntp trusted-key 1
set system ntp broadcast-client
set system processes dhcp-service traceoptions file dhcp_logfile
set system processes dhcp-service traceoptions file size 10m
set system processes dhcp-service traceoptions level error
set system processes dhcp-service traceoptions flag packet

set chassis aggregated-devices ethernet device-count 16
set chassis alarm management-ethernet link-down ignore
set chassis alarm management-ethernet link-up ignore
set chassis auto-image-upgrade enable
set chassis network-services enhanced-ip
set chassis redundancy graceful-switchover
set chassis fpc 0 pic 0 number-of-ports 48
set chassis fpc 0 pic 1 number-of-ports 4`;

              // Ajouter tous les ports ge-0/0/0 à ge-0/0/47 avec des configurations détaillées
              for (let i = 0; i < 48; i++) {
                const portNum = i.toString().padStart(2, '0');
                const vlanId = 10 + (i % 4) * 10; // VLANs 10, 20, 30, 40 en rotation
                
                if (i < 44) { // Ports 0-43 sont des ports d'accès
                  mockConfig += `
set interfaces ge-0/0/${i} description "Access Port ${i} - VLAN ${vlanId} - User Access"
set interfaces ge-0/0/${i} unit 0 family ethernet-switching interface-mode access
set interfaces ge-0/0/${i} unit 0 family ethernet-switching vlan members vlan-${vlanId}
set interfaces ge-0/0/${i} unit 0 family ethernet-switching storm-control default
set interfaces ge-0/0/${i} unit 0 family ethernet-switching port-security
set interfaces ge-0/0/${i} unit 0 family ethernet-switching port-security maximum-mac-addresses 3
set interfaces ge-0/0/${i} unit 0 family ethernet-switching port-security mac-limit-exceeded drop
set interfaces ge-0/0/${i} unit 0 family ethernet-switching port-security aging-time 20
set interfaces ge-0/0/${i} gigether-options 802.3ad ae${i % 4}
set interfaces ge-0/0/${i} gigether-options auto-negotiation
set interfaces ge-0/0/${i} gigether-options flow-control
set interfaces ge-0/0/${i} gigether-options loopback
set interfaces ge-0/0/${i} gigether-options no-flow-control`;
                } else if (i >= 44 && i < 47) { // Ports 44-46 sont des trunks
                  mockConfig += `
set interfaces ge-0/0/${i} description "Trunk Port ${i} - Uplink to Distribution Switch"
set interfaces ge-0/0/${i} unit 0 family ethernet-switching interface-mode trunk
set interfaces ge-0/0/${i} unit 0 family ethernet-switching vlan members [vlan-10 vlan-20 vlan-30 vlan-40 vlan-100 vlan-200]
set interfaces ge-0/0/${i} unit 0 family ethernet-switching native-vlan-id 1
set interfaces ge-0/0/${i} unit 0 family ethernet-switching storm-control default
set interfaces ge-0/0/${i} gigether-options 802.3ad ae10
set interfaces ge-0/0/${i} gigether-options auto-negotiation
set interfaces ge-0/0/${i} gigether-options flow-control`;
                } else { // Port 47 est pour la gestion
                  mockConfig += `
set interfaces ge-0/0/${i} description "Management Port - OOBM Access"
set interfaces ge-0/0/${i} unit 0 family ethernet-switching interface-mode access
set interfaces ge-0/0/${i} unit 0 family ethernet-switching vlan members mgmt-vlan
set interfaces ge-0/0/${i} unit 0 family ethernet-switching storm-control default`;
                }
              }

              // Ajouter les VLANs et leurs configurations détaillées
              const vlans = [
                { id: 10, name: "Users", subnet: "192.168.10", desc: "End User Network" },
                { id: 20, name: "Guests", subnet: "192.168.20", desc: "Guest Network - Limited Access" },
                { id: 30, name: "Servers", subnet: "192.168.30", desc: "Server Network - Production" },
                { id: 40, name: "Printers", subnet: "192.168.40", desc: "Printer Network - Shared Resources" },
                { id: 100, name: "Management", subnet: "10.148.62", desc: "Network Management VLAN" },
                { id: 200, name: "VoIP", subnet: "192.168.200", desc: "Voice over IP Network" },
                { id: 300, name: "Security", subnet: "192.168.300", desc: "Security Camera Network" },
                { id: 400, name: "IoT", subnet: "192.168.400", desc: "Internet of Things Devices" }
              ];

              vlans.forEach(vlan => {
                mockConfig += `
set interfaces vlan unit ${vlan.id} description "${vlan.desc}"
set interfaces vlan unit ${vlan.id} family inet address ${vlan.subnet}.1/24
set interfaces vlan unit ${vlan.id} family inet filter input vlan-${vlan.id}-in
set interfaces vlan unit ${vlan.id} family inet filter output vlan-${vlan.id}-out
set vlans vlan-${vlan.id} description "${vlan.desc}"
set vlans vlan-${vlan.id} vlan-id ${vlan.id}
set vlans vlan-${vlan.id} l3-interface vlan.${vlan.id}
set vlans vlan-${vlan.id} forwarding-options filter input vlan-${vlan.id}-filter
set vlans vlan-${vlan.id} forwarding-options dhcp-relay
set vlans vlan-${vlan.id} switch-options interface-mac-limit 100
set vlans vlan-${vlan.id} switch-options no-mac-learning
set vlans vlan-${vlan.id} switch-options mac-table-aging-time 300`;
              });

              // Ajouter les configurations de sécurité, protocoles et services
              mockConfig += `
set interfaces me0 unit 0 description "Management Interface - Out of Band"
set interfaces me0 unit 0 family inet address ${switchIp}/24
set interfaces me0 unit 0 family inet address ${switchIp}/24 primary
set interfaces me0 unit 0 family inet filter input mgmt-filter
set interfaces me0 unit 0 family inet filter output mgmt-out-filter

set snmp description "${hostname} - Juniper EX Series Switch - Floor 3 Network"
set snmp location "Building A - Floor 3 - Network Room 301"
set snmp contact "Network Operations Center - noc@company.local - +33-1-23-45-67-89"
set snmp community public authorization read-only
set snmp community private authorization read-write
set snmp community monitoring authorization read-only
set snmp community backup authorization read-write
set snmp trap-options source-address ${switchIp}
set snmp trap-options enterprise-oid 1.3.6.1.4.1.2636.1.1.1.2.82
set snmp trap-group monitoring version v2
set snmp trap-group monitoring categories chassis
set snmp trap-group monitoring categories link
set snmp trap-group monitoring categories configuration
set snmp trap-group monitoring targets 192.168.1.200
set snmp trap-group monitoring targets 192.168.1.201
set snmp rmon alarm 1 interface ge-0/0/0.0 variable 1.3.6.1.2.1.2.2.1.10 sample-type absolute-value
set snmp rmon alarm 1 interface ge-0/0/0.0 interval 30
set snmp rmon alarm 1 interface ge-0/0/0.0 rising-threshold 1000000
set snmp rmon alarm 1 interface ge-0/0/0.0 falling-threshold 500000
set snmp v3 usm local-engine user snmp-monitor authentication-sha authentication-password "$9$PTQnhclvMX-VwgJDjqmfz/AtOBIRhSyv"
set snmp v3 usm local-engine user snmp-monitor privacy-aes128 privacy-password "$9$PTQnhclvMX-VwgJDjqmfz/AtOBIRhSyv"
set snmp v3 vacm security-to-group security-model usm security-name snmp-monitor group monitoring-group
set snmp v3 vacm access group monitoring-group default-context-prefix security-model any security-level privacy read-view all-view
set snmp v3 vacm access group monitoring-group default-context-prefix security-model any security-level privacy write-view all-view
set snmp v3 view all-view oid 1.3.6.1 include

set protocols igmp-snooping vlan vlan-10
set protocols igmp-snooping vlan vlan-10 immediate-leave
set protocols igmp-snooping vlan vlan-10 proxy
set protocols igmp-snooping vlan vlan-20
set protocols igmp-snooping vlan vlan-20 immediate-leave
set protocols igmp-snooping vlan vlan-30
set protocols igmp-snooping vlan vlan-30 proxy
set protocols igmp-snooping vlan vlan-40
set protocols lldp port-id-subtype interface-name
set protocols lldp port-description-type interface-description
set protocols lldp interface all
set protocols lldp interface all enable
set protocols lldp-med interface all
set protocols lldp-med interface all enable
set protocols lldp-med fast-start 4
set protocols dot1x authenticator authentication-profile-name dot1x-profile
set protocols dot1x authenticator interface ge-0/0/0.0 supplicant multiple
set protocols dot1x authenticator interface ge-0/0/0.0 retries 3
set protocols dot1x authenticator interface ge-0/0/0.0 transmit-period 30
set protocols dot1x authenticator interface ge-0/0/0.0 reauthentication 3600
set protocols dot1x authenticator interface ge-0/0/0.0 supplicant-timeout 30
set protocols dot1x authenticator interface ge-0/0/0.0 maximum-requests 3
set protocols dot1x authenticator interface ge-0/0/0.0 mac-radius
set protocols dot1x authenticator interface ge-0/0/0.0 guest-vlan vlan-20
set protocols dot1x authenticator interface ge-0/0/0.0 server-fail vlan-id 666
set protocols rstp bridge-priority 32768
set protocols rstp interface all edge
set protocols rstp interface all no-root-port
set protocols rstp bpdu-block-on-edge

set ethernet-switching-options storm-control interface all
set ethernet-switching-options storm-control interface all bandwidth 10000
set ethernet-switching-options storm-control interface all burst-size 4000
set ethernet-switching-options storm-control interface all recover-time 60
set ethernet-switching-options bpdu-block interface all
set ethernet-switching-options bpdu-block disable-timeout 120
set ethernet-switching-options secure-access-port interface ge-0/0/0.0 dhcp-trusted
set ethernet-switching-options secure-access-port interface ge-0/0/1.0 dhcp-trusted
set ethernet-switching-options secure-access-port interface ge-0/0/44.0 dhcp-trusted
set ethernet-switching-options secure-access-port interface ge-0/0/45.0 dhcp-trusted
set ethernet-switching-options secure-access-port interface ge-0/0/46.0 dhcp-trusted
set ethernet-switching-options analyzer mirror-1 input ingress interface ge-0/0/0.0
set ethernet-switching-options analyzer mirror-1 input egress interface ge-0/0/0.0
set ethernet-switching-options analyzer mirror-1 output interface ge-0/0/47.0
set ethernet-switching-options voip interface ge-0/0/0.0 vlan vlan-200
set ethernet-switching-options voip interface ge-0/0/0.0 forwarding-class voice

set security zones security-zone trust host-inbound-traffic system-services all
set security zones security-zone trust host-inbound-traffic protocols all
set security zones security-zone trust interfaces vlan.10
set security zones security-zone trust interfaces vlan.20
set security zones security-zone trust interfaces vlan.30
set security zones security-zone trust interfaces vlan.40
set security zones security-zone trust interfaces vlan.100
set security zones security-zone trust interfaces vlan.200
set security zones security-zone trust interfaces vlan.300
set security zones security-zone trust interfaces vlan.400
set security zones security-zone untrust host-inbound-traffic system-services ssh
set security zones security-zone untrust host-inbound-traffic system-services https
set security zones security-zone untrust interfaces me0.0
set security policies from-zone trust to-zone trust policy intra-zone-policy match source-address any
set security policies from-zone trust to-zone trust policy intra-zone-policy match destination-address any
set security policies from-zone trust to-zone trust policy intra-zone-policy match application any
set security policies from-zone trust to-zone trust policy intra-zone-policy then permit
set security policies from-zone trust to-zone untrust policy internet-access match source-address any
set security policies from-zone trust to-zone untrust policy internet-access match destination-address any
set security policies from-zone trust to-zone untrust policy internet-access match application any
set security policies from-zone trust to-zone untrust policy internet-access then permit

set routing-options static route 0.0.0.0/0 next-hop 192.168.1.1
set routing-options static route 0.0.0.0/0 qualified-next-hop 192.168.1.2 preference 10
set routing-options static route 10.147.0.0/16 next-hop 10.148.62.1
set routing-options static route 172.16.0.0/12 next-hop 192.168.1.1
set routing-options router-id ${switchIp}
set routing-options autonomous-system 65001
set routing-options forwarding-table export load-balance-policy
set routing-options interface-routes rib-group inet import-rib
set routing-options rib-groups import-rib import-rib inet.0
set routing-options rib-groups import-rib import-rib inet6.0

set poe interface all
set poe interface all maximum-power 15.4
set poe interface all priority low
set poe interface all power-pairs signal
set poe management class 0
set poe management class 0 power-limit 15400
set poe management class 1
set poe management class 1 power-limit 4000
set poe management class 2
set poe management class 2 power-limit 7000
set poe management class 3
set poe management class 3 power-limit 15400
set poe management class 4
set poe management class 4 power-limit 30000
set poe management guard-band 1000

set forwarding-options storm-control-profiles default all
set forwarding-options storm-control-profiles default all bandwidth-level 10000
set forwarding-options storm-control-profiles default all burst-size 4000
set forwarding-options storm-control-profiles default all recover-time 60
set forwarding-options storm-control-profiles strict all
set forwarding-options storm-control-profiles strict all bandwidth-level 1000
set forwarding-options storm-control-profiles strict all burst-size 1000
set forwarding-options storm-control-profiles strict all recover-time 300
set forwarding-options dhcp-relay server-group dhcp-servers 192.168.1.10
set forwarding-options dhcp-relay server-group dhcp-servers 192.168.1.11
set forwarding-options dhcp-relay server-group dhcp-servers 192.168.1.12
set forwarding-options dhcp-relay active-server-group dhcp-servers
set forwarding-options dhcp-relay group relay-group interface vlan.10
set forwarding-options dhcp-relay group relay-group interface vlan.20
set forwarding-options dhcp-relay group relay-group interface vlan.30
set forwarding-options dhcp-relay group relay-group interface vlan.40
set forwarding-options sampling input rate 1000
set forwarding-options sampling input run-length 9
set forwarding-options sampling input max-packets-per-second 1000
set forwarding-options sampling output cflowd 192.168.1.100
set forwarding-options sampling output cflowd port 9996
set forwarding-options sampling output cflowd version 5
set forwarding-options sampling output cflowd autonomous-system-type origin

set event-options policy link-down events snmp_trap_link_down
set event-options policy link-down then execute-commands commands "show interfaces terse | match down"
set event-options policy link-down then execute-commands commands "show log messages | last 10"
set event-options policy link-down then execute-commands output-filename /var/log/link-events
set event-options policy link-down then execute-commands destination monitoring@192.168.1.200
set event-options policy config-change events ui_commit
set event-options policy config-change then execute-commands commands "show configuration | compare rollback 1"
set event-options policy config-change then execute-commands output-filename /var/log/config-changes
set event-options policy hardware-alarm events chassis_alarm
set event-options policy hardware-alarm then execute-commands commands "show chassis alarms"
set event-options policy hardware-alarm then execute-commands commands "show chassis environment"
set event-options policy hardware-alarm then execute-commands output-filename /var/log/hardware-events

set access radius-server 10.147.32.47 port 1812
set access radius-server 10.147.32.47 secret "$9$qfTF69tBRcP5Qn9tREdbwsoJUjH.fT3n/9AtOIEcylv"
set access radius-server 10.147.32.47 source-address ${switchIp}
set access radius-server 10.147.32.47 accounting-port 1813
set access radius-server 10.147.32.47 timeout 10
set access radius-server 10.147.32.47 retry 3
set access radius-server 10.147.32.47 max-outstanding-requests 1000
set access radius-server 10.147.160.47 port 1812
set access radius-server 10.147.160.47 secret "$9$72Vw2oJUkm5dbs4JUmPBIREreM8XNVwgaZUjq"
set access radius-server 10.147.160.47 source-address ${switchIp}
set access radius-server 10.147.160.47 accounting-port 1813
set access radius-server 10.147.160.47 timeout 10
set access radius-server 10.147.160.47 retry 3
set access radius-server 10.147.160.47 max-outstanding-requests 1000
set access profile 802.1x-auth accounting-order radius
set access profile 802.1x-auth authentication-order radius
set access profile 802.1x-auth radius authentication-server 10.147.32.47
set access profile 802.1x-auth radius authentication-server 10.147.160.47
set access profile 802.1x-auth radius accounting-server 10.147.32.47
set access profile 802.1x-auth radius accounting-server 10.147.160.47
set access profile 802.1x-auth radius-server 10.147.32.47 accounting-port 1813
set access profile 802.1x-auth radius-server 10.147.160.47 accounting-port 1813
set access profile dot1x-profile accounting-order radius
set access profile dot1x-profile authentication-order radius
set access profile dot1x-profile radius authentication-server 10.147.32.47
set access profile dot1x-profile radius authentication-server 10.147.160.47
set access profile dot1x-profile radius accounting-server 10.147.32.47
set access profile dot1x-profile radius accounting-server 10.147.160.47
set protocols dot1x authenticator authentication-profile-name 802.1x-auth

set applications application junos-dhcp-client protocol udp
set applications application junos-dhcp-client source-port 68
set applications application junos-dhcp-client destination-port 67
set applications application junos-dhcp-server protocol udp
set applications application junos-dhcp-server source-port 67
set applications application junos-dhcp-server destination-port 68
set applications application custom-app-1 protocol tcp
set applications application custom-app-1 destination-port 8080-8090
set applications application custom-app-2 protocol udp
set applications application custom-app-2 destination-port 5000-5010

set firewall family ethernet-switching filter block-dhcp term block-dhcp-server from protocol udp
set firewall family ethernet-switching filter block-dhcp term block-dhcp-server from source-port 67
set firewall family ethernet-switching filter block-dhcp term block-dhcp-server then discard
set firewall family ethernet-switching filter block-dhcp term allow-others then accept
set firewall family inet filter vlan-10-in term allow-established from source-address 192.168.10.0/24
set firewall family inet filter vlan-10-in term allow-established then accept
set firewall family inet filter vlan-10-in term deny-inter-vlan from source-address 192.168.0.0/16
set firewall family inet filter vlan-10-in term deny-inter-vlan then discard
set firewall family inet filter vlan-10-in term allow-internet then accept

set policy-options prefix-list internal-networks 192.168.0.0/16
set policy-options prefix-list internal-networks 10.0.0.0/8
set policy-options prefix-list internal-networks 172.16.0.0/12
set policy-options prefix-list management-networks 10.148.0.0/16
set policy-options prefix-list management-networks 192.168.100.0/24
set policy-options policy-statement load-balance-policy then load-balance per-packet
set policy-options policy-statement export-static from protocol static
set policy-options policy-statement export-static then accept

set class-of-service classifiers dscp default forwarding-class best-effort loss-priority low code-points 000000
set class-of-service classifiers dscp default forwarding-class expedited-forwarding loss-priority low code-points 101110
set class-of-service classifiers dscp default forwarding-class assured-forwarding loss-priority low code-points 001010
set class-of-service classifiers dscp default forwarding-class network-control loss-priority low code-points 110000
set class-of-service forwarding-classes class best-effort queue-num 0
set class-of-service forwarding-classes class expedited-forwarding queue-num 1
set class-of-service forwarding-classes class assured-forwarding queue-num 2
set class-of-service forwarding-classes class network-control queue-num 3
set class-of-service interfaces ge-0/0/0 unit 0 classifiers dscp default
set class-of-service interfaces ge-0/0/0 unit 0 schedulers voice-scheduler
set class-of-service schedulers voice-scheduler transmit-rate percent 50
set class-of-service schedulers voice-scheduler buffer-size percent 25
set class-of-service schedulers voice-scheduler priority high

# Configuration complète terminée - Total: ${mockConfig.split('\n').length} lignes
# Fin de la configuration du switch ${hostname}
# Timestamp de fin: ${new Date().toLocaleString('fr-FR')}`;

              console.log(`Configuration générée: ${mockConfig.split('\n').length} lignes`);
              
              // Utiliser ConfigurationParser pour extraire le hostname proprement
              const extractedHostnameFromConfig = extractHostname(mockConfig);

              setConfiguration(mockConfig);
              setExtractedHostname(extractedHostnameFromConfig);
              setConnectionStatus({ isConnected: true });
              setIsConnecting(false);
              setConnectionStep('');
              
              toast({
                title: "Configuration complète récupérée",
                description: `✓ Hostname: ${extractedHostnameFromConfig} - Fichier prêt pour téléchargement`,
                duration: 5000
              });
            }, 4000);
          }, 1500);
        }, 2000);
      }, 1500);
    }, 1000);
  };

  const handleDisconnect = () => {
    setConnectionStatus({ isConnected: false });
    setConfiguration('');
    setExtractedHostname('');
    setConnectionStep('');
    toast({
      title: "Déconnecté",
      description: "Sessions fermées (serveur Robont et switch)",
    });
  };

  const downloadConfiguration = () => {
    if (!configuration) return;

    const filename = extractedHostname ? `${extractedHostname}.txt` : `switch_${switchIp.replace(/\./g, '_')}.txt`;
    const blob = new Blob([configuration], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Téléchargement",
      description: `Configuration sauvegardée dans ${filename}`,
    });
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-tech-primary">Connexion SSH aux Équipements</h1>
          <p className="text-muted-foreground">
            Connexion via serveur Robont (6.91.128.111) vers switches réseau
          </p>
        </header>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Architecture:</strong> Serveur Robont (6.91.128.111) → Switch cible<br/>
            <strong>Commande exécutée:</strong> show configuration | display set | no-more<br/>
            <strong>Note:</strong> Cette interface simule le processus de connexion SSH en cascade.
            Une implémentation réelle nécessiterait un backend avec paramiko.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Formulaire de connexion */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5 text-tech-primary" />
                Connexion via Serveur Robont
              </CardTitle>
              <CardDescription>
                Connexion SSH : Serveur Robont (6.91.128.111) → Switch cible
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Section Serveur Robont */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-tech-secondary">
                  <div className="w-2 h-2 rounded-full bg-tech-secondary"></div>
                  Serveur Robont (IP fixe)
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="robont-ip">Adresse IP</Label>
                    <Input
                      id="robont-ip"
                      value={robontServerIp}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="robont-username">Utilisateur *</Label>
                    <Input
                      id="robont-username"
                      placeholder="Nom d'utilisateur serveur"
                      value={robontUsername}
                      onChange={(e) => setRobontUsername(e.target.value)}
                      disabled={connectionStatus.isConnected}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="robont-password">Mot de passe *</Label>
                    <Input
                      id="robont-password"
                      type="password"
                      placeholder="Mot de passe serveur Robont"
                      value={robontPassword}
                      onChange={(e) => setRobontPassword(e.target.value)}
                      disabled={connectionStatus.isConnected}
                    />
                  </div>
                </div>
              </div>

              {/* Section Switch */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-tech-primary">
                  <div className="w-2 h-2 rounded-full bg-tech-primary"></div>
                  Switch Cible
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="switch-ip">Adresse IP *</Label>
                    <Input
                      id="switch-ip"
                      placeholder="192.168.1.10"
                      value={switchIp}
                      onChange={(e) => setSwitchIp(e.target.value)}
                      disabled={connectionStatus.isConnected}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="switch-username">Utilisateur *</Label>
                    <Input
                      id="switch-username"
                      placeholder="root"
                      value={switchUsername}
                      onChange={(e) => setSwitchUsername(e.target.value)}
                      disabled={connectionStatus.isConnected}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="switch-password">Mot de passe</Label>
                    <Input
                      id="switch-password"
                      type="password"
                      placeholder="Optionnel si clés SSH"
                      value={switchPassword}
                      onChange={(e) => setSwitchPassword(e.target.value)}
                      disabled={connectionStatus.isConnected}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Connexion SSH sécurisée via serveur Robont → show configuration | display set | no-more
                </span>
              </div>

              {/* Statut de connexion */}
              {isConnecting && connectionStep && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">{connectionStep}</p>
                </div>
              )}

              <div className="flex gap-2">
                {!connectionStatus.isConnected ? (
                  <Button 
                    onClick={handleConnect}
                    disabled={isConnecting}
                    className="flex-1"
                  >
                    {isConnecting ? "Connexion en cours..." : "Se connecter"}
                  </Button>
                ) : (
                  <Button 
                    onClick={handleDisconnect}
                    variant="destructive"
                    className="flex-1"
                  >
                    Se déconnecter
                  </Button>
                )}
              </div>

              {connectionStatus.isConnected && (
                <div className="space-y-2">
                  <Badge variant="outline" className="bg-tech-success/10 text-tech-success border-tech-success/30">
                    Robont: {robontServerIp}
                  </Badge>
                  <Badge variant="outline" className="bg-tech-primary/10 text-tech-primary border-tech-primary/30">
                    Switch: {switchIp}
                  </Badge>
                  {extractedHostname && (
                    <Badge variant="outline" className="bg-tech-secondary/10 text-tech-secondary border-tech-secondary/30">
                      Hostname: {extractedHostname}
                    </Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Affichage de la configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="h-5 w-5 text-tech-secondary" />
                Configuration du Switch
              </CardTitle>
              <CardDescription>
                Résultat de "show configuration | display set | no-more"
              </CardDescription>
            </CardHeader>
            <CardContent>
              {configuration ? (
                <div className="space-y-4">
                  <Textarea
                    value={configuration}
                    readOnly
                    className="min-h-96 font-mono text-sm bg-code-bg text-code-text"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(configuration);
                        toast({
                          title: "Copié !",
                          description: "Configuration copiée dans le presse-papiers",
                        });
                      }}
                    >
                      Copier la configuration
                    </Button>
                    <Button
                      variant="outline"
                      onClick={downloadConfiguration}
                    >
                      Télécharger ({extractedHostname || 'switch'}.txt)
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Terminal className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Connectez-vous pour afficher la configuration</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}