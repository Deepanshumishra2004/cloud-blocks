import { WebSocketServer } from "ws";
import  { spawn, type ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import { createClient } from "redis";
import { WS_PORT, REPL_ID, S3_BUCKET, REDIS_URL, AWS_REGION, WORKSPACE } from "./config";
import { GetObjectAclCommand, GetObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";

const S3 = new S3Client({ region : AWS_REGION });

const uploadtoS3= async(filePath : string, content : string)=>{

};

const restoreFromS3 = async()=>{
    const list = await S3.send(new ListObjectsV2Command({
        Bucket : S3_BUCKET,
        Prefix : `repls/${REPL_ID}/`
    }))

    for(const obj of list.Contents ?? []){
        const res = await S3.send(new GetObjectCommand({
            Bucket : S3_BUCKET,
            Key : obj.Key!
        }))

        const relativePath = obj.Key?.replace(`repls/${REPL_ID}/`,"");
        const fullPath = path.join(WORKSPACE, relativePath!);

        fs.mkdirSync(path.dirname(fullPath), {
            recursive : true
        })

        fs.writeFileSync(fullPath, await res.Body!.transformToString(), "utf-8");
    }
}


const redis = createClient({ url : process.env.REDIS_URL });
await redis.connect();

setInterval(async()=>{
    await redis.set(`repl:active:${REPL_ID}`, Date.now(), {EX : 300})
},30_000);

setInterval(async() => {
    try {
        const walk = (dir : string): string[]=>
            fs.readdirSync(dir, { withFileTypes : true }).flatMap((f)=>
                f.isDirectory()
                ? walk(path.join(dir, f.name))
                : [path.join(dir, f.name)]
            )

        for(const fullPath of walk(WORKSPACE)){
            const rel = path.relative(WORKSPACE, fullPath);
            const content = fs.readFileSync(fullPath, "utf-8");

            await uploadtoS3(rel, content);
            await redis.del(`repl:wal:${REPL_ID}:${rel}`)
        }
    } catch (error) {
        console.error("[flush]", error);
    }
}, 30_000);


await restoreFromS3().catch(()=> console.log("[agent] fresh start — no snapshot"))

const getTree = (dirPath : string) : any[] =>
    fs.readdirSync(dirPath, { withFileTypes : true }).map((f)=>{
        const fullPath     = path.join(dirPath, f.name);
        const relativePath = path.relative(WORKSPACE, fullPath);
        if(f.isDirectory()){
            return {
                name : f.name,
                path : relativePath,
                isDir : true,
                children : getTree(fullPath)
            }
        }
        return {
            name : f.name,
            path : relativePath,
            isDir : false
        }
    })


const wss = new WebSocketServer({ port : WS_PORT })

const VerifyUser=(token : string) : boolean =>{

    try {
        
        return true;
    } catch (error) {
        
        return false;
    }
}


wss.on("connection",(ws, req)=>{
    console.log("connected to ws server");

    const url = new URL(req.url!, `ws://localhost`);
    const token = url.searchParams.get("token");

    if(!token || !VerifyUser(token)){
        ws.close(4001, "Unauthorized");
        return;
    }

    console.log("[agent] client connected");

    let shell : ChildProcess | null = spawn("bash",[],{
        cwd : WORKSPACE,
        env : { ...process.env, TERM : "xterm-256color" }
    })

    shell.stdout?.on("data",(d)=>{
        ws.send(JSON.stringify({
            type : "terminal:output",
            data : d.toString()
        }))
    })

    shell.stderr?.on("data",(d)=>{
        ws.send(JSON.stringify({
            type : "terminal:input",
            data : d.toString()
        }))
    })

    shell.on("close",(code)=>{
        ws.send(JSON.stringify({
            type : "terminal:exit",
            code
        }))
        ws.close()
    })

    ws.on("message",async(data)=>{
        try {
            const msg = JSON.parse(data.toString())
    
            switch (msg.type) {
    
                // terminal input
                case "terminal:input":
                    if(!shell || !msg.data) break;
                    shell.stdin?.write(msg.data);
                    break;
    
                // read file -> send to client
                case "file:read":
                    const fullPath = path.join(WORKSPACE, msg.path);
                    const content = fs.existsSync(fullPath)
                        ? fs.readFileSync(fullPath, "utf-8")
                        : "";
    
                    ws.send(JSON.stringify({
                        type : "file:content",
                        path : msg.path,
                        content
                    }))
                    break;

                // apply mono diff batch
                case "file:patch":
                    const filePath = fs.readFileSync(WORKSPACE, msg.path);

                    let patchContent = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : "";

                    for(const change of msg.changes){
                        patchContent = patchContent.slice(0, change.rangeOffset) + change.text + patchContent.slice(change.rangeOffset + change.rangeLength);
                    }

                    fs.writeFileSync(filePath, patchContent, "utf-8");

                    await redis.rPush(`repl:wal:${REPL_ID}:${msg.path}`, JSON.stringify({
                        changes : msg.changes,
                        ts : Date.now()
                    }))

                    uploadtoS3(msg.path, patchContent).catch((e)=> console.error("[S3]",e));
                    break;
                    
                //list /full workspace files
                case "file:list":
                    ws.send(JSON.stringify({
                        type : "file:list",
                        tree : getTree(WORKSPACE)
                    }))
                    break;

                case "file:create":
                    const fullPath2 = path.join(WORKSPACE, msg.path);
                    fs.mkdirSync(path.dirname(fullPath2), {recursive : true});

                    fs.writeFileSync(fullPath2, "", "utf-8");
                    ws.send(JSON.stringify({
                        type : "file:list",
                        tree : getTree(WORKSPACE)
                    }))
                    break;

                case "file:create":
                    const fullPath3 = path.join(WORKSPACE, msg.path);
                    if(fs.existsSync(fullPath3)) fs.rmSync(fullPath3, { recursive : true });

                    fs.writeFileSync(fullPath3, "", "utf-8");
                    ws.send(JSON.stringify({
                        type : "file:list",
                        tree : getTree(WORKSPACE)
                    }))
                    break;

                default:
              console.warn("[agent] unknown message type:", msg.type);

            }
        } catch (error) {
            console.error("[agent] message error:", error);
        }
    })

    ws.on("close",()=>{
        shell?.kill();
        shell = null;
        console.log("[agent] client disconnected")
    })
})