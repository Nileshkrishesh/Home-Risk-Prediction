@echo off
title Home Credit Risk AI Streamlit App
echo ========================================================
echo    Launching Home Credit Streamlit Dashboard
echo ========================================================
cd /d "%~dp0"
streamlit run streamlit_app.py
pause
