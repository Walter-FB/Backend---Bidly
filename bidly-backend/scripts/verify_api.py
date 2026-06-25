import json
import sys
import urllib.request
from collections import Counter

url = sys.argv[1] if len(sys.argv) > 1 else "https://backend-bidly.up.railway.app/api/subastas?publico=false"
with urllib.request.urlopen(url, timeout=25) as r:
    data = json.load(r)
counts = Counter(x.get("estadoSubasta") for x in data)
print("counts", dict(counts))
pend = [(x["identificador"], x.get("revisionEstado"), x.get("fase")) for x in data if x.get("estadoSubasta") == "pendiente"]
print("pendientes sample", pend[:8])
