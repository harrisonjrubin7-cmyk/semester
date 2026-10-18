import {mkdirSync,copyFileSync,readFileSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const modules=JSON.parse(readFileSync('curriculum.json','utf8'));
if(modules.length!==16)throw Error('Expected 16 modules');
execFileSync(process.execPath,['--check','portal.js'],{stdio:'inherit'});
rmSync('dist',{recursive:true,force:true});
mkdirSync('dist',{recursive:true});
for(const file of ['index.html','portal.js','style.css','curriculum.json','syllabus.md','architecture.md'])copyFileSync(file,'dist/'+file);
console.log('Built static curriculum. No learner code executed.');
