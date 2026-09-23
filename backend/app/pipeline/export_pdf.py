import io
from datetime import datetime, timezone
from typing import List, Dict, Any
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle


def generate_request_list_pdf(escalated_records: List[Dict[str, Any]], total_turnover_kzt: float) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(letter),
        leftMargin=30,
        rightMargin=30,
        topMargin=30,
        bottomMargin=30
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontSize=16,
        leading=20,
        textColor=colors.HexColor('#0f172a'),
        fontName='Helvetica-Bold'
    )
    meta_style = ParagraphStyle(
        'MetaStyle',
        parent=styles['Normal'],
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#475569'),
        fontName='Helvetica'
    )
    disclaimer_style = ParagraphStyle(
        'DisclaimerStyle',
        parent=styles['Normal'],
        fontSize=8,
        leading=11,
        textColor=colors.HexColor('#991b1b'),
        fontName='Helvetica-Bold'
    )
    cell_style = ParagraphStyle(
        'CellStyle',
        parent=styles['Normal'],
        fontSize=8,
        leading=10,
        textColor=colors.HexColor('#1e293b'),
        fontName='Helvetica'
    )
    header_cell_style = ParagraphStyle(
        'HeaderCellStyle',
        parent=styles['Normal'],
        fontSize=8,
        leading=10,
        textColor=colors.HexColor('#ffffff'),
        fontName='Helvetica-Bold'
    )

    elements = []

    # Title & Header
    elements.append(Paragraph("FREEDOM BANK AML INVESTIGATION — LAW ENFORCEMENT REQUEST LIST", title_style))
    elements.append(Spacer(1, 6))

    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    meta_text = (
        f"<b>Generated At:</b> {now_str} &nbsp;|&nbsp; "
        f"<b>Escalated Accounts:</b> {len(escalated_records)} &nbsp;|&nbsp; "
        f"<b>Total Export Turnover:</b> {total_turnover_kzt:,.0f} KZT"
    )
    elements.append(Paragraph(meta_text, meta_style))
    elements.append(Spacer(1, 8))

    # Mandatory Legal / Regulatory Disclaimer (Zero guilt assertions)
    disclaimer_text = (
        "<b>LEGAL NOTICE / ДИСКЛЕЙМЕР:</b> All findings, topologies, and priority classifications represent "
        "analytical hypotheses for targeted verification and audit by authorized oversight bodies. "
        "They do not constitute a statement or determination of guilt or criminal culpability. "
        "(Выводы представляют собой аналитические гипотезы для проверки уполномоченными органами, а не утверждение о виновности)."
    )
    disclaimer_table = Table(
        [[Paragraph(disclaimer_text, disclaimer_style)]],
        colWidths=[732]
    )
    disclaimer_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#fef2f2')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#f87171')),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(disclaimer_table)
    elements.append(Spacer(1, 12))

    # Table columns: GID, Role, Priority, Cluster, Evidence, Cluster Hypothesis
    col_widths = [110, 65, 45, 45, 235, 232]
    table_data = [
        [
            Paragraph("<b>GID</b>", header_cell_style),
            Paragraph("<b>Role</b>", header_cell_style),
            Paragraph("<b>Priority</b>", header_cell_style),
            Paragraph("<b>Cluster</b>", header_cell_style),
            Paragraph("<b>Evidence & Flow Topology</b>", header_cell_style),
            Paragraph("<b>Cluster Hypothesis</b>", header_cell_style),
        ]
    ]

    for rec in escalated_records:
        gid = str(rec.get("gid", ""))
        role = str(rec.get("role", "")).upper()
        p_score = f"{float(rec.get('priority_score', 0.0)):.3f}"
        c_id = str(rec.get("cluster_id", "-"))
        evidence = str(rec.get("evidence", ""))
        hypothesis = str(rec.get("cluster_hypothesis", ""))
        note = rec.get("note")
        if note:
            evidence = f"{evidence}<br/><b>Analyst Note:</b> {note}"

        table_data.append([
            Paragraph(gid, cell_style),
            Paragraph(role, cell_style),
            Paragraph(p_score, cell_style),
            Paragraph(c_id, cell_style),
            Paragraph(evidence, cell_style),
            Paragraph(hypothesis, cell_style),
        ])

    table = Table(table_data, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0f172a')),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')])
    ]))

    elements.append(table)
    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()
