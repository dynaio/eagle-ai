#!/usr/bin/env python3
import argparse
import uvicorn
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def main():
    parser = argparse.ArgumentParser(description='Eagle AI Backend Sidecar')
    parser.add_argument('--port', type=int, default=6789)
    parser.add_argument('--host', default='127.0.0.1')
    args = parser.parse_args()

    try:
        from main import app
        print(f" Eagle AI Backend starting on {args.host}:{args.port}")
        uvicorn.run(app, host=args.host, port=args.port, log_level="info", reload=False)
    except Exception as e:
        print(f"ERROR starting backend: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
