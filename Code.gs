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
    return {
      pageSize: CONFIG.pageSize,
      bases: Object.keys(CONFIG.sheets).map(key => ({
        key,
        nome: CONFIG.sheets[key].name,
        headerRow: CONFIG.sheets[key].headerRow
      })),
      statusOptions: montarOpcoesStatus_(["Ativo", "Ativo - Reabilitado", "Gestante", "Desligado", "Óbito", "Transferido", "Suspenso", "Aposentado", "Afastado pelo INSS", "Licença-maternidade", "Não informado"]),
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

function autorizarPainelPerfilSaude() {
  var cfg = (typeof CONFIG !== "undefined") ? CONFIG : {
    spreadsheetId: "1ap49yRtC1HfT89yYFMmHPXZlvUyLGqeEGx9LuwoD-rY",
    sheets: {
      perfil: { name: "BD PERFIL" },
      patologias: { name: "BD PATOLOGIAS" },
      vacinas: { name: "BD VACINAS" },
      afastamentos: { name: "BD AFASTAMENTOS" },
      acidentes: { name: "BD ACIDENTES" },
      examesAcidentes: { name: "EXAMES ACIDENTES" }
    }
  };
  var ss = SpreadsheetApp.openById(cfg.spreadsheetId);
  var abas = {};
  Object.keys(cfg.sheets).forEach(function(key) {
    var sheet = ss.getSheetByName(cfg.sheets[key].name);
    abas[key] = sheet ? {
      nome: sheet.getName(),
      linhas: sheet.getLastRow(),
      colunas: sheet.getLastColumn()
    } : {
      nome: cfg.sheets[key].name,
      erro: "Aba não encontrada"
    };
  });
  return {
    sucesso: true,
    planilha: ss.getName(),
    abas: abas,
    timezone: Session.getScriptTimeZone(),
    usuario: Session.getActiveUser().getEmail()
  };
}

function diagnosticoRuntimePainel() {
  var funcoes = [
    "carregarResumoPerfil",
    "carregarPatologias",
    "carregarAfastamentos",
    "carregarVacinas",
    "carregarExames",
    "carregarAcidentes",
    "carregarTratativasAcidentes",
    "diagnosticarBases",
    "garantirColunasTratativasAcidentes"
  ];
  var status = {};
  funcoes.forEach(function(nome) {
    status[nome] = typeof this[nome] === "function";
  }, this);
  return {
    sucesso: true,
    configDisponivel: typeof CONFIG !== "undefined",
    funcoes: status,
    data: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss")
  };
}
