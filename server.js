const express=require("express"),webpush=require("web-push"),fs=require("fs"),path=require("path");
const app=express();app.use(express.json({limit:"100kb"}));
app.use((q,s,n)=>{s.set("Access-Control-Allow-Origin","*");s.set("Access-Control-Allow-Headers","Content-Type");s.set("Access-Control-Allow-Methods","GET,POST,OPTIONS");q.method==="OPTIONS"?s.sendStatus(204):n()});
app.use(express.static(path.join(__dirname,"public")));

const SYS="Ту J.A.R.V.I.S ҳастӣ, ёвари ҳушманди шахсӣ дар услуби Тони Старк. Ба корбар бо забони тоҷикӣ ҷавоб деҳ (агар ӯ забони дигар хоста бошад, ҳамон забон). Ӯро «Ҷаноб» хон. Ҷавобҳо кӯтоҳ, дақиқ, бо ҳазли нозук ва боадабона бошанд, зеро онҳо бо овоз хонда мешаванд. Барои рӯйхат аз аломатҳои махсус истифода набар.";
const keys=n=>(process.env[n]||"").split(",").map(s=>s.trim()).filter(Boolean);
const oai=(url,model)=>async(key,msgs)=>{const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+key},body:JSON.stringify({model,messages:[{role:"system",content:SYS},...msgs]})});if(!r.ok)throw new Error(r.status);return (await r.json()).choices[0].message.content};
const gem=async(key,msgs)=>{const m=process.env.GEMINI_MODEL||"gemini-2.0-flash";const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({systemInstruction:{parts:[{text:SYS}]},contents:msgs.map(x=>({role:x.role==="user"?"user":"model",parts:[{text:x.content}]}))})});if(!r.ok)throw new Error(r.status);return (await r.json()).candidates[0].content.parts[0].text};
const pool=[];
for(const k of keys("GEMINI_KEYS"))pool.push(["gemini",k,gem]);
for(const k of keys("GROQ_KEYS"))pool.push(["groq",k,oai("https://api.groq.com/openai/v1/chat/completions",process.env.GROQ_MODEL||"llama-3.3-70b-versatile")]);
for(const k of keys("OPENROUTER_KEYS"))pool.push(["openrouter",k,oai("https://openrouter.ai/api/v1/chat/completions",process.env.OPENROUTER_MODEL||"meta-llama/llama-3.3-70b-instruct:free")]);
let start=0;
app.post("/api/chat",async(q,s)=>{
  const msgs=(q.body.messages||[]).slice(-12).map(m=>({role:m.role==="user"?"user":"assistant",content:String(m.content).slice(0,2000)}));
  if(!msgs.length)return s.status(400).json({error:"Паём холист"});
  if(!pool.length)return s.status(500).json({error:"Калидҳои API танзим нашудаанд"});
  for(let n=0;n<pool.length;n++){
    const [name,key,fn]=pool[(start+n)%pool.length];
    try{const reply=await fn(key,msgs);start=(start+n+1)%pool.length;return s.json({reply,via:name})}
    catch(e){console.log("fail",name,e.message)}
  }
  s.status(503).json({error:"Ҳамаи провайдерҳо банд ҳастанд"});
});

// Огоҳиномаҳо (Web Push)
let pub=process.env.VAPID_PUBLIC,priv=process.env.VAPID_PRIVATE;
if(!pub||!priv){const k=webpush.generateVAPIDKeys();pub=k.publicKey;priv=k.privateKey;console.log("VAPID_PUBLIC="+pub);console.log("VAPID_PRIVATE="+priv);console.log("^ Инҳоро дар Environment-и Render захира кун, вагарна пас аз рестарт нав мешаванд.")}
webpush.setVapidDetails(process.env.VAPID_SUBJECT||"mailto:admin@example.com",pub,priv);
const FILE=path.join(__dirname,"subs.json");let subs=[];try{subs=JSON.parse(fs.readFileSync(FILE))}catch(e){}
const persist=()=>{try{fs.writeFileSync(FILE,JSON.stringify(subs))}catch(e){}};
app.get("/api/vapid",(q,s)=>s.json({key:pub}));
app.post("/api/subscribe",(q,s)=>{if(!q.body.endpoint)return s.sendStatus(400);if(!subs.some(x=>x.endpoint===q.body.endpoint)){subs.push(q.body);persist()}s.sendStatus(201)});
app.get("/api/send-reminders",async(q,s)=>{
  if(!process.env.CRON_SECRET||q.query.secret!==process.env.CRON_SECRET)return s.sendStatus(401);
  const text=JSON.stringify({title:"J.A.R.V.I.S",body:"Ҷаноб, имрӯз ҳанӯз бо ман сӯҳбат накардед."});let sent=0;
  subs=(await Promise.all(subs.map(async x=>{try{await webpush.sendNotification(x,text);sent++;return x}catch(e){return [404,410].includes(e.statusCode)?null:x}}))).filter(Boolean);
  persist();s.json({sent});
});
app.get("/ping",(q,s)=>s.send("ok"));
app.listen(process.env.PORT||3000,()=>console.log("JARVIS online"));
