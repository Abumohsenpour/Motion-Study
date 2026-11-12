/**
 * Stylesheet of the offline expert files (CORTEX look): calm, readable, touch-friendly on a phone.
 * The last block styles the print-only answer sheet that «ذخیره نسخه PDF» sends to the browser's print dialog.
 */
export const QUESTIONNAIRE_CSS = `
/* ---- tokens ---- */
:root{--bg:#f3f4f9;--surface:#fff;--ink:#171a2e;--muted:#5a6079;--line:#dde0ec;--soft:#f6f6fb;--accent:#4a3fd6;--accent-soft:#eeecfd;--g1:#5b4ff0;--g2:#12b5a6;--ok:#1c7448;--okbg:#e4f3ea;--warn:#8f5a06;--warnbg:#fdf3dc;--bad:#b02525;--badbg:#fbe9e9;--hdr:150px}
*{box-sizing:border-box}
html{scroll-padding-top:calc(var(--hdr) + 12px)}
html,body{margin:0;background:var(--bg);color:var(--ink);font-family:Vazirmatn,Tahoma,sans-serif;line-height:1.8;font-size:16px;-webkit-text-size-adjust:100%}
#app{min-height:100vh;display:flex;flex-direction:column}
.view{width:100%;max-width:880px;margin:0 auto;padding:4px 16px 24px;flex:1}
.ltr{direction:ltr;unicode-bidi:isolate}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.muted{color:var(--muted)}
.small{font-size:13px}
h1,h2,h3,p{margin:0}
h2{font-size:19px}
h3{font-size:16px}
p{margin:6px 0}
[hidden]{display:none!important}
:focus-visible{outline:3px solid var(--accent);outline-offset:2px;border-radius:6px}

/* ---- buttons ---- */
button{font:inherit;cursor:pointer;color:inherit}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:40px;padding:6px 16px;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--ink);font-weight:600}
.btn:hover{border-color:var(--accent);color:var(--accent)}
.btn.small{min-height:32px;padding:2px 12px;font-size:13px;border-radius:8px}
.btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}
.btn.primary:hover{background:#3d33bd;color:#fff}
.btn.big{min-height:46px;padding:8px 26px;font-size:17px;font-weight:700}
.btn:disabled{opacity:.45;cursor:not-allowed}
.link{border:0;background:none;padding:2px 6px;color:var(--accent);font-weight:700;text-decoration:underline}
.actions{display:flex;gap:10px;justify-content:flex-end;align-items:center;flex-wrap:wrap;margin-top:14px}

/* ---- sticky header: brand, title, progress, steps, section chips ---- */
.hdr{position:sticky;top:0;z-index:10;background:var(--surface);border-bottom:1px solid var(--line);box-shadow:0 2px 10px rgba(23,26,46,.06)}
.hdr::before{content:"";display:block;height:3px;background:linear-gradient(90deg,var(--g2),var(--g1))}
.hdr-in{max-width:880px;margin:0 auto;padding:8px 16px 8px}
.hdr-top{display:flex;align-items:center;gap:12px}
.brand{display:inline-flex;align-items:center;gap:6px;flex:none;font-size:13px}
.brand b{letter-spacing:.14em;font-weight:800}
.brand-fa{color:var(--muted);font-size:12px}
.logo{width:28px;height:28px;display:block;flex:none}
.hdr-title{flex:1;min-width:0;border-inline-start:1px solid var(--line);padding-inline-start:12px}
.hdr-title h1{font-size:16px;line-height:1.5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.proj{font-size:12px;color:var(--muted);line-height:1.5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hdr-meta{display:flex;gap:6px;flex:none;flex-wrap:wrap;justify-content:flex-end}
.tag{font-size:12px;background:var(--soft);border:1px solid var(--line);border-radius:999px;padding:0 10px;white-space:nowrap}
.hdr-progress{display:flex;align-items:center;gap:10px;margin-top:8px}
.bar{flex:1;height:10px;border-radius:5px;background:#e6e8f2;overflow:hidden}
.bar-fill{height:100%;width:0;border-radius:5px;background:linear-gradient(270deg,var(--g1),var(--g2));transition:width .25s}
.progress-text{font-size:13px;font-weight:700;white-space:nowrap}
.steps{list-style:none;display:flex;flex-wrap:wrap;align-items:center;gap:2px 4px;margin:6px 0 0;padding:0;font-size:13px;color:var(--muted)}
.step{display:flex;align-items:center}
.step+.step::before{content:"←";margin-inline:4px 6px;color:#9aa0b8}
.step button,.step-in{display:inline-flex;align-items:center;gap:5px;border:0;background:none;padding:1px 4px;border-radius:6px;color:inherit;font-weight:500}
.step button:hover{color:var(--accent)}
.step-n{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;border:1.5px solid #9aa0b8;font-size:12px;font-weight:700;line-height:1}
.step.current{color:var(--ink)}
.step.current button,.step.current .step-in{font-weight:800}
.step.current .step-n{background:var(--accent);border-color:var(--accent);color:#fff}
.step.done{color:var(--ok)}
.step.done .step-n{background:var(--ok);border-color:var(--ok);color:#fff}
.chips{display:flex;gap:6px;margin-top:6px;overflow-x:auto;padding:2px 1px 4px;scrollbar-width:thin}
.chip-nav{flex:none;display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);background:var(--soft);border-radius:999px;padding:1px 10px;font-size:13px;white-space:nowrap;min-height:30px}
.chip-nav:hover{border-color:var(--accent)}
.chip-name{max-width:16em;overflow:hidden;text-overflow:ellipsis}
.chip-count{font-weight:700;color:var(--muted);font-size:12px}
.chip-nav.done{background:var(--okbg);border-color:#b9dcc6}
.chip-nav.done .chip-count{color:var(--ok)}

/* ---- cards and sections ---- */
.card{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:16px;margin:12px 0}
.intro p:first-child{margin-top:0}
.consent p{text-align:justify}
.consent h2{margin-bottom:8px}
.agree{display:flex;gap:10px;align-items:flex-start;margin-top:14px;padding:12px;border:1.5px solid var(--line);border-radius:10px;background:var(--soft);font-weight:700;cursor:pointer}
.agree input{width:22px;height:22px;margin-top:4px;flex:none;accent-color:var(--accent)}
.sec-head{display:flex;align-items:center;gap:10px;margin:26px 0 6px}
.card .sec-head{margin-top:0}
.sec-head h2{flex:1}
.sec-count{font-size:13px;font-weight:700;color:var(--muted);background:var(--surface);border:1px solid var(--line);border-radius:999px;padding:0 10px;white-space:nowrap}
.sec-count.done{color:var(--ok);background:var(--okbg);border-color:#b9dcc6}
.sec-count.done::before{content:"✓ "}
.legend{display:flex;flex-wrap:wrap;gap:6px 8px;margin:8px 0;font-size:14px}
.legend-item{background:var(--soft);border:1px solid var(--line);border-radius:8px;padding:0 10px}
.notice{margin:12px 0;padding:10px 14px;border-radius:10px}
.notice.ok{background:var(--okbg);color:var(--ok);border:1px solid #b9dcc6}
.flash{animation:flash 2s ease-out}
@keyframes flash{0%,60%{box-shadow:0 0 0 4px rgba(74,63,214,.45)}100%{box-shadow:0 0 0 4px rgba(74,63,214,0)}}

/* ---- one Delphi question ---- */
.q{border-inline-start:4px solid var(--line)}
.q.done{border-inline-start-color:var(--ok)}
.q-head{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}
.q-head h3{flex:1;min-width:10em}
.code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px;color:var(--muted);background:var(--soft);border:1px solid var(--line);border-radius:5px;padding:0 6px}
.new{font-size:12px;background:var(--accent-soft);color:var(--accent);border-radius:10px;padding:0 8px;font-weight:700}
.tick{display:none;font-size:12px;font-weight:700;color:var(--ok);white-space:nowrap}
.q.done .tick{display:inline}
.req,.exp,.range{font-size:14px;margin-top:4px}
.exp,.range{color:var(--muted)}

/* ---- rating control (radio group of large buttons, grouped by band) ---- */
.rating{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px;align-items:stretch}
.band{display:flex;flex-direction:column;align-items:stretch;gap:2px;background:var(--soft);border:1px solid var(--line);border-radius:12px;padding:6px 6px 2px}
.band-btns{display:flex;gap:5px}
.band-label{font-size:12px;color:var(--muted);text-align:center;line-height:1.6}
.r{position:relative;min-width:46px;min-height:44px;padding:0 6px;border:1.5px solid #c3c7da;background:var(--surface);border-radius:10px;font-size:17px;font-weight:500;color:var(--ink)}
.r:hover{border-color:var(--accent);background:var(--accent-soft)}
.r.on{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:800;box-shadow:0 0 0 2px var(--surface),0 0 0 4px var(--accent)}
.r.on::after{content:"✓";position:absolute;top:-8px;inset-inline-start:-7px;width:18px;height:18px;border-radius:50%;background:var(--ok);color:#fff;font-size:11px;line-height:18px;text-align:center;font-weight:700;box-shadow:0 0 0 2px var(--surface)}
.band.cj-wrap{background:none;border:1.5px dashed #9aa0b8;padding:6px;justify-content:center;margin-inline-start:auto}
.r.cj{font-size:13px;font-weight:600;padding:0 12px;border-style:dashed;color:var(--muted);min-height:44px}
.r.cj.on{color:#fff;background:#3c4257;border-color:#3c4257;border-style:solid;box-shadow:0 0 0 2px var(--surface),0 0 0 4px #3c4257}

/* ---- round-2 feedback ---- */
.fb{margin-top:10px;background:var(--soft);border:1px solid var(--line);border-radius:10px;padding:8px 10px;font-size:13px}
.fb-title{display:flex;flex-wrap:wrap;gap:2px 12px;color:var(--muted);margin-bottom:4px}
.fb-key{display:inline-flex;align-items:center;gap:4px;white-space:nowrap}
.fb-key i{width:12px;height:12px;border-radius:3px;border:1px solid rgba(23,26,46,.25)}
.fb-row{display:grid;grid-template-columns:minmax(130px,210px) 1fr;gap:8px;align-items:center;margin:3px 0}
.fb-name{display:flex;align-items:center;gap:6px;line-height:1.5}
.fb-name small{color:var(--muted);white-space:nowrap}
.dom{display:inline-flex;align-items:center;justify-content:center;flex:none;min-width:22px;height:22px;padding:0 3px;border-radius:5px;color:#fff;font-weight:700;font-size:12px}
.fb-bar{display:flex;height:20px;border-radius:5px;overflow:hidden;background:#e6e8f2}
.fb-seg{display:flex;align-items:center;justify-content:center;color:var(--ink);font-size:11px;font-weight:700;border-inline-end:1px solid #fff}
.fb-seg.top{color:#fff}
.own{margin-top:6px;padding:1px 10px;background:var(--warnbg);border:1px solid #ecd9a6;border-radius:8px;display:inline-block;color:#5c3b00}

/* ---- open answers and allocation ---- */
.open label{display:block;font-weight:700;margin-bottom:6px;font-size:14px}
textarea{display:block;width:100%;font:inherit;border:1.5px solid #c3c7da;border-radius:10px;padding:8px 10px;background:var(--surface);color:var(--ink);resize:vertical}
.alloc-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.alloc-head h3{flex:1;min-width:8em}
.pill{font-size:13px;font-weight:700;padding:0 12px;border-radius:999px;white-space:nowrap;border:1px solid transparent}
.pill.ok{color:var(--ok);background:var(--okbg);border-color:#b9dcc6}
.pill.warn{color:var(--warn);background:var(--warnbg);border-color:#ecd9a6}
.pill.bad{color:var(--bad);background:var(--badbg);border-color:#efc1c1}
.alloc-rows{margin-top:8px}
.alloc-row{display:flex;align-items:center;gap:12px;padding:6px 0;border-bottom:1px solid #eceef5}
.alloc-row label{flex:1;min-width:0}
input.pts{width:96px;flex:none;min-height:42px;font:inherit;font-size:17px;font-weight:700;text-align:center;border:1.5px solid #c3c7da;border-radius:10px;padding:2px 6px;direction:ltr;background:var(--surface);color:var(--ink)}
input.pts.bad{border-color:var(--bad);background:var(--badbg)}
.alloc-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:10px}
.alloc-total{font-weight:700;font-size:14px}

/* ---- weighted-Pugh scoring ---- */
.concept .sketch{display:block;max-width:100%;max-height:420px;margin:10px auto;border:1px solid var(--line);border-radius:10px;background:#fff}
.concept .desc{text-align:justify}
.pq-scale{margin:8px 0 2px;padding:4px 10px;background:var(--soft);border-radius:8px}
.pq{display:grid;grid-template-columns:1fr auto;gap:8px 16px;align-items:center;padding:12px 10px;border-top:1px solid #eceef5;border-inline-start:4px solid transparent;border-radius:4px}
.pq.done{border-inline-start-color:var(--ok)}
.pq-ctl{display:flex;flex-direction:column;align-items:stretch;gap:2px}
.rating.five{margin-top:0;flex-wrap:nowrap;gap:6px}
.pq-val{font-size:12px;color:var(--muted);text-align:center;min-height:20px;max-width:258px;line-height:1.6}
.pq.done .pq-val{color:var(--ok);font-weight:700}

/* ---- review and saving ---- */
.review-card{margin-top:28px;border:2px solid var(--accent)}
.review{list-style:none;margin:10px 0 0;padding:0}
.review li{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:6px 0;border-bottom:1px solid #eceef5}
.rv-mark{display:inline-flex;align-items:center;justify-content:center;flex:none;width:22px;height:22px;border-radius:50%;font-size:13px;font-weight:800;color:#fff;background:var(--ok)}
.review li.open .rv-mark{background:var(--warn)}
.rv-name{font-weight:700;flex:1;min-width:8em}
.rv-text{font-size:14px;color:var(--muted)}
.review li.open .rv-text{color:var(--warn);font-weight:600}
.savebox{margin-top:12px}
.savebox.warn{padding:10px 14px;border-radius:10px;background:var(--warnbg);color:#5c3b00;border:1px solid #ecd9a6}
.savebox.warn ul{margin:0;padding-inline-start:20px}
.savebox.done{padding:14px;border-radius:12px;background:var(--okbg);border:1px solid #b9dcc6}
.savebox.done h3{color:var(--ok)}
.done-steps{list-style:none;margin:10px 0 0;padding:0;display:grid;gap:8px}
.done-steps li{display:flex;gap:10px;align-items:flex-start;background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:10px 12px}
.ds-n{display:inline-flex;align-items:center;justify-content:center;flex:none;width:28px;height:28px;border-radius:50%;background:var(--accent);color:#fff;font-weight:800}
.done-steps li.ok .ds-n{background:var(--ok)}
.file{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px}

/* ---- footer ---- */
.foot{display:flex;align-items:center;justify-content:center;gap:8px;padding:14px 16px 20px;font-size:12px;color:var(--muted);text-align:center;border-top:1px solid var(--line);background:var(--surface)}
.foot .logo{width:20px;height:20px}

/* ---- phone ---- */
@media (max-width:640px){
.fb-row{grid-template-columns:1fr;gap:2px}
.pq{grid-template-columns:1fr}
.rating.five .r{flex:1}
.pq-val{max-width:none;text-align:start}
}
@media (max-width:560px){
/* the bands stack: label beside three wide buttons */
.rating:not(.five){flex-direction:column}
.band{flex-direction:row-reverse;align-items:center;gap:8px;padding:5px 6px}
.band-btns{flex:1}
.band-btns .r{flex:1}
.band-label{flex:none;width:5.2em;text-align:start;line-height:1.4}
.band.cj-wrap{margin-inline-start:0}
.r.cj{flex:1;width:100%}
}
@media (max-width:480px){
html,body{font-size:15px}
.view{padding:2px 10px 20px}
.hdr-in{padding:6px 10px}
.card{padding:12px;border-radius:12px}
.brand-fa,.proj{display:none}
.hdr-top{gap:4px 8px;flex-wrap:wrap}
.hdr-meta{flex:1 1 100%;justify-content:flex-start}
.hdr-title{padding-inline-start:8px}
.hdr-title h1{font-size:14px}
.tag{padding:0 7px;font-size:11px}
.hdr-progress{margin-top:6px;gap:8px}
.bar{min-width:40px}
.steps{font-size:12px}
.step+.step::before{margin-inline:1px 3px}
.step-n{width:18px;height:18px;font-size:11px}
.actions .btn{flex:1 1 100%}
input.pts{width:84px}
.foot{flex-direction:column;gap:4px}
}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important;scroll-behavior:auto!important}.flash{box-shadow:0 0 0 4px rgba(74,63,214,.45)}}

/* ---- the answer sheet (print only): A4, black on white, compact tables ---- */
#print-sheet{display:none}
@page{size:A4;margin:12mm 12mm 14mm}
@media print{
html,body{background:#fff!important;color:#000!important;font-size:10pt;line-height:1.55}
#app{display:none!important}
#print-sheet{display:block}
}
.sheet{color:#000;background:#fff;font-size:10pt;line-height:1.55}
.sheet h2{font-size:12pt;margin:12pt 0 2pt;border-bottom:1.2pt solid #000;break-after:avoid;page-break-after:avoid}
.sheet h3{font-size:10.5pt;margin:8pt 0 2pt;break-after:avoid;page-break-after:avoid}
.sh-head{display:flex;align-items:center;gap:8pt;border-bottom:1.5pt solid #000;padding-bottom:5pt}
.sh-head .logo{width:30pt;height:30pt;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.sh-title{font-size:10pt}
.sh-kind{font-size:14pt;font-weight:800;line-height:1.4}
.sh-draft{margin:6pt 0 0;padding:3pt 8pt;border:1.5pt dashed #000;font-weight:800;font-size:12pt;text-align:center}
.sheet table{width:100%;border-collapse:collapse;margin:3pt 0 4pt}
.sheet th,.sheet td{border:.6pt solid #000;padding:1.5pt 5pt;text-align:start;vertical-align:middle;font-weight:400}
.sheet thead{display:table-header-group}
.sheet tfoot{display:table-row-group}
.sheet thead th,.sheet tfoot th{font-weight:700;background:#eee;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.sheet tr{break-inside:avoid;page-break-inside:avoid}
.sh-meta{margin-top:6pt!important}
.sh-meta th{width:17%;font-weight:700;background:#eee;-webkit-print-color-adjust:exact;print-color-adjust:exact;white-space:nowrap}
.sh-meta td{width:33%}
.sh-iso{font-size:7.5pt;display:inline-block;white-space:nowrap}
.sh-legend{margin:5pt 0 0;font-size:9pt}
.sh-code{width:16mm;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:9pt;white-space:nowrap}
.sheet td.sh-score,.sheet thead th:last-child{width:34mm;text-align:center}
.sh-score b{font-size:12pt}
.sh-cj{font-size:8.5pt;font-weight:700}
.sh-none{font-size:8.5pt;font-style:italic}
.sh-box{display:inline-block;width:14mm;height:5.5mm;border:.9pt solid #000;vertical-align:middle;margin:1pt 0}
.sh-matrix th,.sh-matrix td{text-align:center!important;padding:2pt 2pt}
.sheet .sh-matrix td.sh-cell,.sheet .sh-matrix thead th:last-child{width:auto}
.sh-matrix tbody th{font-weight:700;white-space:nowrap;width:22mm}
.sh-matrix .sh-box{width:9mm}
.sheet .sh-codes thead th:last-child{width:auto;text-align:start}
.sh-open{border:.6pt solid #000;padding:2pt 5pt;margin:0 0 4pt;break-inside:avoid;page-break-inside:avoid}
.sh-open.blank{min-height:16mm}
.sh-open-text{white-space:pre-wrap}
.sh-foot{margin-top:10pt;border-top:1.5pt solid #000;padding-top:4pt;font-size:9pt;break-inside:avoid;page-break-inside:avoid}
.sh-sum{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:8.5pt}
.sh-made{font-size:8pt;margin-top:2pt}
`;
