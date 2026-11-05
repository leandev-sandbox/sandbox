import {readFileSync,writeFileSync} from 'node:fs';
const list=await fetch('http://localhost:9298/json/list').then(r=>r.json());
const tab=list.find((t:any)=>t.type==='page'&&t.url.includes('/issues/1465?stage=pr_review'));
if(!tab)throw Error('Retained native page is missing');
const ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
let id=0;const pending=new Map<number,any>();
ws.onmessage=e=>{const reply=JSON.parse(e.data as string);if(!reply.id)return;const p=pending.get(reply.id);if(!p)return;pending.delete(reply.id);clearTimeout(p.timer);reply.error?p.reject(reply.error):p.resolve(reply.result)};
const send=(method:string,params={})=>new Promise<any>((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject,timer:setTimeout(()=>{pending.delete(key);reject(Error('Local CDP timeout: '+method))},25000)});ws.send(JSON.stringify({id:key,method,params}));});
const evaluate=async(expression:string)=>(await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true})).result?.value;
const checks:any[]=[];const check=(name:string,pass:boolean,detail?:any)=>{checks.push({name,pass,detail});if(!pass)throw Error(name);console.log('PASS',name)};
const result:any={smoke:'f6b72d7d',method:'Continue the retained native page after the remote CDP client timed out; same UI actions and assertions as review-panel-immediate',startedAt:new Date().toISOString(),checks};
try{
 const captured=JSON.parse(readFileSync('/tmp/otto678-evidence/native-discuss-capture.json','utf8'));
 const current=await evaluate(`({timeOrigin:performance.timeOrigin,head:document.querySelector('#pr-review').dataset.head,phase:document.querySelector('#pr-review').dataset.phase,terminalRetained:window.paneTerminal===document.querySelector('#session-terminal'),states:window.paneStates,verified:['immediate_one','immediate_two'].every(id=>document.querySelector('[data-plan-item="'+id+'"] .kind').textContent.includes('Verified')),events:[...document.querySelectorAll('[data-feed] [data-seq]')].map(x=>({seq:Number(x.dataset.seq),kind:x.dataset.kind,text:x.textContent})),commands:window.immediateCommands})`);
 result.before=current;
 check('same document as connected Discuss screenshots',current.timeOrigin===captured.views[0].timeOrigin);
 check('terminal node retained',current.terminalRetained);
 check('both findings verified at the pushed head',current.verified&&current.head==='07c90045c0ac17ace72dd622b3653d019992687d');
 for(const state of ['Cuy fixing','Fixed in','Verified'])check('observed '+state,current.states.some((s:any)=>s.text.includes(state)));
 for(const kind of ['comment','round','push','reply','passed'])check('Feed contains '+kind,current.events.some((e:any)=>e.kind===kind));
 check('Feed rows append once in order',current.events.every((e:any,i:number,a:any[])=>!i||e.seq>a[i-1].seq));
 check('Feed includes the conversation comment',current.events.some((e:any)=>e.text.includes('Smoke f6b72d7d: acknowledge')));
 check('Feed includes the review body',current.events.some((e:any)=>e.text.includes('Smoke f6b72d7d: review-body')));
 result.reverifyCommand=await evaluate("window.immediateCommands.findLast(c=>c.action==='reverify')");
 if(!result.reverifyCommand)throw Error('Existing Re-verify command is missing; refusing a second click');
 console.log('Re-verify clicked',result.reverifyCommand.commandId);
 const until=Date.now()+180000;let receipt:any;
 while(Date.now()<until){receipt=await evaluate(`fetch(document.querySelector('#pr-review').dataset.path+'/commands/'+${JSON.stringify(result.reverifyCommand.commandId)},{headers:{accept:'application/json'}}).then(r=>r.json())`);if(receipt?.outcome!=='received')break;await Bun.sleep(1000)}
 result.receipt=receipt;check('owner page Re-verify applied',receipt?.outcome==='applied',receipt);
 for(const width of [1920,1440,1280,390]){await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});await Bun.sleep(700);check(width+'px no sideways scroll',await evaluate('document.documentElement.scrollWidth<=innerWidth'));const shot=await send('Page.captureScreenshot',{format:'png'});writeFileSync(`/tmp/otto678-evidence/review-panel-immediate-${width}.png`,Buffer.from(shot.data,'base64'));}
 check('same document after Re-verify',await evaluate('performance.timeOrigin')===current.timeOrigin);
 result.after=await evaluate(`({head:document.querySelector('#pr-review').dataset.head,phase:document.querySelector('#pr-review').dataset.phase,commands:window.immediateCommands})`);
 result.browser=await send('Browser.getVersion');result.passed=true;
}finally{result.finishedAt=new Date().toISOString();writeFileSync('/tmp/otto678-evidence/native-continuation.json',JSON.stringify(result,null,2));ws.close()}
