import json
import os
import re


def make(dc_html, props, out, title='Riverline prototype', init=None):
    css = re.search(r'<style>(.*?)</style>', dc_html, re.S).group(1)
    body = re.search(r'</helmet>\s*(.*?)\s*</x-dc>', dc_html, re.S).group(1)
    script = re.search(r'<script type="text/x-dc"[^>]*>(.*?)</script>', dc_html, re.S).group(1)
    shim = r"""
class DCLogic { constructor(props){ this.props = props || {}; this.state = {}; } setState(p){ Object.assign(this.state, p); window.__render(); } }
window.__props = %s;
%s
const comp = new Component(window.__props);
Object.assign(comp.state, %s);
(location.hash || '').slice(1).split('&').forEach(kv => { const [k, v] = kv.split('='); if (k && v && (k === 'view' || k === 'th' || k === 'sec')) comp.state[k] = decodeURIComponent(v); });
const tpl = document.getElementById('tpl');
const root = document.getElementById('app');
const getPath = (scope, path) => { path = path.trim(); if (path === 'true') return true; if (path === 'false') return false; return path.split('.').reduce((o,k)=> (o==null? undefined : o[k]), scope); };
function expand(node, scope, parent){
  if (node.nodeType === 3) { const t = node.textContent.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (m,p)=>{ const v = getPath(scope,p); return v==null?'':String(v); }); parent.appendChild(document.createTextNode(t)); return; }
  if (node.nodeType !== 1) return;
  const tag = node.localName;
  if (tag === 'sc-if') { const m = node.getAttribute('value').match(/\{\{\s*([^}]+?)\s*\}\}/); if (getPath(scope, m[1])) node.childNodes.forEach(c=>expand(c,scope,parent)); return; }
  if (tag === 'sc-for') { const m = node.getAttribute('list').match(/\{\{\s*([^}]+?)\s*\}\}/); const list = getPath(scope, m[1]) || []; const as = node.getAttribute('as'); list.forEach((it,i)=>{ const s = Object.create(scope); s[as]=it; s.$index=i; node.childNodes.forEach(c=>expand(c,s,parent)); }); return; }
  const el = document.createElementNS(node.namespaceURI, node.localName);
  for (const a of node.attributes) {
    if (a.name.startsWith('hint-')) continue;
    const whole = a.value.match(/^\{\{\s*([^}]+?)\s*\}\}$/);
    if (whole) { const v = getPath(scope, whole[1]); if (a.name.startsWith('on')) { if (typeof v === 'function') el.addEventListener(a.name.slice(2).toLowerCase(), v); } else if (a.name === 'disabled') { if (v) el.setAttribute('disabled',''); } else if (v != null) el.setAttribute(a.name, String(v)); }
    else el.setAttribute(a.name, a.value.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (m,p)=>{ const v = getPath(scope,p); return v==null?'':String(v); }));
  }
  node.childNodes.forEach(c=>expand(c,scope,el)); parent.appendChild(el);
}
window.__render = () => { const ae = document.activeElement; let keep = null; if (ae && root.contains(ae) && ae.getAttribute('aria-label')) keep = { l: ae.getAttribute('aria-label'), a: ae.selectionStart, b: ae.selectionEnd };
  const scr = []; root.querySelectorAll('[class]').forEach(e=>{ if (e.scrollTop > 0) scr.push([e.className, e.scrollTop]); });
  const vals = comp.renderVals(); const frag = document.createDocumentFragment(); tpl.content.childNodes.forEach(c=>expand(c, vals, frag)); root.replaceChildren(frag);
  scr.forEach(([c,v])=>{ const e = Array.from(root.querySelectorAll('[class]')).find(x=>x.className===c); if (e) e.scrollTop = v; });
  if (keep) { const e = Array.from(root.querySelectorAll('[aria-label]')).find(x=>x.getAttribute('aria-label')===keep.l); if (e) { e.focus({preventScroll:true}); try { if (keep.a != null) e.setSelectionRange(keep.a, keep.b); } catch(_){} } } };
window.__render(); window.__comp = comp;
""" % (json.dumps(props), script, json.dumps(init or {}))
    fonts = '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&amp;family=Rubik:wght@400;500;600;700&amp;display=swap" rel="stylesheet">'
    fit = '<style>html,body{height:100%%;background:#050d09}body{display:flex;align-items:flex-start;justify-content:center;overflow:auto}#app{flex:none;transform-origin:top center}</style><script>addEventListener("DOMContentLoaded",()=>{const a=document.getElementById("app");const f=()=>{const r=a.firstElementChild;if(!r)return;const w=r.offsetWidth,h=r.offsetHeight;const k=Math.min(1,innerWidth/w,innerHeight/h);a.style.transform=k<1?"scale("+k+")":"";a.style.height=(h*k)+"px";};f();addEventListener("resize",f);});</script>'
    html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>%s</title>%s<style>%s</style>%s</head><body><template id="tpl">%s</template><div id="app"></div><script>%s</script></body></html>' % (
        title,
        fonts,
        css,
        fit,
        body,
        shim,
    )
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    with open(out, 'w', encoding='utf-8') as fh:
        fh.write(html)
