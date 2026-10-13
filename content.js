console.log("AUTOMAÇÃO VITAI HIAM: content.js carregado");

window.addEventListener("message", function (event) {
    if (event.source !== window || !event.data) return;

    if (event.data.type === "VITAI_LOGIN") {
        if (!event.data.username || !event.data.password) return;
        chrome.runtime.sendMessage({
            type: "INICIAR_LOGIN_VITAI",
            username: event.data.username,
            password: event.data.password
        });
        return;
    }

    if (event.data.type === "EXPORTAR_RELATORIOS") {
        chrome.runtime.sendMessage({
            type: "EXPORTAR_RELATORIOS",
            dataInicial: event.data.dataInicial,
            dataFinal: event.data.dataFinal
        });
        return;
    }

    if (event.data.type === "ARQUIVO_PRONTO_PARA_GRAVAR") {
        chrome.runtime.sendMessage({
            type: "ARQUIVO_BAIXADO_PRONTO",
            dataUrl: event.data.dataUrl,
            nomeArquivo: event.data.nomeArquivo,
            tipoRelatorio: event.data.tipoRelatorio
        });
        return;
    }

    if (event.data.type === "FLUXO_CONCLUIDO") {
        chrome.runtime.sendMessage({
            type: "FLUXO_CONCLUIDO",
            mensagem: event.data.mensagem
        });
        return;
    }

    if (event.data.type === "ERRO_FLUXO") {
        chrome.runtime.sendMessage({
            type: "EXPORTACAO_ERRO",
            mensagem: event.data.mensagem
        });
        return;
    }
});

chrome.runtime.onMessage.addListener(function (message) {
    if (message.type === "LOGIN_VITAI_SUCESSO") {
        window.postMessage({ type: "LOGIN_VITAI_SUCESSO" }, "*");
        return;
    }
    if (message.type === "LOGIN_VITAI_ERRO") {
        window.postMessage({ type: "LOGIN_VITAI_ERRO", mensagem: message.mensagem }, "*");
        return;
    }
    if (message.type === "EXPORTACAO_SUCESSO") {
        window.postMessage({ type: "EXPORTACAO_SUCESSO", mensagem: message.mensagem }, "*");
        return;
    }
    if (message.type === "EXPORTACAO_ERRO") {
        window.postMessage({ type: "EXPORTACAO_ERRO", mensagem: message.mensagem }, "*");
        return;
    }
});

if (location.hostname.includes("vitai.care")) {
    console.log("EXTENSÃO EXECUTANDO NO HIAM VITAI.");

    function verificarEstadoLogin() {
        const campoUsuario = document.querySelector("#login");
        const campoSenha = document.querySelector("#senha");
        const telaLogin = !!campoUsuario && !!campoSenha;
        const textoPagina = document.body ? document.body.innerText : "";
        const erroLogin = telaLogin && (textoPagina.includes("incorreto") || textoPagina.includes("inválida") || textoPagina.includes("Erro"));
        return { telaLogin, erroLogin };
    }

    function informarEstado() {
        const estado = verificarEstadoLogin();
        chrome.runtime.sendMessage({
            type: "VITAI_ESTADO",
            telaLogin: estado.telaLogin,
            erroLogin: estado.erroLogin
        });
    }

    setTimeout(informarEstado, 800);

    let ultimoEstado = null;
    setInterval(function () {
        const estado = verificarEstadoLogin();
        if (estado.telaLogin !== ultimoEstado) {
            ultimoEstado = estado.telaLogin;
            informarEstado();
        }
    }, 500);

    chrome.runtime.onMessage.addListener(function (message) {
        if (message.type === "PREENCHER_LOGIN") {
            const campoUsuario = document.querySelector("#login");
            const campoSenha = document.querySelector("#senha");
            if (!campoUsuario || !campoSenha) return;

            campoUsuario.value = message.username;
            campoUsuario.dispatchEvent(new Event("input", { bubbles: true }));
            campoSenha.value = message.password;
            campoSenha.dispatchEvent(new Event("input", { bubbles: true }));

            setTimeout(() => {
                campoSenha.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, bubbles: true }));
            }, 500);
        }
    });

    // Função auxiliar para esperar o Kendo Grid carregar
    function esperarGridCarregar() {
        return new Promise((resolve) => {
            const intervalo = setInterval(() => {
                const loading = document.querySelector(".k-loading-mask");
                if (!loading) {
                    clearInterval(intervalo);
                    setTimeout(resolve, 1000);
                }
            }, 500);
        });
    }

    async function sleep(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    // Execução exata da árvore baseada no seu script Python
    chrome.runtime.onMessage.addListener(async function (message) {
        if (message.type !== "EXECUTAR_FLUXO_RELATORIOS") return;

        try {
            const dataIniTxt = message.dataInicial + " 00:00";
            const dataFimTxt = message.dataFinal + " 23:59";
            const dataIniNome = message.dataInicial.replace(/\//g, "-");
            const dataFimNome = message.dataFinal.replace(/\//g, "-");

            // 1. Clicar em RELATÓRIOS
            const relatorios = Array.from(document.querySelectorAll("a")).find(el => el.textContent.includes("RELATÓRIOS"));
            if (!relatorios) throw new Error("Menu RELATÓRIOS não encontrado.");
            relatorios.click();
            await sleep(1500);

            // 2. Clicar em CDI -> EMERGÊNCIA
            const cdi = Array.from(document.querySelectorAll("span")).find(el => el.textContent.trim() === "CDI");
            if (!cdi) throw new Error("Item CDI não encontrado na árvore.");
            cdi.click();
            await sleep(2000);

            const emergencia = Array.from(document.querySelectorAll("span")).find(el => el.textContent.trim() === "EMERGÊNCIA");
            if (!emergencia) throw new Error("Item EMERGÊNCIA não encontrado.");
            emergencia.click();
            await sleep(2000);

            // 3. Pacientes Registrados (PA)
            const pacientes = Array.from(document.querySelectorAll("span")).find(el => el.textContent.trim() === "Pacientes Registrados");
            if (!pacientes) throw new Error("Opção Pacientes Registrados não encontrada.");
            pacientes.click();
            await sleep(1500);

            await aplicarPeriodoEExportar(dataIniTxt, dataFimTxt, `PA-${dataIniNome}A${dataFimNome}`);

            // 4. INTERNAÇÃO -> Altas Hospitalares
            const internacao = Array.from(document.querySelectorAll("span")).find(el => el.textContent.trim() === "INTERNAÇÃO");
            if (!internacao) throw new Error("Item INTERNAÇÃO não encontrado.");
            internacao.click();
            await esperarGridCarregar();

            const altas = Array.from(document.querySelectorAll("span")).find(el => el.textContent.trim() === "Altas Hospitalares");
            if (!altas) throw new Error("Item Altas Hospitalares não encontrado.");
            altas.click();
            await esperarGridCarregar();

            await aplicarPeriodoEExportar(dataIniTxt, dataFimTxt, `ALTAS-${dataIniNome}A${dataFimNome}`);

            window.postMessage({ type: "FLUXO_CONCLUIDO", mensagem: "Relatórios PA e Altas exportados com sucesso!" }, "*");

        } catch (erro) {
            window.postMessage({ type: "ERRO_FLUXO", mensagem: erro.message }, "*");
        }
    });

    async function aplicarPeriodoEExportar(dtIni, dtFim, prefixoNome) {
        // Selecionar Personalizado no Kendo Dropdown
        const periodoInput = document.querySelector("input[aria-owns='uiPeriodo_listbox']");
        if (periodoInput) {
            periodoInput.click();
            await sleep(500);
            // Simula digitação e Enter
            periodoInput.value = "Personalizado";
            periodoInput.dispatchEvent(new Event('input', { bubbles: true }));
            periodoInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            await sleep(1000);
        }

        const inputDtIni = document.querySelector("#uiDtInicial");
        const inputDtFim = document.querySelector("#uiDtFinal");
        const btnRefresh = document.querySelector("#refreshButton");

        if (inputDtIni) {
            inputDtIni.value = dtIni;
            inputDtIni.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (inputDtFim) {
            inputDtFim.value = dtFim;
            inputDtFim.dispatchEvent(new Event('input', { bubbles: true }));
        }
        await sleep(500);

        if (btnRefresh) {
            btnRefresh.click();
        }
        await esperarGridCarregar();

        // Clicar no botão de exportar Excel do Kendo Grid
        const btnExcel = document.querySelector(".k-grid-excel");
        if (!btnExcel) throw new Error("Botão de exportar Excel (.k-grid-excel) não localizado.");
        
        // Interceptando download via link gerado pelo grid ou clique direto
        btnExcel.click();
        await sleep(3000); // Aguarda geração do excel pelo grid
    }
}
