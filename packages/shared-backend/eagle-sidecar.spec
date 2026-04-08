block_cipher = None

a = Analysis(
    ['sidecar_main.py'],
    pathex=[],
    binaries=[],
    datas=[('src', 'src'), ('main.py', '.'), ('routers', 'routers'), ('state', 'state'), ('settings', 'settings')],
    hiddenimports=[
        'uvicorn', 'uvicorn.logging', 'uvicorn.loops', 'uvicorn.protocols',
        'fastapi', 'starlette', 'pydantic', 'pydantic_core',
        'pandas', 'openpyxl', 'numpy', 'anyio', 'sniffio',
        'httpx', 'httpcore', 'h11', 'websockets', 'email_validator',
    ],
    excludes=[
        'PyQt5', 'PyQt6', 'PySide2', 'PySide6', 'matplotlib', 'tkinter',
        'IPython', 'jupyter', 'notebook', 'pytest', 'jedi',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz, a.scripts, a.binaries, a.zipfiles, a.datas, [],
    name='eagle-sidecar',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
)
