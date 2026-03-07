import * as k8s from "@kubernetes/client-node";

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const coreApi = kc.makeApiClient(k8s.CoreV1Api);

export const createReplPod = async (replId: string) => {
    const pod: k8s.V1Pod = {
        metadata: { name: `repl-${replId}`, namespace: "repls", labels: { replId } },
        spec: {
            runtimeClassName: "gvisor",
            nodeSelector: { pool: "repl_workers" },
            containers: [{
                name: "runner",
                image: "deepanshumishra2004/execution_layer:latest",
                env: [
                    { name : "REPL_ID", value : replId },
                    { name : "S3_BUCKET", value : process.env.S3_BUCKET },
                    { name : "REDIS_URL", value : process.env.REDIS_URL }
                ],
                resources: {
                    limits: { cpu: "500m", memory: "512Mi" },
                    requests: { cpu: "100m", memory: "128Mi" }
                },
                ports: [
                    { containerPort: 8080 },
                    { containerPort: 3000 }
                ]
            }],

        }
    }

    const svc: k8s.V1Service = {
        metadata: { name: `repl-${replId}-svc`, namespace: "repls" },
        spec: {
            selector: { replId },
            ports: [
                { name: "agent", port: 8080 },
                { name: "preview", port: 3000 }
            ]
        }
    }

    await coreApi.createNamespacedPod({ namespace : "repls", body : pod });
    await coreApi.createNamespacedService({ namespace: "repls", body: svc });

    return `repl-${replId}.xyz.com`;
}

export const deleteReplPod = async (replId: string) => {

    await coreApi.deleteNamespacedPod({ name: `repl-${replId}`, namespace: "repls" }).catch(() => { })
    await coreApi.deleteNamespacedService({ name: `repl-${replId}-svc`, namespace: "repls" }).catch(() => { })

}