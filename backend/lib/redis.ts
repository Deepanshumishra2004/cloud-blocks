import Redis from "ioredis";
import { env } from "../config/env";
import { logger } from "./logger";

export const redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest : 3,
    retryStrategy(times){
        if(times > 3){
            logger.error("redis connection failed after 3 retries");
            return null;
        }
        return Math.min(times * 200, 2000);
    },
    lazyConnect : true
})

redis.on("connect", () => logger.info("redis connected"));
redis.on("error", (err) => logger.error({ err }, "redis error"));