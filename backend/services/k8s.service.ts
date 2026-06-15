import * as k8s from "@kubernetes/client-node";
import { env } from "../config/env";
import { logger } from "../lib/logger";

const kc = new k8s.KubeConfig();

if (env.K8S_SKIP_TLS_VERIFY) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

if (process.env.KUBERNETES_SERVICE_HOST && process.env.KUBERNETES_SERVICE_PORT) {
  kc.loadFromCluster();
} else {
  kc.loadFromDefault();
}

if (env.K8S_SKIP_TLS_VERIFY) {
  const cluster = kc.getCurrentCluster();
  if (cluster) {
    kc.loadFromClusterAndUser(
      { ...cluster, skipTLSVerify: true },
      kc.getCurrentUser() ?? { name: "default" },
    );
  }
}

const coreApi = kc.makeApiClient(k8s.CoreV1Api);
const networkingApi = kc.makeApiClient(k8s.NetworkingV1Api);

const NAMESPACE = env.REPL_NAMESPACE;
const REPL_IMAGE = env.REPL_IMAGE;
const REPL_IMAGE_PULL_POLICY = env.REPL_IMAGE_PULL_POLICY;
const BASE_DOMAIN = env.REPL_BASE_DOMAIN;
const REPL_RUNTIME_SECRET = env.REPL_RUNTIME_SECRET;
const REPL_STOP_GRACE_SECONDS = 60;

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

const isNotFoundError = (error: unknown): boolean => {
  const e = error as {
    statusCode?: number;
    body?: { reason?: string };
    message?: string;
  };

  return (
    e?.statusCode === 404 ||
    e?.body?.reason === "NotFound" ||
    (typeof e?.message === "string" && e.message.includes("NotFound"))
  );
};

const bodyOf = <T>(response: T | { body: T }): T =>
  response && typeof response === "object" && "body" in response
    ? (response as { body: T }).body
    : (response as T);

const hasDeletionTimestamp = (
  resource: { metadata?: { deletionTimestamp?: string | Date } } | undefined,
): boolean =>
  Boolean(resource?.metadata?.deletionTimestamp);

const safeReplId = (replId: string) => replId.toLowerCase().replace(/[^a-z0-9-]/g, "-");

const isPodReady = (pod: k8s.V1Pod | undefined): boolean => {
  if (!pod?.status || pod.status.phase !== "Running") return false;

  return (
    pod.status.conditions?.some(
      (condition) => condition.type === "Ready" && condition.status === "True",
    ) ?? false
  );
};

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

export const getReplPodState = async (replId: string): Promise<{
  exists: boolean;
  ready: boolean;
  phase?: string;
  terminating: boolean;
}> => {
  try {
    const cleanReplId = safeReplId(replId);
    const response = await coreApi.readNamespacedPod({
      name: `repl-${cleanReplId}`,
      namespace: NAMESPACE,
    });
    const pod = bodyOf<k8s.V1Pod>(response);

    return {
      exists: true,
      ready: isPodReady(pod),
      phase: pod.status?.phase,
      terminating: hasDeletionTimestamp(pod),
    };
  } catch (error) {
    if (!isNotFoundError(error)) throw error;

    return {
      exists: false,
      ready: false,
      terminating: false,
    };
  }
};

export const provisionReplRuntime = async (replId: string, type: string, userId: string) => {
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
      // Give the agent time to flush a final workspace snapshot to R2 on SIGTERM
      // (stop / idle-evict / rolling delete) before the kubelet SIGKILLs it.
      terminationGracePeriodSeconds: 60,
      containers: [
        {
          name: "runner",
          image: REPL_IMAGE,
          imagePullPolicy: REPL_IMAGE_PULL_POLICY,
          env: [
            { name: "REPL_ID",       value: cleanReplId },
            { name: "REPL_TYPE",     value: normalizedType },
            { name: "USER_ID",       value: userId },
            { name: "S3_BUCKET",     value: env.S3_BUCKET ?? "" },
            { name: "REDIS_URL",     value: env.REDIS_URL },
            { name: "R2_ACCOUNT_ID", value: env.R2_ACCOUNT_ID ?? "" },
            { name: "JWT_SECRET",    value: env.JWT_SECRET },
            { name: "PREVIEW_URL",   value: previewUrl },
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
      },
    },
    spec: {
      ingressClassName: "nginx",
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

  await createOrAdoptReplPod(cleanReplId, podName, pod);

  try {
    await coreApi.createNamespacedService({ namespace: NAMESPACE, body: svc });
  } catch (e) {
    if (!isAlreadyExistsError(e)) throw e;
    logger.info(`[k8s] service already exists for repl ${cleanReplId}`);
  }

  try {
    await networkingApi.createNamespacedIngress({ namespace: NAMESPACE, body: ing });
  } catch (e) {
    if (!isAlreadyExistsError(e)) throw e;
    logger.info(`[k8s] ingress already exists for repl ${cleanReplId}`);
  }

  await waitForPodReady(cleanReplId);

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

const sleep = (ms: number): Promise<void> =>
  new Promise((r) => (setTimeout as unknown as (fn: () => void, ms: number) => void)(r, ms));

const waitForPodReady = async (cleanReplId: string, timeoutMs = 120_000): Promise<void> => {
  const podName = `repl-${cleanReplId}`;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await coreApi.readNamespacedPod({
        name: podName,
        namespace: NAMESPACE,
      });
      const pod = bodyOf<k8s.V1Pod>(response);

      if (isPodReady(pod)) return;

      if (hasDeletionTimestamp(pod)) {
        logger.info(`[k8s] waiting for pod ${podName} to finish terminating before readiness check`);
        await waitForPodGone(cleanReplId);
        continue;
      }

      const phase = pod.status?.phase;
      if (phase === "Failed" || phase === "Succeeded") {
        throw new Error(`Pod ${podName} exited during startup with phase ${phase}`);
      }
    } catch (error) {
      if (!isNotFoundError(error)) throw error;
    }

    await sleep(2_000);
  }

  throw new Error(`Timed out waiting for pod repl-${cleanReplId} to become ready`);
};

const waitForPodGone = async (cleanReplId: string, timeoutMs = (REPL_STOP_GRACE_SECONDS + 15) * 1_000): Promise<void> => {
  const podName = `repl-${cleanReplId}`;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      await coreApi.readNamespacedPod({
        name: podName,
        namespace: NAMESPACE,
      });
    } catch (error) {
      if (isNotFoundError(error)) return;
      throw error;
    }

    await sleep(2_000);
  }

  throw new Error(`Timed out waiting for pod repl-${cleanReplId} to terminate`);
};

export const replPodExists = async (replId: string): Promise<boolean> => {
  return (await getReplPodState(replId)).exists;
};

const deletePodIfPresent = async (
  podName: string,
  gracePeriodSeconds = REPL_STOP_GRACE_SECONDS,
): Promise<void> => {
  await coreApi
    .deleteNamespacedPod({
      name: podName,
      namespace: NAMESPACE,
      gracePeriodSeconds,
      propagationPolicy: "Foreground",
    })
    .catch((error: unknown) => {
      if (!isNotFoundError(error)) throw error;
    });
};

const createOrAdoptReplPod = async (
  cleanReplId: string,
  podName: string,
  pod: k8s.V1Pod,
): Promise<void> => {
  const deadline = Date.now() + 60_000;

  while (Date.now() < deadline) {
    try {
      await coreApi.createNamespacedPod({ namespace: NAMESPACE, body: pod });
      return;
    } catch (error) {
      if (!isAlreadyExistsError(error)) throw error;
    }

    const state = await getReplPodState(cleanReplId);

    if (state.terminating) {
      logger.info(`[k8s] pod ${podName} is terminating; waiting before recreating`);
      await waitForPodGone(cleanReplId);
      continue;
    }

    if (state.phase === "Failed" || state.phase === "Succeeded") {
      logger.warn(`[k8s] pod ${podName} is ${state.phase}; deleting stale pod before recreate`);
      await deletePodIfPresent(podName);
      await waitForPodGone(cleanReplId);
      continue;
    }

    logger.info(`[k8s] pod ${podName} already exists; adopting existing startup`);
    return;
  }

  throw new Error(`Timed out creating pod ${podName} because the previous pod did not clear`);
};

export const deleteReplPod = async (replId: string) => {
  const cleanReplId = safeReplId(replId);
  const podName = `repl-${cleanReplId}`;
  const serviceName = `repl-${cleanReplId}-svc`;
  const ingressName = `repl-${cleanReplId}-ing`;

  await deletePodIfPresent(podName);
  await waitForPodGone(cleanReplId);

  await networkingApi
    .deleteNamespacedIngress({ name: ingressName, namespace: NAMESPACE })
    .catch((error: unknown) => {
      if (!isNotFoundError(error)) throw error;
    });

  await coreApi
    .deleteNamespacedService({ name: serviceName, namespace: NAMESPACE })
    .catch((error: unknown) => {
      if (!isNotFoundError(error)) throw error;
    });
};
