var SS_CACHE_PERFIL_SAUDE = null;

function getSpreadsheet() {
  if (!SS_CACHE_PERFIL_SAUDE) SS_CACHE_PERFIL_SAUDE = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  return SS_CACHE_PERFIL_SAUDE;
}

function chaveCache(nome) {
  return CONFIG.cachePrefix + String(nome || "");
}

function normalizarChave(valor) {
  return normalizarTexto(valor).replace(/[^A-Z0-9]/g, "").toLowerCase();
}

function normalizarTexto(valor) {
  if (valor === null || valor === undefined) return "";
  return String(valor).trim().replace(/\s+/g, " ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}

function limparTexto(valor) {
  if (valor === null || valor === undefined) return "";
  const texto = String(valor).trim();
  if (!texto || ["#N/A", "#VALUE!", "#REF!", "#DIV/0!", "undefined", "null"].indexOf(texto) !== -1) return "";
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
  const m = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+.*)?$/);
  if (m) return new Date(Number(m[3].length === 2 ? "20" + m[3] : m[3]), Number(m[2]) - 1, Number(m[1]));
  const dt = new Date(texto);
  return isNaN(dt.getTime()) ? null : dt;
}

function formatarData(valor) {
  const dt = dataSegura(valor);
  return dt ? Utilities.formatDate(dt, Session.getScriptTimeZone(), "dd/MM/yyyy") : limparTexto(valor);
}

function obterAno(valor) {
  const dt = dataSegura(valor);
  if (dt) return dt.getFullYear();
  const m = String(valor || "").match(/\b(19\d{2}|20\d{2})\b/);
  return m ? Number(m[1]) : "";
}

function obterMes(valor) {
  const dt = dataSegura(valor);
  return dt ? dt.getMonth() + 1 : 0;
}

function keyPessoa(mat, nome) {
  const matricula = limparTexto(mat);
  if (matricula) return "M:" + normalizarTexto(matricula);
  const nomeLimpo = limparTexto(nome);
  return nomeLimpo ? "N:" + normalizarTexto(nomeLimpo) : "";
}

function addGrupo(obj, chave, qtd) {
  const nome = limparTexto(chave) || "Não informado";
  obj[nome] = (obj[nome] || 0) + (qtd || 1);
}

function toArrayGrupo(obj, limite) {
  const lista = Object.keys(obj || {}).map(k => ({ nome: k, quantidade: obj[k] })).sort((a, b) => b.quantidade - a.quantidade || a.nome.localeCompare(b.nome));
  return limite ? lista.slice(0, limite) : lista;
}

function familiaCid(cid) {
  const m = normalizarTexto(cid).match(/[A-Z]/);
  return m ? m[0] : "";
}

function descricaoFamiliaCid(letra) {
  return letra ? (CONFIG.cidFamilies[letra] || "Família CID " + letra) : "Não informado";
}

function classificarSexo(valor) {
  const s = normalizarTexto(valor);
  if (s === "F" || s.indexOf("FEMIN") !== -1) return "Feminino";
  if (s === "M" || s.indexOf("MASC") !== -1) return "Masculino";
  return limparTexto(valor) || "Não informado";
}

function statusPadraoSelecionado(status) {
  const s = normalizarTexto(status || "Não informado");
  const semHifen = s.replace(/[-–—]/g, " ");
  if (!s || s === "NAO INFORMADO" || s === "NÃO INFORMADO") return false;
  if (CONFIG.statusRules.exceptionalKeywords.some(k => semHifen.indexOf(normalizarTexto(k).replace(/[-–—]/g, " ")) !== -1)) return false;
  if (s === "ATIVO") return true;
  return CONFIG.statusRules.normalKeywords.some(k => {
    const key = normalizarTexto(k).replace(/[-–—]/g, " ");
    return key && semHifen.indexOf(key) !== -1;
  });
}

function montarOpcoesStatus_(statusList) {
  const mapa = {};
  (statusList || []).forEach(s => { mapa[limparTexto(s) || "Não informado"] = true; });
  if (!Object.keys(mapa).length) mapa["Não informado"] = true;
  return Object.keys(mapa).sort().map(nome => ({ nome, selected: statusPadraoSelecionado(nome) }));
}

function medirPerformance(nome, fn) {
  const inicio = Date.now();
  const resultado = fn();
  const fim = Date.now();
  if (resultado && typeof resultado === "object" && !Array.isArray(resultado)) {
    resultado.performance = resultado.performance || {};
    resultado.performance[nome] = {
      totalMs: fim - inicio,
      returnBytes: JSON.stringify(resultado).length
    };
  }
  return resultado;
}

function limitarRegistrosTela_(registros) {
  var limite = 1200;
  return (registros || []).slice(0, limite);
}
