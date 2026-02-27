import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL;

if(!REDIS_URL) throw new Error("REDIS URL is not defined");

export const redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest : 3,
    retryStrategy(times){
        if(times > 3){
            console.error("[redis] connection failed after 3 retries");
            return null;
        }
        return Math.min(times * 200, 2000);
    },
    lazyConnect : true
})

redis.on("connect", ()=> console.log("[redis] connected"))
redis.on("error", (err)=> console.error("[redis] error",err))