import { redis } from "../lib/redis"
import { prisma } from "../lib/prisma";
import { createReplPod, deleteReplPod } from "./k8s.service";

export const startRepl = async (replId: string, userId: string) => {

    const cached = await redis.get(`repl:pod:${replId}`);
    if (cached) return cached;

    const repl = await prisma?.repl.findUnique({
        where: {
            id: replId
        }
    })
    if (!repl || repl.userId !== userId) throw new Error("Repl not found");

    const podUrl = await createReplPod(replId, repl.type);

    await prisma?.repl.update({
        where: { id: replId },
        data: {
            status: "RUNNING"
        }
    })

    await redis.set(`repl:pod:${replId}`, podUrl, "EX", 3600);
    await redis.sadd("repls:running",replId);

    return podUrl;
}

export const stopRepl = async (replId: string) => {
    await deleteReplPod(replId);

    await prisma?.repl.update({
        where : {
            id : replId
        },
        data : {
            status : "STOPPED"
        }
    })

    await redis.del(`repl:pod:${replId}`);
    await redis.srem("repls:running",replId);
    await redis.del(`repl:active:${replId}`);
}
