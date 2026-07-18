function doGet() {
  return HtmlService.createTemplateFromFile("Index")
    .evaluate()
    .setTitle("SESMT HRC - Perfil de Saúde")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(nomeArquivo) {
  const nome = String(nomeArquivo || "");
  if (!CONFIG.includes[nome]) throw new Error("Include não permitido: " + nome);
  return HtmlService.createHtmlOutputFromFile(nome).getContent();
}

function carregarView(nomeView) {
  const chave = normalizarChave(nomeView || "perfil");
  const arquivo = CONFIG.views[chave] || CONFIG.views.perfil;
  return HtmlService.createHtmlOutputFromFile(arquivo).getContent();
}

function carregarConfiguracoes() {
  return medirPerformance("carregarConfiguracoes", () => {
    const bases = Object.keys(CONFIG.sheets).map(key => {
      const info = lerBase(key, { somenteCabecalho: true });
      return {
        key,
        nome: CONFIG.sheets[key].name,
        headerRow: CONFIG.sheets[key].headerRow,
        encontrada: info.encontrada,
        headers: info.headers
      };
    });
    const perfil = carregarRegistrosPerfil_();
    return {
      pageSize: CONFIG.pageSize,
      bases,
      statusOptions: montarOpcoesStatus_(perfil.map(r => r.status)),
      updatedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm")
    };
  });
}

function limparCachePerfilSaude() {
  CacheService.getScriptCache().removeAll([
    chaveCache("perfil"), chaveCache("patologias"), chaveCache("afastamentos"),
    chaveCache("vacinas"), chaveCache("exames"), chaveCache("acidentes"), chaveCache("diagnostico")
  ]);
  return { sucesso: true, mensagem: "Cache limpo." };
}

function validarTemplatesPortal() {
  const html = HtmlService.createTemplateFromFile("Index").evaluate().getContent();
  const problemas = [];
  if (html.indexOf('include("Style")') !== -1 || html.indexOf("<?") !== -1) problemas.push("Scriptlet não processado no HTML final.");
  if (html.indexOf("<style>") === -1) problemas.push("CSS não injetado.");
  if (html.indexOf("<script>") === -1) problemas.push("JavaScript não injetado.");
  return { sucesso: problemas.length === 0, problemas, tamanhoHtml: html.length };
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Painel Perfil de Saúde")
    .addItem("Limpar cache", "limparCachePerfilSaude")
    .addItem("Validar templates", "validarTemplatesPortal")
    .addItem("Diagnóstico geral", "diagnosticarBases")
    .addToUi();
}
