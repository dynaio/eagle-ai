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
    print("--- Sidecar build started ---")
    
    # Path setup
    root_dir = Path(__file__).resolve().parent
    bin_dir = root_dir.parent / "src-tauri" / "binaries"
    bin_dir.mkdir(parents=True, exist_ok=True)
    
    # 1. Install Dependencies
    print("Installing dependencies from requirements.txt...")
    python_cmd = sys.executable
    try:
        # User requested --no-deps first for reliability
        subprocess.run([python_cmd, "-m", "pip", "install", "-r", "requirements.txt", "--no-deps"], check=True, cwd=root_dir)
        # Then ensure all missing deps are actually there
        subprocess.run([python_cmd, "-m", "pip", "install", "-r", "requirements.txt"], check=True, cwd=root_dir)
        print("Dependencies installed successfully.")
    except subprocess.CalledProcessError as e:
        print(f"Error installing dependencies: {e}")
        sys.exit(1)

    # 2. Run PyInstaller
    print(f"Executing PyInstaller on {root_dir}/eagle-sidecar.spec...")
    try:
        subprocess.run([python_cmd, "-m", "PyInstaller", "--clean", "--noconfirm", "eagle-sidecar.spec"], check=True, cwd=root_dir)
    except subprocess.CalledProcessError as e:
        print(f"Error: PyInstaller failed with exit code {e.returncode}")
        sys.exit(1)

    # 3. Handle Binary Move/Rename
    dist_file = "eagle-sidecar.exe" if platform.system() == "Windows" else "eagle-sidecar"
    dist_path = root_dir / "dist" / dist_file
    
    if not dist_path.exists():
        print(f"Error: Binary not found at {dist_path}")
        sys.exit(1)

    # Tauri requires the target triple suffix to identify the sidecar correctly
    triple = get_target_triple()
    final_name = f"eagle-sidecar-{triple}"
    if platform.system() == "Windows":
        final_name += ".exe"
        
    dest_path = bin_dir / final_name
    
    print(f"Binary created successfully. Moving to: {dest_path}")
    shutil.copy2(dist_path, dest_path)
    
    # Also create the simple named copy for convenience
    shutil.copy2(dist_path, bin_dir / dist_file)
    
    print(f"--- Build Success! ---")

if __name__ == "__main__":
    build()
