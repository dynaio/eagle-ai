import os
import sys
import subprocess
import shutil
import platform
from pathlib import Path

def get_target_triple():
    system = platform.system().lower()
    arch = platform.machine().lower()
    
    if arch == 'amd64' or arch == 'x86_64':
        arch = 'x86_64'
    elif arch == 'arm64' or 'aarch64' in arch:
        arch = 'aarch64'
        
    if system == 'linux':
        return f"{arch}-unknown-linux-gnu"
    elif system == 'windows':
        return f"{arch}-pc-windows-msvc"
    elif system == 'darwin':
        return f"{arch}-apple-darwin"
    return f"{arch}-unknown"

def build():
    print("--- EagleAI: Building Industrial Backend Sidecar ---")
    
    # Path setup
    root_dir = Path(__file__).resolve().parent
    bin_dir = root_dir.parent / "src-tauri" / "binaries"
    bin_dir.mkdir(parents=True, exist_ok=True)
    
    # Run PyInstaller
    # Use the existing spec file
    print(f"Executing PyInstaller on {root_dir}/eagle-sidecar.spec...")
    
    # Dynamic Python Discovery (Crucial for GitHub Actions)
    python_cmd = sys.executable
    # Look for a local venv first (standard for CI/CD)
    local_venv = root_dir.parent.parent / "packages" / "shared-backend" / ".venv"
    
    if platform.system() == "Windows":
        win_py = local_venv / "Scripts" / "python.exe"
        if win_py.exists():
            python_cmd = str(win_py)
    else:
        unix_py = local_venv / "bin" / "python3"
        if unix_py.exists():
            python_cmd = str(unix_py)
    
    print(f"Using Python: {python_cmd}")
    
    try:
        subprocess.run([python_cmd, "-m", "PyInstaller", "--clean", "eagle-sidecar.spec"], check=True, cwd=root_dir)
    except subprocess.CalledProcessError as e:
        print(f"Error: PyInstaller failed with exit code {e.returncode}")
        return

    # Determine resulting binary path
    target_name = "eagle-sidecar"
    if platform.system() == "Windows":
        target_name += ".exe"
        
    dist_path = root_dir / "dist" / target_name
    
    if not dist_path.exists():
        print(f"Error: Binary not found at {dist_path}")
        return
        
    # Rename and Move to Tauri bin folder
    triple = get_target_triple()
    final_name = f"eagle-sidecar-{triple}"
    if platform.system() == "Windows":
        final_name += ".exe"
        
    dest_path = bin_dir / final_name
    
    print(f"Packaging binary as: {final_name}")
    shutil.copy2(dist_path, dest_path)
    
    print(f"--- Build Success! Binary moved to: {dest_path} ---")

if __name__ == "__main__":
    build()
