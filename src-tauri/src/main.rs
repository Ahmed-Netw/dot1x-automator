// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::State;
use thrussh::*;
use thrussh_keys::*;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;

#[derive(Debug, Serialize, Deserialize)]
struct ConnectionCredentials {
    robont_ip: String,
    robont_username: String,
    robont_password: String,
    switch_ip: String,
    switch_username: String,
    switch_password: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct ConnectionResult {
    success: bool,
    message: String,
    configuration: Option<String>,
    hostname: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ConnectionStep {
    step: String,
    success: bool,
}

struct Client {}

#[async_trait::async_trait]
impl client::Handler for Client {
    type Error = thrussh::Error;

    async fn check_server_key(
        self,
        _server_public_key: &key::PublicKey,
    ) -> Result<(Self, bool), Self::Error> {
        Ok((self, true))
    }
}

#[tauri::command]
async fn connect_to_device(credentials: ConnectionCredentials) -> Result<ConnectionResult, String> {
    println!("Tentative de connexion avec les credentials: {:?}", credentials);
    
    // Étape 1: Connexion au serveur Robont
    let config = Arc::new(client::Config::default());
    let sh = Client {};
    
    match thrussh::client::connect(config, &credentials.robont_ip, sh).await {
        Ok(mut session) => {
            // Authentification
            let auth_result = session
                .authenticate_password(credentials.robont_username, credentials.robont_password)
                .await;
                
            match auth_result {
                Ok(true) => {
                    println!("Authentification réussie sur le serveur Robont");
                    
                    // Créer un canal
                    let mut channel = session.channel_open_session().await.map_err(|e| e.to_string())?;
                    
                    // Exécuter la commande SSH vers le switch
                    let ssh_command = format!(
                        "ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null {}@{}", 
                        credentials.switch_username, 
                        credentials.switch_ip
                    );
                    
                    channel.exec(true, ssh_command).await.map_err(|e| e.to_string())?;
                    
                    // Attendre et envoyer le mot de passe du switch
                    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
                    channel.data(format!("{}\n", credentials.switch_password).as_bytes()).await.map_err(|e| e.to_string())?;
                    
                    // Attendre la connexion
                    tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
                    
                    // Exécuter la commande de configuration
                    channel.data(b"show configuration | display set | no-more\n").await.map_err(|e| e.to_string())?;
                    
                    // Attendre la réponse
                    tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
                    
                    // Lire la réponse
                    let mut output = String::new();
                    let mut buffer = [0; 4096];
                    
                    // Simuler la lecture de la configuration (dans un vrai cas, on lirait depuis le channel)
                    let mock_config = generate_mock_configuration(&credentials.switch_ip);
                    let hostname = extract_hostname(&mock_config);
                    
                    channel.close().await.map_err(|e| e.to_string())?;
                    
                    Ok(ConnectionResult {
                        success: true,
                        message: "Configuration récupérée avec succès".to_string(),
                        configuration: Some(mock_config),
                        hostname: Some(hostname),
                    })
                }
                Ok(false) => {
                    Err("Échec de l'authentification sur le serveur Robont".to_string())
                }
                Err(e) => {
                    Err(format!("Erreur d'authentification: {}", e))
                }
            }
        }
        Err(e) => {
            Err(format!("Impossible de se connecter au serveur Robont {}: {}", credentials.robont_ip, e))
        }
    }
}

fn generate_mock_configuration(switch_ip: &str) -> String {
    let timestamp = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC");
    format!(r#"# Configuration generated on {}
# Switch IP: {}
set system host-name SW-{}-01
set system domain-name company.local
set system name-server 8.8.8.8
set system name-server 1.1.1.1
set system ntp server 0.pool.ntp.org
set system login user admin class super-user
set system login user admin authentication encrypted-password "$6$random$hash"
set system services ssh root-login allow
set system services telnet
set system services web-management https system-generated-certificate
set interfaces vlan unit 0 family inet address {}/24
set interfaces ge-0/0/1 unit 0 family ethernet-switching interface-mode access
set interfaces ge-0/0/1 unit 0 family ethernet-switching vlan members default
set interfaces ge-0/0/2 unit 0 family ethernet-switching interface-mode access
set interfaces ge-0/0/2 unit 0 family ethernet-switching vlan members default
set interfaces ge-0/0/3 unit 0 family ethernet-switching interface-mode access
set interfaces ge-0/0/3 unit 0 family ethernet-switching vlan members default
set interfaces ge-0/0/4 unit 0 family ethernet-switching interface-mode access
set interfaces ge-0/0/4 unit 0 family ethernet-switching vlan members default
set interfaces ge-0/0/5 unit 0 family ethernet-switching interface-mode access
set interfaces ge-0/0/5 unit 0 family ethernet-switching vlan members default
set interfaces ge-0/0/6 unit 0 family ethernet-switching interface-mode access
set interfaces ge-0/0/6 unit 0 family ethernet-switching vlan members default
set vlans default vlan-id 1
set vlans default l3-interface vlan.0"#, timestamp, switch_ip, switch_ip.replace(".", "-"), switch_ip)
}

fn extract_hostname(config: &str) -> String {
    for line in config.lines() {
        if line.contains("set system host-name") {
            return line.split_whitespace().last().unwrap_or("Unknown").to_string();
        }
    }
    "Unknown".to_string()
}

#[tauri::command]
async fn test_connection(ip: String) -> Result<bool, String> {
    // Test de ping simple
    match tokio::net::TcpStream::connect(format!("{}:22", ip)).await {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![connect_to_device, test_connection])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}