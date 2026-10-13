console.log("BACKGROUND VITAI HIAM INICIADO");

let abaNossaPagina = null;
let abaVITAI = null;

chrome.runtime.onMessage.addListener(async function (message, sender) {

    if (message.type === "INICIAR_LOGIN_VITAI") {
        if (sender.tab) abaNossaPagina = sender.tab.id;

        await chrome.storage.session.set({
            loginVITAI: { username: message.username, password: message.password },
            operacaoAtual: "login",
            tentativaEnviada: false,
            abaNossaPagina: abaNossaPagina
        });

        const tab = await chrome.tabs.create({
            url: "https://hiam.vitai.care/vitai/pages/login.do",
            active: false
        });

        abaVITAI = tab.id;
        await chrome.storage.session.set({ abaVITAI: tab.id });
        return;
    }

    if (message.type === "EXPORTAR_RELATORIOS") {
        if (sender.tab) abaNossaPagina = sender.tab.id;

        if (!message.dataInicial || !message.dataFinal) {
            if (abaNossaPagina) {
                await chrome.tabs.sendMessage(abaNossaPagina, {
                    type: "EXPORTACAO_ERRO",
                    mensagem: "Informe a data inicial e a data final."
                });
            }
            return;
        }

        await chrome.storage.session.set({
            operacaoAtual: "exportar_relatorios",
            exportacaoDados: { dataInicial: message.dataInicial, dataFinal: message.dataFinal },
            exportacaoIniciada: false,
            abaNossaPagina: abaNossaPagina
        });

        const tab = await chrome.tabs.create({
            url: "https://hiam.vitai.care/vitai/pages/login.do",
            active: false
        });

        abaVITAI = tab.id;
        await chrome.storage.session.set({ abaVITAI: tab.id });
        return;
    }

    if (message.type === "VITAI_ESTADO") {
        const tabId = sender.tab?.id;
        if (!tabId) return;

        const dados = await chrome.storage.session.get([
            "loginVITAI", "abaVITAI", "abaNossaPagina", "operacaoAtual", "exportacaoDados", "exportacaoIniciada", "tentativaEnviada"
        ]);

        if (dados.abaVITAI !== tabId) return;

        if (dados.operacaoAtual === "login") {
            if (message.erroLogin) {
                if (dados.abaNossaPagina) {
                    try {
                        await chrome.tabs.sendMessage(dados.abaNossaPagina, {
                            type: "LOGIN_VITAI_ERRO",
                            mensagem: "Login ou senha incorreto(s)."
                        });
                    } catch (e) {}
                }
                await chrome.storage.session.set({ operacaoAtual: null });
                await chrome.storage.session.remove(["loginVITAI", "abaVITAI", "tentativaEnviada"]);
                setTimeout(async () => { try { await chrome.tabs.remove(tabId); } catch (e) {} }, 500);
                return;
            }

            if (message.telaLogin === true) {
                if (dados.tentativaEnviada) return;
                const login = dados.loginVITAI;
                if (!login) return;

                await chrome.storage.session.set({ tentativaEnviada: true });
                try {
                    await chrome.tabs.sendMessage(tabId, {
                        type: "PREENCHER_LOGIN",
                        username: login.username,
                        password: login.password
                    });
                } catch (erro) {}
                return;
            }

            if (message.telaLogin === false) {
                await chrome.storage.session.set({ operacaoAtual: null });
                await chrome.storage.session.remove(["loginVITAI", "abaVITAI", "tentativaEnviada"]);

                if (dados.abaNossaPagina) {
                    try {
                        await chrome.tabs.sendMessage(dados.abaNossaPagina, { type: "LOGIN_VITAI_SUCESSO" });
                    } catch (e) {}
                }

                setTimeout(async () => { try { await chrome.tabs.remove(tabId); } catch (e) {} }, 700);
                return;
            }
        }

        if (dados.operacaoAtual === "exportar_relatorios") {
            if (message.telaLogin === true) {
                if (dados.abaNossaPagina) {
                    try {
                        await chrome.tabs.sendMessage(dados.abaNossaPagina, {
                            type: "EXPORTACAO_ERRO",
                            mensagem: "Sessão expirada. Faça login novamente."
                        });
                    } catch (e) {}
                }
                await chrome.storage.session.set({ operacaoAtual: null });
                setTimeout(async () => { try { await chrome.tabs.remove(tabId); } catch (e) {} }, 500);
                return;
            }

            if (message.telaLogin === false && !dados.exportacaoIniciada) {
                const exp = dados.exportacaoDados;
                if (!exp) return;

                await chrome.storage.session.set({ exportacaoIniciada: true });

                try {
                    await chrome.tabs.sendMessage(tabId, {
                        type: "EXECUTAR_FLUXO_RELATORIOS",
                        dataInicial: exp.dataInicial,
                        dataFinal: exp.dataFinal
                    });
                } catch (e) {}
                return;
            }
        }
    }

    if (message.type === "ARQUIVO_BAIXADO_PRONTO") {
        const dados = await chrome.storage.session.get(["abaNossaPagina"]);
        if (!dados.abaNossaPagina) return;

        try {
            await chrome.tabs.sendMessage(dados.abaNossaPagina, {
                type: "GRAVAR_ARQUIVO_LOCAL",
                dataUrl: message.dataUrl,
                nomeArquivo: message.nomeArquivo,
                tipoRelatorio: message.tipoRelatorio
            });
        } catch (e) {}
        return;
    }

    if (message.type === "FLUXO_CONCLUIDO") {
        const dados = await chrome.storage.session.get(["abaNossaPagina", "abaVITAI"]);
        if (dados.abaNossaPagina) {
            try {
                await chrome.tabs.sendMessage(dados.abaNossaPagina, {
                    type: "EXPORTACAO_SUCESSO",
                    mensagem: message.mensagem
                });
            } catch (e) {}
        }
        await chrome.storage.session.set({ operacaoAtual: null });
        await chrome.storage.session.remove(["exportacaoDados", "exportacaoIniciada"]);
        if (dados.abaVITAI) {
            setTimeout(async () => { try { await chrome.tabs.remove(dados.abaVITAI); } catch (e) {} }, 1000);
        }
        return;
    }

    if (message.type === "EXPORTACAO_ERRO") {
        const dados = await chrome.storage.session.get(["abaNossaPagina", "abaVITAI"]);
        if (dados.abaNossaPagina) {
            try {
                await chrome.tabs.sendMessage(dados.abaNossaPagina, {
                    type: "EXPORTACAO_ERRO",
                    mensagem: message.mensagem
                });
            } catch (e) {}
        }
        await chrome.storage.session.set({ operacaoAtual: null });
        await chrome.storage.session.remove(["exportacaoDados", "exportacaoIniciada"]);
        if (dados.abaVITAI) {
            setTimeout(async () => { try { await chrome.tabs.remove(dados.abaVITAI); } catch (e) {} }, 500);
        }
        return;
    }
});
