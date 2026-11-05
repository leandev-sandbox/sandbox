import {writeFileSync} from 'node:fs';
const url='http://localhost:8798/development/leandev-sandbox/otto-environment-fixture/issues/1465?stage=pr_review';
const tab=await fetch('http://localhost:9298/json/new?'+encodeURIComponent(url),{method:'PUT'}).then(r=>r.json());
const ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);let id=0;const pending=new Map<number,any>();
ws.onmessage=e=>{const r=JSON.parse(e.data as string);const p=pending.get(r.id);if(!p)return;pending.delete(r.id);clearTimeout(p.timer);r.error?p.reject(r.error):p.resolve(r.result)};
const send=(method:string,params={})=>new Promise<any>((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject,timer:setTimeout(()=>reject(Error('Local CDP timeout '+method)),30000)});ws.send(JSON.stringify({id:key,method,params}))});
const evaluate=async(expression:string)=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result?.value};
const until=async(name:string,test:()=>Promise<any>,ms=90000)=>{const end=Date.now()+ms;while(Date.now()<end){const value=await test();if(value)return value;await Bun.sleep(500)}throw Error('Timed out: '+name)};
const checks:any[]=[];const check=(name:string,pass:boolean,detail?:any)=>{checks.push({name,pass,detail});if(!pass)throw Error(name);console.log('PASS',name)};
const result:any={smoke:'f6b72d7d',case:'final-source-reverify',startedAt:new Date().toISOString(),checks,rounds:[]};
try{
 await until('new source page',()=>evaluate("!!document.querySelector('#pr-review')"));
 const initial=await evaluate("({origin:performance.timeOrigin,head:document.querySelector('#pr-review').dataset.head})");result.initial=initial;
 await evaluate("window.verificationCommands=[];const prior=window.fetch;window.fetch=async(input,init)=>{if(String(input).endsWith('/commands')&&init?.method==='POST')window.verificationCommands.push(JSON.parse(new URLSearchParams(init.body).get('command')));return prior(input,init)}");
 for(let round=0;round<2;round++){
  await until('current Re-verify binding',()=>evaluate("(()=>{const root=document.querySelector('#pr-review'),form=document.querySelector('#review-menu form');return root.dataset.phase==='in_review'&&form&&JSON.parse(form.dataset.command).version===root.dataset.revision&&!form.querySelector('button').disabled})()"));
  const baseline=await evaluate("({revision:document.querySelector('#pr-review').dataset.revision,menu:document.querySelector('#review-menu').open})");
  await evaluate("document.querySelector('[data-review-tab=findings]').click();document.querySelector('#review-menu').open=true;document.querySelector('#review-menu form button').click()");
  const command=await until('UI sent Re-verify',()=>evaluate('window.verificationCommands['+round+']'));
  const receipt=await until('Re-verify receipt',async()=>{const r=await evaluate("fetch(document.querySelector('#pr-review').dataset.path+'/commands/'+"+JSON.stringify(command.commandId)+",{headers:{accept:'application/json'}}).then(r=>r.json())");return ['applied','rejected'].includes(r?.outcome)?r:null});
  check('round '+(round+1)+' owner Re-verify applied',receipt.outcome==='applied',receipt);
  const state=await until('verification completes',async()=>{const s=await evaluate("fetch(document.querySelector('#pr-review').dataset.path,{headers:{accept:'application/json'}}).then(r=>r.json()).then(s=>({revision:s.revision,phase:s.phase,current:s.review?.current,head:s.review?.head}))");return s?.phase==='in_review'&&s.current&&s.revision>Number(command.version)?s:null},300000);
  check('round '+(round+1)+' reverified unchanged head',state.head===initial.head,state);
  check('round '+(round+1)+' document retained',await evaluate('performance.timeOrigin')===initial.origin);
  result.rounds.push({baseline,command,receipt,state});
 }
 await until('new menu binding after second verification',()=>evaluate("(()=>{const r=document.querySelector('#pr-review'),f=document.querySelector('#review-menu form');return f&&JSON.parse(f.dataset.command).version===r.dataset.revision&&r.dataset.phase==='in_review'})()"));
 for(const width of [1920,1440,1280,390]){await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});await Bun.sleep(700);check(width+'px no page overflow',await evaluate('document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight'));const shot=await send('Page.captureScreenshot',{format:'png'});writeFileSync('/tmp/otto678-evidence/review-panel-immediate-'+width+'.png',Buffer.from(shot.data,'base64'))}
 result.browser=await send('Browser.getVersion');result.passed=true;
}finally{result.finishedAt=new Date().toISOString();writeFileSync('/tmp/otto678-evidence/native-final-source.json',JSON.stringify(result,null,2));ws.close()}
