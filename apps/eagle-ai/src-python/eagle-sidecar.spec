# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_all, collect_submodules

# 1. Collect everything for heavy libraries to avoid ModuleNotFoundError
datas_xgboost, binaries_xgboost, hidden_xgboost = collect_all('xgboost')
datas_polars, binaries_polars, hidden_polars = collect_all('polars')
datas_sklearn, binaries_sklearn, hidden_sklearn = collect_all('sklearn')
datas_scipy, binaries_scipy, hidden_scipy = collect_all('scipy')

# 2. Collect internal submodules recursively
hidden_routers = collect_submodules('routers')
hidden_services = collect_submodules('services')
hidden_core = collect_submodules('core')

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=binaries_xgboost + binaries_polars + binaries_sklearn + binaries_scipy,
    datas=datas_xgboost + datas_polars + datas_sklearn + datas_scipy,
    hiddenimports=[
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        'fastapi',
        'fastapi.middleware.cors',
        'starlette.middleware.cors',
        'pydantic',
        'pydantic_core',
        'pydantic_core._pydantic_core',
        'pandas._libs.tslibs.base',
        'pandas._libs.tslibs.np_datetime',
        'pandas._libs.tslibs.nattype',
        'pandas._libs.tslibs.timedeltas',
        'pyarrow',
    ] + hidden_xgboost + hidden_polars + hidden_sklearn + hidden_scipy + \
      hidden_routers + hidden_services + hidden_core,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['PyQt5', 'PyQt6', 'PySide2', 'PySide6', 'torch', 'notebook', 'matplotlib'],
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
    upx=False,          # CRITICAL: Disable UPX for Windows 7 and xgboost compatibility
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
