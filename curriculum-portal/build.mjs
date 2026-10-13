import {mkdirSync,copyFileSync,readFileSync} from 'node:fs';
const modules=JSON.parse(readFileSync('curriculum.json','utf8'));
if(modules.length!==16)throw Error('Expected 16 modules');
mkdirSync('dist',{recursive:true});
for(const file of ['index.html','portal.js','style.css','curriculum.json','syllabus.md','architecture.md'])copyFileSync(file,'dist/'+file);
console.log('Built static curriculum. No learner code executed.');
