@echo off
echo ========================================
echo RAG Q&A System - Quick Start
echo ========================================
echo.

echo Step 1: Checking Python dependencies...
pip show sentence-transformers >nul 2>&1
if %errorlevel% neq 0 (
    echo Installing Python dependencies...
    pip install -r requirements_rag.txt
) else (
    echo ✓ Dependencies already installed
)
echo.

echo Step 2: Testing with sample dataset...
python test_rag.py
echo.

echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Choose an option:
echo   1. Run CLI (Interactive)
echo   2. Run API Server
echo   3. Exit
echo.

set /p choice="Enter choice (1-3): "

if "%choice%"=="1" (
    echo.
    echo Starting CLI...
    python rag_cli.py
) else if "%choice%"=="2" (
    echo.
    echo Starting API Server on port 5001...
    node rag_server.js
) else (
    echo Goodbye!
)
