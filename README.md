# Automação VITAI HIAM

Extensão local do Chrome para automatizar a exportação dos relatórios do VITAI HIAM.

## Versão 2.0 — detecção flexível e diagnóstico dos downloads

- A aplicação apresenta três etapas: informar usuário/senha, conferir o período e baixar os dois relatórios em sequência.
- As credenciais são usadas apenas para preencher a tela de login e não são salvas pela aplicação.
- Navega na árvore do VITAI para **EMERGÊNCIA → Pacientes Registrados** e **INTERNAÇÃO → Altas Hospitalares**.
- Seleciona **Personalizado**, preenche as datas e aciona diretamente **Exportar para Excel**.
- Datas padrão: terça a domingo, dia anterior completo; segunda-feira, sexta-feira a domingo. As datas continuam editáveis.
- Renomeia os arquivos para `Emergencia_YYYYMMDD.xlsx` e `Internacao_YYYYMMDD.xlsx` (para intervalos, inclui as duas datas).
- Aguarda o Chrome confirmar cada download antes de passar ao segundo relatório.
- Mostra em tempo real a etapa em que a automação está trabalhando, facilitando identificar onde uma execução para.
- Reconhece os downloads mesmo quando o Chrome informa `tabId = -1`, o nome vem com sufixo, ou a exportação usa um nome original do VITAI.
- Se o download não for concluído, a mensagem de erro mostra os downloads recentes que o Chrome reportou.

IDs de datasource usados pelo sistema: Emergência `100563`; Internação `100556`.

## Como usar

1. Atualize a extensão local: abra `chrome://extensions` e clique em **Recarregar**.
2. Abra a página de controle publicada no Vercel.
3. Abra o VITAI e faça login normalmente no site oficial. Mantenha a sessão ativa.
4. Na página de controle, confira as datas e clique em **Baixar os dois relatórios automaticamente**.
5. Aguarde a mensagem de conclusão e confira os arquivos na pasta de downloads configurada no Chrome.

A automação navega pelos relatórios após o login, mas não preenche usuário/senha e não contorna a autenticação do VITAI. O botão **Aplicar** não é usado; o fluxo preenche os filtros e aciona a exportação do Excel diretamente.

## Limitações conhecidas

- Esta atualização ainda precisa ser validada com uma sessão real do VITAI, pois a página depende da estrutura e dos componentes Kendo carregados pelo sistema.
- O botão **Escolher pasta** ainda não redireciona os downloads para essa pasta. Os arquivos são salvos no destino de downloads configurado no Chrome.
- Para substituir arquivos existentes, a extensão solicita ao Chrome a ação de conflito `overwrite`; o comportamento final também depende das configurações do navegador.

## Instalação/atualização local

1. Baixe o repositório em **Code → Download ZIP** e extraia em uma pasta fixa.
2. Abra `chrome://extensions`.
3. Ative **Modo do desenvolvedor** e use **Carregar sem compactação** na pasta da extensão, ou clique em **Recarregar** se ela já estiver instalada.
4. Abra a página publicada no Vercel e siga as instruções de uso acima.

## Segurança

Não coloque senhas, cookies de sessão, planilhas reais ou dados identificáveis de pacientes neste repositório. Faça o login manualmente no site oficial. A página de controle não recebe a senha do VITAI.
