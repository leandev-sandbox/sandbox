import { readFileSync, writeFileSync } from 'node:fs';
import { startRunner } from '../678/adapters/runner-smoke.ts';
const path = '.wrangler/lifecycle-smoke/f6b72d7d.json';
const smoke = JSON.parse(readFileSync(path, 'utf8'));
const child = await startRunner({folder: smoke.dir+'/runner',server:'http://localhost:8798',environmentId:'smoke-'+smoke.id,credential:smoke.credential,feature:smoke.feature,build:true,home:smoke.dir+'/codex-home',skillOverlay:smoke.skillOverlay});
smoke.runner=child.pid;writeFileSync(path,JSON.stringify(smoke,null,2));console.log('Resumed the shared smoke runner',child.pid);
