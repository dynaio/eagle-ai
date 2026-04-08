# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_all

# Collect all native binaries, data files, and hidden imports for industrial libs
datas_xgboost, binaries_xgboost, hiddenimports_xgboost = collect_all('xgboost')
datas_scipy, binaries_scipy, hiddenimports_scipy = collect_all('scipy')
datas_sklearn, binaries_sklearn, hiddenimports_sklearn = collect_all('sklearn')

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=binaries_xgboost + binaries_scipy + binaries_sklearn,
    datas=datas_xgboost + datas_scipy + datas_sklearn,
    hiddenimports=[
        'routers.eagle_ai',
        'routers.model_adaptor',
        'routers.time_series_provider',
        'routers.db_integration',
        'routers.data_router',
        'services.db_sync_service',
        'services.ai_engine',
        'core.state_manager',
        'core.config',
        'fastapi',
        'uvicorn',
        'polars',
        'pandas',
        'pydantic',
        'numpy'
    ] + hiddenimports_xgboost + hiddenimports_scipy + hiddenimports_sklearn,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['PyQt5', 'PyQt6', 'PySide2', 'PySide6', 'pyodbc'],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='eagle-sidecar',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False, # Disable UPX for AI libs to prevent corruption
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
