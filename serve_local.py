#!/usr/bin/env python3
"""Serve the local PWA with uncached files and a live-reload revision endpoint."""
import argparse
import hashlib
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import threading
import time
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent / 'dist'


class Revision:
    def __init__(self):
        self.lock = threading.Lock()
        self.signature = self.scan()
        self.current = self.signature
        self.changed_at = time.monotonic()

    def scan(self):
        entries = []
        for path in sorted(ROOT.rglob('*')):
            if path.is_file():
                stat = path.stat()
                entries.append((str(path.relative_to(ROOT)), stat.st_mtime_ns, stat.st_size))
        return hashlib.sha256(repr(entries).encode()).hexdigest()

    def get(self):
        with self.lock:
            try:
                signature = self.scan()
            except FileNotFoundError:
                return self.current
            if signature != self.signature:
                self.signature = signature
                self.changed_at = time.monotonic()
            elif time.monotonic() - self.changed_at >= .3:
                self.current = signature
            return self.current


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, max-age=0')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()

    def do_GET(self):
        if urlsplit(self.path).path == '/__dev/version':
            body = json.dumps({'revision': self.server.revision.get()}).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            super().do_GET()

    def log_message(self, format, *args):
        if urlsplit(self.path).path != '/__dev/version':
            super().log_message(format, *args)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8769)
    args = parser.parse_args()
    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    server.revision = Revision()
    print(f'Plane wave: http://127.0.0.1:{args.port}/', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
