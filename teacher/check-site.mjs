import {existsSync,readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const root=process.cwd();
const js=[
 'teacher/app.js','teacher/studio.js','teacher/student.js',
 'teacher/grades.js','teacher/grades-base.js'
];
const html=['teacher/index.html','teacher/studio.html','teacher/student.html','teacher/grades.html','teacher/portfolio.html','teacher/reset.html'];
let total=0;
for(const file of [...js,...html]){
 assert(existsSync(resolve(root,file)),file+' missing');
 if(js.includes(file)){
  execFileSync(process.execPath,['--check',resolve(root,file)],{stdio:'pipe'});
  total++;
 }
}
for(const file of html){
 const body=readFileSync(resolve(root,file),'utf8');
 assert(body.includes('<html')&&body.includes('</html>'),file+' incomplete');
 for(const match of body.matchAll(/(?:href|src)=["']\.\/([^"'?#]+)(?:\?[^"']*)?["']/g)){
  const target=resolve(root,'teacher',match[1]);
  assert(existsSync(target),file+' broken local reference: '+match[1]);
 }
 const inline=[...body.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)];
 for(const block of inline){
  const clean=block[1].replace(/^\s*import[^\n]*\n/,'');
  new Function(clean);
 }
 total++;
}
const grade=readFileSync(resolve(root,'teacher/grades.js'),'utf8');
const base=readFileSync(resolve(root,'teacher/grades-base.js'),'utf8');
const imported=grade.match(/import \{([^}]+)\} from '\.\/grades-base\.js'/);
assert(imported,'gradebook module dependency missing');
const exposed=base.match(/export \{([^}]+)\};/);
assert(exposed,'gradebook exports missing');
for(const name of imported[1].split(',').map(x=>x.trim())){
 assert(exposed[1].split(',').map(x=>x.trim()).includes(name),'unexported helper '+name);
}
for(const path of ['teacher/studio.html','teacher/student.html','teacher/grades.html','teacher/portfolio.html']){
 assert(readFileSync(resolve(root,'teacher/index.html'),'utf8').includes('./'+path.split('/')[1]),'main site missing '+path);
}
console.log('Passed '+total+' JS syntax / HTML structure checks. All gradebook imports exported and homepage links exist.');
