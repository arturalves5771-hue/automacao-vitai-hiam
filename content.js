(() => {
  const VITAI_ORIGIN = "https://hiam.vitai.care";

  // Na página de controle (Vercel), encaminha comandos da interface para a extensão.
  if (location.hostname.endsWith(".vercel.app")) {
    window.addEventListener("message", (event) => {
      if (event.source !== window || !event.data || event.data.origem !== "AUTOMACAO_VITAI_HIAM") {
        return;
      }

      const tiposPermitidos = new Set([
        "VITAI_ABRIR_SISTEMA",
        "VITAI_EXECUTAR_RELATORIO"
      ]);

      if (!tiposPermitidos.has(event.data.type)) return;

      chrome.runtime.sendMessage({
        type: event.data.type,
        relatorio: event.data.relatorio
      }, (resposta) => {
        window.postMessage({
          origem: "EXTENSAO_VITAI_HIAM",
          type: event.data.type + "_RESPOSTA",
          resposta: resposta || {
            ok: false,
            erro: chrome.runtime.lastError ? chrome.runtime.lastError.message : "Sem resposta da extensão."
          }
        }, location.origin);
      });
    });

    return;
  }

  if (location.origin !== VITAI_ORIGIN) return;

  chrome.runtime.sendMessage({ type: "VITAI_REGISTRAR_ABA" });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type !== "VITAI_EXECUTAR_RELATORIO") return;

    // A automação dos relatórios será ligada aos menus e filtros reais após
    // confirmarmos a tela interna do VITAI, sem presumir caminhos ou parâmetros.
    sendResponse({
      ok: false,
      etapa: "mapeamento",
      erro: "A conexão com o VITAI está pronta, mas este relatório ainda precisa ser configurado. Envie uma captura de tela da tela inicial após o login, sem dados de pacientes visíveis."
    });
  });
})();