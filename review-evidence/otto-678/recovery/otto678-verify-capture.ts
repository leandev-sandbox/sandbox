import {readFileSync,writeFileSync} from 'node:fs';
const url='http://localhost:8798/development/leandev-sandbox/otto-environment-fixture/issues/1465?stage=pr_review';
const tab=(await fetch('http://localhost:9298/json/list').then(r=>r.json())).find((t:any)=>t.type==='page'&&t.url===url);
const ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);let id=0;const pending=new Map<number,any>();
ws.onmessage=e=>{const r=JSON.parse(e.data as string);const p=pending.get(r.id);if(!p)return;pending.delete(r.id);clearTimeout(p.timer);r.error?p.reject(r.error):p.resolve(r.result)};
const send=(method:string,params={})=>new Promise<any>((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject,timer:setTimeout(()=>reject(Error('Local CDP timeout '+method)),30000)});ws.send(JSON.stringify({id:key,method,params}))});
const evaluate=async(expression:string)=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result?.value};
const until=async(name:string,test:()=>Promise<any>,ms=90000)=>{const end=Date.now()+ms;while(Date.now()<end){const value=await test();if(value)return value;await Bun.sleep(500)}throw Error('Timed out: '+name)};
const checks:any[]=[];const check=(name:string,pass:boolean,detail?:any)=>{checks.push({name,pass,detail});if(!pass)throw Error(name);console.log('PASS',name)};
const result:any={smoke:'f6b72d7d',case:'final-source-reverify',startedAt:new Date().toISOString(),checks,rounds:[]};
try{
 const before=JSON.parse(readFileSync('/tmp/otto678-evidence/final-source-reverify-before.json','utf8'));
 const after=JSON.parse(readFileSync('/tmp/otto678-evidence/final-source-reverify-after.json','utf8'));
 const prior=JSON.parse(readFileSync('/tmp/otto678-evidence/native-final-source.json','utf8'));
 const ui=await evaluate("({origin:performance.timeOrigin,head:document.querySelector('#pr-review').dataset.head,phase:document.querySelector('#pr-review').dataset.phase,revision:document.querySelector('#pr-review').dataset.revision,menu:JSON.parse(document.querySelector('#review-menu form').dataset.command),commands:window.verificationCommands})");
 result.source='945af30';result.before=before;result.after=after;result.ui=ui;
 const command=ui.commands[0];const receipt=after.commands.find((c:any)=>c.command_id===command.commandId);
 check('final source owner page Re-verify applied',receipt?.outcome==='applied',receipt);
 check('verification completed at unchanged head',after.phase==='in_review'&&after.pr_head===before.pr_head);
 check('brief retained byte for byte',after.briefSha256===before.briefSha256);
 check('fresh verification request',after.verification.request!==before.verification.request&&after.verification.request===command.commandId);
 check('menu binding advanced without reload',ui.menu.version===ui.revision&&Number(ui.menu.version)>Number(command.version));
 check('document retained across Re-verify',ui.origin===prior.initial.origin);
 for(const width of [1920,1440,1280,390]){await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});await Bun.sleep(700);check(width+'px no page overflow',await evaluate('document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight'));const shot=await send('Page.captureScreenshot',{format:'png'});writeFileSync('/tmp/otto678-evidence/review-panel-immediate-'+width+'.png',Buffer.from(shot.data,'base64'))}
 result.browser=await send('Browser.getVersion');result.passed=true;
}finally{result.finishedAt=new Date().toISOString();writeFileSync('/tmp/otto678-evidence/native-final-source.json',JSON.stringify(result,null,2));ws.close()}
