#!/usr/bin/env python3
"""
P-ACA 사용 설명서 PDF 생성기
"""

import re
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.lib.colors import HexColor, white, black
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak,
    Table, TableStyle, ListFlowable, ListItem, KeepTogether
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY

# 한글 폰트 등록
pdfmetrics.registerFont(TTFont('NanumGothic', '/usr/share/fonts/truetype/nanum/NanumGothic.ttf'))
pdfmetrics.registerFont(TTFont('NanumGothicBold', '/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf'))
pdfmetrics.registerFont(TTFont('NanumSquare', '/usr/share/fonts/truetype/nanum/NanumSquareR.ttf'))
pdfmetrics.registerFont(TTFont('NanumSquareBold', '/usr/share/fonts/truetype/nanum/NanumSquareB.ttf'))

# 색상 정의
PRIMARY_COLOR = HexColor('#1e3a5f')  # 진한 네이비
SECONDARY_COLOR = HexColor('#3b82f6')  # 파란색
ACCENT_COLOR = HexColor('#10b981')  # 초록색
LIGHT_BG = HexColor('#f8fafc')
BORDER_COLOR = HexColor('#e2e8f0')

def create_styles():
    """스타일 정의"""
    styles = {}

    # 제목 스타일
    styles['Title'] = ParagraphStyle(
        'Title',
        fontName='NanumSquareBold',
        fontSize=36,
        textColor=PRIMARY_COLOR,
        alignment=TA_CENTER,
        spaceAfter=20,
    )

    # 부제목 스타일
    styles['Subtitle'] = ParagraphStyle(
        'Subtitle',
        fontName='NanumGothic',
        fontSize=14,
        textColor=HexColor('#64748b'),
        alignment=TA_CENTER,
        spaceAfter=30,
    )

    # H1 스타일 (## 섹션)
    styles['Heading1'] = ParagraphStyle(
        'Heading1',
        fontName='NanumSquareBold',
        fontSize=22,
        textColor=PRIMARY_COLOR,
        spaceBefore=30,
        spaceAfter=15,
        borderPadding=(10, 10, 10, 10),
    )

    # H2 스타일 (### 서브섹션)
    styles['Heading2'] = ParagraphStyle(
        'Heading2',
        fontName='NanumSquareBold',
        fontSize=14,
        textColor=SECONDARY_COLOR,
        spaceBefore=25,
        spaceAfter=12,
        leading=22,
    )

    # 본문 스타일
    styles['Normal'] = ParagraphStyle(
        'Normal',
        fontName='NanumGothic',
        fontSize=10,
        textColor=black,
        spaceBefore=6,
        spaceAfter=6,
        leading=20,
    )

    # 강조 텍스트
    styles['Bold'] = ParagraphStyle(
        'Bold',
        fontName='NanumGothicBold',
        fontSize=10,
        textColor=black,
        spaceBefore=5,
        spaceAfter=5,
    )

    # 리스트 아이템
    styles['ListItem'] = ParagraphStyle(
        'ListItem',
        fontName='NanumGothic',
        fontSize=10,
        textColor=black,
        leftIndent=20,
        spaceBefore=4,
        spaceAfter=4,
        leading=18,
    )

    # 인용구/팁 박스
    styles['Tip'] = ParagraphStyle(
        'Tip',
        fontName='NanumGothic',
        fontSize=10,
        textColor=HexColor('#0369a1'),
        backColor=HexColor('#f0f9ff'),
        borderPadding=(10, 10, 10, 10),
        spaceBefore=10,
        spaceAfter=10,
        leftIndent=10,
        leading=18,
    )

    # 목차 스타일
    styles['TOC'] = ParagraphStyle(
        'TOC',
        fontName='NanumGothic',
        fontSize=11,
        textColor=PRIMARY_COLOR,
        spaceBefore=10,
        spaceAfter=10,
        leftIndent=10,
        leading=20,
    )

    # 페이지 헤더
    styles['Header'] = ParagraphStyle(
        'Header',
        fontName='NanumGothic',
        fontSize=9,
        textColor=HexColor('#94a3b8'),
    )

    # 코드/테이블 내용
    styles['Code'] = ParagraphStyle(
        'Code',
        fontName='NanumGothic',
        fontSize=9,
        textColor=HexColor('#374151'),
        backColor=LIGHT_BG,
        leftIndent=10,
        rightIndent=10,
        spaceBefore=5,
        spaceAfter=5,
    )

    return styles

def parse_markdown(md_content):
    """마크다운을 파싱하여 구조화된 데이터로 변환"""
    lines = md_content.split('\n')
    sections = []
    current_section = None
    current_subsection = None
    buffer = []
    in_table = False
    table_data = []
    in_code = False
    code_content = []

    for line in lines:
        # 코드 블록 처리
        if line.strip().startswith('```'):
            if in_code:
                in_code = False
                if code_content:
                    buffer.append({'type': 'code', 'content': '\n'.join(code_content)})
                code_content = []
            else:
                in_code = True
            continue

        if in_code:
            code_content.append(line)
            continue

        # H1 (# 제목) - 스킵 (타이틀용)
        if line.startswith('# ') and not line.startswith('## '):
            continue

        # H2 (## 섹션)
        if line.startswith('## '):
            # 이전 섹션 저장
            if current_section:
                if buffer:
                    if current_subsection:
                        current_subsection['content'] = buffer
                        current_section['subsections'].append(current_subsection)
                    else:
                        current_section['content'] = buffer
                sections.append(current_section)

            title = line[3:].strip()
            # 숫자와 제목 분리
            match = re.match(r'^(\d+)\.\s*(.+)$', title)
            if match:
                num, name = match.groups()
                current_section = {
                    'type': 'section',
                    'number': num,
                    'title': name,
                    'subsections': [],
                    'content': []
                }
            else:
                current_section = {
                    'type': 'section',
                    'number': '',
                    'title': title,
                    'subsections': [],
                    'content': []
                }
            current_subsection = None
            buffer = []
            continue

        # H3 (### 서브섹션)
        if line.startswith('### '):
            if buffer and current_section:
                if current_subsection:
                    current_subsection['content'] = buffer
                    current_section['subsections'].append(current_subsection)
                else:
                    current_section['content'] = buffer

            title = line[4:].strip()
            current_subsection = {
                'type': 'subsection',
                'title': title,
                'content': []
            }
            buffer = []
            continue

        # 테이블 처리
        if '|' in line and line.strip().startswith('|'):
            if not in_table:
                in_table = True
                table_data = []

            # 구분선 스킵
            if re.match(r'^\|[\s\-:|]+\|$', line.strip()):
                continue

            # 테이블 행 파싱
            cells = [cell.strip() for cell in line.split('|')[1:-1]]
            if cells:
                table_data.append(cells)
            continue
        elif in_table:
            in_table = False
            if table_data:
                buffer.append({'type': 'table', 'data': table_data})
            table_data = []

        # 인용구 (>)
        if line.strip().startswith('>'):
            text = line.strip()[1:].strip()
            if text.startswith('**'):
                text = text.replace('**', '')
            buffer.append({'type': 'tip', 'content': text})
            continue

        # 리스트 (- 또는 숫자.)
        if re.match(r'^\s*[-*]\s+', line) or re.match(r'^\s*\d+\.\s+', line):
            text = re.sub(r'^\s*[-*\d.]+\s+', '', line)
            indent = len(line) - len(line.lstrip())
            buffer.append({'type': 'list', 'content': text, 'indent': indent})
            continue

        # 일반 텍스트
        if line.strip() and not line.startswith('---'):
            buffer.append({'type': 'text', 'content': line.strip()})

    # 마지막 섹션 저장
    if current_section:
        if buffer:
            if current_subsection:
                current_subsection['content'] = buffer
                current_section['subsections'].append(current_subsection)
            else:
                current_section['content'] = buffer
        sections.append(current_section)

    return sections

def create_cover_page(styles):
    """표지 페이지 생성"""
    elements = []

    elements.append(Spacer(1, 6*cm))

    # 로고/아이콘 대신 텍스트
    logo_style = ParagraphStyle(
        'Logo',
        fontName='NanumSquareBold',
        fontSize=48,
        textColor=PRIMARY_COLOR,
        alignment=TA_CENTER,
        leading=60,
        spaceAfter=40,
    )
    elements.append(Paragraph("P-ACA", logo_style))

    # 메인 타이틀
    title_style = ParagraphStyle(
        'CoverTitle',
        fontName='NanumSquareBold',
        fontSize=32,
        textColor=PRIMARY_COLOR,
        alignment=TA_CENTER,
        leading=45,
        spaceAfter=25,
    )
    elements.append(Paragraph("사용 설명서", title_style))

    # 부제목
    subtitle_style = ParagraphStyle(
        'CoverSubtitle',
        fontName='NanumGothic',
        fontSize=14,
        textColor=HexColor('#64748b'),
        alignment=TA_CENTER,
        leading=22,
        spaceAfter=80,
    )
    elements.append(Paragraph("체육입시 학원관리 시스템", subtitle_style))

    # 버전 정보
    version_style = ParagraphStyle(
        'Version',
        fontName='NanumGothic',
        fontSize=11,
        textColor=HexColor('#64748b'),
        alignment=TA_CENTER,
        leading=18,
        spaceAfter=10,
    )
    elements.append(Paragraph("버전 3.3.26", version_style))
    elements.append(Paragraph("2026년 1월", version_style))

    elements.append(PageBreak())

    return elements

def create_toc(sections, styles):
    """목차 페이지 생성"""
    elements = []

    toc_title = ParagraphStyle(
        'TOCTitle',
        fontName='NanumSquareBold',
        fontSize=24,
        textColor=PRIMARY_COLOR,
        alignment=TA_LEFT,
        spaceAfter=30,
    )
    elements.append(Paragraph("목차", toc_title))
    elements.append(Spacer(1, 0.5*cm))

    for section in sections:
        if section['number']:
            text = f"{section['number']}. {section['title']}"
        else:
            text = section['title']
        elements.append(Paragraph(text, styles['TOC']))

    elements.append(PageBreak())

    return elements

def format_text(text, styles):
    """텍스트 포맷팅 (볼드, 이탤릭 처리)"""
    # **text** -> <b>text</b>
    text = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', text)
    # `code` -> <font color="#dc2626">code</font>
    text = re.sub(r'`(.+?)`', r'<font color="#dc2626">\1</font>', text)
    # ✓ ✅ 등 이모지 처리
    return text

def create_content(sections, styles):
    """본문 내용 생성"""
    elements = []

    for idx, section in enumerate(sections):
        # 각 섹션 시작 시 새 페이지 (첫 섹션 제외 - 목차 다음이므로)
        if idx > 0:
            elements.append(PageBreak())

        # 섹션 제목
        if section['number']:
            title = f"{section['number']}. {section['title']}"
        else:
            title = section['title']

        # 섹션 헤더 박스
        section_style = ParagraphStyle(
            'SectionHeader',
            fontName='NanumSquareBold',
            fontSize=18,
            textColor=white,
            backColor=PRIMARY_COLOR,
            borderPadding=(15, 15, 15, 15),
            spaceBefore=20,
            spaceAfter=20,
            leading=26,
        )
        elements.append(Paragraph(title, section_style))

        # 섹션 본문
        for item in section.get('content', []):
            elements.extend(render_item(item, styles))

        # 서브섹션
        for subsection in section.get('subsections', []):
            elements.append(Spacer(1, 0.3*cm))
            elements.append(Paragraph(subsection['title'], styles['Heading2']))

            for item in subsection.get('content', []):
                elements.extend(render_item(item, styles))

        elements.append(Spacer(1, 0.5*cm))

    return elements

def render_item(item, styles):
    """개별 항목 렌더링"""
    elements = []

    if item['type'] == 'text':
        text = format_text(item['content'], styles)
        elements.append(Paragraph(text, styles['Normal']))

    elif item['type'] == 'list':
        text = format_text(item['content'], styles)
        indent = item.get('indent', 0)
        list_style = ParagraphStyle(
            'ListItem',
            fontName='NanumGothic',
            fontSize=10,
            textColor=black,
            leftIndent=20 + (indent * 10),
            spaceBefore=4,
            spaceAfter=4,
            bulletIndent=10 + (indent * 10),
            leading=18,
        )
        elements.append(Paragraph(f"• {text}", list_style))

    elif item['type'] == 'tip':
        tip_style = ParagraphStyle(
            'TipBox',
            fontName='NanumGothic',
            fontSize=10,
            textColor=HexColor('#0369a1'),
            backColor=HexColor('#f0f9ff'),
            borderPadding=(10, 10, 10, 10),
            spaceBefore=10,
            spaceAfter=10,
            leftIndent=5,
            rightIndent=5,
            leading=16,
        )
        text = format_text(item['content'], styles)
        elements.append(Paragraph(f"💡 {text}", tip_style))

    elif item['type'] == 'table':
        table_data = item['data']
        if table_data:
            # 테이블 스타일
            table = Table(table_data, repeatRows=1)
            table.setStyle(TableStyle([
                # 헤더 스타일
                ('BACKGROUND', (0, 0), (-1, 0), PRIMARY_COLOR),
                ('TEXTCOLOR', (0, 0), (-1, 0), white),
                ('FONTNAME', (0, 0), (-1, 0), 'NanumGothicBold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
                ('TOPPADDING', (0, 0), (-1, 0), 10),

                # 본문 스타일
                ('FONTNAME', (0, 1), (-1, -1), 'NanumGothic'),
                ('FONTSIZE', (0, 1), (-1, -1), 9),
                ('ALIGN', (0, 1), (-1, -1), 'LEFT'),
                ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
                ('TOPPADDING', (0, 1), (-1, -1), 8),
                ('LEFTPADDING', (0, 0), (-1, -1), 10),
                ('RIGHTPADDING', (0, 0), (-1, -1), 10),

                # 테두리
                ('GRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),

                # 줄무늬 배경
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, LIGHT_BG]),
            ]))
            elements.append(Spacer(1, 0.2*cm))
            elements.append(table)
            elements.append(Spacer(1, 0.2*cm))

    elif item['type'] == 'code':
        code_style = ParagraphStyle(
            'CodeBlock',
            fontName='NanumGothic',
            fontSize=9,
            textColor=HexColor('#374151'),
            backColor=HexColor('#f1f5f9'),
            borderPadding=(10, 10, 10, 10),
            spaceBefore=10,
            spaceAfter=10,
            leftIndent=5,
            rightIndent=5,
            leading=14,
        )
        # 줄바꿈 보존
        content = item['content'].replace('\n', '<br/>')
        elements.append(Paragraph(content, code_style))

    return elements

def add_page_number(canvas, doc):
    """페이지 번호 추가"""
    canvas.saveState()

    # 페이지 번호
    page_num = canvas.getPageNumber()
    if page_num > 2:  # 표지와 목차 제외
        text = f"- {page_num - 2} -"
        canvas.setFont('NanumGothic', 9)
        canvas.setFillColor(HexColor('#94a3b8'))
        canvas.drawCentredString(A4[0]/2, 1.5*cm, text)

    # 헤더
    if page_num > 2:
        canvas.setFont('NanumGothic', 8)
        canvas.setFillColor(HexColor('#94a3b8'))
        canvas.drawString(2*cm, A4[1] - 1.5*cm, "P-ACA 사용 설명서")
        canvas.drawRightString(A4[0] - 2*cm, A4[1] - 1.5*cm, "v3.3.26")

        # 헤더 라인
        canvas.setStrokeColor(BORDER_COLOR)
        canvas.setLineWidth(0.5)
        canvas.line(2*cm, A4[1] - 1.7*cm, A4[0] - 2*cm, A4[1] - 1.7*cm)

    canvas.restoreState()

def generate_pdf(md_file, output_file):
    """PDF 생성"""
    # 마크다운 파일 읽기
    with open(md_file, 'r', encoding='utf-8') as f:
        md_content = f.read()

    # 마크다운 파싱
    sections = parse_markdown(md_content)

    # 스타일 생성
    styles = create_styles()

    # PDF 문서 생성
    doc = SimpleDocTemplate(
        output_file,
        pagesize=A4,
        leftMargin=2*cm,
        rightMargin=2*cm,
        topMargin=2.5*cm,
        bottomMargin=2*cm,
    )

    # 전체 요소 구성
    elements = []

    # 1. 표지
    elements.extend(create_cover_page(styles))

    # 2. 목차
    elements.extend(create_toc(sections, styles))

    # 3. 본문
    elements.extend(create_content(sections, styles))

    # PDF 빌드
    doc.build(elements, onFirstPage=add_page_number, onLaterPages=add_page_number)

    print(f"✅ PDF 생성 완료: {output_file}")

if __name__ == '__main__':
    import os
    script_dir = os.path.dirname(os.path.abspath(__file__))
    md_file = os.path.join(script_dir, 'USER-MANUAL.md')
    output_file = os.path.join(script_dir, 'P-ACA_사용설명서.pdf')

    generate_pdf(md_file, output_file)
