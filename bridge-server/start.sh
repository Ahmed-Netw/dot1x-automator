#!/bin/bash
echo "========================================"
echo " Network Management Bridge Server"
echo "========================================"
echo ""
echo "Installation des dépendances..."
pip3 install -r requirements.txt
echo ""
echo "Démarrage du serveur..."
echo "Serveur accessible sur: http://127.0.0.1:5001"
echo "Documentation API: http://127.0.0.1:5001/docs"
echo ""
echo "Appuyez sur Ctrl+C pour arrêter"
echo "========================================"
python3 bridge_server.py