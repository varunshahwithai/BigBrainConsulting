import sys
import os; d=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','src')+'/';suf=sys.argv[1] if len(sys.argv)>1 else ''
m={'ui.js':'ui.bak3','opsui.js':'opsui.bak5','head.html':'head.bak3','opshead.html':'opshead.bak'} if suf=='old' else {}
r=lambda f:open(d+m.get(f,f)).read()
h=r('head.html');a=h.index('\n  <div id="ops" hidden>');b=h.index('\n  <footer>')
h=h[:a]+'\n'+r('opshead.html')+h[b:]
import re
strip=lambda t:'\n'.join(l for l in t.split('\n') if not l.startswith('if(typeof module!=="undefined")module.exports'))
js=''.join((lambda t:t if t.endswith('\n') else t+'\n')(strip(r(f))) for f in ['engine.js','ui.js','ai.js','tour.js','opsengine.js','opsui.js','opsai.js','opstour.js'])
out=h.rstrip('\n')+'\n<script>\n'+js+'</script>'
open(sys.argv[2] if len(sys.argv)>2 else os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','index.html'),'w').write(out)
