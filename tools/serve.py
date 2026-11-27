#!/usr/bin/env python3
"""Tiny static server with correct MIME types and gzip/cache headers.

Only binds 127.0.0.1: the app is reached over an SSH tunnel or Tailscale, and the
browser only grants camera access on localhost/HTTPS. Compressed bodies are cached
in memory (~1 MB here), so repeated loads of the single-file app are cheap.
"""
import gzip
import http.server
import io
import mimetypes
import os
import sys
import threading
import urllib.parse

mimetypes.add_type("application/wasm", ".wasm")
mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("application/octet-stream", ".data")
mimetypes.add_type("application/octet-stream", ".tflite")

# Text and model payloads compress well; audio/images are already compressed.
COMPRESSIBLE = {".html", ".js", ".mjs", ".css", ".json", ".svg", ".wasm", ".data", ".tflite"}
IMMUTABLE_PREFIXES = ("/vendor/", "/assets/", "/audio/")
_CACHE_MAX = 64 * 1024 * 1024
_cache = {}
_cache_lock = threading.Lock()


def cache_control_for(url_path):
    path = urllib.parse.unquote(urllib.parse.urlsplit(url_path).path)
    if path.startswith(IMMUTABLE_PREFIXES):
        return "public, max-age=31536000, immutable"
    # The single-file app and anything else must revalidate, so a deploy is visible.
    return "no-cache"


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=sys.argv[1], **kwargs)

    def log_message(self, fmt, *args):
        pass

    def send_head(self):
        path = self.translate_path(self.path)
        # `/` resolves to a directory; serve its index through the gzip path too.
        if os.path.isdir(path):
            index = os.path.join(path, "index.html")
            if os.path.isfile(index):
                path = index
        ext = os.path.splitext(path)[1].lower()
        accepts_gzip = "gzip" in self.headers.get("Accept-Encoding", "").lower()
        if os.path.isfile(path) and ext in COMPRESSIBLE and accepts_gzip:
            try:
                st = os.stat(path)
                key = (path, st.st_mtime_ns, st.st_size)
                with _cache_lock:
                    body = _cache.get(key)
                    if body is None:
                        with open(path, "rb") as fh:
                            body = gzip.compress(fh.read(), compresslevel=6, mtime=0)
                        if sum(len(v) for v in _cache.values()) + len(body) > _CACHE_MAX:
                            _cache.clear()
                        _cache[key] = body
                self.send_response(200)
                self.send_header("Content-Type", self.guess_type(path)[0] or "application/octet-stream")
                self.send_header("Content-Encoding", "gzip")
                self.send_header("Content-Length", str(len(body)))
                self.send_header("Last-Modified", self.date_time_string(st.st_mtime))
                self.send_header("Cache-Control", cache_control_for(self.path))
                self.send_header("Vary", "Accept-Encoding")
                self.end_headers()
                return io.BytesIO(body)
            except OSError:
                pass  # fall through to the plain handler (missing file, permission...)
        return super().send_head()

    def end_headers(self):
        # send_head's plain branches cannot add a header after handing back the file,
        # so add the cache header here unless the gzip branch already sent one.
        sent = any(b"Cache-Control" in chunk for chunk in getattr(self, "_headers_buffer", []))
        if not sent:
            self.send_header("Cache-Control", cache_control_for(self.path))
        super().end_headers()


port = int(sys.argv[2])
http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()