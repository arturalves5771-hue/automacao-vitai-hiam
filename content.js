(() => {
  const VITAI_ORIGIN = "https://hiam.vitai.care";

  if (location.hostname.endsWith(".vercel.app")) {
    chrome.runtime.onMessage.addListener((message) => {
      if (message && message.type === "VITAI_PROGRESS") {
        window.postMessage({ origem: "EXTENSAO_VITAI_HIAM", type: "VITAI_PROGRESS", texto: message.texto || "" }, location.origin);
      }
    });
    window.addEventListener("message", (event) => {
      if (event.source !== window || !event.data || event.data.origem !== "AUTOMACAO_VITAI_HIAM") return;
      const tiposPermitidos = new Set(["VITAI_ABRIR_SISTEMA", "VITAI_EXECUTAR_RELATORIO", "VITAI_EXECUTAR_AMBOS", "VITAI_LOGIN_E_EXECUTAR_AMBOS", "VITAI_LOGIN_VITAI"]);
      if (!tiposPermitidos.has(event.data.type)) return;

      chrome.runtime.sendMessage({
        type: event.data.type,
        relatorio: event.data.relatorio,
        dataInicial: event.data.dataInicial,
        dataFinal: event.data.dataFinal,
        usuario: event.data.usuario,
        senha: event.data.senha
      }, (resposta) => {
        window.postMessage({
          origem: "EXTENSAO_VITAI_HIAM",
          type: event.data.type + "_RESPOSTA",
          relatorio: event.data.relatorio,
          resposta: resposta || {
            ok: false,
            erro: chrome.runtime.lastError ? chrome.runtime.lastError.message : "Sem resposta da extensão."
          }
        }, location.origin);
      });
    });
    return;
  }

  if (location.origin === VITAI_ORIGIN) {
    chrome.runtime.sendMessage({ type: "VITAI_REGISTRAR_ABA" });
    window.addEventListener("message", (event) => {
      if (event.source !== window || event.origin !== location.origin ||
          !event.data || event.data.origem !== "VITAI_AUTOMACAO_PROGRESSO") return;
      chrome.runtime.sendMessage({ type: "VITAI_PROGRESS_INTERNO", texto: String(event.data.texto || "") });
    });
  }
})();
