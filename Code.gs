/*************************************************************
 * PAINEL PERFIL DE SAÚDE SESMT HRC
 * Code.gs
 * Versão 6.0 - Otimização de carregamento e cache
 *************************************************************/

const CONFIG = {
  spreadsheetId: "1ap49yRtC1HfT89yYFMmHPXZlvUyLGqeEGx9LuwoD-rY",
  cachePrefix: "PAINEL_PERFIL_SAUDE_V60_",
  cacheTime: 600,
  sheets: {
    perfil: "BD PERFIL",
    patologias: "BD PATOLOGIAS",
    afastamentos: "BD AFASTAMENTOS",
    vacinas: "BD VACINAS",
    exames: "BD EXAMES",
    acidentes: "ACID. BIO. COLAB."
  }
};

function doGet() {
  return HtmlService
    .createTemplateFromFile("Index")
    .evaluate()
    .setTitle("PAINEL PERFIL DE SAÚDE SESMT HRC")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(nomeArquivo) {
  return HtmlService.createHtmlOutputFromFile(nomeArquivo).getContent();
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Painel Perfil de Saúde")
    .addItem("Limpar cache do portal", "limparCachePerfilSaude")
    .addItem("Testar aba Perfil", "testarPerfilSaude")
    .addItem("Testar aba Patologias", "testarPatologias")
    .addItem("Testar aba Afastamentos", "testarAfastamentos")
    .addItem("Testar aba Vacinas", "testarVacinas")
    .addItem("Diagnosticar Vacinas", "diagnosticarVacinasIndicadores")
    .addToUi();
}

let SS_CACHE_PERFIL_SAUDE = null;

function getSpreadsheet() {
  if (!SS_CACHE_PERFIL_SAUDE) {
    SS_CACHE_PERFIL_SAUDE = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  }
  return SS_CACHE_PERFIL_SAUDE;
}

function getCache() {
  return CacheService.getScriptCache();
}

function chaveCache(nome) {
  return CONFIG.cachePrefix + nome;
}

function cacheJsonPutSeguro(cache, key, objeto) {
  try {
    const texto = JSON.stringify(objeto);
    // CacheService aceita valores de até ~100 KB. Evita erro quando a aba retorna registros detalhados.
    if (texto.length < 90000) {
      cache.put(key, texto, CONFIG.cacheTime);
    }
  } catch (e) {
    // Se não couber em cache, o portal continua funcionando normalmente.
  }
}

function limparCachePerfilSaude() {
  const cache = getCache();
  [
    "VIEW_Perfil", "VIEW_Patologias", "VIEW_Afastamentos", "VIEW_Vacinas", "VIEW_AcidentesBiologicos",
    "DADOS_PERFIL", "DADOS_PATOLOGIAS", "DADOS_VACINAS", "DADOS_AFASTAMENTOS"
  ].forEach(k => cache.remove(chaveCache(k)));
  return { sucesso: true, mensagem: "Cache limpo com sucesso." };
}

function carregarView(nomeView) {
  const permitidas = {
    perfil: "Perfil",
    patologias: "Patologias",
    afastamentos: "Afastamentos",
    vacinas: "Vacinas",
    acidentes: "AcidentesBiologicos"
  };

  const arquivo = permitidas[String(nomeView || "").toLowerCase()] || "Perfil";
  const key = chaveCache("VIEW_" + arquivo);
  const cache = getCache();
  const cached = cache.get(key);
  if (cached) return cached;

  const html = HtmlService.createHtmlOutputFromFile(arquivo).getContent();
  cache.put(key, html, CONFIG.cacheTime);
  return html;
}

function lerAba(nomeAba) {
  const aba = getSpreadsheet().getSheetByName(nomeAba);
  if (!aba) return [];

  const lastCol = aba.getLastColumn();
  const lastRowPlanilha = aba.getLastRow();
  if (lastRowPlanilha < 1 || lastCol < 1) return [];

  // Otimização importante: várias abas possuem fórmulas até linhas muito abaixo
  // dos colaboradores reais. Usamos a coluna B (NOME) como referência para
  // encontrar a última linha útil e evitar ler milhares de linhas vazias.
  const colunaReferencia = 2;
  const valoresRef = aba.getRange(1, colunaReferencia, lastRowPlanilha, 1).getValues();
  let lastRowUtil = lastRowPlanilha;

  for (let i = valoresRef.length - 1; i >= 0; i--) {
    if (limparTexto(valoresRef[i][0]) !== "") {
      lastRowUtil = i + 1;
      break;
    }
  }

  if (lastRowUtil < 1) return [];
  return aba.getRange(1, 1, lastRowUtil, lastCol).getValues();
}

/* ===========================================================
 * UTILITÁRIOS
 * =========================================================== */

function normalizarTexto(valor) {
  if (valor === null || valor === undefined) return "";
  return String(valor)
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function limparTexto(valor) {
  if (valor === null || valor === undefined) return "";
  const texto = String(valor).trim();
  if (["#N/A", "#VALUE!", "#REF!", "#DIV/0!", "undefined", "null"].indexOf(texto) !== -1) return "";
  return texto;
}

function numeroSeguro(valor) {
  if (valor === null || valor === undefined || valor === "") return 0;
  if (typeof valor === "number") return valor;
  const n = Number(String(valor).replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? 0 : n;
}

function dataSegura(valor) {
  if (!valor) return null;
  if (Object.prototype.toString.call(valor) === "[object Date]" && !isNaN(valor.getTime())) return valor;
  if (typeof valor === "number") return new Date(Math.round((valor - 25569) * 86400 * 1000));
  const texto = String(valor).trim();
  const m = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const ano = Number(m[3].length === 2 ? "20" + m[3] : m[3]);
    return new Date(ano, Number(m[2]) - 1, Number(m[1]));
  }
  const dt = new Date(texto);
  return isNaN(dt.getTime()) ? null : dt;
}

function formatarData(valor) {
  const dt = dataSegura(valor);
  if (!dt) return limparTexto(valor);
  return Utilities.formatDate(dt, Session.getScriptTimeZone(), "dd/MM/yyyy");
}

function obterAno(valor) {
  const dt = dataSegura(valor);
  if (dt) return dt.getFullYear();
  const achado = String(valor || "").match(/\b(19\d{2}|20\d{2})\b/);
  return achado ? Number(achado[1]) : "";
}

function obterMes(valor) {
  const dt = dataSegura(valor);
  return dt ? (dt.getMonth() + 1) : 0;
}

function localizarLinhaCabecalho(dados, nomesObrigatorios) {
  const limite = Math.min((dados || []).length, 20);
  for (let i = 0; i < limite; i++) {
    const linha = dados[i].map(normalizarTexto);
    let encontrados = 0;
    (nomesObrigatorios || []).forEach(nome => {
      if (linha.indexOf(normalizarTexto(nome)) !== -1) encontrados++;
    });
    if (encontrados >= nomesObrigatorios.length) return i;
  }
  return 0;
}

function mapaCabecalho(linhaCabecalho) {
  const mapa = {};
  (linhaCabecalho || []).forEach((cabecalho, indice) => {
    const chave = normalizarTexto(cabecalho);
    if (chave) mapa[chave] = indice;
  });
  return mapa;
}

function indiceCabecalho(mapa, nomesPossiveis) {
  for (let i = 0; i < nomesPossiveis.length; i++) {
    const chave = normalizarTexto(nomesPossiveis[i]);
    if (Object.prototype.hasOwnProperty.call(mapa, chave)) return mapa[chave];
  }
  return -1;
}

function valorLinha(linha, indice) {
  if (indice < 0) return "";
  return linha[indice];
}

function ordenarLista(lista) {
  return (lista || [])
    .filter(v => v !== null && v !== undefined && String(v).trim() !== "")
    .sort((a, b) => String(a).localeCompare(String(b), "pt-BR"));
}

function incrementarGrupo(objeto, chave, quantidade) {
  const nome = limparTexto(chave) || "Não informado";
  if (!objeto[nome]) objeto[nome] = 0;
  objeto[nome] += quantidade || 1;
}

function transformarGrupoEmArray(objeto) {
  return Object.keys(objeto)
    .map(chave => ({ nome: chave, quantidade: objeto[chave] }))
    .sort((a, b) => b.quantidade - a.quantidade);
}

function considerarColaboradorMacro(status) {
  const s = normalizarTexto(status);
  return s !== "" && s !== "DESLIGADO" && s !== "TRANSFERIDO" && s !== "OBITO" && s !== "OBITO." && s !== "FALECIDO";
}

function considerarNaAnalisePatologia(status) {
  const s = normalizarTexto(status);
  return s === "ATIVO" ||
    s === "ATIVO - REABILITADO" ||
    s === "ATIVO REABILITADO" ||
    s.indexOf("REABILIT") !== -1 ||
    s === "LICENCA MATERNIDADE" ||
    s === "LICENÇA MATERNIDADE" ||
    s === "AFASTADO (INSS)" ||
    s === "AFASTADO INSS" ||
    (s.indexOf("AFASTADO") !== -1 && s.indexOf("INSS") !== -1) ||
    s === "GESTANTE";
}

function considerarNaAnaliseVacinas(status) {
  return considerarNaAnalisePatologia(status);
}

function isAtivoOuReabilitado(status) {
  const s = normalizarTexto(status);
  return s === "ATIVO" || s.indexOf("REABILIT") !== -1;
}

function familiaCidCodigo(cid) {
  const texto = limparTexto(cid).toUpperCase();
  const encontrado = texto.match(/[A-Z]/);
  return encontrado ? encontrado[0] : "";
}

function descricaoFamiliaCid(familia) {
  const mapa = {
    A: "Algumas doenças infecciosas e parasitárias", B: "Algumas doenças infecciosas e parasitárias",
    C: "Neoplasias", D: "Neoplasias / doenças do sangue e órgãos hematopoéticos",
    E: "Doenças endócrinas, nutricionais e metabólicas", F: "Transtornos mentais e comportamentais",
    G: "Doenças do sistema nervoso", H: "Doenças do olho, ouvido e anexos",
    I: "Doenças do aparelho circulatório", J: "Doenças do aparelho respiratório",
    K: "Doenças do aparelho digestivo", L: "Doenças da pele e tecido subcutâneo",
    M: "Doenças do sistema osteomuscular e tecido conjuntivo", N: "Doenças do aparelho geniturinário",
    O: "Gravidez, parto e puerpério", P: "Afecções originadas no período perinatal",
    Q: "Malformações congênitas e anomalias cromossômicas", R: "Sintomas, sinais e achados anormais",
    S: "Lesões, envenenamentos e causas externas", T: "Lesões, envenenamentos e causas externas",
    U: "Códigos para propósitos especiais", V: "Causas externas de morbidade e mortalidade",
    W: "Causas externas de morbidade e mortalidade", X: "Causas externas de morbidade e mortalidade",
    Y: "Causas externas de morbidade e mortalidade", Z: "Fatores que influenciam o estado de saúde"
  };
  return mapa[String(familia || "").toUpperCase()] || "Família CID não classificada";
}

function classificarSimNaoNaoInformado(valor) {
  const v = normalizarTexto(valor);
  if (v === "" || v === "NAO INFORMADO" || v === "N/I" || v === "NI" || v === "IGNORADO") return "Não informado";
  if (v === "SIM" || v === "S" || v === "YES") return "Sim";
  if (v === "NAO" || v === "NÃO" || v === "N" || v === "NO") return "Não";
  return limparTexto(valor) || "Não informado";
}

function graficoSimNaoNaoInformado(registros, campo) {
  const grupo = { "Sim": 0, "Não": 0, "Não informado": 0 };
  (registros || []).forEach(item => {
    const classe = classificarSimNaoNaoInformado(item[campo]);
    if (!Object.prototype.hasOwnProperty.call(grupo, classe)) grupo[classe] = 0;
    grupo[classe]++;
  });
  const ordem = { "Sim": 1, "Não": 2, "Não informado": 3 };
  return Object.keys(grupo)
    .map(chave => ({ nome: chave, quantidade: grupo[chave] }))
    .filter(item => item.quantidade > 0)
    .sort((a, b) => (ordem[a.nome] || 99) - (ordem[b.nome] || 99));
}

function classificarVacinaCompleta(valorSituacao, fallbackCompleto) {
  const v = normalizarTexto(valorSituacao);

  // Atenção: verificar INCOMPLETO antes de COMPLETO, pois "INCOMPLETO" contém "COMPLETO".
  if (
    v.indexOf("INCOMPLETO") !== -1 ||
    v.indexOf("INCOMPLETA") !== -1 ||
    v.indexOf("EM ATUALIZACAO") !== -1 ||
    v.indexOf("EM ATUALIZAÇÃO") !== -1 ||
    v.indexOf("PEND") !== -1
  ) return false;

  if (
    v.indexOf("COMPLETO") !== -1 ||
    v.indexOf("COMPLETA") !== -1 ||
    v.indexOf("ATUALIZAD") !== -1 ||
    v.indexOf("IMUNIZADO") !== -1
  ) return true;

  return !!fallbackCompleto;
}

function classificarCovidCompleta(valorSituacao, fallbackCompleto) {
  const v = normalizarTexto(valorSituacao);

  // Atenção: verificar INCOMPLETO antes de COMPLETO, pois "INCOMPLETO" contém "COMPLETO".
  if (
    v.indexOf("NAO VACINADO") !== -1 ||
    v.indexOf("NÃO VACINADO") !== -1 ||
    v.indexOf("INCOMPLET") !== -1 ||
    v.indexOf("EM ATUALIZACAO") !== -1 ||
    v.indexOf("EM ATUALIZAÇÃO") !== -1 ||
    v.indexOf("PEND") !== -1
  ) return false;

  if (
    v.indexOf("VACINADO") !== -1 ||
    v.indexOf("ATUALIZAD") !== -1 ||
    v.indexOf("COMPLET") !== -1 ||
    v.indexOf("IMUNIZADO") !== -1
  ) return true;

  return !!fallbackCompleto;
}

function classificarEsquemaVacinalGeral(valorSituacao) {
  const v = normalizarTexto(valorSituacao);
  if (v.indexOf("PEND") !== -1 || v.indexOf("INCOMPLET") !== -1) return false;
  return v.indexOf("VACINAS ATUALIZADAS") !== -1 || v.indexOf("ATUALIZAD") !== -1 || v.indexOf("COMPLET") !== -1;
}

/* ===========================================================
 * EXTRAÇÕES
 * =========================================================== */

function extrairPerfil() {
  const dados = lerAba(CONFIG.sheets.perfil);
  if (dados.length < 2) return [];

  const linhaCab = localizarLinhaCabecalho(dados, ["NOME"]);
  const cab = mapaCabecalho(dados[linhaCab]);

  const idxMat = indiceCabecalho(cab, ["MAT", "MATRICULA", "MATRÍCULA", "CHAPA"]);
  const idxNome = indiceCabecalho(cab, ["NOME", "NOME COMPLETO"]);
  const idxStatus = indiceCabecalho(cab, ["STATUS", "SITUACAO", "SITUAÇÃO"]);
  const idxFuncao = indiceCabecalho(cab, ["FUNCAO", "FUNÇÃO", "CARGO"]);
  const idxSetor = indiceCabecalho(cab, ["SETOR"]);
  const idxSexoCab = indiceCabecalho(cab, ["SEXO", "GENERO", "GÊNERO"]);
  const idxSexo = idxSexoCab >= 0 ? idxSexoCab : 10;
  const idxIdade = indiceCabecalho(cab, ["IDADE"]);

  const registros = [];
  for (let i = linhaCab + 1; i < dados.length; i++) {
    const linha = dados[i];
    const mat = limparTexto(valorLinha(linha, idxMat));
    const nome = limparTexto(valorLinha(linha, idxNome));
    if (!mat && !nome) continue;
    registros.push({
      mat,
      nome,
      status: limparTexto(valorLinha(linha, idxStatus)),
      funcao: limparTexto(valorLinha(linha, idxFuncao)),
      setor: limparTexto(valorLinha(linha, idxSetor)),
      sexo: limparTexto(valorLinha(linha, idxSexo)),
      idade: numeroSeguro(valorLinha(linha, idxIdade))
    });
  }
  return registros;
}

function extrairPatologias() {
  const dados = lerAba(CONFIG.sheets.patologias);
  if (dados.length < 2) return [];

  const registros = [];
  const IDX_MAT = 0;
  const IDX_NOME = 1;
  const IDX_STATUS = 2;
  const IDX_CID1 = 3;
  const IDX_CID2 = 4;
  const IDX_CID3 = 5;
  const IDX_CID4 = 6;
  const IDX_CID5 = 7;
  const IDX_ATIVIDADE = 11;
  const IDX_TABAGISTA = 14;
  const IDX_FUNCAO = 20;
  const IDX_SETOR = 21;
  const IDX_ATIVIDADE_2 = 25;
  const IDX_IDADE = 28;

  for (let i = 1; i < dados.length; i++) {
    const linha = dados[i];
    const mat = limparTexto(linha[IDX_MAT]);
    const nome = limparTexto(linha[IDX_NOME]);
    if (!mat && !nome) continue;

    const cids = [linha[IDX_CID1], linha[IDX_CID2], linha[IDX_CID3], linha[IDX_CID4], linha[IDX_CID5]]
      .map(v => limparTexto(v).toUpperCase().replace(/\s+/g, ""))
      .filter(v => v !== "" && v !== "NAO" && v !== "NÃO" && v !== "SEM CID" && v !== "SEMCID" && v !== "-" && v !== "0");

    const familiasMap = {};
    cids.forEach(cid => {
      const familia = familiaCidCodigo(cid);
      if (familia) familiasMap[familia] = true;
    });

    registros.push({
      mat,
      nome,
      status: limparTexto(linha[IDX_STATUS]),
      funcao: limparTexto(linha[IDX_FUNCAO]),
      setor: limparTexto(linha[IDX_SETOR]),
      sexo: "",
      idade: numeroSeguro(linha[IDX_IDADE]),
      possuiPatologia: cids.length > 0 ? "Sim" : "Não",
      cids,
      familiasCid: Object.keys(familiasMap).sort(),
      cid1: cids[0] || "",
      cid2: cids[1] || "",
      cid3: cids[2] || "",
      cid4: cids[3] || "",
      cid5: cids[4] || "",
      atividadeFisica: limparTexto(linha[IDX_ATIVIDADE_2]) || limparTexto(linha[IDX_ATIVIDADE]),
      tabagista: limparTexto(linha[IDX_TABAGISTA])
    });
  }

  return registros;
}

function extrairAfastamentos() {
  const dados = lerAba(CONFIG.sheets.afastamentos);
  if (dados.length < 2) return [];

  const linhaCab = localizarLinhaCabecalho(dados, ["NOME", "DTINICIO"]);
  const cab = mapaCabecalho(dados[linhaCab]);

  const idxMat = indiceCabecalho(cab, ["CHAPA", "MAT", "MATRICULA", "MATRÍCULA"]);
  const idxNome = indiceCabecalho(cab, ["NOME", "NOME COMPLETO"]);
  const idxFuncao = indiceCabecalho(cab, ["FUNCAO", "FUNÇÃO", "CARGO"]);
  const idxSetor = indiceCabecalho(cab, ["SETOR"]);
  const idxInicio = indiceCabecalho(cab, ["DTINICIO", "DATA INICIO", "DATA DE INICIO", "DATA INICIAL"]);
  const idxFim = indiceCabecalho(cab, ["DTFINAL", "DATA FINAL", "DATA FIM", "DATA DE FIM"]);
  const idxQtd = indiceCabecalho(cab, ["QTD", "DIAS", "QUANTIDADE", "QTD DIAS"]);
  const idxCid = indiceCabecalho(cab, ["CID"]);
  const idxDescricaoCid = indiceCabecalho(cab, ["DESCRICAO_CID", "DESCRIÇÃO_CID", "DESCRICAO CID", "DESCRIÇÃO CID"]);
  const idxTipo = indiceCabecalho(cab, ["TIPO DE ATESTADO", "TIPO", "TIPO ATESTADO"]);
  const idxMedico = indiceCabecalho(cab, ["MEDICO", "MÉDICO"]);

  const registros = [];
  for (let i = linhaCab + 1; i < dados.length; i++) {
    const linha = dados[i];
    const mat = limparTexto(valorLinha(linha, idxMat));
    const nome = limparTexto(valorLinha(linha, idxNome));
    if (!mat && !nome) continue;

    const inicioValor = valorLinha(linha, idxInicio);
    const fimValor = valorLinha(linha, idxFim);
    const inicio = dataSegura(inicioValor);
    const fim = dataSegura(fimValor);
    const diasInformados = numeroSeguro(valorLinha(linha, idxQtd));
    const diasCalculados = (inicio && fim) ? Math.max(Math.round((fim.getTime() - inicio.getTime()) / 86400000) + 1, 1) : 0;
    const dias = diasInformados || diasCalculados || 1;
    const cid = limparTexto(valorLinha(linha, idxCid)).toUpperCase().replace(/\s+/g, "");
    const familiaCid = familiaCidCodigo(cid) || "Sem CID";

    registros.push({
      mat,
      nome,
      funcao: limparTexto(valorLinha(linha, idxFuncao)),
      setor: limparTexto(valorLinha(linha, idxSetor)),
      inicio: formatarData(inicioValor),
      fim: formatarData(fimValor),
      ano: obterAno(inicioValor),
      mes: obterMes(inicioValor),
      dias,
      cid,
      familiaCid,
      descricaoCid: limparTexto(valorLinha(linha, idxDescricaoCid)),
      tipo: limparTexto(valorLinha(linha, idxTipo)),
      medico: limparTexto(valorLinha(linha, idxMedico))
    });
  }
  return registros;
}

function extrairVacinas() {
  const dados = lerAba(CONFIG.sheets.vacinas);
  if (dados.length < 2) return [];

  const linhaCab = localizarLinhaCabecalho(dados, ["NOME"]);
  const cab = mapaCabecalho(dados[linhaCab]);
  const idxMat = indiceCabecalho(cab, ["MAT", "MATRICULA", "MATRÍCULA", "CHAPA"]);
  const idxNome = indiceCabecalho(cab, ["NOME", "NOME COMPLETO"]);
  const idxStatus = indiceCabecalho(cab, ["STATUS", "SITUACAO", "SITUAÇÃO"]);

  // Estrutura validada da BD VACINAS
  const IDX_SITUACAO_GERAL = 3;      // D - SITUAÇÃO VACINAL
  const IDX_DT_1 = 5;                // F - dT 1ª dose
  const IDX_DT_2 = 6;                // G - dT 2ª dose
  const IDX_DT_3 = 7;                // H - dT 3ª dose
  const IDX_DT_REFORCO = 8;          // I - Reforço dT
  const IDX_DT_PROXIMO = 9;          // J - Próximo reforço dT
  const IDX_DT_ESQUEMA = 10;         // K - Esquema de dT
  const IDX_HEP_1 = 11;              // L - Hep. B 1ª dose
  const IDX_HEP_2 = 12;              // M - Hep. B 2ª dose
  const IDX_HEP_3 = 13;              // N - Hep. B 3ª dose
  const IDX_HEP_NOVO_1 = 14;         // O - Novo esquema Hep B 1 dose
  const IDX_HEP_NOVO_2 = 15;         // P - Novo esquema Hep B 2 dose
  const IDX_HEP_ESQUEMA = 17;        // R - Situação vacinal Hepatite B
  const IDX_COVID_ESQUEMA = 26;      // AA - Situação vacinal COVID

  const registros = [];
  for (let i = linhaCab + 1; i < dados.length; i++) {
    const linha = dados[i];
    const mat = limparTexto(valorLinha(linha, idxMat));
    const nome = limparTexto(valorLinha(linha, idxNome));
    if (!mat && !nome) continue;

    const situacaoVacinal = limparTexto(valorLinha(linha, IDX_SITUACAO_GERAL));
    const dtSituacao = limparTexto(valorLinha(linha, IDX_DT_ESQUEMA));
    const hepSituacao = limparTexto(valorLinha(linha, IDX_HEP_ESQUEMA));
    const covidSituacao = limparTexto(valorLinha(linha, IDX_COVID_ESQUEMA));

    const dtDatas = [IDX_DT_1, IDX_DT_2, IDX_DT_3, IDX_DT_REFORCO]
      .map(idx => valorLinha(linha, idx))
      .filter(ehDataAplicadaValida);

    const hepDatas = [IDX_HEP_1, IDX_HEP_2, IDX_HEP_3, IDX_HEP_NOVO_1, IDX_HEP_NOVO_2]
      .map(idx => valorLinha(linha, idx))
      .filter(ehDataAplicadaValida);

    registros.push({
      mat,
      nome,
      status: limparTexto(valorLinha(linha, idxStatus)),
      funcao: "",
      setor: "",
      sexo: "",
      idade: "",
      situacaoVacinal,
      esquemaCompleto: classificarEsquemaVacinalGeral(situacaoVacinal) ? "Completo" : "Incompleto",
      dtCompleta: classificarVacinaCompleta(dtSituacao, false) ? "Completa" : "Incompleta",
      hepCompleta: classificarVacinaCompleta(hepSituacao, false) ? "Completa" : "Incompleta",
      covidCompleta: classificarCovidCompleta(covidSituacao, false) ? "Completa" : "Incompleta",
      dtProximoReforco: formatarDataIsoVacina(valorLinha(linha, IDX_DT_PROXIMO)),
      dtDatas: dtDatas.map(formatarDataIsoVacina),
      hepDatas: hepDatas.map(formatarDataIsoVacina)
    });
  }
  return registros;
}

function ehDataValida(valor) {
  return Object.prototype.toString.call(valor) === "[object Date]" && !isNaN(valor.getTime());
}

function ehDataAplicadaValida(valor) {
  if (!ehDataValida(valor)) return false;
  const hoje = new Date();
  hoje.setHours(23, 59, 59, 999);
  return valor.getTime() <= hoje.getTime();
}

function formatarDataIsoVacina(valor) {
  if (!ehDataValida(valor)) return "";
  return Utilities.formatDate(valor, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function criarMapaPerfil(perfil) {
  const mapa = {};
  (perfil || []).forEach(item => {
    const mat = normalizarTexto(item.mat);
    if (mat) mapa[mat] = item;
  });
  return mapa;
}

function complementarComPerfil(registros, mapaPerfil) {
  return (registros || []).map(item => {
    const perfil = mapaPerfil[normalizarTexto(item.mat)] || {};
    return Object.assign({}, item, {
      status: item.status || perfil.status || "",
      funcao: item.funcao || perfil.funcao || "",
      setor: item.setor || perfil.setor || "",
      sexo: item.sexo || perfil.sexo || "",
      idade: item.idade || perfil.idade || ""
    });
  });
}

/* ===========================================================
 * ABA PERFIL
 * =========================================================== */

function carregarPerfilSaude() {
  const key = chaveCache("DADOS_PERFIL");
  const cache = getCache();
  const cached = cache.get(key);
  if (cached) return JSON.parse(cached);

  const perfil = extrairPerfil();
  const mapaPerfil = criarMapaPerfil(perfil);
  const patologias = complementarComPerfil(extrairPatologias(), mapaPerfil);
  const afastamentos = complementarComPerfil(extrairAfastamentos(), mapaPerfil);
  const vacinas = extrairVacinas();

  const ano = new Date().getFullYear();
  const perfilConsiderado = perfil.filter(i => considerarColaboradorMacro(i.status));
  const patologiasConsideradas = patologias.filter(i => considerarNaAnalisePatologia(i.status));
  const vacinasAtivos = vacinas.filter(i => considerarNaAnaliseVacinas(i.status));
  const afastamentosAno = afastamentos.filter(i => Number(i.ano) === Number(ano));

  const totalColaboradores = perfilConsiderado.length;
  const totalColaboradoresAtivos = perfil.filter(i => isAtivoOuReabilitado(i.status)).length;

  let feminino = 0, masculino = 0;
  perfilConsiderado.forEach(item => {
    const sexo = normalizarTexto(item.sexo);
    if (sexo === "F" || sexo === "FEMININO" || sexo === "FEMININA") feminino++;
    if (sexo === "M" || sexo === "MASCULINO" || sexo === "MASCULINA") masculino++;
  });

  const comPatologia = patologiasConsideradas.filter(i => (i.cids || []).length > 0).length;
  const semPatologia = Math.max(patologiasConsideradas.length - comPatologia, 0);

  const retorno = {
    atualizadoEm: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm"),
    anoVigente: ano,
    cards: {
      totalColaboradores,
      totalColaboradoresAtivos,
      percentualFeminino: totalColaboradores ? (feminino / totalColaboradores) * 100 : 0,
      percentualMasculino: totalColaboradores ? (masculino / totalColaboradores) * 100 : 0,
      statusColaboradores: transformarGrupoEmArray(perfilConsiderado.reduce((acc, item) => { incrementarGrupo(acc, item.status, 1); return acc; }, {}))
    },
    graficoPatologiaSimNao: transformarGrupoEmArray({ "Com patologia": comPatologia, "Sem patologia": semPatologia }),
    graficoPatologias: graficoPatologiasFamilia(patologiasConsideradas),
    graficoAfastamentosPorCid: graficoAfastamentosFamilia(afastamentosAno),
    graficoPatologiasAfastamentos: graficoPatologiasXAfastamentos(patologiasConsideradas, afastamentosAno),
    graficoAtividadeFisica: graficoCampo(patologiasConsideradas, "atividadeFisica"),
    graficoTabagismo: graficoSimNaoNaoInformado(patologiasConsideradas, "tabagista"),
    graficoVacinas: graficoVacinaCompleta(vacinasAtivos),
    graficoVacinasPorTipo: graficoVacinasPorTipo(vacinasAtivos),
    categoriasPatologia: ordenarLista(Object.keys(patologiasConsideradas.reduce((acc, i) => { acc[i.status || "Não informado"] = true; return acc; }, {})))
  };

  cacheJsonPutSeguro(cache, key, retorno);
  return retorno;
}

function graficoCampo(registros, campo) {
  const grupo = {};
  (registros || []).forEach(item => incrementarGrupo(grupo, item[campo], 1));
  return transformarGrupoEmArray(grupo);
}

function graficoPatologiasFamilia(registros) {
  const grupo = {};
  (registros || []).forEach(item => {
    (item.cids || []).forEach(cid => {
      const familia = familiaCidCodigo(cid);
      if (familia) incrementarGrupo(grupo, familia, 1);
    });
  });
  return Object.keys(grupo).map(familia => ({
    nome: familia,
    quantidade: grupo[familia],
    descricao: descricaoFamiliaCid(familia),
    tooltip: "Família " + familia + " — " + descricaoFamiliaCid(familia) + "\nQuantidade: " + grupo[familia]
  })).sort((a, b) => b.quantidade - a.quantidade);
}

function graficoAfastamentosFamilia(registros) {
  const grupo = {};
  (registros || []).forEach(item => {
    const familia = familiaCidCodigo(item.cid) || "Sem CID";
    incrementarGrupo(grupo, familia, 1);
  });
  return Object.keys(grupo).map(familia => ({
    nome: familia,
    quantidade: grupo[familia],
    descricao: familia === "Sem CID" ? "CID não informado" : descricaoFamiliaCid(familia),
    tooltip: (familia === "Sem CID" ? "CID não informado" : "Família " + familia + " — " + descricaoFamiliaCid(familia)) + "\nAfastamentos: " + grupo[familia]
  })).sort((a, b) => b.quantidade - a.quantidade);
}

function graficoPatologiasXAfastamentos(patologias, afastamentosAno) {
  const grupo = {};
  (patologias || []).forEach(item => {
    (item.cids || []).forEach(cid => {
      const familia = familiaCidCodigo(cid);
      if (!familia) return;
      if (!grupo[familia]) grupo[familia] = { nome: familia, patologias: 0, afastamentos: 0, descricao: descricaoFamiliaCid(familia) };
      grupo[familia].patologias++;
    });
  });
  (afastamentosAno || []).forEach(item => {
    const familia = familiaCidCodigo(item.cid);
    if (!familia) return;
    if (!grupo[familia]) grupo[familia] = { nome: familia, patologias: 0, afastamentos: 0, descricao: descricaoFamiliaCid(familia) };
    grupo[familia].afastamentos++;
  });
  return Object.keys(grupo).map(k => grupo[k]).sort((a, b) => (b.patologias + b.afastamentos) - (a.patologias + a.afastamentos)).slice(0, 15);
}

function graficoVacinaCompleta(registros) {
  const grupo = { "Esquema completo": 0, "Esquema incompleto": 0 };
  (registros || []).forEach(item => grupo[item.esquemaCompleto === "Completo" ? "Esquema completo" : "Esquema incompleto"]++);
  return transformarGrupoEmArray(grupo);
}

function graficoVacinasPorTipo(registros) {
  const lista = registros || [];
  const total = lista.length;
  return [
    { nome: "dT", atualizada: lista.filter(i => i.dtCompleta === "Completa").length },
    { nome: "Hepatite B", atualizada: lista.filter(i => i.hepCompleta === "Completa").length },
    { nome: "COVID", atualizada: lista.filter(i => i.covidCompleta === "Completa").length }
  ].map(item => ({
    nome: item.nome,
    atualizada: item.atualizada,
    pendente: Math.max(total - item.atualizada, 0),
    total
  }));
}

/* ===========================================================
 * ABA PATOLOGIAS
 * =========================================================== */

function carregarPatologias() {
  const key = chaveCache("DADOS_PATOLOGIAS");
  const cache = getCache();
  const cached = cache.get(key);
  if (cached) return JSON.parse(cached);

  const perfil = extrairPerfil();
  const mapaPerfil = criarMapaPerfil(perfil);

  const todosConsiderados = complementarComPerfil(extrairPatologias(), mapaPerfil)
    .filter(item => considerarNaAnalisePatologia(item.status));

  const registrosComPatologia = todosConsiderados
    .filter(item => (item.cids || []).length > 0)
    .map(normalizarRegistroPatologiaV41);

  const setoresMap = {};
  const funcoesMap = {};
  const sexosMap = {};

  registrosComPatologia.forEach(item => {
    if (item.setor) setoresMap[item.setor] = true;
    if (item.funcao) funcoesMap[item.funcao] = true;
    if (item.sexo) sexosMap[item.sexo] = true;
  });

  const retorno = {
    atualizadoEm: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm"),
    totalAnalisados: todosConsiderados.length,
    filtros: {
      setores: ordenarLista(Object.keys(setoresMap)),
      funcoes: ordenarLista(Object.keys(funcoesMap)),
      sexos: ordenarLista(Object.keys(sexosMap))
    },
    registros: registrosComPatologia,
    resumoGeral: montarResumoPatologiasV41(registrosComPatologia, todosConsiderados.length)
  };

  cacheJsonPutSeguro(cache, key, retorno);
  return retorno;
}

function normalizarRegistroPatologiaV41(item) {
  const cids = (item.cids || [])
    .map(cid => limparTexto(cid).toUpperCase().replace(/\s+/g, ""))
    .filter(cid => cid !== "");

  const familiasMap = {};
  cids.forEach(cid => {
    const familia = familiaCidCodigo(cid);
    if (familia) familiasMap[familia] = true;
  });

  const familias = Object.keys(familiasMap).sort();

  return {
    mat: limparTexto(item.mat),
    nome: limparTexto(item.nome),
    sexo: limparTexto(item.sexo),
    idade: item.idade || "",
    setor: limparTexto(item.setor),
    funcao: limparTexto(item.funcao),
    status: limparTexto(item.status),
    possuiPatologia: item.possuiPatologia === "Sim" ? "Sim" : "Não",
    cids: cids,
    familiasCid: familias,
    familiasCidTexto: familias.join(", "),
    totalPatologias: cids.length
  };
}

function montarResumoPatologiasV41(registros, totalAnalisados) {
  const lista = registros || [];
  const familias = {};
  const cids = {};
  const detalheFamiliaCid = {};

  lista.forEach(item => {
    (item.cids || []).forEach(cid => {
      const cidLimpo = limparTexto(cid).toUpperCase().replace(/\s+/g, "");
      if (!cidLimpo) return;

      incrementarGrupo(cids, cidLimpo, 1);

      const familia = familiaCidCodigo(cidLimpo);
      if (!familia) return;

      incrementarGrupo(familias, familia, 1);
      if (!detalheFamiliaCid[familia]) detalheFamiliaCid[familia] = {};
      incrementarGrupo(detalheFamiliaCid[familia], cidLimpo, 1);
    });
  });

  const graficoFamilias = Object.keys(familias).map(familia => {
    const detalhes = transformarGrupoEmArray(detalheFamiliaCid[familia] || {});
    return {
      nome: familia,
      quantidade: familias[familia],
      descricao: descricaoFamiliaCid(familia),
      cids: detalhes,
      tooltip: "Família " + familia + " - " + descricaoFamiliaCid(familia) + "\nTotal: " + familias[familia] + "\n\n" + detalhes.map(i => i.nome + ": " + i.quantidade).join("\n")
    };
  }).sort((a, b) => b.quantidade - a.quantidade);

  return {
    totalAnalisados: totalAnalisados || 0,
    colaboradoresComPatologias: lista.length,
    totalPatologias: lista.reduce((s, item) => s + (item.totalPatologias || 0), 0),
    familiaMaisPrevalente: graficoFamilias[0] || { nome: "-", quantidade: 0, descricao: "-", cids: [] },
    graficoFamilias: graficoFamilias,
    topCids: transformarGrupoEmArray(cids).slice(0, 10),
    tabela: lista
  };
}

/* ===========================================================
 * ABA AFASTAMENTOS
 * =========================================================== */

function carregarAfastamentos() {
  const key = chaveCache("DADOS_AFASTAMENTOS");
  const cache = getCache();
  const cached = cache.get(key);
  if (cached) return JSON.parse(cached);

  const perfil = extrairPerfil();
  const mapaPerfil = criarMapaPerfil(perfil);
  const afastamentos = complementarComPerfil(extrairAfastamentos(), mapaPerfil)
    .filter(item => item.nome || item.mat)
    .map(normalizarRegistroAfastamentoV50);

  const setoresMap = {};
  const funcoesMap = {};
  const sexosMap = {};
  const anosMap = {};

  afastamentos.forEach(item => {
    if (item.setor) setoresMap[item.setor] = true;
    if (item.funcao) funcoesMap[item.funcao] = true;
    if (item.sexo) sexosMap[item.sexo] = true;
    if (item.ano) anosMap[item.ano] = true;
  });

  const patologiasComparativo = complementarComPerfil(extrairPatologias(), mapaPerfil)
    .filter(item => considerarNaAnalisePatologia(item.status))
    .filter(item => (item.cids || []).length > 0)
    .map(normalizarRegistroPatologiaV41);

  const retorno = {
    atualizadoEm: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm"),
    anoVigente: new Date().getFullYear(),
    filtros: {
      setores: ordenarLista(Object.keys(setoresMap)),
      funcoes: ordenarLista(Object.keys(funcoesMap)),
      sexos: ordenarLista(Object.keys(sexosMap)),
      anos: Object.keys(anosMap).sort((a, b) => Number(b) - Number(a))
    },
    registros: afastamentos,
    patologiasComparativo: patologiasComparativo,
    resumoGeral: montarResumoAfastamentosV50(afastamentos)
  };

  cacheJsonPutSeguro(cache, key, retorno);
  return retorno;
}

function normalizarRegistroAfastamentoV50(item) {
  const cid = limparTexto(item.cid).toUpperCase().replace(/\s+/g, "");
  return {
    mat: limparTexto(item.mat),
    nome: limparTexto(item.nome),
    sexo: limparTexto(item.sexo),
    idade: item.idade || "",
    status: limparTexto(item.status),
    setor: limparTexto(item.setor),
    funcao: limparTexto(item.funcao),
    inicio: item.inicio || "",
    fim: item.fim || "",
    ano: item.ano || "",
    mes: item.mes || 0,
    dias: numeroSeguro(item.dias) || 1,
    cid,
    familiaCid: cid ? familiaCidCodigo(cid) : "Sem CID",
    descricaoCid: limparTexto(item.descricaoCid),
    tipo: limparTexto(item.tipo),
    medico: limparTexto(item.medico)
  };
}

function montarResumoAfastamentosV50(registros) {
  const lista = registros || [];
  const colaboradores = {};
  let diasPerdidos = 0;
  let semCid = 0;
  let cidF = 0;
  let cidM = 0;
  const cids = {};
  const familias = {};
  const familiasComCid = {};
  const setores = {};
  const mesesQtd = {};

  lista.forEach(item => {
    const chaveColaborador = item.mat || item.nome;
    if (chaveColaborador) colaboradores[chaveColaborador] = true;

    diasPerdidos += numeroSeguro(item.dias);

    const cid = limparTexto(item.cid);
    const familia = cid ? familiaCidCodigo(cid) : "Sem CID";

    if (!cid) semCid++;
    if (familia === "F") cidF++;
    if (familia === "M") cidM++;

    if (cid) {
      incrementarGrupo(cids, cid, 1);
      incrementarGrupo(familiasComCid, familia, 1);
    }

    incrementarGrupo(familias, familia || "Sem CID", 1);
    incrementarGrupo(setores, item.setor, 1);

    const mes = Number(item.mes || 0);
    if (mes) incrementarGrupo(mesesQtd, mes, 1);
  });

  return {
    totalAfastamentos: lista.length,
    colaboradoresAfastados: Object.keys(colaboradores).length,
    diasPerdidos,
    mediaDias: lista.length ? diasPerdidos / lista.length : 0,
    semCid,
    cidF,
    cidM,
    topCids: transformarGrupoEmArray(cids).slice(0, 10),
    familias: transformarGrupoEmArray(familias),
    familiasComCid: transformarGrupoEmArray(familiasComCid),
    setores: transformarGrupoEmArray(setores).slice(0, 15),
    mesesQtd: montarArrayMeses(mesesQtd)
  };
}

function montarArrayMeses(grupo) {
  const nomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const arr = [];
  for (let i = 1; i <= 12; i++) {
    arr.push({ nome: nomes[i - 1], mes: i, quantidade: grupo[i] || 0 });
  }
  return arr;
}


/* ===========================================================
 * ABA VACINAS - VERSÃO 5.5
 * =========================================================== */

function carregarVacinas() {
  const key = chaveCache("DADOS_VACINAS");
  const cache = getCache();
  const cached = cache.get(key);
  if (cached) return JSON.parse(cached);

  const perfil = extrairPerfil();
  const mapaPerfil = criarMapaPerfil(perfil);

  const vacinas = complementarComPerfil(extrairVacinas(), mapaPerfil)
    .filter(item => considerarNaAnaliseVacinas(item.status))
    .map(normalizarRegistroVacinaV55);

  const setoresMap = {}, funcoesMap = {}, sexosMap = {}, situacoesMap = {};
  vacinas.forEach(item => {
    if (item.setor) setoresMap[item.setor] = true;
    if (item.funcao) funcoesMap[item.funcao] = true;
    if (item.sexo) sexosMap[item.sexo] = true;
    if (item.esquemaCompleto) situacoesMap[item.esquemaCompleto] = true;
  });

  const retorno = {
    atualizadoEm: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm"),
    filtros: {
      setores: ordenarLista(Object.keys(setoresMap)),
      funcoes: ordenarLista(Object.keys(funcoesMap)),
      sexos: ordenarLista(Object.keys(sexosMap)),
      situacoes: ordenarLista(Object.keys(situacoesMap))
    },
    registros: vacinas,
    resumoGeral: montarResumoVacinasV55(vacinas)
  };

  cacheJsonPutSeguro(cache, key, retorno);
  return retorno;
}

function normalizarRegistroVacinaV55(item) {
  return {
    mat: limparTexto(item.mat),
    nome: limparTexto(item.nome),
    status: limparTexto(item.status),
    setor: limparTexto(item.setor),
    funcao: limparTexto(item.funcao),
    sexo: limparTexto(item.sexo) || "Não informado",
    idade: item.idade || "",
    esquemaCompleto: item.esquemaCompleto || "Incompleto",
    dtCompleta: item.dtCompleta || "Incompleta",
    hepCompleta: item.hepCompleta || "Incompleta",
    covidCompleta: item.covidCompleta || "Incompleta",
    dtProximoReforco: item.dtProximoReforco || "",
    dtDatas: item.dtDatas || [],
    hepDatas: item.hepDatas || []
  };
}

function montarResumoVacinasV55(registros) {
  const lista = registros || [];
  const total = lista.length;
  const completos = lista.filter(i => i.esquemaCompleto === "Completo").length;
  const incompletos = total - completos;
  const dtAtualizadas = lista.filter(i => i.dtCompleta === "Completa").length;
  const hepAtualizadas = lista.filter(i => i.hepCompleta === "Completa").length;
  const covidAtualizadas = lista.filter(i => i.covidCompleta === "Completa").length;
  const pendenciasSetor = {}, pendenciasFuncao = {}, coberturaSexo = {};

  lista.forEach(item => {
    const pendente = item.esquemaCompleto !== "Completo" || item.dtCompleta !== "Completa" || item.hepCompleta !== "Completa" || item.covidCompleta !== "Completa";
    if (pendente) {
      incrementarGrupo(pendenciasSetor, item.setor, 1);
      incrementarGrupo(pendenciasFuncao, item.funcao, 1);
    }
    incrementarGrupo(coberturaSexo, item.sexo, item.esquemaCompleto === "Completo" ? 1 : 0);
  });

  const coberturas = [
    { nome: "dT", atualizada: dtAtualizadas, pendente: Math.max(total - dtAtualizadas, 0), percentual: total ? (dtAtualizadas / total) * 100 : 0 },
    { nome: "Hepatite B", atualizada: hepAtualizadas, pendente: Math.max(total - hepAtualizadas, 0), percentual: total ? (hepAtualizadas / total) * 100 : 0 },
    { nome: "COVID", atualizada: covidAtualizadas, pendente: Math.max(total - covidAtualizadas, 0), percentual: total ? (covidAtualizadas / total) * 100 : 0 }
  ];

  const menor = coberturas.slice().sort((a, b) => a.percentual - b.percentual)[0] || { nome: "-", percentual: 0 };

  return {
    total,
    completos,
    incompletos,
    coberturaGeral: total ? (completos / total) * 100 : 0,
    dtAtualizadas,
    hepAtualizadas,
    covidAtualizadas,
    menorCobertura: menor,
    coberturaGeralGrafico: transformarGrupoEmArray({ "Completo": completos, "Incompleto": incompletos }),
    coberturaPorVacina: coberturas,
    pendenciasPorSetor: transformarGrupoEmArray(pendenciasSetor).slice(0, 15),
    pendenciasPorFuncao: transformarGrupoEmArray(pendenciasFuncao).slice(0, 15),
    coberturaPorSexo: transformarGrupoEmArray(coberturaSexo),
    aplicadasMes: montarVacinasAplicadasPorMes(lista),
    aplicadasAno: montarVacinasAplicadasPorAno(lista),
    pendencias: lista.filter(i => i.esquemaCompleto !== "Completo")
  };
}

function montarVacinasAplicadasPorMes(registros) {
  const anoAtual = new Date().getFullYear();
  const nomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const mapa = {};
  for (let m = 1; m <= 12; m++) mapa[m] = { nome: nomes[m - 1], mes: m, dt: 0, hep: 0, total: 0 };

  (registros || []).forEach(item => {
    (item.dtDatas || []).forEach(data => incrementarAplicacaoVacina(mapa, data, "dt", anoAtual));
    (item.hepDatas || []).forEach(data => incrementarAplicacaoVacina(mapa, data, "hep", anoAtual));
  });

  return Object.keys(mapa).map(m => mapa[m]);
}

function montarVacinasAplicadasPorAno(registros) {
  const mapa = {};
  (registros || []).forEach(item => {
    (item.dtDatas || []).forEach(data => incrementarAplicacaoVacinaAno(mapa, data, "dt"));
    (item.hepDatas || []).forEach(data => incrementarAplicacaoVacinaAno(mapa, data, "hep"));
  });
  return Object.keys(mapa).sort((a, b) => Number(a) - Number(b)).map(ano => mapa[ano]);
}

function incrementarAplicacaoVacina(mapa, data, tipo, anoFiltro) {
  const p = String(data || "").split("-");
  if (p.length < 2) return;
  const ano = Number(p[0]);
  const mes = Number(p[1]);
  if (ano !== Number(anoFiltro) || !mapa[mes]) return;
  mapa[mes][tipo]++;
  mapa[mes].total++;
}

function incrementarAplicacaoVacinaAno(mapa, data, tipo) {
  const p = String(data || "").split("-");
  if (p.length < 1) return;
  const ano = p[0];
  if (!ano) return;
  if (!mapa[ano]) mapa[ano] = { nome: ano, ano: Number(ano), dt: 0, hep: 0, total: 0 };
  mapa[ano][tipo]++;
  mapa[ano].total++;
}


function diagnosticarVacinasIndicadores() {
  limparCachePerfilSaude();

  const perfil = extrairPerfil();
  const mapaPerfil = criarMapaPerfil(perfil);
  const registros = complementarComPerfil(extrairVacinas(), mapaPerfil)
    .filter(item => considerarNaAnaliseVacinas(item.status))
    .map(normalizarRegistroVacinaV55);

  const total = registros.length;
  const completoGeral = registros.filter(i => i.esquemaCompleto === "Completo").length;
  const pendenteGeral = registros.filter(i => i.esquemaCompleto !== "Completo").length;
  const dtCompleta = registros.filter(i => i.dtCompleta === "Completa").length;
  const dtPendente = registros.filter(i => i.dtCompleta !== "Completa").length;
  const hepCompleta = registros.filter(i => i.hepCompleta === "Completa").length;
  const hepPendente = registros.filter(i => i.hepCompleta !== "Completa").length;
  const covidCompleta = registros.filter(i => i.covidCompleta === "Completa").length;
  const covidPendente = registros.filter(i => i.covidCompleta !== "Completa").length;

  const pendenciasPorSetor = {};
  registros.forEach(item => {
    if (item.esquemaCompleto !== "Completo") incrementarGrupo(pendenciasPorSetor, item.setor, 1);
  });

  const resultado = {
    regra: {
      situacaoVacinalGeral: "Coluna D",
      esquemaDT: "Coluna K",
      hepatiteB: "Coluna R",
      covid: "Coluna AA",
      pendenciaOperacional: "Coluna D diferente de VACINAS ATUALIZADAS"
    },
    totalColaboradoresConsiderados: total,
    esquemaVacinalCompleto: completoGeral,
    esquemaVacinalIncompleto: pendenteGeral,
    coberturaVacinalGeralPercentual: total ? (completoGeral / total) * 100 : 0,
    dT: { completa: dtCompleta, pendente: dtPendente, percentual: total ? (dtCompleta / total) * 100 : 0 },
    hepatiteB: { completa: hepCompleta, pendente: hepPendente, percentual: total ? (hepCompleta / total) * 100 : 0 },
    covid: { completa: covidCompleta, pendente: covidPendente, percentual: total ? (covidCompleta / total) * 100 : 0 },
    pendenciasPorSetorTop15: transformarGrupoEmArray(pendenciasPorSetor).slice(0, 15),
    amostraPendencias: registros.filter(i => i.esquemaCompleto !== "Completo").slice(0, 10)
  };

  Logger.log(JSON.stringify(resultado, null, 2));
  return resultado;
}

function testarVacinas() {
  limparCachePerfilSaude();
  const dados = carregarVacinas();
  Logger.log(JSON.stringify(dados, null, 2));
  return dados;
}

function testarPerfilSaude() {
  limparCachePerfilSaude();
  const dados = carregarPerfilSaude();
  Logger.log(JSON.stringify(dados, null, 2));
  return dados;
}

function testarPatologias() {
  limparCachePerfilSaude();
  const dados = carregarPatologias();
  Logger.log(JSON.stringify(dados, null, 2));
  return dados;
}

function testarAfastamentos() {
  limparCachePerfilSaude();
  const dados = carregarAfastamentos();
  Logger.log(JSON.stringify(dados, null, 2));
  return dados;
}
