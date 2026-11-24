// Mostra, para cada pacote, a MAIOR versão publicada há pelo menos 14 dias.
// Uso: node tools/versao-segura.mjs pacote [pacote#major ...]
import { execSync } from 'node:child_process';
const cutoff = Date.now() - 14*864e5;
const cmp=(a,b)=>{const x=a.split('.').map(Number),y=b.split('.').map(Number);for(let i=0;i<3;i++)if(x[i]!==y[i])return x[i]-y[i];return 0};
for (const arg of process.argv.slice(2)) {
  const [p, major] = arg.split('#');
  const t = JSON.parse(execSync(`npm view ${p} time --json`,{stdio:['ignore','pipe','ignore']}).toString());
  let vs = Object.entries(t).filter(([v,d]) => /^\d+\.\d+\.\d+$/.test(v) && Date.parse(d) < cutoff).map(([v])=>v);
  if (major) vs = vs.filter(v=>v.startsWith(major+'.'));
  vs.sort(cmp);
  console.log(p.padEnd(28), vs.at(-1), (t[vs.at(-1)]||'').slice(0,10));
}
