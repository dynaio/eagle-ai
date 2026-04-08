#!/bin/bash
# EagleAI Backend Environment Setup
# This script creates a virtual environment and installs required dependencies.

# Exit on error
set -e

echo "--- EagleAI: Initializing Industrial Python Environment ---"

# Detect OS
OS="linux"
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
    OS="windows"
fi

# Check for Python
if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
    echo "Error: Python is not installed. Please install Python 3.10+."
    exit 1
fi

PY_CMD="python3"
if [[ "$OS" == "windows" ]]; then
    PY_CMD="python"
fi

# Create Virtual Environment
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    $PY_CMD -m venv venv
else
    echo "Virtual environment already exists."
fi

# Activate Venv and Install
if [[ "$OS" == "windows" ]]; then
    source venv/Scripts/activate
else
    source venv/bin/activate
fi

echo "Installing dependencies from requirements.txt..."
pip install --upgrade pip
pip install -r requirements.txt

echo "--- Setup Complete! ---"
echo "To manually test the backend: "
if [[ "$OS" == "windows" ]]; then
    echo "  venv\Scripts\python main.py --port 6789"
else
    echo "  ./venv/bin/python main.py --port 6789"
fi
