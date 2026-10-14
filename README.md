# Automação VITAI HIAM

Extensão local do Chrome para automatizar a exportação dos relatórios do VITAI HIAM.

## Versão 0.6.8 — credenciais locais opcionais e download com substituição

- A aplicação apresenta três etapas: informar usuário/senha, conferir o período e baixar os dois relatórios em sequência.
- A tela de login oferece a opção **Salvar usuário e senha neste navegador**. Se marcada, a extensão guarda as credenciais no armazenamento local do perfil do Chrome; se desmarcada, remove as credenciais salvas após login bem-sucedido.
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
3. Na tela de login da aplicação, informe as credenciais do VITAI. Marque **Salvar usuário e senha neste navegador** somente se esse computador e perfil do Chrome forem de uso confiável.
4. Clique em **Entrar no VITAI**. A extensão abre o VITAI em segundo plano e confirma o login.
5. Confira as datas e clique em **Baixar os dois relatórios**. Aguarde a confirmação de ambos os downloads.

A extensão preenche os campos de login no próprio VITAI com as credenciais informadas pelo usuário; não contorna a autenticação. As credenciais salvas ficam no armazenamento local da extensão, não no servidor da página. Isso não é o cofre nativo do Gerenciador de senhas do Chrome. O botão **Aplicar** não é usado; o fluxo preenche os filtros e aciona a exportação do Excel diretamente.

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

Não coloque senhas, cookies de sessão, planilhas reais ou dados identificáveis de pacientes neste repositório. A opção de lembrar credenciais é local ao perfil do Chrome e deve ser usada apenas em computadores confiáveis. Em computadores compartilhados, deixe-a desmarcada.
