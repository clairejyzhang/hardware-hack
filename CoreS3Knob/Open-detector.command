#!/bin/bash
set -eu
cd -- "$(dirname -- "$0")"
exec python3 - <<'PY'
import functools
import http.server
import subprocess
import threading

handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=".")
with http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler) as server:
    url = f"http://127.0.0.1:{server.server_port}/"
    print("Keep this Terminal window open while testing. Press Control-C when finished.", flush=True)
    threading.Timer(0.2, lambda: subprocess.run(["open", "-a", "Google Chrome", url], check=False)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
PY
