const fs=require('fs'),path=require('path');
const dir=path.join(__dirname,'../src');
const files=['e1_core.js','e2_econ.js','e3_war.js','e3b_empire.js','e4_dip.js','e5_policy.js','e6_events.js','e6b_empire_events.js','e7_turn.js','e8_explain.js','e9_cabinet.js','e10_story.js','e11_ambition.js','e12_intel.js','e13_aftermath.js','e14_reports.js','e15_projects.js','e16_credit.js','e17_fallout.js'];
let code=files.map(f=>fs.readFileSync(path.join(dir,f),'utf8')).join('\n');
const out=`const WORLDDATA=${fs.readFileSync(path.join(dir,'worlddata.json'),'utf8')};\nconst MAPDATA=${fs.readFileSync(path.join(dir,'mapdata.json'),'utf8')};\nconst Engine=(function(){\n'use strict';\n${code}\nreturn Engine;\n})();\nif(typeof module!=='undefined')module.exports=Engine;\n`;
fs.mkdirSync(path.join(__dirname,'../dist'),{recursive:true});
fs.writeFileSync(path.join(__dirname,'../dist/engine.js'),out);
console.log('engine bytes',out.length);
