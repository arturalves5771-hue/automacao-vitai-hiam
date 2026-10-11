const VITAI_URL = "https://hiam.vitai.care/vitai/pages/login.do";

const RELATORIOS = [
  { chave: "emergencia-pacientes-registrados", datasourceId: "100563", prefixo: "Emergencia", grupo: "EMERGÊNCIA", nome: "Pacientes Registrados" },
  { chave: "internacao-altas", datasourceId: "100556", prefixo: "Internacao", grupo: "INTERNAÇÃO", nome: "Altas Hospitalares" }
];

let vitaiTabId = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return;

  if (message.type === "VITAI_ABRIR_SISTEMA") {
    chrome.tabs.create({ url: VITAI_URL, active: true }, (tab) => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, erro: chrome.runtime.lastError.message });
        return;
      }
      vitaiTabId = tab.id;
      chrome.storage.session.set({ vitaiTabId: tab.id });
      sendResponse({ ok: true, tabId: tab.id });
    });
    return true;
  }

  if (message.type === "VITAI_REGISTRAR_ABA") {
    if (sender.tab && Number.isInteger(sender.tab.id)) {
      vitaiTabId = sender.tab.id;
      chrome.storage.session.set({ vitaiTabId });
    }
    sendResponse({ ok: true });
    return;
  }

  if (message.type === "VITAI_EXECUTAR_RELATORIO") {
    executarRelatorioIndividual(message, sendResponse);
    return true;
  }

  if (message.type === "VITAI_EXECUTAR_AMBOS") {
    executarAmbos(message, sendResponse);
    return true;
  }
});

function validarDatas(inicial, final) {
  const formato = /^\\d{4}-\\d{2}-\\d{2}$/;
  if (!formato.test(inicial) || !formato.test(final)) return "Informe as duas datas no formato correto.";
  if (inicial > final) return "A data inicial não pode ser posterior à data final.";
  return "";
}

function nomeArquivo(prefixo, inicial, final) {
  const a = inicial.replaceAll("-", "");
  const b = final.replaceAll("-", "");
  return inicial === final ? prefixo + "_" + a + ".xlsx" : prefixo + "_" + a + "_a_" + b + ".xlsx";
}

async function obterAbaVitai() {
  const dadosAba = await chrome.storage.session.get("vitaiTabId");
  const tabId = dadosAba.vitaiTabId || vitaiTabId;
  if (!Number.isInteger(tabId)) throw new Error("Aba do VITAI não localizada. Abra o VITAI e entre no sistema primeiro.");

  let tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch {
    throw new Error("Não encontrei a aba do VITAI. Abra o sistema novamente.");
  }
  if (!tab.url || !tab.url.startsWith("https://hiam.vitai.care/")) {
    throw new Error("A aba registrada não é uma página do VITAI. Abra o sistema novamente.");
  }
  return { tabId, tab };
}

async function executarAmbos(message, sendResponse) {
  const inicial = String(message.dataInicial || "");
  const final = String(message.dataFinal || "");
  const erroDatas = validarDatas(inicial, final);
  if (erroDatas) {
    sendResponse({ ok: false, erro: erroDatas });
    return;
  }

  let aba;
  try {
    aba = await obterAbaVitai();
  } catch (erro) {
    sendResponse({ ok: false, erro: erro.message });
    return;
  }

  const resultados = [];
  try {
    for (const relatorio of RELATORIOS) {
      const filename = nomeArquivo(relatorio.prefixo, inicial, final);
      const inicioDownload = Date.now();
      await chrome.storage.session.set({
        pendingDownload: { tabId: aba.tabId, filename, criadoEm: inicioDownload }
      });

      const execucao = await chrome.scripting.executeScript({
        target: { tabId: aba.tabId },
        world: "MAIN",
        args: [{
          grupo: relatorio.grupo,
          nome: relatorio.nome,
          datasourceId: relatorio.datasourceId,
          dataInicial: inicial,
          dataFinal: final
        }],
        func: async (args) => {
          const pausa = (ms) => new Promise(resolve => setTimeout(resolve, ms));
          const esperar = async (condicao, limite = 30000, descricao = "elemento") => {
            const inicio = Date.now();
            while (Date.now() - inicio < limite) {
              try {
                const valor = condicao();
                if (valor) return valor;
              } catch (_) {}
              await pausa(250);
            }
            throw new Error("Tempo esgotado aguardando " + descricao + ".");
          };
          const normalizar = (valor) => String(valor || "").normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").trim().toUpperCase();

          try {
            const $ = window.jQuery;
            if (!$) throw new Error("A biblioteca jQuery do VITAI não foi encontrada.");

            let tree = $("#treeview").data("kendoTreeView");
            if (!tree && typeof window.openWindow === "function") {
              window.openWindow("3929", "reportcontainer.do", "/vitai");
            }
            tree = await esperar(() => $("#treeview").data("kendoTreeView"), 35000, "a árvore de relatórios");

            const acharItem = (texto) => {
              const procurado = normalizar(texto);
              let encontrado = null;
              tree.items().each(function() {
                if (encontrado) return;
                const item = tree.dataItem(this);
                if (item && normalizar(item.text || item.TEXT) === procurado) encontrado = $(this);
              });
              return encontrado;
            };

            let grupo = acharItem(args.grupo);
            if (!grupo) {
              grupo = await esperar(() => acharItem(args.grupo), 10000, "o grupo " + args.grupo);
            }
            tree.expand(grupo);
            await pausa(500);

            let itemRelatorio = acharItem(args.nome);
            if (!itemRelatorio) {
              itemRelatorio = await esperar(() => acharItem(args.nome), 12000, "o relatório " + args.nome);
            }

            const gradeAnterior = document.querySelector("#grid");
            tree.select(itemRelatorio);
            tree.trigger("select", { node: itemRelatorio[0] });

            await esperar(() => {
              const titulo = document.querySelector("#uiNomeRelatorio");
              const gradeElemento = document.querySelector("#grid");
              const gradeAtual = gradeElemento && $("#grid").data("kendoGrid");
              if (!titulo || normalizar(titulo.textContent) !== normalizar(args.nome) ||
                  !gradeElemento || !gradeAtual ||
                  !document.querySelector("#uiDtInicial") || !document.querySelector("#uiDtFinal")) return false;
              const leitura = gradeAtual.dataSource && gradeAtual.dataSource.transport &&
                gradeAtual.dataSource.transport.options && gradeAtual.dataSource.transport.options.read;
              const parametros = leitura && typeof leitura.data === "function" ? leitura.data() :
                (leitura && leitura.data && typeof leitura.data === "object" ? leitura.data : null);
              const datasource = String(parametros && parametros.datasourceId || "");
              return gradeElemento !== gradeAnterior || datasource === String(args.datasourceId);
            }, 30000, "a grade atualizada do relatório " + args.nome);

            const periodoInput = document.querySelector("#uiPeriodo") ||
              document.querySelector("input[aria-owns='uiPeriodo_listbox']");
            if (!periodoInput) throw new Error("Não encontrei o seletor de período do relatório.");

            const periodo = $(periodoInput).data("kendoDropDownList") ||
              $(periodoInput).data("kendoComboBox") ||
              $(periodoInput).data("kendoMultiColumnComboBox");

            if (periodo) {
              const dados = periodo.dataSource && periodo.dataSource.data ? periodo.dataSource.data() : [];
              let opcao = null;
              let indice = -1;
              for (let i = 0; i < dados.length; i++) {
                const registro = dados[i];
                const rotulo = registro.text || registro.TEXT || registro.nome || registro.NOME || "";
                if (normalizar(rotulo) === "PERSONALIZADO") {
                  opcao = registro;
                  indice = i;
                  break;
                }
              }
              if (opcao) {
                const valor = opcao.value !== undefined ? opcao.value :
                  (opcao.VALUE !== undefined ? opcao.VALUE : opcao.id);
                if (valor !== undefined && valor !== null) periodo.value(String(valor));
                else periodo.select(indice);
                periodo.trigger("change");
              } else {
                periodo.text("Personalizado");
                periodo.trigger("change");
              }
            } else {
              periodoInput.click();
              const opcaoHtml = await esperar(() => {
                const lista = document.querySelector("#uiPeriodo_listbox");
                if (!lista) return null;
                return Array.from(lista.querySelectorAll("li")).find(li => normalizar(li.textContent) === "PERSONALIZADO");
              }, 5000, "a opção Personalizado");
              opcaoHtml.click();
            }

            await esperar(() => {
              const a = document.querySelector("#uiDtInicial");
              const b = document.querySelector("#uiDtFinal");
              return a && b && !a.disabled && !b.disabled;
            }, 10000, "a habilitação das datas no período Personalizado");

            const converterData = (iso, hora, minuto, segundo) => {
              const partes = iso.split("-").map(Number);
              return new Date(partes[0], partes[1] - 1, partes[2], hora, minuto, segundo, 0);
            };
            const inicialInput = $("#uiDtInicial");
            const finalInput = $("#uiDtFinal");
            const widgetInicial = inicialInput.data("kendoDateTimePicker");
            const widgetFinal = finalInput.data("kendoDateTimePicker");

            if (!widgetInicial || !widgetFinal) throw new Error("Os campos de data não foram inicializados pelo VITAI.");

            widgetInicial.value(converterData(args.dataInicial, 0, 0, 0));
            widgetInicial.trigger("change");
            widgetFinal.value(converterData(args.dataFinal, 23, 59, 59));
            widgetFinal.trigger("change");

            const botaoExcel = await esperar(() => document.querySelector("#grid .k-grid-excel") ||
              document.querySelector(".k-grid-excel"), 10000, "o botão Exportar para Excel");
            botaoExcel.click();

            return {
              ok: true,
              relatorio: args.nome,
              datasourceId: args.datasourceId,
              dataInicial: args.dataInicial,
              dataFinal: args.dataFinal,
              mensagem: "Período Personalizado preenchido e exportação acionada."
            };
          } catch (erro) {
            return { ok: false, erro: erro && erro.message ? erro.message : String(erro) };
          }
        }
      });

      const resultado = execucao && execucao[0] ? execucao[0].result : null;
      if (!resultado || !resultado.ok) {
        await chrome.storage.session.remove("pendingDownload");
        throw new Error((resultado && resultado.erro) || "O VITAI não retornou o resultado do relatório.");
      }

      await aguardarDownload(aba.tabId, inicioDownload, filename, 90000);
      resultados.push({
        relatorio: relatorio.nome,
        nomeArquivo: filename,
        ok: true
      });
    }

    await chrome.storage.session.remove("pendingDownload");
    sendResponse({
      ok: true,
      resultados,
      mensagem: "Os dois relatórios foram exportados com sucesso."
    });
  } catch (erro) {
    await chrome.storage.session.remove("pendingDownload");
    sendResponse({
      ok: false,
      erro: erro && erro.message ? erro.message : String(erro),
      resultados
    });
  }
}

async function aguardarDownload(tabId, inicioMs, filename, limiteMs) {
  const inicio = Date.now();
  while (Date.now() - inicio < limiteMs) {
    const itens = await chrome.downloads.search({ orderBy: ["-startTime"], limit: 30 });
    const item = itens.find(d => {
      const tempo = d.startTime ? Date.parse(d.startTime) : 0;
      const nome = String(d.filename || "").replace(/^.*[\\\\/]/, "");
      return d.tabId === tabId && tempo >= inicioMs - 1000 &&
        (nome === filename || nome.toLowerCase() === "timedreportexport.xlsx" ||
         nome.toLowerCase().endsWith(filename.toLowerCase()));
    });
    if (item) {
      if (item.state === "complete") return;
      if (item.state === "interrupted") throw new Error("O download de " + filename + " foi interrompido.");
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error("A exportação foi acionada, mas o Chrome não confirmou o download de " + filename + " em 90 segundos.");
}

async function executarRelatorioIndividual(message, sendResponse) {
  sendResponse({
    ok: false,
    erro: "Use o botão Baixar os dois relatórios para a automação navegar e exportar os relatórios em sequência."
  });
}

chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  chrome.storage.session.get("pendingDownload", (dados) => {
    const pendente = dados.pendingDownload;
    const nomeOriginal = String(item.filename || "").split(/[\\/]/).pop();
    if (pendente && item.tabId === pendente.tabId &&
        nomeOriginal.toLowerCase() === "timedreportexport.xlsx") {
      suggest({ filename: pendente.filename, conflictAction: "overwrite" });
      chrome.storage.session.remove("pendingDownload");
    } else {
      suggest();
    }
  });
  return true;
});
