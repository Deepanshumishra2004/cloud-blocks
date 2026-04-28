# Kubernetes setup

## One entry point
Everything needed to bootstrap the local cluster lives in `k8s/`.

Run from repo root:
```powershell
powershell -ExecutionPolicy Bypass -File .\k8s\bootstrap.ps1
```

This does three things:
- installs or upgrades `ingress-nginx` through Helm
- applies the platform manifests in `k8s/`
- waits for the ingress controller, backend, frontend, and redis to be ready

Script defaults:
- pinned ingress-nginx chart version
- explicit Helm values from `ingress-nginx-values.yaml`
- validation that required files and commands exist
- `helm upgrade --install --wait` for repeatable reruns

## Files
- `bootstrap.ps1`
- `ingress-nginx-values.yaml`
- `namespace.yaml`
- `rbac.yaml`
- `backend-secret.yaml`
- `repl-runtime-secret.yaml`
- `backend-deployment.yaml`
- `backend-service.yaml`
- `frontend-deployment.yaml`
- `frontend-service.yaml`
- `redis.yaml`
- `ingress.yaml`

## Dynamic repl runtime
When a user starts a repl, backend provisions:
- pod: `repl-<id>`
- service: `repl-<id>-svc`
- ingress: `repl-<id>-ing`

Routing contract for each repl host:
- `/` -> service port `3002` (preview)
- `/ws` -> service port `8080` (websocket/agent)

## Verify
```powershell
kubectl get pods -n ingress-nginx
kubectl get all -n repls
kubectl get ingress -n repls
```

## Notes
- `bootstrap.ps1` is the entry point for local cluster bootstrap.
- `ingress-nginx-values.yaml` is the reviewable source of ingress controller configuration.
- For production, keep chart version pinning and values in source control, then promote changes through code review.

## URLs
- frontend: `http://app.127.0.0.1.nip.io`
- backend: `http://api.127.0.0.1.nip.io`
- repl preview: `http://repl-<id>.127.0.0.1.nip.io`

## Production runtime URLs
- Set `REPL_PUBLIC_PROTOCOL=https` and `REPL_PUBLIC_WS_PROTOCOL=wss` when ingress/TLS is enabled.
- Keep them as `http` and `ws` in local clusters without TLS.
- Preview is expected only for `REACT` and `NEXT` repl types; other repl types expose terminal/output but do not start a preview server.
