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
use std::process::Command;
use std::fs;
use std::path::Path;

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
    execution_logs: Option<String>,
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
    
    match thrussh::client::connect(config, format!("{}:22", &credentials.robont_ip), sh).await {
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
                        "ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null {}@{} 'show configuration | display set | no-more'", 
                        credentials.switch_username, 
                        credentials.switch_ip
                    );
                    
                    println!("Exécution de la commande: {}", ssh_command);
                    channel.exec(true, ssh_command).await.map_err(|e| e.to_string())?;
                    
                    // Attendre et envoyer le mot de passe du switch si nécessaire
                    if !credentials.switch_password.is_empty() {
                        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
                        channel.data(format!("{}\n", credentials.switch_password).as_bytes()).await.map_err(|e| e.to_string())?;
                    }
                    
                    // Attendre la réponse et lire la configuration réelle
                    tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
                    
                    let mut output = String::new();
                    let mut buffer = vec![0; 4096];
                    let mut total_read = 0;
                    
                    // Lire la réponse du switch (timeout après 30 secondes)
                    let start_time = std::time::Instant::now();
                    while start_time.elapsed().as_secs() < 30 {
                        match channel.data(&mut buffer).await {
                            Ok(Some(data)) => {
                                let text = String::from_utf8_lossy(&data);
                                output.push_str(&text);
                                total_read += data.len();
                                
                                // Si on a reçu des données et qu'il n'y en a plus, on s'arrête
                                if text.contains("# Configuration complete") || text.ends_with("# End of configuration") {
                                    break;
                                }
                            }
                            Ok(None) => {
                                // Pas de données disponibles, attendre un peu
                                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                            }
                            Err(_) => break,
                        }
                    }
                    
                    channel.close().await.map_err(|e| e.to_string())?;
                    
                    // Si on n'a pas réussi à récupérer la vraie configuration, 
                    // informer l'utilisateur et proposer une alternative
                    if output.is_empty() || output.len() < 100 {
                        return Err(format!(
                            "Impossible de récupérer la configuration du switch {}. Vérifiez:\n\
                            - Les identifiants du switch\n\
                            - La connectivité entre Robont et le switch\n\
                            - Que le switch supporte la commande 'show configuration | display set | no-more'\n\
                            Configuration reçue: {}",
                            credentials.switch_ip,
                            if output.is_empty() { "Aucune donnée" } else { &output[..std::cmp::min(200, output.len())] }
                        ));
                    }
                    
                    let hostname = extract_hostname(&output);
                    
                    Ok(ConnectionResult {
                        success: true,
                        message: format!("Configuration récupérée avec succès du switch {}", hostname),
                        configuration: Some(output),
                        hostname: Some(hostname),
                        execution_logs: None,
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

fn extract_hostname(config: &str) -> String {
    for line in config.lines() {
        if line.contains("set system host-name") || line.contains("hostname") {
            if let Some(hostname) = line.split_whitespace().last() {
                return hostname.replace(";", "").to_string();
            }
        }
    }
    "Unknown".to_string()
}

#[derive(Debug, Serialize, Deserialize)]
struct RebondCredentials {
    rebond_ip: String,
    rebond_username: String,
    rebond_password: String,
    switch_ip: String,
    switch_username: String,
    switch_password: String,
}

#[tauri::command]
async fn run_rebond_script(credentials: RebondCredentials) -> Result<ConnectionResult, String> {
    println!("Executing rebond script with credentials: {:?}", credentials);
    
    // Embed the Python script
    let script_content = include_str!("../../../public/scripts/rebond_fetch_config.py");
    
    // Create a temporary directory for the script
    let temp_dir = std::env::temp_dir();
    let script_path = temp_dir.join("rebond_fetch_config.py");
    
    // Write the script to temp file
    fs::write(&script_path, script_content)
        .map_err(|e| format!("Failed to write script to temp file: {}", e))?;
    
    // Try different Python executables
    let python_executables = if cfg!(target_os = "windows") {
        vec!["python", "python3", "py"]
    } else {
        vec!["python3", "python"]
    };
    
    let mut last_error = String::new();
    let mut execution_logs = String::new();
    
    for python_exe in python_executables {
        println!("Trying Python executable: {}", python_exe);
        
        let mut cmd = Command::new(python_exe);
        cmd.arg(&script_path)
           .arg(&credentials.rebond_ip)
           .arg(&credentials.rebond_username)
           .arg(&credentials.rebond_password)
           .arg(&credentials.switch_ip)
           .arg(&credentials.switch_username)
           .arg(&credentials.switch_password);
        
        match cmd.output() {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let stderr = String::from_utf8_lossy(&output.stderr);
                
                // Capture execution logs for debugging
                execution_logs.push_str(&format!("=== Execution avec {} ===\n", python_exe));
                execution_logs.push_str(&format!("STDOUT:\n{}\n", stdout));
                if !stderr.is_empty() {
                    execution_logs.push_str(&format!("STDERR:\n{}\n", stderr));
                }
                execution_logs.push_str(&format!("Exit Status: {}\n\n", output.status));
                
                println!("Python stdout: {}", stdout);
                if !stderr.is_empty() {
                    println!("Python stderr: {}", stderr);
                }
                
                // Look for the success message and file path
                if stdout.contains("✅ Récupération terminée avec succès!") || stdout.contains("📄 Fichier généré:") {
                    // Extract the file path from the output
                    let mut file_path: Option<String> = None;
                    
                    for line in stdout.lines() {
                        if line.contains("📁 Configuration sauvegardée:") {
                            if let Some(path) = line.split("📁 Configuration sauvegardée:").nth(1) {
                                file_path = Some(path.trim().to_string());
                                break;
                            }
                        } else if line.contains("📄 Fichier généré:") {
                            if let Some(path) = line.split("📄 Fichier généré:").nth(1) {
                                file_path = Some(path.trim().to_string());
                                break;
                            }
                        }
                    }
                    
                    if let Some(path) = file_path {
                        // Read the configuration file
                        match fs::read_to_string(&path) {
                            Ok(config_content) => {
                                let hostname = extract_hostname(&config_content);
                                
                                // Clean up temp script
                                let _ = fs::remove_file(&script_path);
                                
                                return Ok(ConnectionResult {
                                    success: true,
                                    message: format!("Configuration récupérée avec succès du switch {}", hostname),
                                    configuration: Some(config_content),
                                    hostname: Some(hostname),
                                    execution_logs: Some(execution_logs),
                                });
                            }
                            Err(e) => {
                                last_error = format!("Failed to read configuration file {}: {}", path, e);
                                continue;
                            }
                        }
                    } else {
                        last_error = "Script executed but could not find output file path".to_string();
                        continue;
                    }
                } else {
                    last_error = format!("Script failed. Stdout: {} Stderr: {}", stdout, stderr);
                    continue;
                }
            }
            Err(e) => {
                last_error = format!("Failed to execute {}: {}", python_exe, e);
                continue;
            }
        }
    }
    
    // Clean up temp script
    let _ = fs::remove_file(&script_path);
    
    Err(format!(
        "Échec de l'exécution du script Python avec tous les exécutables Python disponibles.\n\nLogs d'exécution:\n{}\n\nDernière erreur: {}",
        execution_logs,
        last_error
    ))
}

// Alias for test_robont_connection to maintain consistency
#[tauri::command]
async fn test_rebond_connection(ip: String, username: String, password: String) -> Result<String, String> {
    test_robont_connection(ip, username, password).await
}

#[tauri::command]
async fn ping_host(ip: String) -> Result<bool, String> {
    println!("Test de ping vers: {}", ip);
    
    // Ping basique - essayer de se connecter au port SSH (22)
    match tokio::time::timeout(
        tokio::time::Duration::from_secs(5),
        tokio::net::TcpStream::connect(format!("{}:22", ip))
    ).await {
        Ok(Ok(_)) => {
            println!("Ping réussi vers {} (port 22 ouvert)", ip);
            Ok(true)
        }
        Ok(Err(e)) => {
            println!("Ping échoué vers {}: {}", ip, e);
            Ok(false)
        }
        Err(_) => {
            println!("Timeout lors du ping vers {}", ip);
            Ok(false)
        }
    }
}

#[tauri::command]
async fn test_robont_connection(ip: String, username: String, password: String) -> Result<String, String> {
    println!("Test de connexion au serveur Robont: {}@{}", username, ip);
    
    let config = Arc::new(client::Config::default());
    let sh = Client {};
    
    match tokio::time::timeout(
        tokio::time::Duration::from_secs(10),
        thrussh::client::connect(config, format!("{}:22", ip), sh)
    ).await {
        Ok(Ok(mut session)) => {
            match session.authenticate_password(username, password).await {
                Ok(true) => {
                    session.disconnect(thrussh::Disconnect::ByApplication, "", "").await.ok();
                    Ok("Connexion au serveur Robont réussie".to_string())
                }
                Ok(false) => {
                    Err("Identifiants incorrects pour le serveur Robont".to_string())
                }
                Err(e) => {
                    Err(format!("Erreur d'authentification: {}", e))
                }
            }
        }
        Ok(Err(e)) => {
            Err(format!("Impossible de se connecter au serveur Robont: {}", e))
        }
        Err(_) => {
            Err("Timeout lors de la connexion au serveur Robont".to_string())
        }
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            connect_to_device, 
            ping_host, 
            test_robont_connection,
            run_rebond_script,
            test_rebond_connection
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}