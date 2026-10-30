#!/usr/bin/env python3
"""Reuse the approved HTML snapshot unchanged visually, and bundle the actual intake client."""
from pathlib import Path
import argparse
import json
import re

parser = argparse.ArgumentParser()
parser.add_argument('--template', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
source = Path(__file__).parent
html = args.template.read_text()
if '<script' in html.lower() or 'id="admission-name"' not in html:
    raise SystemExit('Expected the script-free, approved parent form snapshot')
# Remove Next-specific links: the download must not depend on a local HTTP origin.
html = re.sub(r'<link\b[^>]*>', '', html, flags=re.I)
html = re.sub(r'<next-route-announcer\b[^>]*>.*?</next-route-announcer>', '', html, flags=re.S)
html = re.sub(r'<section aria-label="Notifications.*?</section>', '', html, flags=re.S)
html = re.sub(r' autocomplete="[^"]*"', '', html)
html = html.replace('<form class=', '<form autocomplete="off" method="post" class=')
html = html.replace('type="submit">', 'type="submit" disabled>')
# CSS is an embedded generated asset; maintained behavior stays in standalone-client.js.
html = re.sub(r'<style>(.*?)</style>', lambda m: '<style>' + re.sub(r'\s+', ' ', m[1]) + '</style>', html, flags=re.S)
html = re.sub(r'<title>.*?</title>', '', html, flags=re.S)
html = html.replace('<head>', '<head><title>일산 맥스 입학원서 · 접수용</title><meta name="referrer" content="no-referrer">')
status = '''<section class="rounded-lg border border-border bg-card p-4 text-sm space-y-3" aria-label="접수 연결 상태">
<p id="connection-status" role="status">연결 확인 전에는 원서가 저장되지 않습니다.</p>
<button id="connection-retry" type="button" class="rounded-md border border-input px-4 py-2">연결 다시 확인</button>
<noscript>접수하려면 이 파일을 JavaScript를 지원하는 웹 브라우저에서 열어 주세요. 파일 미리보기에서는 제출할 수 없습니다.</noscript></section>
<section id="admission-success" hidden tabindex="-1" class="rounded-lg border border-border bg-card p-5 space-y-4" role="status">
<h2 class="text-xl font-semibold">입학원서를 접수했습니다</h2>
<p>담당자가 등록일과 첫 달 학원비를 확인한 뒤 승인합니다. 원서 제출만으로 결제되거나 바로 재원 등록되지 않습니다.</p>
<p id="admission-receipt" class="break-all text-sm"></p>
<button id="admission-next" type="button" class="rounded-md border border-input px-4 py-3">다음 학생 원서 작성</button></section>
'''
html = html.replace('<form ', status + '<form ', 1)
html = html.replace('</form>', '<p id="admission-error" role="alert" class="text-sm text-destructive"></p></form>', 1)
config = json.loads((source / 'standalone-config.json').read_text())
script = '<script>window.ILSAN_ADMISSION_CONFIG=' + json.dumps(config, ensure_ascii=False) + ';</script>\n'
script += '<script>\n' + (source / 'standalone-client.js').read_text() + '\n</script>'
html = html.replace('</body>', script + '</body>')
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(html)
print(json.dumps({'output':str(args.output),'bytes':args.output.stat().st_size,'lines':len(html.splitlines())}, ensure_ascii=False))
