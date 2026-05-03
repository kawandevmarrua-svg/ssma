"""
Gera o PDF do Termo de Uso para validacao antes de implementar no app.
Saida: docs/termos_de_uso_operadores_v1.pdf
"""
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_JUSTIFY, TA_CENTER, TA_LEFT
from reportlab.lib.units import cm
from reportlab.lib.colors import HexColor, black
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    PageBreak,
    Table,
    TableStyle,
)


OUTPUT = os.path.join(os.path.dirname(__file__), "termos_de_uso_operadores_v1.pdf")

PRIMARY = HexColor("#0F4C81")
MUTED = HexColor("#555555")


def build_styles():
    base = getSampleStyleSheet()
    styles = {
        "title": ParagraphStyle(
            "title", parent=base["Title"], fontSize=20, leading=24,
            textColor=PRIMARY, alignment=TA_CENTER, spaceAfter=6,
        ),
        "subtitle": ParagraphStyle(
            "subtitle", parent=base["Normal"], fontSize=11, leading=14,
            textColor=MUTED, alignment=TA_CENTER, spaceAfter=18,
        ),
        "h2": ParagraphStyle(
            "h2", parent=base["Heading2"], fontSize=13, leading=16,
            textColor=PRIMARY, spaceBefore=14, spaceAfter=6,
        ),
        "body": ParagraphStyle(
            "body", parent=base["BodyText"], fontSize=10.5, leading=15,
            alignment=TA_JUSTIFY, spaceAfter=8,
        ),
        "bullet": ParagraphStyle(
            "bullet", parent=base["BodyText"], fontSize=10.5, leading=15,
            alignment=TA_JUSTIFY, leftIndent=14, bulletIndent=2, spaceAfter=4,
        ),
        "small": ParagraphStyle(
            "small", parent=base["BodyText"], fontSize=9, leading=12,
            textColor=MUTED, alignment=TA_LEFT,
        ),
        "sigLabel": ParagraphStyle(
            "sigLabel", parent=base["BodyText"], fontSize=9.5, leading=12,
            textColor=MUTED, alignment=TA_LEFT, spaceAfter=2,
        ),
    }
    return styles


def p(text, style):
    return Paragraph(text, style)


def bullets(items, style):
    return [Paragraph(f"• {it}", style) for it in items]


def build():
    doc = SimpleDocTemplate(
        OUTPUT, pagesize=A4,
        leftMargin=2.2 * cm, rightMargin=2.2 * cm,
        topMargin=2 * cm, bottomMargin=2 * cm,
        title="Termo de Uso - Operadores",
        author="Marrua Engenharia",
    )
    s = build_styles()
    story = []

    story.append(p("TERMO DE USO E CONSENTIMENTO", s["title"]))
    story.append(p(
        "Aplicativo Marrua Operacoes &middot; Versao 1.0 &middot; Data de vigencia: 30/04/2026",
        s["subtitle"],
    ))

    story.append(p("1. Apresentacao e Aceite", s["h2"]))
    story.append(p(
        "Este Termo de Uso (\"Termo\") regula o acesso e a utilizacao, por colaboradores "
        "e prestadores de servico (\"Operador\"), do aplicativo movel disponibilizado pela "
        "<b>Marrua Engenharia</b> (\"Empresa\") destinado ao registro e acompanhamento de "
        "atividades operacionais, listas de verificacao (checklists), pre-operacao de "
        "equipamentos, paradas, evidencias fotograficas e demais rotinas relacionadas. "
        "Ao marcar a caixa de aceite e confirmar a assinatura eletronica na tela inicial, "
        "o Operador declara que <b>leu, entendeu e concorda integralmente</b> com as "
        "disposicoes aqui estabelecidas.",
        s["body"],
    ))
    story.append(p(
        "A nao concordancia com este Termo impede o acesso ao aplicativo. Em caso de "
        "duvidas antes do aceite, o Operador deve procurar seu encarregado, o RH ou o "
        "responsavel de TI da Empresa.",
        s["body"],
    ))

    story.append(p("2. Finalidade do Aplicativo", s["h2"]))
    story.append(p(
        "O aplicativo tem por finalidade <b>exclusiva</b> apoiar a operacao da Empresa, "
        "permitindo, entre outras funcionalidades:",
        s["body"],
    ))
    story.extend(bullets([
        "Registro de inicio e fim de atividades, servicos e paradas operacionais.",
        "Preenchimento de checklists de pre-operacao de maquinas, veiculos e equipamentos.",
        "Captura de fotos e evidencias de nao conformidades (NCs) em campo.",
        "Recebimento de notificacoes, alertas de seguranca e instrucoes operacionais.",
        "Identificacao do equipamento operado e localizacao do Operador durante o turno.",
    ], s["bullet"]))

    story.append(p("3. Cadastro, Credenciais e Responsabilidade", s["h2"]))
    story.append(p(
        "O acesso e realizado mediante credenciais individuais (e-mail e senha) "
        "fornecidas pela Empresa. O Operador e <b>integralmente responsavel</b> pela "
        "guarda e uso de suas credenciais, comprometendo-se a:",
        s["body"],
    ))
    story.extend(bullets([
        "Nao compartilhar a senha com terceiros, ainda que colegas de equipe ou superiores.",
        "Nao permitir que outra pessoa registre atividades ou checklists em seu nome.",
        "Comunicar imediatamente o RH ou TI em caso de suspeita de uso indevido da conta.",
        "Sair do aplicativo (logout) ao encerrar o turno em equipamentos compartilhados.",
    ], s["bullet"]))
    story.append(p(
        "Quaisquer registros realizados sob a conta do Operador presumem-se feitos por "
        "ele, podendo ser utilizados como prova em procedimentos internos e, se for o "
        "caso, em esfera judicial.",
        s["body"],
    ))

    story.append(p("4. Veracidade das Informacoes", s["h2"]))
    story.append(p(
        "O Operador compromete-se a preencher checklists, formularios e demais campos do "
        "aplicativo com <b>veracidade e exatidao</b>, refletindo a real condicao do "
        "equipamento e da operacao no momento do registro. A insercao deliberada de "
        "informacoes falsas - em especial no checklist de pre-operacao, em registros de "
        "horas, em paradas ou em evidencias fotograficas - constitui falta grave, podendo "
        "ensejar aplicacao de medidas disciplinares previstas na legislacao trabalhista, "
        "inclusive demissao por justa causa, sem prejuizo da responsabilizacao civil e "
        "criminal cabivel.",
        s["body"],
    ))

    story.append(p("5. Tratamento de Dados Pessoais (LGPD)", s["h2"]))
    story.append(p(
        "Em conformidade com a Lei Geral de Protecao de Dados (Lei n. 13.709/2018 - LGPD), "
        "a Empresa, na qualidade de <b>controladora</b>, tratara os seguintes dados do "
        "Operador, com as bases legais indicadas:",
        s["body"],
    ))

    data = [
        ["Categoria", "Dados", "Base legal"],
        ["Identificacao", "Nome, e-mail corporativo, funcao, ID interno",
         "Execucao de contrato (art. 7, V)"],
        ["Operacionais", "Checklists, horarios, atividades, paradas, alertas",
         "Legitimo interesse (art. 7, IX)"],
        ["Localizacao", "Coordenadas GPS durante a jornada e turno",
         "Legitimo interesse / seguranca"],
        ["Imagens", "Fotos de equipamentos e nao conformidades",
         "Legitimo interesse (art. 7, IX)"],
        ["Dispositivo", "Modelo, sistema operacional, token de notificacao",
         "Execucao de contrato"],
    ]
    table = Table(data, colWidths=[3.6 * cm, 7.2 * cm, 5.2 * cm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
        ("TEXTCOLOR", (0, 0), (-1, 0), HexColor("#FFFFFF")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [HexColor("#F5F7FB"), HexColor("#FFFFFF")]),
        ("GRID", (0, 0), (-1, -1), 0.4, HexColor("#D0D5DD")),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(table)
    story.append(Spacer(1, 10))

    story.append(p(
        "Os dados serao utilizados <b>exclusivamente</b> para fins operacionais, de "
        "seguranca do trabalho, conformidade regulatoria e gestao de pessoas. <b>Nao</b> "
        "serao vendidos, cedidos ou compartilhados com terceiros, ressalvadas: (i) "
        "obrigacoes legais; (ii) provedores de infraestrutura tecnologica que atuem como "
        "operadores de dados sob contrato (ex.: Supabase, provedores de notificacao); "
        "(iii) determinacao judicial ou de autoridade competente.",
        s["body"],
    ))

    story.append(p("6. Geolocalizacao", s["h2"]))
    story.append(p(
        "O aplicativo coleta a localizacao do dispositivo durante o periodo de trabalho "
        "do Operador, com a finalidade de:",
        s["body"],
    ))
    story.extend(bullets([
        "Confirmar presenca em frentes de servico e equipamentos.",
        "Acionar equipes de resgate em caso de emergencia ou acidente.",
        "Auditar registros operacionais quando houver divergencia.",
    ], s["bullet"]))
    story.append(p(
        "A coleta e <b>limitada ao turno de trabalho</b> e cessa quando o aplicativo nao "
        "esta em uso operacional. O Operador reconhece que a localizacao e dado pessoal "
        "necessario ao vinculo de trabalho e a seguranca em campo.",
        s["body"],
    ))

    story.append(p("7. Direitos do Titular", s["h2"]))
    story.append(p(
        "Nos termos do art. 18 da LGPD, o Operador podera, a qualquer tempo, solicitar:",
        s["body"],
    ))
    story.extend(bullets([
        "Confirmacao da existencia de tratamento de seus dados.",
        "Acesso aos dados tratados.",
        "Correcao de dados incompletos, inexatos ou desatualizados.",
        "Anonimizacao, bloqueio ou eliminacao de dados desnecessarios.",
        "Informacao sobre uso compartilhado de dados.",
        "Revogacao do consentimento, quando aplicavel.",
    ], s["bullet"]))
    story.append(p(
        "As solicitacoes devem ser encaminhadas ao canal: "
        "<b>ti@marruaeng.com.br</b>. A Empresa respondera em prazo razoavel, observados "
        "os limites legais e a necessidade de retencao de dados para cumprimento de "
        "obrigacoes regulatorias e trabalhistas.",
        s["body"],
    ))

    story.append(p("8. Seguranca da Informacao", s["h2"]))
    story.append(p(
        "Os dados sao armazenados em infraestrutura com <b>criptografia em transito</b> "
        "(HTTPS/TLS) e em <b>repouso</b>, com controle de acesso por papel (RLS). "
        "Apenas usuarios autorizados acessam dados de outros operadores. Incidentes de "
        "seguranca relevantes serao comunicados conforme a LGPD.",
        s["body"],
    ))

    story.append(p("9. Uso Aceitavel", s["h2"]))
    story.append(p("E vedado ao Operador:", s["body"]))
    story.extend(bullets([
        "Utilizar o aplicativo para finalidades estranhas ao trabalho.",
        "Tentar burlar mecanismos de seguranca, autenticacao ou auditoria.",
        "Inserir conteudo ofensivo, ilegal ou de terceiros sem autorizacao.",
        "Realizar engenharia reversa, copiar ou redistribuir o aplicativo.",
        "Capturar, divulgar ou comercializar dados acessados via aplicativo.",
    ], s["bullet"]))

    story.append(p("10. Disponibilidade e Atualizacoes", s["h2"]))
    story.append(p(
        "A Empresa empregara esforcos razoaveis para manter o aplicativo disponivel, "
        "porem nao garante operacao ininterrupta. Atualizacoes podem ser disponibilizadas "
        "periodicamente. Quando este Termo for materialmente alterado, sera apresentada "
        "uma nova versao para aceite no proximo acesso.",
        s["body"],
    ))

    story.append(p("11. Vigencia e Encerramento", s["h2"]))
    story.append(p(
        "Este Termo vigora enquanto durar o vinculo do Operador com a Empresa. Encerrado "
        "o vinculo, o acesso sera revogado, podendo a Empresa reter os registros pelo "
        "prazo necessario ao cumprimento de obrigacoes legais e regulatorias.",
        s["body"],
    ))

    story.append(p("12. Foro e Legislacao Aplicavel", s["h2"]))
    story.append(p(
        "Este Termo e regido pelas leis da Republica Federativa do Brasil. Fica eleito o "
        "foro da comarca da sede da Empresa para dirimir controversias decorrentes deste "
        "instrumento, com renuncia a qualquer outro, por mais privilegiado que seja.",
        s["body"],
    ))

    story.append(p("13. Registro Eletronico do Aceite", s["h2"]))
    story.append(p(
        "O aceite deste Termo sera registrado eletronicamente no banco de dados da "
        "Empresa, contendo, no minimo: identificacao do Operador (ID e e-mail), versao do "
        "Termo aceito, data e hora (timestamp), endereco IP e informacoes do dispositivo. "
        "Tais registros constituem <b>prova do aceite</b> para todos os fins legais, nos "
        "termos do art. 10 da MP 2.200-2/2001 e da Lei n. 14.063/2020.",
        s["body"],
    ))

    story.append(Spacer(1, 14))
    story.append(p("Assinatura eletronica do Operador", s["h2"]))
    story.append(Spacer(1, 4))

    sig_data = [
        [Paragraph("<b>Nome completo:</b>", s["sigLabel"]), ""],
        [Paragraph("<b>CPF / Matricula:</b>", s["sigLabel"]), ""],
        [Paragraph("<b>Funcao:</b>", s["sigLabel"]), ""],
        [Paragraph("<b>Data e hora do aceite:</b>", s["sigLabel"]), ""],
        [Paragraph("<b>Assinatura digitada:</b>", s["sigLabel"]), ""],
    ]
    sig_table = Table(sig_data, colWidths=[5 * cm, 11 * cm])
    sig_table.setStyle(TableStyle([
        ("LINEBELOW", (1, 0), (1, -1), 0.6, HexColor("#888888")),
        ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(sig_table)

    story.append(Spacer(1, 18))
    story.append(p(
        "Documento gerado para validacao interna. A versao final que sera apresentada "
        "no aplicativo sera registrada na tabela <i>terms_versions</i> e cada aceite na "
        "tabela <i>terms_acceptances</i>, conforme arquitetura aprovada.",
        s["small"],
    ))

    doc.build(story)
    print(f"PDF gerado: {OUTPUT}")


if __name__ == "__main__":
    build()
