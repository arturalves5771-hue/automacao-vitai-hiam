const VITAI_URL = "https://hiam.vitai.care/vitai/pages/login.do";

const RELATORIOS = [
  { chave: "emergencia-pacientes-registrados", datasourceId: "100563", prefixo: "Emergencia", grupo: "EMERGÊNCIA", nome: "Pacientes Registrados" },
  { chave: "internacao-altas", datasourceId: "100556", prefixo: "Internacao", grupo: "INTERNAÇÃO", nome: "Altas Hospitalares" }
];

let vitaiTabId = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return;

  if (message.type === "VITAI_ABRIR_SISTEMA") {
    chrome.tabs.create({ url: VITAI_URL, active: false }, (tab) => {
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

  if (message.type === "VITAI_PROGRESS_INTERNO") {
    (async () => {
      const dados = await chrome.storage.session.get("vitaiUiTabId");
      const uiTabId = dados.vitaiUiTabId;
      if (Number.isInteger(uiTabId)) {
        try { await chrome.tabs.sendMessage(uiTabId, { type: "VITAI_PROGRESS", texto: String(message.texto || "") }); } catch (_) {}
      }
    })();
    return;
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

  if (message.type === "VITAI_LOGIN_VITAI") {
    loginEExecutarAmbos(message, sender, sendResponse);
    return true;
  }

  if (message.type === "VITAI_EXECUTAR_AMBOS") {
    executarAmbos(message, sender, sendResponse);
    return true;
  }
});

function validarDatas(inicial, final) {
  const formato = /^\d{4}-\d{2}-\d{2}$/;
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

async function loginEExecutarAmbos(message, sender, sendResponse) {
  const usuario = String(message.usuario || "").trim();
  const senha = String(message.senha || "");
  if (!usuario || !senha) {
    sendResponse({ ok: false, erro: "Informe o usuário e a senha do VITAI." });
    return;
  }

  const uiTabId = sender && sender.tab && sender.tab.id;
  let aba;
  try {
    if (Number.isInteger(uiTabId)) await chrome.tabs.update(uiTabId, { active: true });
    try {
      aba = await obterAbaVitai();
    } catch (_) {
      const abertas = await chrome.tabs.query({ url: "https://hiam.vitai.care/*" });
      let tab = abertas.find(t => t.url && t.url.startsWith("https://hiam.vitai.care/"));
      if (!tab) tab = await chrome.tabs.create({ url: VITAI_URL, active: false });
      vitaiTabId = tab.id;
      await chrome.storage.session.set({ vitaiTabId: tab.id });
      if (Number.isInteger(uiTabId)) await chrome.tabs.update(uiTabId, { active: true });
      await new Promise(resolve => {
        if (tab.status === "complete") return resolve();
        const listener = (tabId, info) => {
          if (tabId === tab.id && info.status === "complete") {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
        setTimeout(() => { chrome.tabs.onUpdated.removeListener(listener); resolve(); }, 15000);
      });
      aba = { tabId: tab.id, tab: await chrome.tabs.get(tab.id) };
    }
    const resultadoLogin = await chrome.scripting.executeScript({
      target: { tabId: aba.tabId },
      world: "MAIN",
      args: [{ usuario, senha }],
      func: async (credenciais) => {
        const normalizar = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const campos = Array.from(document.querySelectorAll("input:not([type=hidden]):not([type=submit]):not([type=button])"));
        const senhaInput = campos.find(el => el.type === "password" ||
          /senha|password|pass/.test(normalizar([el.name, el.id, el.autocomplete, el.placeholder].join(" "))));
        const textoCampo = (el) => normalizar([el.name, el.id, el.autocomplete, el.placeholder, el.getAttribute("aria-label")].join(" "));
        const usuarioInput = campos.find(el => el !== senhaInput &&
          (/user|login|usuario|matricula/.test(textoCampo(el)) || el.autocomplete === "username")) ||
          campos.find(el => el !== senhaInput && !/cpf|certificado|digital/.test(textoCampo(el)) &&
            (el.type === "text" || el.type === "email"));
        if (!senhaInput || !usuarioInput) {
          if (document.querySelector("#treeview") || document.querySelector("a[href*='report']")) {
            return { ok: true, jaLogado: true, mensagem: "Sessão do VITAI já parece estar aberta." };
          }
          return { ok: false, erro: "Não encontrei os campos de usuário e senha na página do VITAI. Confira se a tela de login está aberta." };
        }
        const preencher = (el, valor) => {
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
          setter.call(el, valor);
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        };
        preencher(usuarioInput, credenciais.usuario);
        preencher(senhaInput, credenciais.senha);
        const form = senhaInput.form || usuarioInput.form;
        const botoes = Array.from((form || document).querySelectorAll("button, input[type=submit], input[type=button]"));
        const botaoLogin = botoes.find(el => {
          const texto = normalizar(el.innerText || el.value || el.textContent || "");
          return /entrar|acessar|login|autenticar/.test(texto) &&
            !/certificado|digital|cpf/.test(texto);
        });
        if (botaoLogin) botaoLogin.click();
        else if (form) form.requestSubmit ? form.requestSubmit() : form.submit();
        else return { ok: false, erro: "Preenchi os campos, mas não encontrei o formulário de usuário e senha do VITAI." };

        return { ok: true, mensagem: "Credenciais preenchidas e envio do login acionado." };
      }
    });
    const login = resultadoLogin && resultadoLogin[0] ? resultadoLogin[0].result : null;
    if (!login || !login.ok) {
      sendResponse({ ok: false, erro: (login && login.erro) || "Não foi possível concluir o login no VITAI." });
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 2500));
    const verificacao = await chrome.scripting.executeScript({
      target: { tabId: aba.tabId },
      world: "MAIN",
      func: () => {
        const senha = document.querySelector('input[type="password"]');
        const mensagemErro = Array.from(document.querySelectorAll(".error, .erro, .alert-danger, [role=alert]"))
          .map(el => (el.innerText || "").trim()).filter(Boolean).join(" ");
        if (mensagemErro && /senha|usu.rio|inv.lid|incorret|falha|erro/i.test(mensagemErro)) {
          return { ok: false, erro: "O VITAI apresentou uma mensagem de login: " + mensagemErro.slice(0, 240) };
        }
        if (!senha || document.querySelector("#treeview") || document.querySelector("a[href*='report']")) {
          return { ok: true };
        }
        return { ok: false, erro: "A tela de login continua aberta. Confira o usuário e a senha e tente novamente." };
      }
    });
    const statusLogin = verificacao && verificacao[0] ? verificacao[0].result : null;
    if (!statusLogin || !statusLogin.ok) {
      sendResponse({ ok: false, erro: (statusLogin && statusLogin.erro) || "Não foi possível confirmar o login no VITAI." });
      return;
    }
    if (Number.isInteger(uiTabId)) await chrome.tabs.update(uiTabId, { active: true });
    sendResponse({ ok: true, mensagem: "Login confirmado. O VITAI ficou em segundo plano. Confira o período e clique para baixar os dois relatórios." });
  } catch (erro) {
    sendResponse({ ok: false, erro: erro && erro.message ? erro.message : String(erro) });
  }
}

async function executarAmbos(message, sender, sendResponse) {
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
  const uiTabId = sender && sender.tab && sender.tab.id;
  if (Number.isInteger(uiTabId)) await chrome.storage.session.set({ vitaiUiTabId: uiTabId });
  const informar = async (texto) => {
    if (Number.isInteger(uiTabId)) {
      try { await chrome.tabs.sendMessage(uiTabId, { type: "VITAI_PROGRESS", texto }); } catch (_) {}
    }
  };
  try {
    if (Number.isInteger(uiTabId)) await chrome.tabs.update(uiTabId, { active: true });
    for (const relatorio of RELATORIOS) {
      await informar("Preparando o relatório " + relatorio.nome + "...");
      const filename = nomeArquivo(relatorio.prefixo, inicial, final);
      const inicioDownload = Date.now();
      await chrome.storage.session.set({
        pendingDownload: { tabId: aba.tabId, filename, criadoEm: inicioDownload }
      });

      // A árvore do VITAI pode estar dentro de um frame. Primeiro abrimos
      // RELATÓRIOS na página principal e depois identificamos o frame real.
      let frameArvoreId = 0;
      try {
        const diagnosticoInicial = await chrome.scripting.executeScript({
          target: { tabId: aba.tabId },
          world: "MAIN",
          func: () => {
            if (document.querySelector("#treeview")) return true;
            const normalizar = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
            const candidatos = Array.from(document.querySelectorAll("a, span, button"))
              .filter(el => ["RELATORIOS"].includes(normalizar(el.textContent)));
            const link = candidatos.find(el => el.tagName === "A") ||
              candidatos.find(el => el.closest("a"))?.closest("a") || candidatos[0];
            if (link) { link.click(); }
            if (typeof window.openWindow === "function") {
              try { window.openWindow("3929", "reportcontainer.do", "/vitai"); } catch (_) {}
            }
            return false;
          }
        });
      } catch (_) {}

      const inicioBuscaFrame = Date.now();
      let arvoreEncontrada = false;
      while (Date.now() - inicioBuscaFrame < 25000) {
        try {
          const frames = await chrome.scripting.executeScript({
            target: { tabId: aba.tabId, allFrames: true },
            world: "MAIN",
            func: () => ({ temArvore: !!document.querySelector("#treeview"), url: location.href })
          });
          const frame = frames.find(item => item.result && item.result.temArvore);
          if (frame) {
            frameArvoreId = frame.frameId;
            arvoreEncontrada = true;
            break;
          }
        } catch (_) {}
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      if (!arvoreEncontrada) {
        await informar("A tela RELATÓRIOS abriu, mas a árvore não foi encontrada em nenhum frame do VITAI.");
        throw new Error("A árvore de relatórios não apareceu em nenhum frame da página. A automação parou antes de selecionar o relatório.");
      }

      const execucao = await chrome.scripting.executeScript({
        target: { tabId: aba.tabId, frameIds: [frameArvoreId] },
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
          const progresso = (texto) => window.postMessage({ origem: "VITAI_AUTOMACAO_PROGRESSO", texto }, location.origin);
          const normalizar = (valor) => String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();

          try {
            const $ = window.jQuery;

            // NAVEGAÇÃO PELA ÁRVORE DE RELATÓRIOS
            // Replica a sequência que funciona no Selenium: CDI -> EMERGÊNCIA -> relatório.
            // Para internação: INTERNAÇÃO -> Altas Hospitalares.
            const esperarElemento = async (seletor, limite = 20000) => {
              const inicio = Date.now();
              while (Date.now() - inicio < limite) {
                const el = document.querySelector(seletor);
                if (el) return el;
                await pausa(250);
              }
              return null;
            };

            const abrirRelatorios = async () => {
              if (document.querySelector("#treeview")) return;
              progresso("Abrindo a seção RELATÓRIOS...");
              const links = Array.from(document.querySelectorAll("a, span, button"))
                .filter(el => normalizar(el.textContent) === "RELATÓRIOS" || normalizar(el.textContent) === "RELATORIOS");
              const link = links.find(el => el.tagName === "A") ||
                links.find(el => el.closest("a"))?.closest("a") ||
                links.find(el => el.tagName === "SPAN") ||
                links[0];

              if (link) {
                link.scrollIntoView({ block: "center" });
                link.click();
                await pausa(500);
              }

              if (typeof window.openWindow === "function") {
                try { window.openWindow("3929", "reportcontainer.do", "/vitai"); } catch (_) {}
              }

              const arvore = await esperarElemento("#treeview", 25000);
              if (!arvore) {
                throw new Error("A árvore de relatórios não carregou. Abra RELATÓRIOS no VITAI e tente novamente.");
              }
            };

            const localizarNo = async (rotulo, limite = 15000) => {
              const desejado = normalizar(rotulo);
              const inicio = Date.now();
              while (Date.now() - inicio < limite) {
                const arvore = document.querySelector("#treeview");
                if (arvore) {
                  // Prioriza os spans de texto do Kendo TreeView, evitando clicar em
                  // contêineres-pai que repetem o texto de todos os descendentes.
                  const candidatos = Array.from(arvore.querySelectorAll("span.k-in, span"))
                    .filter(el => normalizar(el.textContent) === desejado && el.getClientRects().length > 0);
                  if (candidatos.length) return candidatos[0];
                }
                await pausa(300);
              }
              return null;
            };

            const clicarNo = async (rotulo, descricao = rotulo) => {
              progresso("Localizando " + descricao + " na árvore de relatórios...");
              const no = await localizarNo(rotulo);
              if (!no) throw new Error("Não foi possível localizar o rótulo " + rotulo + " na árvore de relatórios.");
              no.scrollIntoView({ block: "center" });
              await pausa(150);
              // Clique no próprio rótulo, como no script Selenium que funciona.
              no.click();
              await pausa(1200);
            };

            await abrirRelatorios();

            if (normalizar(args.grupo).includes("EMERG")) {
              // Pula o nó CDI e abre diretamente EMERGÊNCIA.
              await clicarNo("EMERGÊNCIA", "EMERGÊNCIA");
            } else {
              await clicarNo(args.grupo, args.grupo);
            }

            await clicarNo(args.nome, args.nome);

            progresso("Aguardando a grade de dados carregar...");
            const inicioEspera = Date.now();
            while (Date.now() - inicioEspera < 25000) {
              if (document.querySelector("#uiDtInicial") && document.querySelector("#uiDtFinal")) {
                break;
              }
              await pausa(500);
            }

            progresso("Configurando período e datas...");
            const periodoInput = document.querySelector("#uiPeriodo") || document.querySelector("input[aria-owns='uiPeriodo_listbox']");
            if (periodoInput) {
              periodoInput.click();
              await pausa(400);
              const lis = Array.from(document.querySelectorAll("li")).filter(li => normalizar(li.textContent).includes("PERSONALIZADO"));
              if (lis.length > 0) {
                lis[0].click();
              }
            }

            await pausa(800);
            const inicialInput = document.querySelector("#uiDtInicial");
            const finalInput = document.querySelector("#uiDtFinal");
            
            if (!inicialInput || !finalInput) throw new Error("Os campos de data não ficaram visíveis.");

            if ($) {
              const wIni = $(inicialInput).data("kendoDateTimePicker");
              const wFim = $(finalInput).data("kendoDateTimePicker");
              const partesIni = args.dataInicial.split("-").map(Number);
              const partesFim = args.dataFinal.split("-").map(Number);
              
              if (wIni && wFim) {
                wIni.value(new Date(partesIni[0], partesIni[1] - 1, partesIni[2], 0, 0, 0));
                wIni.trigger("change");
                wFim.value(new Date(partesFim[0], partesFim[1] - 1, partesFim[2], 23, 59, 59));
                wFim.trigger("change");
              } else {
                inicialInput.value = args.dataInicial;
                finalInput.value = args.dataFinal;
              }
            }

            progresso("Acionando exportação para Excel...");
            const botaoExcel = document.querySelector("#grid .k-grid-excel") || document.querySelector(".k-grid-excel");
            if (!botaoExcel) throw new Error("Botão de exportar para Excel não foi encontrado.");
            
            botaoExcel.click();

            return {
              ok: true,
              relatorio: args.nome,
              datasourceId: args.datasourceId,
              dataInicial: args.dataInicial,
              dataFinal: args.dataFinal,
              mensagem: "Período preenchido e exportação iniciada com sucesso."
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

      await informar("O VITAI preparou " + relatorio.nome + ". Aguardando o download do arquivo Excel...");
      await aguardarDownload(aba.tabId, inicioDownload, filename, 90000);
      resultados.push({
        relatorio: relatorio.nome,
        nomeArquivo: filename,
        ok: true
      });
      await informar("Relatório " + relatorio.nome + " baixado. " + (resultados.length < RELATORIOS.length ? "Preparando o próximo relatório..." : "Finalizando a exportação..."));
    }

    await chrome.storage.session.remove("pendingDownload");
    sendResponse({
      ok: true,
      resultados,
      mensagem: "Os dois relatórios foram exportados com sucesso."
    });
  } catch (erro) {
    await chrome.storage.session.remove("pendingDownload");
    await informar("A exportação foi interrompida: " + (erro && erro.message ? erro.message : String(erro)));
    sendResponse({
      ok: false,
      erro: erro && erro.message ? erro.message : String(erro),
      resultados
    });
  }
}

async function aguardarDownload(tabId, inicioMs, filename, limiteMs) {
  const inicioEspera = Date.now();
  const baseEsperada = filename.toLowerCase().replace(/\.xlsx$/i, "");
  let ultimoDiagnostico = "";

  while (Date.now() - inicioEspera < limiteMs) {
    const itens = await chrome.downloads.search({ orderBy: ["-startTime"], limit: 50 });
    const recentes = itens.filter(d => {
      const tempo = d.startTime ? Date.parse(d.startTime) : 0;
      return tempo >= inicioMs - 2000;
    });

    const item = recentes.find(d => {
      const nome = String(d.filename || "").split(/[\\\\/]/).pop().toLowerCase();
      const url = String(d.url || "").toLowerCase();
      const esperado = nome === filename.toLowerCase() || nome.endsWith("/" + filename.toLowerCase());
      const originalVitai = nome === "timedreportexport.xlsx" || /timedreportexport/.test(url);
      const origemVitai = Number(d.tabId) === Number(tabId) ||
        /https:\/\/hiam\.vitai\.care\//i.test(url);
      // Não aceitar qualquer XLSX: precisa corresponder ao nome esperado ou ao exportador do VITAI.
      return origemVitai && (esperado || originalVitai);
    });

    if (item) {
      const nomeItem = String(item.filename || "").split(/[\\\\/]/).pop();
      if (item.state === "complete") return { nomeArquivo: nomeItem, downloadId: item.id };
      if (item.state === "interrupted") {
        throw new Error("O download detectado (" + nomeItem + ") foi interrompido pelo Chrome.");
      }
      ultimoDiagnostico = "Arquivo detectado: " + nomeItem + " (estado: " + item.state + ").";
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  const itensFinais = await chrome.downloads.search({ orderBy: ["-startTime"], limit: 15 });
  const recentesFinais = itensFinais
    .filter(d => d.startTime && Date.parse(d.startTime) >= inicioMs - 2000)
    .map(d => {
      const nome = String(d.filename || "").split(/[\\\\/]/).pop();
      return nome + " [" + d.state + "]";
    });
  const detalhe = recentesFinais.length ? " Downloads recentes: " + recentesFinais.join("; ") :
    (ultimoDiagnostico ? " " + ultimoDiagnostico : " Nenhum download recente foi listado pelo Chrome.");
  throw new Error("O Chrome não confirmou a conclusão do download de " + filename + " em " +
    Math.round(limiteMs / 1000) + " segundos." + detalhe);
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
    const nomeOriginal = String(item.filename || "").split(/[\\\\/]/).pop();
    const url = String(item.url || "").toLowerCase();
    const idade = pendente ? Date.now() - Number(pendente.criadoEm || 0) : Infinity;
    const origemVitai = pendente && (
      Number(item.tabId) === Number(pendente.tabId) ||
      /https:\/\/hiam\.vitai\.care\//i.test(url) ||
      /timedreportexport/i.test(url)
    );
    const exportadorConhecido = /^timedreportexport(?:\\.xlsx)?$/i.test(nomeOriginal) ||
      /timedreportexport/i.test(url);
    if (pendente && origemVitai && idade >= -1000 && idade < 120000 && exportadorConhecido) {
      // Usa o nome planejado e substitui um arquivo que já exista.
      suggest({ filename: pendente.filename, conflictAction: "overwrite" });
      chrome.storage.session.remove("pendingDownload");
    } else {
      suggest();
    }
  });
  return true;
});
