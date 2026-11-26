#!/usr/bin/env python3
"""Tiny static server with correct MIME types for MediaPipe wasm/data files."""
import http.server
import mimetypes
import sys

mimetypes.add_type("application/wasm", ".wasm")
mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("application/octet-stream", ".data")
mimetypes.add_type("application/octet-stream", ".tflite")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=sys.argv[1], **kwargs)

    def log_message(self, fmt, *args):
        pass


port = int(sys.argv[2])
http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()