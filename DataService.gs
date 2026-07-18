function lerBase(baseKey, options) {
  const opt = options || {};
  const cfg = CONFIG.sheets[baseKey];
  if (!cfg) throw new Error("Base não configurada: " + baseKey);

  const t0 = Date.now();
  const sheet = getSpreadsheet().getSheetByName(cfg.name);
  if (!sheet) {
    return { baseKey, encontrada: false, headers: [], registros: [], performance: { leituraMs: Date.now() - t0 } };
  }

  const lastCol = sheet.getLastColumn();
  const maxRow = sheet.getLastRow();
  const headerRow = cfg.headerRow || 1;
  if (maxRow < headerRow || lastCol < 1) return { baseKey, encontrada: true, headers: [], registros: [] };

  const headers = sheet.getRange(headerRow, 1, 1, lastCol).getDisplayValues()[0].map((h, i) => limparTexto(h) || ("COL_" + (i + 1)));
  if (opt.somenteCabecalho) return { baseKey, encontrada: true, headers, registros: [] };

  const headerMap = montarMapaCabecalho(headers);
  const keyIndexes = (cfg.keyAliases || []).map(a => headerMap[normalizarTexto(a)]).filter(i => i !== undefined);
  const scanStart = headerRow + 1;
  const rowsToScan = Math.max(maxRow - headerRow, 0);
  let lastUsefulRow = headerRow;
  if (rowsToScan > 0 && keyIndexes.length) {
    keyIndexes.forEach(idx => {
      const vals = sheet.getRange(scanStart, idx + 1, rowsToScan, 1).getDisplayValues();
      for (let i = vals.length - 1; i >= 0; i--) {
        if (limparTexto(vals[i][0])) {
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
  const registros = values.map((row, idx) => montarRegistro(row, headers, headerMap, headerRow + idx + 1, cfg))
    .filter(reg => regValido(reg));
  return {
    baseKey,
    encontrada: true,
    headers,
    headerMap,
    registros,
    linhasLidas: values.length,
    performance: { leituraMs, processamentoMs: Date.now() - t1, totalMs: Date.now() - t0 }
  };
}

function montarMapaCabecalho(headers) {
  const map = {};
  headers.forEach((h, i) => {
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
  headers.forEach((h, i) => { reg[h] = limparTexto(row[i]); });
  Object.keys(CONFIG.aliases).forEach(campo => {
    const idx = idxAlias(headerMap, CONFIG.aliases[campo]);
    reg[campo] = idx >= 0 ? limparTexto(row[idx]) : "";
  });
  Object.keys((cfg && cfg.fieldFallbacks) || {}).forEach(campo => {
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
  return lerBase("perfil").registros.map(r => ({
    key: r.key, mat: r.mat, nome: r.nome, status: r.status, setor: r.setor, funcao: r.funcao,
    sexo: r.sexo, idade: numeroSeguro(r.idade), nascimento: r.nascimento
  }));
}

function mapaPerfil_() {
  const mapa = {};
  carregarRegistrosPerfil_().forEach(r => { if (r.key && !mapa[r.key]) mapa[r.key] = r; });
  return mapa;
}

function opcoesComuns_(registros) {
  const setor = {}, funcao = {}, sexo = {}, status = {};
  registros.forEach(r => {
    addGrupo(setor, r.setor, 0); addGrupo(funcao, r.funcao, 0); addGrupo(sexo, r.sexo, 0); addGrupo(status, r.status, 0);
  });
  return {
    setores: Object.keys(setor).sort(),
    funcoes: Object.keys(funcao).sort(),
    sexos: Object.keys(sexo).sort(),
    status: montarOpcoesStatus_(Object.keys(status))
  };
}

function diagnosticarBases() {
  return medirPerformance("diagnosticarBases", () => {
    const atual = {};
    Object.keys(CONFIG.sheets).forEach(key => {
      const base = lerBase(key);
      const status = {}, setor = {}, funcao = {}, seen = {}, dup = {};
      base.registros.forEach(r => {
        addGrupo(status, r.status, 1); addGrupo(setor, r.setor, 1); addGrupo(funcao, r.funcao, 1);
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
        excluidosPorFiltroAtual: base.registros.filter(r => !statusPadraoSelecionado(r.status)).length,
        performance: base.performance
      };
    });
    return { updatedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm"), bases: atual };
  });
}
