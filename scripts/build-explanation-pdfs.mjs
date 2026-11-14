// Export the site's explanations and rendered answer diagrams, without user data.
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const base=process.env.EXPLANATION_BASE_URL ?? 'http://localhost:4173';
const out='public/explanations';await mkdir(out,{recursive:true});
const css=await readFile('src/style.css','utf8');
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const names={am1:'午前Ⅰ',am2:'午前Ⅱ',pm1:'午後Ⅰ',pm2:'午後Ⅱ'};
const browser=await chromium.launch({channel:'chrome',headless:true});
const onlyMorning=process.argv.includes('--morning-only');
const manifest=onlyMorning?JSON.parse(await readFile(`${out}/manifest.json`,'utf8')).filter(m=>m.part.startsWith('pm')):[];
try{
 const source=await browser.newPage({viewport:{width:1280,height:1000}});
 const print=await browser.newPage();
 for(let year=2025;year>=2016;year--)for(const part of Object.keys(names)){
  if(onlyMorning && part.startsWith('pm'))continue;
  const term=year<2020?'春期':year===2020?'10月':'秋期';
  const title=`${year}年度 ${term} ${names[part]} 解答・解説`;
  let body='',questionCount=0,explanationCount=0;
  if(part.startsWith('am')){
   const paper=JSON.parse(await readFile(`public/morning/data/${year}-${part}.json`,'utf8'));
   questionCount=paper.questions.length;explanationCount=questionCount;
   body=`<p class="source-links">出典：<a href="${paper.source}">IPA公式問題</a> ／ <a href="${paper.answerSource}">IPA公式解答例</a></p>`;
   for(const q of paper.questions){
    const figure=q.figure?(q.figure.startsWith('/')?`<img src="${base}${q.figure}" alt="問${q.number}の図表">`:q.figure):'';
    body+=`<section class="morning-question"><h2>問${q.number}</h2><div>${q.stem}</div>${figure}<table class="choices"><tbody>${q.choices.map((choice,i)=>`<tr><th>${'アイウエ'[i]}</th><td>${choice}</td></tr>`).join('')}</tbody></table><div class="answer-explanation"><h3>正解：${q.answer}</h3><div>${q.explanation}</div></div></section>`;
   }
  }else{
   questionCount=part==='pm1'?3:2;
   for(let q=1;q<=questionCount;q++){
    const route=`/${year}/${part}/q${q}/answer`;
    await source.goto(base+route);
    await source.locator('.layout > article > section').first().waitFor();
    const data=await source.evaluate(()=>{
     const article=document.querySelector('.layout > article');
     const sections=[...article.querySelectorAll(':scope > section')].map(node=>node.cloneNode(true));
     for(const section of sections){
      section.querySelectorAll('.own-answer,.diagram-scoring-rules,.diagram-footer,.figure-source').forEach(n=>n.remove());
      // Preserve the selected circles in the component-tree answer as SVG marks.
      section.querySelectorAll('.part-tree-figure button').forEach(button=>{
       if(button.getAttribute('aria-pressed')==='true'){
        const svg=button.parentElement.querySelector('svg');const v=svg.viewBox.baseVal;
        const ellipse=document.createElementNS('http://www.w3.org/2000/svg','ellipse');
        ellipse.setAttribute('cx',String(parseFloat(button.style.left)/100*v.width));ellipse.setAttribute('cy',String(parseFloat(button.style.top)/100*v.height));
        ellipse.setAttribute('rx','23');ellipse.setAttribute('ry','19');ellipse.setAttribute('stroke','#126854');ellipse.setAttribute('stroke-width','2');ellipse.setAttribute('fill','none');svg.append(ellipse);
       }button.remove();
      });
      section.querySelectorAll('a').forEach(a=>{a.href=new URL(a.getAttribute('href'),location.href).href.replace(location.origin,'https://ipa-db-sp.naritai.app');});
      section.querySelectorAll('img, image').forEach(img=>{const attr=img.tagName==='image'?'href':'src';const val=img.getAttribute(attr);if(val)img.setAttribute(attr,new URL(val,location.origin).href);});
     }
     return {title:document.querySelector('.breadcrumbs h1').textContent,html:sections.map(s=>s.outerHTML).join(''),explanations:article.querySelectorAll('.answer-explanation').length};
    });
    explanationCount+=data.explanations;
    body+=`<article class="afternoon-question"><h2 class="question-title">問${q} ${esc(data.title)}</h2><p class="source-links"><a href="https://ipa-db-sp.naritai.app${route}">サイトでこの問題の解説を開く</a></p>${data.html}</article>`;
   }
  }
  await print.setContent(`<!doctype html><html lang="ja"><head><meta charset="utf-8"><base href="${base}/"><title>${esc(title)}</title><style>${css}
  @page{size:A4;margin:16mm 14mm 19mm}html,body{background:white!important;color:#193a41}body{font:10pt/1.65 'Hiragino Sans',sans-serif;margin:0}*{box-sizing:border-box}main.print-document{width:100%;max-width:none;padding:0;margin:0}h1{font-size:21pt;margin:0 0 6mm}h2{font-size:14pt;margin:6mm 0 3mm;break-after:avoid}h3{font-size:11pt;break-after:avoid}p{margin:2mm 0 3mm}a{color:#126854;overflow-wrap:anywhere}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:9pt}table{border-collapse:collapse;width:100%;font-size:9pt}td,th{padding:2mm;border:1px solid #cad5ce;vertical-align:top}tr{break-inside:avoid}thead{display:table-header-group}img,svg{max-width:100%;height:auto}img{display:block;max-height:170mm;object-fit:contain;margin:3mm auto}.canvas{padding:0;margin:3mm 0;overflow:visible;min-width:0;border:0;break-inside:avoid}.canvas>svg{display:block;width:100%;min-width:0;max-height:175mm;height:auto}.diagram{break-inside:avoid}.diagram-legend{font-size:8pt}.diagram-legend svg{width:25px}.diagram-score,.score-note{font-size:8pt}.review-answers{font-size:9pt}.review-answers tbody th{width:16%}.review-answers .score-cell{width:15%}.answer-explanation{padding:2mm 3mm;border-left:2px solid #126854;background:#f4f8f5;break-inside:avoid}.answer-explanation>a{font-size:8pt}.morning-question{break-inside:avoid;margin:0 0 6mm}.choices th{width:9mm}.morning-question svg line,.morning-question svg rect{stroke:#273940;stroke-width:1.6}.morning-question svg rect{fill:white}.morning-question svg text{font:16px system-ui;fill:#192b32}.morning-question .schema{display:flex;flex-wrap:wrap}.morning-question .schema span{border:1px solid #73858a;padding:2mm}.morning-question .schema i{font-style:normal;border-bottom:1px dashed}.morning-question .pair,.morning-question .eq{display:flex;gap:2mm 4mm;flex-wrap:wrap}.morning-question .frac{display:inline-flex;vertical-align:middle;flex-direction:column;text-align:center;line-height:1.4}.morning-question .frac span:first-child{border-bottom:1px solid}.afternoon-question+.afternoon-question{break-before:page}.part-tree{break-inside:avoid}.part-tree-figure{max-width:100%}.source-links,.print-note{font-size:8pt;color:#4c6365}.diagram :is(button,input),.relation-switch{display:none}.score-heading{break-after:avoid}.question-title{border-bottom:2px solid #126854;padding-bottom:3mm}.print-note{border-bottom:1px solid #cad5ce;padding-bottom:4mm}
  </style></head><body><main class="print-document"><h1>${esc(title)}</h1><p class="print-note">データベーススペシャリスト試験演習室｜当サイト作成の学習用解説です。IPA公式の解説ではありません。<br>問題・解答例の出典：IPA。午後の予想配点は当サイト独自の推定です。</p>${body}</main></body></html>`,{waitUntil:'networkidle'});
  await print.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});
  const file=`${year}-${part}.pdf`;
  await print.pdf({path:`${out}/${file}`,format:'A4',printBackground:true,preferCSSPageSize:true,displayHeaderFooter:true,headerTemplate:'<span></span>',footerTemplate:`<div style="width:100%;margin:0 14mm;font:8px sans-serif;color:#4c6365;display:flex;justify-content:space-between"><span>https://ipa-db-sp.naritai.app/</span><span>お問い合わせ：https://x.com/taiki_smec</span><span class="pageNumber"></span></div>`});
  const pages=Number(/^Pages:\s+(\d+)/m.exec(execFileSync('pdfinfo',[`${out}/${file}`],{encoding:'utf8'}))[1]);
  manifest.push({year,part,file,questionCount,explanationCount,pages});console.log(file,questionCount,'questions',explanationCount,'explanations');
 }
 await writeFile(`${out}/manifest.json`,JSON.stringify(manifest,null,2)+'\n');
}finally{await browser.close();}
