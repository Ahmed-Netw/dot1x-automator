@echo off
echo ========================================
echo  Network Management Bridge Server
echo ========================================
echo.
echo Installation des dependances...
pip install -r requirements.txt
echo.
echo Demarrage du serveur...
echo Serveur accessible sur: http://127.0.0.1:5001
echo Documentation API: http://127.0.0.1:5001/docs
echo.
echo Appuyez sur Ctrl+C pour arreter
echo ========================================
python bridge_server.py
pause