const VITAI_URL = "https://hiam.vitai.care/vitai/pages/login.do";

const RELATORIOS = {
  "emergencia-pacientes-registrados": { datasourceId: "100563", prefixo: "Emergencia" },
  "internacao-altas": { datasourceId: "100556", prefixo: "Internacao" }
};

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
    executarRelatorio(message, sendResponse);
    return true;
  }
});

function nomeArquivo(prefixo, inicial, final) {
  const a = inicial.replaceAll("-", "");
  const b = final.replaceAll("-", "");
  return inicial === final ? `${prefixo}_${a}.xlsx` : `${prefixo}_${a}_a_${b}.xlsx`;
}

async function executarRelatorio(message, sendResponse) {
  const config = RELATORIOS[message.relatorio];
  if (!config) {
    sendResponse({ ok: false, erro: "Relatório não reconhecido." });
    return;
  }

  const inicial = String(message.dataInicial || "");
  const final = String(message.dataFinal || "");
  const formatoData = /^\d{4}-\d{2}-\d{2}$/;

  if (!formatoData.test(inicial) || !formatoData.test(final)) {
    sendResponse({ ok: false, erro: "Informe as duas datas no formato correto." });
    return;
  }
  if (inicial > final) {
    sendResponse({ ok: false, erro: "A data inicial não pode ser posterior à data final." });
    return;
  }

  const dadosAba = await chrome.storage.session.get("vitaiTabId");
  const tabId = dadosAba.vitaiTabId || vitaiTabId;
  if (!Number.isInteger(tabId)) {
    sendResponse({ ok: false, erro: "Aba do VITAI não localizada. Clique em Abrir VITAI e entre no sistema." });
    return;
  }

  let tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch {
    sendResponse({ ok: false, erro: "Não encontrei a aba do VITAI. Abra o sistema novamente." });
    return;
  }

  if (!tab.url || !tab.url.startsWith("https://hiam.vitai.care/")) {
    sendResponse({ ok: false, erro: "A aba registrada não é uma página do VITAI. Abra o sistema novamente." });
    return;
  }

  const filename = nomeArquivo(config.prefixo, inicial, final);
  await chrome.storage.session.set({ pendingDownload: { tabId, filename, criadoEm: Date.now() } });

  try {
    const execucao = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      args: [{ datasourceId: config.datasourceId, dataInicial: inicial, dataFinal: final }],
      func: async (args) => {
        try {
          const $ = window.jQuery;
          const elemento = document.querySelector("#grid");
          const grade = $ && elemento ? $(elemento).data("kendoGrid") : null;

          if (!grade) {
            return { ok: false, erro: "Não encontrei a grade do relatório nesta aba. Abra o relatório desejado no VITAI." };
          }
          if (typeof window.getParametros !== "function") {
            return { ok: false, erro: "A tela não disponibilizou os parâmetros do relatório. Atualize a página do VITAI." };
          }

          const parametrosAtuais = window.getParametros(args.datasourceId);
          const datasourceAtual = String(parametrosAtuais?.datasourceId || "");
          if (datasourceAtual !== String(args.datasourceId)) {
            return {
              ok: false,
              erro: `A tela aberta usa o relatório ${datasourceAtual || "não identificado"}, mas este botão é para ${args.datasourceId}. Abra o relatório correspondente no VITAI.`
            };
          }

          const botaoExcel = document.querySelector("#grid .k-grid-excel");
          if (!botaoExcel) return { ok: false, erro: "Não encontrei o botão Exportar para Excel nesta grade." };

          const originalGetParametros = window.getParametros;
          let restaurado = false;
          const getParametrosComPeriodo = function(id) {
            const resultado = originalGetParametros.apply(this, arguments);
            if (String(id) !== String(args.datasourceId) || !resultado || typeof resultado !== "object") return resultado;
            return {
              ...resultado,
              dataInicial: args.dataInicial + " 00:00:00",
              dataFinal: args.dataFinal + " 23:59:59"
            };
          };
          const restaurar = () => {
            if (!restaurado && window.getParametros === getParametrosComPeriodo) {
              window.getParametros = originalGetParametros;
              restaurado = true;
            }
          };

          window.getParametros = getParametrosComPeriodo;
          grade.one("excelExport", restaurar);
          window.setTimeout(restaurar, 120000);

          try {
            await grade.dataSource.read();
            botaoExcel.click();
            return {
              ok: true,
              datasourceId: datasourceAtual,
              totalRegistros: grade.dataSource.total(),
              mensagem: "Consulta refeita com o período solicitado e exportação acionada."
            };
          } catch (erro) {
            restaurar();
            return { ok: false, erro: "Falha ao consultar ou exportar: " + (erro?.message || String(erro)) };
          }
        } catch (erro) {
          return { ok: false, erro: erro?.message || String(erro) };
        }
      }
    });

    const resultado = execucao && execucao[0] ? execucao[0].result : null;
    if (!resultado || !resultado.ok) {
      await chrome.storage.session.remove("pendingDownload");
      sendResponse(resultado || { ok: false, erro: "O VITAI não retornou o resultado da automação." });
      return;
    }

    sendResponse({
      ok: true,
      mensagem: resultado.mensagem,
      totalRegistros: resultado.totalRegistros,
      datasourceId: resultado.datasourceId,
      nomeArquivo: filename,
      observacao: "A exportação foi acionada. Confira os downloads do Chrome para confirmar que terminou."
    });
  } catch (erro) {
    await chrome.storage.session.remove("pendingDownload");
    sendResponse({ ok: false, erro: "Não consegui executar a automação nesta aba: " + (erro?.message || String(erro)) });
  }
}

chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  chrome.storage.session.get("pendingDownload", (dados) => {
    const pendente = dados.pendingDownload;
    const nomeOriginal = String(item.filename || "").split(/[\\/]/).pop();
    if (pendente && item.tabId === pendente.tabId && nomeOriginal.toLowerCase() === "timedreportexport.xlsx") {
      suggest({ filename: pendente.filename, conflictAction: "uniquify" });
      chrome.storage.session.remove("pendingDownload");
    } else {
      suggest();
    }
  });
  return true;
});
