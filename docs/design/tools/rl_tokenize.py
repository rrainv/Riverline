import re, sys, json
src=open('Main.before.dc.html').read()
m=re.search(r'<style>(.*?)</style>',src,re.S); css=m.group(1)
pre=src[:m.start(1)]; post=src[m.end(1):]
# ---------- 1. CSS ----------
css=re.sub(r'\.root\.light[^{}]*\{[^{}]*\}','',css)          # ad-hoc light patches go; tokens replace them
css=re.sub(r'(?<=[}\s])\s*\.root\.light[^{}]*(?=\.root\.light|\{)','',css)
def whitea(a):
    a=float(a); return 'var(--tint)' if a<=.07 else 'var(--line)' if a<=.14 else 'var(--line2)' if a<=.26 else 'var(--line3)'
OVER=r'rgba\((?:8,20,15|12,26,20|14,30,23),\.\d+\)'
def fix(sel,prop,val):
    s=sel.strip(); v=val
    if s=='.root' or s.startswith('.root{'): return v
    if prop=='color':
        if s.endswith('.pc'): return 'var(--card-ink)'
        if s.endswith('.pc.red'): return 'var(--card-red)'
        if '.seatd .disc b' in s: return 'var(--seat-text)'
        if s in('.seatd .disc','.disc2') and 'accent' in v: return 'var(--seat-ink)'
        if '.sub' in s and '#cfe0d4' in v: return 'var(--overlay-ink2)'
        if v in('#f2f5f1','#e6efe8') : return 'var(--overlay-ink)'
        if v=='var(--accent)': return 'var(--accent-text)'
        if v=='var(--brass)': return 'var(--brass-text)'
        if v=='var(--over)': return 'var(--over-text)'
        if v=='#e08a7a': return 'var(--danger)'
    if prop in('background','background-color'):
        if 'radial-gradient(circle at 34% 28%,#34453c' in v: return 'var(--seat-bg)'
        if 'radial-gradient(ellipse at 50% 30%,#34805f' in v: return 'var(--felt)'
        if s=='.pill': return 'var(--pill-bg)'
        if s=='.dock': return 'var(--dock-bg)'
        if s=='.root:before': return v.replace('rgba(255,226,160,.15)','var(--root-glow)')
        if s=='.sharecard': return v
        if re.fullmatch(OVER,v): return 'var(--overlay-bg)'
        if re.fullmatch(r'rgba\(224,191,106,\.0\d\)',v): return 'var(--sel-bg)'
        if re.fullmatch(r'rgba\(224,138,122,\.\d+\)',v): return 'var(--danger-bg)'
        if re.fullmatch(r'rgba\(0,0,0,\.\d+\)',v): return 'var(--well)'
        if v in('#e08a7a',): return 'var(--danger)'
        if v=='#d08a52': return 'var(--over)'
    if prop=='box-shadow':
        v=v.replace('#bfa965','var(--felt-rim)').replace('#6a5a2c','var(--felt-rim2)').replace('#b9a777','var(--felt-rim)').replace('#6f6447','var(--felt-rim2)')
        if s.endswith('.pc.bk'): v=v.replace('0 2px 6px rgba(0,0,0,.28)','var(--elev-1)')
        if '.disc' in s: v=v.replace('rgba(0,0,0,.18)','var(--seat-ring)')
        v=re.sub(r'0 (?:8|10|5|6)px (?:16|20|10)px rgba\(0,0,0,\.\d+\)',lambda mm:'var(--elev-1)' if mm.group(0).startswith('0 5px') else 'var(--elev-2)',v)
        v=re.sub(r'0 (?:10|14)px (?:24|34)px rgba\(0,0,0,\.\d+\)','var(--elev-3)',v)
        v=re.sub(r'0 (?:18|22|24)px (?:36|40|46|50|60)px rgba\(0,0,0,\.\d+\)','var(--elev-4)',v)
        if s in('.bub','.abub') or 'tipx' in s: v=re.sub(r'var\(--elev-\d\)','var(--overlay-shadow)',v)
    if prop=='text-shadow' and 'rgba(0,0,0' in v: return 'none'
    if prop.startswith('border') or prop=='outline':
        v=v.replace('#e08a7a','var(--danger)').replace('#0b1511','var(--bg)')
        if s in('.seatd .disc','.disc2'): v=re.sub(r'rgba\(255,255,255,\.\d+\)','var(--seat-line)',v)
        if s in('.seat2','.seatd .tag','.abub') : v=re.sub(r'rgba\(255,255,255,\.\d+\)|var\(--line2\)','var(--overlay-line)',v)
    v=re.sub(r'rgba\(255,255,255,(\.\d+)\)',lambda mm:whitea(mm.group(1)),v)
    return v
def rule(mm):
    sel,body=mm.group(1),mm.group(2); out=[]
    for d in body.split(';'):
        if ':' not in d: out.append(d); continue
        p,v=d.split(':',1); out.append(p+':'+fix(sel,p.strip(),v.strip()))
    return sel+'{'+';'.join(out)+'}'
css=re.sub(r'([^{}]+)\{([^{}]*)\}',rule,css)
DARK = """--well:rgba(0,0,0,.22);--tint:rgba(255,255,255,.03);--line3:rgba(255,255,255,.3);--overlay-bg:rgba(8,20,15,.94);--overlay-line:rgba(255,255,255,.16);--overlay-ink:#f2f5f1;--overlay-ink2:#cfe0d4;--overlay-shadow:0 6px 16px rgba(0,0,0,.45);--dock-bg:rgba(10,24,18,.72);--pill-bg:rgba(10,24,18,.6);--scrim:rgba(3,10,7,.62);--root-glow:rgba(255,226,160,.15);--seg-gap:rgba(8,16,12,.55);
 --seat-bg:radial-gradient(circle at 34% 28%,#34453c,#121b17 72%);--seat-line:rgba(255,255,255,.18);--seat-ink:var(--accent);--seat-text:#f2f5f1;--seat-ring:rgba(0,0,0,.18);--on-felt:#ffffff;--on-felt2:#e9f3ec;
 --accent-text:var(--accent);--brass-text:var(--brass);--sel-bg:color-mix(in srgb,var(--accent) 10%,transparent);--ok:#42ad7b;--danger:#e08a7a;--danger-bg:rgba(224,138,122,.1);--over-text:#eeaa78;--under-text:#8ed0db;--ok-text:#6fd1a2;
 --card-ink:#1a1f1c;--card-red:#c2412f;--pcshadow:0 2px 6px rgba(0,0,0,.28);--felt-rim:#bfa965;--felt-rim2:#6a5a2c;
 --elev-1:0 2px 6px rgba(0,0,0,.28);--elev-2:0 8px 16px rgba(0,0,0,.45);--elev-3:0 14px 34px rgba(0,0,0,.45);--elev-4:0 24px 50px rgba(0,0,0,.5);
 --dur-1:120ms;--dur-2:200ms;--dur-3:320ms;--dur-4:520ms;--ease-out:cubic-bezier(.23,1,.32,1);--ease-inout:cubic-bezier(.65,0,.35,1);--ease-spring:cubic-bezier(.34,1.36,.64,1);--ease-exit:cubic-bezier(.55,0,.8,.4);"""
assert '.root{--bg:' in css
css=css.replace('.root{--bg:','.root{'+DARK+'--bg:',1)
css=css.replace('--text3:#9aa9a0','--text3:#a6b4ab',1)
css=re.sub(r'--felt:radial-gradient\([^;]*?\);','--felt:radial-gradient(ellipse at 50% 30%,#2f7657 0%,#215641 55%,#17382a 100%);',css,1)
css+="""
.sharecard{--text:#f2f5f1;--text2:#c6cec8;--text3:#a6b4ab;--line:rgba(255,255,255,.1);--line2:rgba(255,255,255,.22);--over-text:#eeaa78;--accent-text:#e0bf6a;color:var(--text)}
.hcell.on .t3,.pcell.set .t3,.svrow.on .t3,.lnode.on .t3,.tk.on .kbd{color:var(--text2)}
.pal-list{max-height:520px;overflow-y:auto}
.lad .steps{position:absolute;top:8px;right:8px;padding:0;flex-direction:column;gap:4px} .lad .steps button{width:24px;height:22px;flex:none;line-height:1}
"""
# ---------- 2. markup ----------
body_m=re.search(r'</helmet>\s*(.*?)\s*</x-dc>',post,re.S); body=body_m.group(1)
def st(mm):
    v=mm.group(1)
    v=v.replace('color:#d6e5da','color:var(--on-felt2)')
    v=re.sub(r'(?<![-a-z])color:#fff\b','color:var(--on-felt)',v)
    v=re.sub(r'(?<![-a-z])color:#f2f5f1','color:var(--on-felt)',v)
    v=v.replace('background:radial-gradient(ellipse at 50% 30%,#34805f,#1f5740 60%,#143a2b)','background:var(--felt)')
    v=v.replace('#bfa965','var(--felt-rim)').replace('#6a5a2c','var(--felt-rim2)')
    v=re.sub(r'0 \d+px \d+px rgba\(0,0,0,\.\d+\)','var(--elev-4)',v) if 'felt-rim' in v else v
    v=v.replace('rgba(8,16,12,.55)','var(--seg-gap)').replace('background:rgba(0,0,0,.22)','background:var(--well)').replace('background:rgba(0,0,0,.2)','background:var(--well)')
    v=v.replace('border-color:#a85f70','border-color:var(--danger)').replace('background:rgba(168,95,112,.07)','background:var(--danger-bg)').replace('color:#e8a0b0','color:var(--danger)')
    v=v.replace('1px dashed rgba(255,255,255,.4)','1px dashed var(--line3)').replace('border-color:rgba(0,0,0,.3)','border-color:var(--line2)')
    v=v.replace('border-color:#d08a52','border-color:var(--over)').replace('color:#eeaa78','color:var(--over-text)').replace('background:#d08a52','background:var(--over)')
    v=v.replace('background:rgba(3,10,7,.62)','background:var(--scrim)').replace('background:rgba(12,26,20,.92)','background:var(--overlay-bg)').replace('background:rgba(14,30,23,.95)','background:var(--overlay-bg)')
    v=re.sub(r'(?<![-a-z])color:var\(--accent\)','color:var(--accent-text)',v); v=re.sub(r'(?<![-a-z])color:var\(--brass\)','color:var(--brass-text)',v); v=re.sub(r'(?<![-a-z])color:var\(--over\)','color:var(--over-text)',v)
    v=re.sub(r'rgba\(255,255,255,(\.\d+)\)',lambda q:whitea(q.group(1)),v)
    return 'style="'+v+'"'
body=re.sub(r'style="([^"]*)"',st,body)
body=body.replace('<div style="padding-top:8px"><sc-for list="{{ palItems }}"','<div class="pal-list" style="padding-top:8px"><sc-for list="{{ palItems }}"')
assert 'pal-list' in body
post=post[:body_m.start(1)]+body+post[body_m.end(1):]
# ---------- 3. logic ----------
sm=re.search(r'(<script type="text/x-dc"[^>]*>)(.*?)(</script>)',post,re.S); js=sm.group(2)
a=js.index('const TM = {'); b=js.index('const cu0 = s.cust;'); c=js.index('const tm = {')
head,tmblock,mid,tail=js[:a],js[a:b],js[b:c],js[c:]
def jsfix(t):
    t=re.sub(r"rgba\(255,255,255,(\.\d+)\)",lambda q:whitea(q.group(1)),t)
    t=t.replace("'#e08a7a'","'var(--danger)'").replace("'#42ad7b'","'var(--ok)'").replace("'#5aa3b0'","'var(--under)'")
    t=re.sub(r"(color[^,;]{0,60}?)'#d08a52'",r"\1'var(--over-text)'",t).replace("'#d08a52'","'var(--over)'")
    t=re.sub(r"(olor[A-Za-z]*: [^,;]{0,80}?)'var\(--accent\)'",r"\1'var(--accent-text)'",t)
    t=t.replace("rgba(0,0,0,.22)","var(--well)")
    return t
head=jsfix(head); tail=jsfix(tail)
LIGHTFN = r"""const mixk = (hex, k) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0')).join('');
    const lightVars = (o) => { const k = o.ink; return '--root-bg:linear-gradient(180deg,' + o.bg0 + ',' + o.bg1 + ');--root-glow:transparent;--panel-bg:' + o.panel + ';--panel-border:1px solid rgba(' + k + ',.12);--shadow:0 1px 2px rgba(' + k + ',.05),0 10px 28px rgba(' + k + ',.08);--bg:' + o.bg0 + ';--text:' + o.text + ';--text2:' + o.text2 + ';--text3:' + o.text3 + ';--line:rgba(' + k + ',.10);--line2:rgba(' + k + ',.24);--line3:rgba(' + k + ',.42);--hover:rgba(' + k + ',.055);--track:rgba(' + k + ',.10);--well:rgba(' + k + ',.045);--tint:rgba(' + k + ',.02);--overlay-bg:#ffffff;--overlay-line:rgba(' + k + ',.2);--overlay-ink:' + o.text + ';--overlay-ink2:' + o.text2 + ';--overlay-shadow:0 6px 18px rgba(' + k + ',.2);--dock-bg:rgba(255,255,255,.93);--pill-bg:#ffffff;--scrim:rgba(' + k + ',.38);--seg-gap:rgba(255,255,255,.92);--seat-bg:radial-gradient(circle at 34% 28%,#ffffff,#e3eae5 72%);--seat-line:rgba(' + k + ',.26);--seat-ink:' + o.seatInk + ';--seat-text:' + o.text + ';--seat-ring:rgba(255,255,255,.32);--brass:#c59b36;--brass-text:#7a5a12;--ok:#2f9a68;--danger:#b42318;--danger-bg:rgba(180,35,24,.07);--over-text:#9a4a12;--under-text:#17697a;--ok-text:#1b7347;--pcshadow:0 0 0 1px rgba(' + k + ',.18),0 2px 5px rgba(' + k + ',.16);--elev-1:0 1px 3px rgba(' + k + ',.16);--elev-2:0 4px 12px rgba(' + k + ',.18);--elev-3:0 10px 28px rgba(' + k + ',.16);--elev-4:0 18px 40px rgba(' + k + ',.22);'; };
    """
tmblock=tmblock.replace("const TM = {",LIGHTFN+"const TM = {",1)
tmblock=re.sub(r"daylight: \{.*?\} \};", "daylight: { name: 'Daylight', bg: '#f3f6f3', panel: '#ffffff', text: '#0f1713', text2: '#3a4740', acc: '#1f7350', light: true, vars: lightVars({ bg0: '#f4f7f4', bg1: '#e6ede8', panel: '#ffffff', text: '#0f1713', text2: '#3a4740', text3: '#5a685f', ink: '16,40,28', seatInk: '#1f6a46' }) },\n      paper: { name: 'Paper', bg: '#f5f0e6', panel: '#fdfaf3', text: '#231d12', text2: '#4d4433', acc: '#7a5a12', light: true, vars: lightVars({ bg0: '#f6f1e7', bg1: '#ece4d3', panel: '#fdfaf3', text: '#231d12', text2: '#4d4433', text3: '#6b604a', ink: '48,36,12', seatInk: '#6b4e0f' }) } };", tmblock, flags=re.S)
assert 'paper:' in tmblock
mid=re.sub(r"const tmBase = s\.th === 'custom' \? \{.*?\} : TM\[s\.th\];", "const cuLight = lumx(cu0.bg) > 0.4;\n    const tmBase = s.th === 'custom' ? { name: 'Custom', bg: cu0.bg, panel: cu0.panel, text: cu0.text, text2: cu0.text, acc: cu0.accent, light: cuLight, vars: cuLight ? lightVars({ bg0: cu0.bg, bg1: mixk(cu0.bg, 0.94), panel: cu0.panel, text: cu0.text, text2: mixk(cu0.text, 1), text3: cu0.text, ink: '16,40,28', seatInk: mixk(cu0.accent, 0.7) }) : '--root-bg:radial-gradient(ellipse 85% 75% at 50% 36%,color-mix(in srgb,' + cu0.bg + ' 78%,#ffffff 22%) 0%,' + cu0.bg + ' 100%);--panel-bg:color-mix(in srgb,' + cu0.panel + ' 86%,transparent);--bg:' + cu0.bg + ';--text:' + cu0.text + ';--text2:color-mix(in srgb,' + cu0.text + ' 78%,' + cu0.bg + ');--text3:color-mix(in srgb,' + cu0.text + ' 62%,' + cu0.bg + ');' } : TM[s.th];", mid, flags=re.S)
assert 'cuLight' in mid
# lumx must exist before use: move its definition up
lx=re.search(r"const lumx = \(hex\) => \{.*?\};\n",mid,re.S); assert lx
mid=mid.replace(lx.group(0),'',1); tmblock=lx.group(0).strip()+"\n    "+tmblock
mid=mid.replace("';--accent-ink:' + (lumx(accNow) > 0.4 ? '#07120d' : '#ffffff') + ';'","';--accent-ink:' + (lumx(accNow) > 0.36 ? '#07120d' : '#ffffff') + ';--accent-text:' + ((tmBase.light && lumx(accNow) > 0.2) ? mixk(accNow, lumx(accNow) > 0.5 ? 0.45 : 0.6) : (!tmBase.light && lumx(accNow) < 0.12 ? '#ffffff' : accNow)) + ';' + (tmBase.light ? '--sel-bg:color-mix(in srgb,' + accNow + ' 12%,transparent);' : '')")
assert '--accent-text:' in mid
# theme-aware data palette
pm=re.search(r'P = \{"over".*?\}, LEAK',head,re.S); assert pm
head=head.replace(', LEAK = ',', LEAK = ',1)
i=head.index('const SUIT ='); 
head=head[:i]+"const isLightTheme = s.th === 'daylight' || s.th === 'paper' || (s.th === 'custom' && s.cust && parseInt(s.cust.bg.slice(1, 3), 16) + parseInt(s.cust.bg.slice(3, 5), 16) + parseInt(s.cust.bg.slice(5, 7), 16) > 420);\n    if (isLightTheme) Object.assign(P, { heatText: '#0f1713', neutral: 'rgba(16,40,28,.07)', ring: '#0f1713', redSuit: '#b3261e', blackSuit: '#232b26', overText: '#9a4a12', underText: '#17697a', upText: '#1b7347', downText: '#9a4a12', textc: '#0f1713' });\n    "+head[i:]
head=head.replace("const P = {","const P = {") 
js=head+tmblock+mid+tail
# small layout fixes found by the audit
js=js.replace("const dlogRows = s.dlog.length ? s.dlog :","const dlogRows = s.dlog.length ? s.dlog.slice(-4) :")
post=post[:sm.start(2)]+js+post[sm.end(2):]
post=post.replace('padding:6px 0;border-top:1px solid var(--line);font-size:13.5px"><i class="ldot {{ f.dot }}"></i>','padding:3px 0;border-top:1px solid var(--line);font-size:13px"><i class="ldot {{ f.dot }}"></i>')
out=pre+css+post
open('Main.tok.dc.html','w').write(out)
left=re.findall(r'#[0-9a-fA-F]{6}\b|rgba?\([^)]*\)',re.sub(r'\.root\{.*?\n background','',css,flags=re.S))
import collections; print('css colours left:',collections.Counter(left).most_common(40))
print('root.light left:',out.count('.root.light'),'| P is const obj:', 'P = {"over"' in out)
