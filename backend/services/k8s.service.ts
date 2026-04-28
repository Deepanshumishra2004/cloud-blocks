import * as k8s from "@kubernetes/client-node";
import { env } from "../config/env";
import { logger } from "../lib/logger";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const kc = new k8s.KubeConfig();

if (process.env.KUBERNETES_SERVICE_HOST && process.env.KUBERNETES_SERVICE_PORT) {
  kc.loadFromCluster();
} else {
  kc.loadFromDefault();
}

const coreApi = kc.makeApiClient(k8s.CoreV1Api);
const networkingApi = kc.makeApiClient(k8s.NetworkingV1Api);

const NAMESPACE = env.REPL_NAMESPACE;
const REPL_IMAGE = env.REPL_IMAGE;
const BASE_DOMAIN = env.REPL_BASE_DOMAIN;
const REPL_RUNTIME_SECRET = env.REPL_RUNTIME_SECRET;

const inferPublicProtocol = (): string => {
  if (env.REPL_PUBLIC_PROTOCOL) return env.REPL_PUBLIC_PROTOCOL;
  try {
    return new URL(env.APP_URL).protocol.replace(":", "");
  } catch {
    return "http";
  }
};

const REPL_PUBLIC_PROTOCOL = inferPublicProtocol();
const REPL_PUBLIC_WS_PROTOCOL =
  env.REPL_PUBLIC_WS_PROTOCOL ??
  (REPL_PUBLIC_PROTOCOL === "https" ? "wss" : "ws");

const isAlreadyExistsError = (error: unknown): boolean => {
  const e = error as {
    statusCode?: number;
    body?: { reason?: string; message?: string };
    message?: string;
  };

  return (
    e?.statusCode === 409 ||
    e?.body?.reason === "AlreadyExists" ||
    (typeof e?.message === "string" && e.message.includes("AlreadyExists"))
  );
};

const safeReplId = (replId: string) => replId.toLowerCase().replace(/[^a-z0-9-]/g, "-");

export const getReplRuntimeUrls = (replId: string) => {
  const cleanReplId = safeReplId(replId);
  const host = `repl-${cleanReplId}.${BASE_DOMAIN}`;

  return {
    replId: cleanReplId,
    host,
    previewUrl: `${REPL_PUBLIC_PROTOCOL}://${host}/`,
    wsUrl: `${REPL_PUBLIC_WS_PROTOCOL}://${host}/ws`,
  };
};

export const provisionReplRuntime = async (replId: string, type: string) => {
  const cleanReplId = safeReplId(replId);
  const podName = `repl-${cleanReplId}`;
  const serviceName = `repl-${cleanReplId}-svc`;
  const ingressName = `repl-${cleanReplId}-ing`;
  const { host, previewUrl, wsUrl } = getReplRuntimeUrls(cleanReplId);
  const normalizedType = type.toLowerCase();

  const pod: k8s.V1Pod = {
    metadata: {
      name: podName,
      namespace: NAMESPACE,
      labels: {
        app: "repl-runtime",
        replId: cleanReplId,
      },
    },
    spec: {
      restartPolicy: "Never",
      containers: [
        {
          name: "runner",
          image: REPL_IMAGE,
          imagePullPolicy: "Always",
          env: [
            { name: "REPL_ID",     value: cleanReplId },
            { name: "REPL_TYPE",   value: normalizedType },
            { name: "S3_BUCKET",   value: env.S3_BUCKET ?? "" },
            { name: "REDIS_URL",   value: env.REDIS_URL },
            { name: "AWS_REGION",  value: env.AWS_REGION },
            { name: "JWT_SECRET",  value: env.JWT_SECRET },
          ],
          envFrom: [{ secretRef: { name: REPL_RUNTIME_SECRET } }],
          ports: [
            { name: "ws", containerPort: 8080 },
            { name: "preview", containerPort: 3002 },
          ],
          resources: {
            requests: {
              cpu: "100m",
              memory: "128Mi",
            },
            limits: {
              cpu: "500m",
              memory: "512Mi",
            },
          },
          readinessProbe: {
            tcpSocket: {
              port: 8080,
            },
            initialDelaySeconds: 5,
            periodSeconds: 5,
          },
        },
      ],
    },
  };

  const svc: k8s.V1Service = {
    metadata: {
      name: serviceName,
      namespace: NAMESPACE,
      labels: {
        app: "repl-runtime",
        replId: cleanReplId,
      },
    },
    spec: {
      selector: {
        replId: cleanReplId,
      },
      ports: [
        {
          name: "preview",
          port: 3002,
          targetPort: 3002,
        },
        {
          name: "ws",
          port: 8080,
          targetPort: 8080,
        },
      ],
      type: "ClusterIP",
    },
  };

  const ing: k8s.V1Ingress = {
    metadata: {
      name: ingressName,
      namespace: NAMESPACE,
      annotations: {
        "nginx.ingress.kubernetes.io/proxy-read-timeout": "3600",
        "nginx.ingress.kubernetes.io/proxy-send-timeout": "3600",
        "nginx.ingress.kubernetes.io/proxy-http-version": "1.1",
        "cert-manager.io/cluster-issuer": "selfsigned-issuer",
      },
    },
    spec: {
      ingressClassName: "nginx",
      tls: [{ hosts: [host], secretName: `repl-${cleanReplId}-tls` }],
      rules: [
        {
          host,
          http: {
            paths: [
              {
                path: "/ws",
                pathType: "Prefix",
                backend: {
                  service: {
                    name: serviceName,
                    port: {
                      number: 8080,
                    },
                  },
                },
              },
              {
                path: "/",
                pathType: "Prefix",
                backend: {
                  service: {
                    name: serviceName,
                    port: {
                      number: 3002,
                    },
                  },
                },
              },
            ],
          },
        },
      ],
    },
  };

  try {
    await coreApi.createNamespacedPod({
      namespace: NAMESPACE,
      body: pod,
    });
  } catch (e) {
    if (!isAlreadyExistsError(e)) throw e;
    logger.info(`[k8s] pod already exists for repl ${cleanReplId}`);
  }

  try {
    await coreApi.createNamespacedService({
      namespace: NAMESPACE,
      body: svc,
    });
  } catch (e) {
    if (!isAlreadyExistsError(e)) throw e;
    logger.info(`[k8s] service already exists for repl ${cleanReplId}`);
  }

  try {
    await networkingApi.createNamespacedIngress({
      namespace: NAMESPACE,
      body: ing,
    });
  } catch (e) {
    if (!isAlreadyExistsError(e)) throw e;
    logger.info(`[k8s] ingress already exists for repl ${cleanReplId}`);
  }

  return {
    replId: cleanReplId,
    host,
    previewUrl,
    wsUrl,
    serviceName,
    podName,
    ingressName,
  };
};

export const createReplPod = provisionReplRuntime;

export const deleteReplPod = async (replId: string) => {
    const cleanReplId = safeReplId(replId);
    const podName = `repl-${cleanReplId}`;
    const serviceName = `repl-${cleanReplId}-svc`;
    const ingressName = `repl-${cleanReplId}-ing`;
  
    await networkingApi
      .deleteNamespacedIngress({ name: ingressName, namespace: NAMESPACE })
      .catch(() => {});
  
    await coreApi
      .deleteNamespacedService({ name: serviceName, namespace: NAMESPACE })
      .catch(() => {});
  
    await coreApi
      .deleteNamespacedPod({ name: podName, namespace: NAMESPACE })
      .catch(() => {});
  };
