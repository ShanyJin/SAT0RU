import sys

src, dst, driver_path = sys.argv[1], sys.argv[2], sys.argv[3]
html = open(src, encoding='utf-8').read()

alert = """<script>
window.__errs = [];
window.alert = function (m) { console.warn('ALERT', m); };
window.addEventListener('error', function (e) { window.__errs.push(e.message || e.type); });
window.addEventListener('unhandledrejection', function (e) { window.__errs.push(String(e.reason)); });
</script>
"""
assert '<head>' in html
html = html.replace('<head>', '<head>\n' + alert, 1)

driver = open(driver_path, encoding='utf-8').read()
anchor = "        composer.setSize(window.innerWidth, window.innerHeight);\n    });\n</script>"
assert anchor in html, 'anchor not found'
html = html.replace(anchor, "        composer.setSize(window.innerWidth, window.innerHeight);\n    });\n\n" + driver + "\n</script>", 1)

open(dst, 'w', encoding='utf-8').write(html)
print('written', dst, len(html), 'bytes')