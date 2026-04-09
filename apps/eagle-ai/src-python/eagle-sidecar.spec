# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_all

# Collect heavy industrial libraries
datas_xgboost, binaries_xgboost, hidden_xgboost = collect_all('xgboost')
datas_scipy, binaries_scipy, hidden_scipy = collect_all('scipy')
datas_sklearn, binaries_sklearn, hidden_sklearn = collect_all('sklearn')

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=binaries_xgboost + binaries_scipy + binaries_sklearn,
    datas=datas_xgboost + datas_scipy + datas_sklearn,
    hiddenimports=[
        'uvicorn',
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'fastapi',
        'fastapi.middleware',
        'starlette',
        'pydantic',
        'pydantic_core',
        'polars',
        'pandas',
        'numpy',
        'routers.eagle_ai',
        'routers.data_router',
        'services.ai_engine',
        'services.db_sync_service',
        'core.state_manager',
        'core.config'
    ] + hidden_xgboost + hidden_scipy + hidden_sklearn,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['PyQt5', 'PyQt6', 'PySide2', 'PySide6', 'pyodbc', 'torch'],
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure, a.zipped_data)
exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='eagle-sidecar',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,          # مهم: نعطل UPX عشان ما يفسد xgboost
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
