# Automação VITAI HIAM

Projeto local de automação para apoiar o acesso ao VITAI HIAM e a exportação dos relatórios utilizados pelo SAME Laudos.

## Relatórios planejados

1. Emergência — pacientes registrados.
2. Internação — altas.

## Estado atual — versão 0.1.0

- Página inicial criada.
- Botão para abrir o login oficial do VITAI.
- Login feito manualmente no site oficial.
- Seleção de uma pasta de destino pelo Chrome.
- Estrutura inicial da extensão Manifest V3.
- Os botões de exportação permanecem desativados até mapearmos os menus, filtros e formatos reais de cada relatório.

## Arquivos

- `index.html`: página de controle; pode ser hospedada no Vercel.
- `manifest.json`: configuração da extensão local do Chrome.
- `background.js`: abre o VITAI e encaminha comandos para a aba do sistema.
- `content.js`: ponte de comunicação e ponto de integração com os relatórios.

## Instalação local da extensão

1. Baixe o repositório em **Code → Download ZIP**.
2. Extraia o ZIP para uma pasta fixa no computador.
3. Abra `chrome://extensions`.
4. Ative **Modo do desenvolvedor**.
5. Clique em **Carregar sem compactação** e selecione a pasta extraída.
6. Abra a página de controle publicada no Vercel ou abra o `index.html` localmente.

## Próxima etapa

Entre no VITAI manualmente e mapeie os menus dos dois relatórios. Antes de compartilhar capturas de tela, oculte nomes, CNS, prontuários e quaisquer outros dados identificáveis de pacientes.

**Importante:** não coloque credenciais, cookies, planilhas reais ou dados de pacientes neste repositório.