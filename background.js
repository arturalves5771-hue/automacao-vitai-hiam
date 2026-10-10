const VITAI_URL = "https://hiam.vitai.care/vitai/pages/login.do";

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
      sendResponse({ ok: true, tabId: tab.id });
    });

    return true;
  }

  if (message.type === "VITAI_REGISTRAR_ABA") {
    if (sender.tab && sender.tab.id) {
      vitaiTabId = sender.tab.id;
      chrome.storage.session.set({ vitaiTabId });
    }
    sendResponse({ ok: true });
    return;
  }

  if (message.type === "VITAI_EXECUTAR_RELATORIO") {
    chrome.storage.session.get("vitaiTabId", (dados) => {
      const tabId = dados.vitaiTabId || vitaiTabId;

      if (!tabId) {
        sendResponse({
          ok: false,
          erro: "Abra o VITAI e entre no sistema antes de solicitar um relatório."
        });
        return;
      }

      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError || !tab) {
          sendResponse({
            ok: false,
            erro: "Não encontrei a aba do VITAI. Abra o sistema novamente."
          });
          return;
        }

        chrome.tabs.sendMessage(tabId, {
          type: "VITAI_EXECUTAR_RELATORIO",
          relatorio: message.relatorio
        }, (resposta) => {
          if (chrome.runtime.lastError) {
            sendResponse({
              ok: false,
              erro: "Não consegui comunicar com a página do VITAI. Atualize a aba e tente novamente."
            });
            return;
          }

          sendResponse(resposta || { ok: false, erro: "O VITAI não retornou uma resposta." });
        });
      });
    });

    return true;
  }
});