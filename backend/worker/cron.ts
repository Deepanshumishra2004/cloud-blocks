import cron from "node-cron";
import { redis } from "../lib/redis";
import { stopRepl } from "../services/repl.service";

const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

cron.schedule("* * * * *",async()=>{

    const runningRepls = await redis.smembers("repls:running");

    for(const replId of runningRepls){
        const lastActive = await redis.get(`repl:active:${replId}`);

        if(!lastActive || Date.now() - Number(lastActive) > IDLE_TIMEOUT_MS){
            console.log(`[cron] idle shutdown: ${replId}`);
            await stopRepl(replId).catch((e)=> console.error("[cron]",e));
        }
    }
})

console.log("[cron] idle detection running");