(() => {
  const VITAI_ORIGIN = "https://hiam.vitai.care";

  if (location.hostname.endsWith(".vercel.app")) {
    window.addEventListener("message", (event) => {
      if (event.source !== window || !event.data || event.data.origem !== "AUTOMACAO_VITAI_HIAM") return;
      const tiposPermitidos = new Set(["VITAI_ABRIR_SISTEMA", "VITAI_EXECUTAR_RELATORIO", "VITAI_EXECUTAR_AMBOS"]);
      if (!tiposPermitidos.has(event.data.type)) return;

      chrome.runtime.sendMessage({
        type: event.data.type,
        relatorio: event.data.relatorio,
        dataInicial: event.data.dataInicial,
        dataFinal: event.data.dataFinal
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
  }
})();
