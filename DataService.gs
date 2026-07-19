var BASE_CACHE_EXECUCAO = {};
var MAPA_PERFIL_CACHE_EXECUCAO = null;

function lerBase(baseKey, options) {
  const opt = options || {};
  const cfg = CONFIG.sheets[baseKey];
  if (!cfg) throw new Error("Base não configurada: " + baseKey);

  const cacheKey = baseKey + (opt.somenteCabecalho ? "::cabecalho" : "::completa");
  if (BASE_CACHE_EXECUCAO[cacheKey]) return BASE_CACHE_EXECUCAO[cacheKey];

  const t0 = Date.now();
  const sheet = getSpreadsheet().getSheetByName(cfg.name);
  if (!sheet) {
    const ausente = {
      baseKey, encontrada: false, headers: [], headerMap: {}, registros: [], linhasLidas: 0,
      performance: { cacheMemoria: false, leituraMs: Date.now() - t0, processamentoMs: 0, totalMs: Date.now() - t0 }
    };
    BASE_CACHE_EXECUCAO[cacheKey] = ausente;
    return ausente;
  }

  const headerRow = cfg.headerRow || 1;
  const lastCol = sheet.getLastColumn();
  const maxRow = sheet.getLastRow();
  if (maxRow < headerRow || lastCol < 1) {
    const vazia = {
      baseKey, encontrada: true, headers: [], headerMap: {}, registros: [], linhasLidas: 0,
      performance: { cacheMemoria: false, leituraMs: Date.now() - t0, processamentoMs: 0, totalMs: Date.now() - t0 }
    };
    BASE_CACHE_EXECUCAO[cacheKey] = vazia;
    return vazia;
  }

  const headers = sheet.getRange(headerRow, 1, 1, lastCol).getDisplayValues()[0]
    .map(function(h, i) { return limparTexto(h) || ("COL_" + (i + 1)); });
  const headerMap = montarMapaCabecalho(headers);

  if (opt.somenteCabecalho) {
    const somenteCabecalho = {
      baseKey, encontrada: true, headers, headerMap, registros: [], linhasLidas: 0,
      performance: { cacheMemoria: false, leituraMs: Date.now() - t0, processamentoMs: 0, totalMs: Date.now() - t0 }
    };
    BASE_CACHE_EXECUCAO[cacheKey] = somenteCabecalho;
    return somenteCabecalho;
  }

  const scanStart = headerRow + 1;
  const rowsToScan = Math.max(maxRow - headerRow, 0);
  const keyIndexes = obterIndicesChave_(cfg, headerMap);
  let lastUsefulRow = headerRow;

  if (rowsToScan > 0 && keyIndexes.length) {
    keyIndexes.forEach(function(idx) {
      const coluna = sheet.getRange(scanStart, idx + 1, rowsToScan, 1).getDisplayValues();
      for (let i = coluna.length - 1; i >= 0; i--) {
        if (limparTexto(coluna[i][0])) {
          lastUsefulRow = Math.max(lastUsefulRow, scanStart + i);
          break;
        }
      }
    });
  } else {
    lastUsefulRow = maxRow;
  }

  const dataRows = Math.max(lastUsefulRow - headerRow, 0);
  const values = dataRows ? sheet.getRange(headerRow + 1, 1, dataRows, lastCol).getDisplayValues() : [];
  const leituraMs = Date.now() - t0;
  const t1 = Date.now();
  const registros = values
    .map(function(row, idx) { return montarRegistro(row, headers, headerMap, headerRow + idx + 1, cfg); })
    .filter(regValido);

  const resultado = {
    baseKey, encontrada: true, headers, headerMap, registros, linhasLidas: values.length,
    performance: { cacheMemoria: false, leituraMs, processamentoMs: Date.now() - t1, totalMs: Date.now() - t0 }
  };
  BASE_CACHE_EXECUCAO[cacheKey] = resultado;
  return resultado;
}

function obterIndicesChave_(cfg, headerMap) {
  const vistos = {};
  const indices = [];
  (cfg.keyAliases || []).forEach(function(alias) {
    const idx = headerMap[normalizarTexto(alias)];
    if (idx !== undefined && !vistos[idx]) {
      vistos[idx] = true;
      indices.push(idx);
    }
  });
  return indices;
}

function montarMapaCabecalho(headers) {
  const map = {};
  (headers || []).forEach(function(h, i) {
    const key = normalizarTexto(h);
    if (key && map[key] === undefined) map[key] = i;
  });
  return map;
}

function idxAlias(headerMap, aliases) {
  for (let i = 0; i < aliases.length; i++) {
    const idx = headerMap[normalizarTexto(aliases[i])];
    if (idx !== undefined) return idx;
  }
  return -1;
}

function valorAlias(reg, campo) {
  return reg[campo] || "";
}

function montarRegistro(row, headers, headerMap, rowNumber, cfg) {
  const reg = { _rowNumber: rowNumber, _raw: row, _headers: headers };
  headers.forEach(function(h, i) { reg[h] = limparTexto(row[i]); });
  Object.keys(CONFIG.aliases).forEach(function(campo) {
    const idx = idxAlias(headerMap, CONFIG.aliases[campo]);
    reg[campo] = idx >= 0 ? limparTexto(row[idx]) : "";
  });
  Object.keys((cfg && cfg.fieldFallbacks) || {}).forEach(function(campo) {
    if (!limparTexto(reg[campo])) reg[campo] = limparTexto(reg[cfg.fieldFallbacks[campo]]);
  });
  reg.mat = limparTexto(reg.mat);
  reg.nome = limparTexto(reg.nome);
  reg.status = limparTexto(reg.status) || "Não informado";
  reg.setor = limparTexto(reg.setor) || "Não informado";
  reg.funcao = limparTexto(reg.funcao) || "Não informado";
  reg.sexo = classificarSexo(reg.sexo);
  reg.key = keyPessoa(reg.mat, reg.nome);
  return reg;
}

function regValido(reg) {
  if (!(reg && reg.key)) return false;
  if (linhaCabecalhoRepetida_(reg)) return false;
  if (normalizarTexto(reg.nome) === "NOME" && normalizarTexto(reg.status) === "STATUS") return false;
  return true;
}

function linhaCabecalhoRepetida_(reg) {
  const raw = reg._raw || [];
  const headers = reg._headers || [];
  let preenchidas = 0;
  let iguaisAoCabecalho = 0;
  for (let i = 0; i < headers.length; i++) {
    const valor = limparTexto(raw[i]);
    if (!valor) continue;
    preenchidas++;
    if (normalizarTexto(valor) === normalizarTexto(headers[i])) iguaisAoCabecalho++;
  }
  return preenchidas >= 3 && iguaisAoCabecalho >= Math.min(3, preenchidas);
}

function carregarRegistrosPerfil_() {
  return lerBase("perfil").registros.map(function(r) {
    return {
      key: r.key, mat: r.mat, nome: r.nome, status: r.status, setor: r.setor, funcao: r.funcao,
      sexo: r.sexo, idade: numeroSeguro(r.idade), nascimento: r.nascimento
    };
  });
}

function mapaPerfil_() {
  if (MAPA_PERFIL_CACHE_EXECUCAO) return MAPA_PERFIL_CACHE_EXECUCAO;
  const mapa = {};
  carregarRegistrosPerfil_().forEach(function(r) {
    if (r.key && !mapa[r.key]) mapa[r.key] = r;
  });
  MAPA_PERFIL_CACHE_EXECUCAO = mapa;
  return mapa;
}

function opcoesComuns_(registros) {
  const setor = {}, funcao = {}, sexo = {}, status = {};
  (registros || []).forEach(function(r) {
    addGrupo(setor, r.setor, 0);
    addGrupo(funcao, r.funcao, 0);
    addGrupo(sexo, r.sexo, 0);
    addGrupo(status, r.status, 0);
  });
  return {
    setores: Object.keys(setor).sort(),
    funcoes: Object.keys(funcao).sort(),
    sexos: Object.keys(sexo).sort(),
    status: montarOpcoesStatus_(Object.keys(status))
  };
}

function limparCacheExecucaoBases_() {
  BASE_CACHE_EXECUCAO = {};
  MAPA_PERFIL_CACHE_EXECUCAO = null;
}

function diagnosticarBases() {
  limparCacheExecucaoBases_();
  return medirPerformance("diagnosticarBases", function() {
    const atual = {};
    Object.keys(CONFIG.sheets).forEach(function(key) {
      const base = lerBase(key);
      const status = {}, setor = {}, funcao = {}, seen = {}, dup = {};
      base.registros.forEach(function(r) {
        addGrupo(status, r.status, 1);
        addGrupo(setor, r.setor, 1);
        addGrupo(funcao, r.funcao, 1);
        if (r.key) {
          if (seen[r.key]) dup[r.key] = true;
          seen[r.key] = true;
        }
      });
      atual[key] = {
        aba: CONFIG.sheets[key].name,
        encontrada: base.encontrada,
        headerRow: CONFIG.sheets[key].headerRow,
        headers: base.headers,
        linhasLidas: base.linhasLidas || 0,
        registrosValidos: base.registros.length,
        matriculasDistintas: Object.keys(seen).length,
        duplicidades: Object.keys(dup).length,
        porStatus: toArrayGrupo(status),
        porSetor: toArrayGrupo(setor, 20),
        porFuncao: toArrayGrupo(funcao, 20),
        excluidosPorFiltroAtual: base.registros.filter(function(r) { return !statusPadraoSelecionado(r.status); }).length,
        performance: base.performance
      };
    });
    return {
      updatedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm"),
      bases: atual
    };
  });
}

function testarCacheExecucaoDataService() {
  limparCacheExecucaoBases_();
  const inicioPrimeira = Date.now();
  const primeira = lerBase("perfil");
  const primeiraMs = Date.now() - inicioPrimeira;
  const inicioSegunda = Date.now();
  const segunda = lerBase("perfil");
  const segundaMs = Date.now() - inicioSegunda;
  const resultado = {
    sucesso: true,
    primeiraLeituraMs: primeiraMs,
    segundaLeituraMs: segundaMs,
    mesmoObjetoEmMemoria: primeira === segunda,
    registros: primeira.registros.length
  };
  Logger.log(JSON.stringify(resultado, null, 2));
  return resultado;
}
