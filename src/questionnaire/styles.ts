/** Stylesheet of the offline expert files: calm, readable, works on a phone, prints cleanly. */
export const QUESTIONNAIRE_CSS = `
:root{--bg:#f5f4f0;--surface:#fff;--ink:#1f2430;--muted:#5d6475;--line:#dcdad2;--accent:#34507a;--ok:#2f6b45;--okbg:#e3efe6;--warn:#8a5a00;--warnbg:#fbf1dc}
*{box-sizing:border-box}
html,body{margin:0;background:var(--bg);color:var(--ink);font-family:Vazirmatn,Tahoma,sans-serif;line-height:1.8;font-size:16px}
#app{max-width:860px;margin:0 auto;padding:16px}
.ltr{direction:ltr;unicode-bidi:isolate}
.top{padding:8px 0 4px}
.top .proj{font-size:13px;color:var(--muted)}
.top h1{font-size:22px;margin:4px 0}
.top .meta{display:flex;flex-wrap:wrap;gap:16px;font-size:14px;color:var(--muted)}
.card{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:16px;margin:12px 0}
h2{font-size:18px;margin:20px 0 8px}
.card h2{margin-top:0}
h3{font-size:16px;margin:0}
p{margin:6px 0}
.consent p{text-align:justify}
.agree{display:flex;gap:8px;align-items:center;margin-top:12px;font-weight:600}
.agree input{width:20px;height:20px}
.actions{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:12px}
button{font:inherit;cursor:pointer}
button.primary{background:var(--accent);color:#fff;border:1px solid var(--accent);border-radius:8px;padding:8px 18px;font-weight:600}
button.primary:disabled{opacity:.45;cursor:not-allowed}
button.secondary{background:var(--surface);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:4px 12px}
.sticky{position:sticky;top:0;z-index:5;background:var(--bg);padding:8px 0;border-bottom:1px solid var(--line)}
.bar{height:8px;border-radius:4px;background:#e4e2db;overflow:hidden}
.bar-fill{height:8px;background:var(--accent);width:0;transition:width .2s}
.sticky-row{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:6px;font-size:14px;color:var(--muted)}
.legend{display:flex;flex-wrap:wrap;gap:8px 16px;margin-top:8px;font-size:14px}
.legend .band{background:#f0efea;border-radius:6px;padding:2px 8px}
.param .p-head{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}
.code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px;color:var(--muted);background:#f0efea;border-radius:4px;padding:0 6px}
.new{font-size:12px;background:#e5ebf4;color:var(--accent);border-radius:10px;padding:0 8px;font-weight:600}
.req,.exp,.range{font-size:14px;margin-top:4px}
.exp,.range{color:var(--muted)}
.rating{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px;align-items:flex-start}
.seg{display:flex;flex-direction:column;align-items:center}
.seg-buttons{display:flex;gap:4px}
.seg-label{font-size:12px;color:var(--muted);margin-top:2px}
.r{min-width:40px;height:40px;border:1px solid var(--line);background:var(--surface);border-radius:8px;font-size:16px}
.r.cj{font-size:13px;padding:0 10px}
.r:hover{border-color:var(--accent)}
.r.on{background:var(--accent);color:#fff;border-color:var(--accent);font-weight:700}
.rating.small{gap:4px;flex-wrap:nowrap}
.rating.small .r{min-width:34px;height:34px}
.fb{margin-top:10px;background:#f7f6f2;border:1px dashed var(--line);border-radius:8px;padding:8px 10px;font-size:13px}
.fb-title{color:var(--muted);margin-bottom:4px}
.fb-row{display:grid;grid-template-columns:24px minmax(120px,190px) 1fr;gap:8px;align-items:center;margin:3px 0}
.chip{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:5px;color:#fff;font-weight:700;font-size:12px}
.fb-name small{color:var(--muted)}
.fb-bar{display:flex;height:20px;border-radius:4px;overflow:hidden;background:#ebe9e2}
.fb-seg{display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;text-shadow:0 0 2px rgba(0,0,0,.6)}
.own{margin-top:6px;padding:4px 8px;background:#fff3c4;border-radius:6px;display:inline-block}
.muted{color:var(--muted)}
.small{font-size:13px}
.open label{display:block;font-weight:600;margin-bottom:4px;font-size:14px}
textarea{width:100%;font:inherit;border:1px solid var(--line);border-radius:8px;padding:8px;background:var(--surface);color:var(--ink)}
table{width:100%;border-collapse:collapse}
table.alloc td{padding:6px 4px;border-bottom:1px solid #eeece6}
table.alloc td:last-child{width:120px}
input.pts{width:100px;font:inherit;text-align:center;border:1px solid var(--line);border-radius:6px;padding:4px;direction:ltr}
input.pts.bad{border-color:#9b2c2c;background:#f8e3e3}
.total{font-size:13px;font-weight:600;margin-inline-start:8px;padding:1px 8px;border-radius:10px}
.total.ok{color:var(--ok);background:var(--okbg)}
.total.warn{color:var(--warn);background:var(--warnbg)}
.notice{margin:8px 0;padding:0;border-radius:8px}
.notice.ok{padding:10px;background:var(--okbg);color:var(--ok)}
.notice.warn{padding:10px;background:var(--warnbg);color:var(--warn)}
.concept .sketch{display:block;max-width:100%;max-height:420px;margin:8px auto;border:1px solid var(--line);border-radius:8px;background:#fff}
.concept .desc{text-align:justify}
table.pugh td{padding:8px 4px;border-bottom:1px solid #eeece6;vertical-align:middle}
table.pugh td:last-child{width:200px}
@media (max-width:600px){.fb-row{grid-template-columns:24px 1fr}.fb-row .fb-bar,.fb-row .muted{grid-column:1/-1}table.pugh td{display:block;width:auto!important}}
@media print{.sticky,.actions,button{display:none!important}.card{break-inside:avoid}}
`;
