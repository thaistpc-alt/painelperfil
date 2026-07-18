function doGet() {
  return HtmlService.createTemplateFromFile("Index")
    .evaluate()
    .setTitle("SESMT HRC - Perfil de Saúde")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(nomeArquivo) {
  var nome = String(nomeArquivo || "");
  var permitidos = { Style: true, JavaScript: true, Components: true };
  if (!permitidos[nome]) throw new Error("Include não permitido: " + nome);
  return HtmlService.createHtmlOutputFromFile(nome).getContent();
}

function carregarView(nomeView) {
  var chave = String(nomeView || "perfil").toLowerCase().replace(/[^a-z0-9]/g, "");
  var views = {
    perfil: "Perfil",
    patologias: "Patologias",
    afastamentos: "Afastamentos",
    vacinas: "Vacinas",
    exames: "Exames",
    seguimento: "SeguimentoExames",
    acidentes: "AcidentesBiologicos"
  };
  var arquivo = views[chave] || views.perfil;
  return HtmlService.createHtmlOutputFromFile(arquivo).getContent();
}

function carregarConfiguracoes() {
  var sheets = {
    perfil: { name: "BD PERFIL", headerRow: 1 },
    patologias: { name: "BD PATOLOGIAS", headerRow: 1 },
    vacinas: { name: "BD VACINAS", headerRow: 1 },
    afastamentos: { name: "BD AFASTAMENTOS", headerRow: 3 },
    exames: { name: "BD EXAMES COMPLEMENTARES", headerRow: 1 },
    acidentes: { name: "BD ACIDENTES", headerRow: 1 },
    examesAcidentes: { name: "EXAMES ACIDENTES", headerRow: 2 }
  };
  var bases = [];
  Object.keys(sheets).forEach(function(key) {
    bases.push({ key: key, nome: sheets[key].name, headerRow: sheets[key].headerRow });
  });
  return {
    pageSize: 50,
    bases: bases,
    statusOptions: [
      { nome: "Ativo", selected: true },
      { nome: "Ativo - Reabilitado", selected: true },
      { nome: "Gestante", selected: true },
      { nome: "Desligado", selected: false },
      { nome: "Óbito", selected: false },
      { nome: "Transferido", selected: false },
      { nome: "Suspenso", selected: false },
      { nome: "Aposentado", selected: false },
      { nome: "Afastado pelo INSS", selected: false },
      { nome: "Licença-maternidade", selected: false },
      { nome: "Não informado", selected: true }
    ],
    updatedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm")
  };
}

function limparCachePerfilSaude() {
  CacheService.getScriptCache().removeAll([
    chaveCache("perfil"), chaveCache("patologias"), chaveCache("afastamentos"),
    chaveCache("vacinas"), chaveCache("exames"), chaveCache("seguimento"), chaveCache("acidentes"), chaveCache("diagnostico")
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
      exames: { name: "BD EXAMES COMPLEMENTARES" },
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

function testarCarregamentoModulosPainel() {
  var testes = {
    configuracoes: function() { return carregarConfiguracoes(); },
    perfil: function() { return carregarResumoPerfil(); },
    patologias: function() { return carregarPatologias(); },
    afastamentos: function() { return carregarAfastamentos(); },
    vacinas: function() { return carregarVacinas(); },
    exames: function() { return carregarExames(); },
    seguimento: function() { return carregarTratativasAcidentes(); },
    acidentes: function() { return carregarAcidentes(); }
  };
  var saida = {};
  Object.keys(testes).forEach(function(nome) {
    var inicio = Date.now();
    try {
      saida[nome] = resumoRetornoModulo_(testes[nome](), Date.now() - inicio);
    } catch (e) {
      saida[nome] = { sucesso: false, erro: e && e.stack ? e.stack : String(e), tempoMs: Date.now() - inicio };
    }
  });
  return saida;
}

function resumoRetornoModulo_(ret, tempoMs) {
  ret = ret || {};
  return {
    sucesso: true,
    tempoMs: tempoMs,
    updatedAt: ret.updatedAt || "",
    registros: ret.registros ? ret.registros.length : "",
    colaboradores: ret.colaboradores ? ret.colaboradores.length : "",
    totalRegistros: ret.totalRegistros || "",
    retornoLimitado: !!ret.retornoLimitado,
    origem: ret.origem || "",
    performance: ret.performance || ""
  };
}
