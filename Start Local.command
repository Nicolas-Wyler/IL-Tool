#!/bin/zsh
cd -- "${0:A:h}" || exit 1
if /usr/bin/curl --silent --fail --max-time 2 http://127.0.0.1:8769/__dev/version >/dev/null; then
  print 'IL Tool is already running at http://127.0.0.1:8769/'
  exit 0
fi
exec /usr/bin/env python3 serve_local.py --port 8769
