# Automação VITAI HIAM

Extensão local do Chrome para teste da exportação de relatórios do VITAI HIAM.

## Versão 0.2.0 — teste inicial

- Página de controle com período inicial e final.
- Emergência — pacientes registrados: datasourceId `100563`.
- Internação — altas: datasourceId `100556`.
- Confere se o relatório aberto corresponde ao botão acionado.
- Aplica o período informado (início às 00:00:00 e fim às 23:59:59).
- Refaz a consulta e aciona o botão nativo "Exportar para Excel".
- Tenta renomear o download original `TiMedReportExport.xlsx` para um nome baseado no relatório e no período.

## Limitação desta versão de teste

**A extensão ainda não navega sozinha entre os menus de Emergência e Internação.** Para testar, abra manualmente no VITAI o relatório correspondente e deixe essa aba aberta; depois clique no botão do mesmo relatório na página de controle. Execute um relatório por vez.

A pasta escolhida pelo botão "Escolher pasta" ainda não é usada para mover o download. O arquivo será salvo no local de downloads configurado no Chrome. Se a renomeação não funcionar, o download ainda poderá aparecer com o nome original do VITAI.

## Instalação/atualização local

1. Baixe o repositório em **Code → Download ZIP** e extraia para uma pasta fixa.
2. Abra `chrome://extensions`.
3. Se a extensão já estiver instalada, clique em **Recarregar**; se não estiver, ative **Modo do desenvolvedor** e clique em **Carregar sem compactação**.
4. Abra a página publicada no Vercel.
5. Clique em **Abrir VITAI HIAM**, faça login manualmente e navegue até o relatório que deseja testar.
6. Escolha o período na página de controle e clique no botão do relatório que está aberto no VITAI.

## Relatórios mapeados

| Relatório | datasourceId |
|---|---:|
| Emergência — pacientes registrados | `100563` |
| Internação — altas | `100556` |

## Segurança

Não coloque senhas, cookies de sessão, planilhas reais ou dados identificáveis de pacientes neste repositório. Faça o login manualmente no site oficial.
