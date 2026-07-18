function carregarPatologias() {
  return medirPerformance("carregarPatologias", () => {
    const preparado = prepararPatologias_();
    const registros = limitarRegistrosTela_(preparado.registros);
    return {
      updatedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm"),
      opcoes: opcoesComuns_(preparado.registros),
      registros: registros,
      origem: preparado.origem,
      totalRegistros: preparado.registros.length,
      retornoLimitado: registros.length < preparado.registros.length
    };
  });
}

function prepararPatologias_() {
  const base = lerBase("patologias");
  const porPessoa = {};
  base.registros.forEach(r => {
    const cids = extrairCidsPatologia_(r);
    const familias = Array.from(new Set(cids.map(familiaCid).filter(Boolean))).sort();
    const atual = porPessoa[r.key] || {
      key: r.key,
      mat: r.mat,
      nome: r.nome,
      status: r.status,
      setor: r.setor,
      funcao: r.funcao,
      sexo: r.sexo,
      idade: numeroSeguro(r.idade),
      cids: [],
      familiasCid: [],
      atividadeFisica: limparTexto(r["PRATICA ATIVIDADE"]) || limparTexto(r["PRATICA EXERCICIOS"]) || "Nao informado",
      etilismo: valorPatologiaColuna_(r, 13, ["ETILISTA", "ETILISMO"]) || "Nao informado",
      tabagismo: valorPatologiaColuna_(r, 14, ["TABAGISTA", "TABAGISMO"]) || "Nao informado"
    };
    atualizarSeInformado_(atual, "atividadeFisica", limparTexto(r["PRATICA ATIVIDADE"]) || limparTexto(r["PRATICA EXERCICIOS"]));
    atualizarSeInformado_(atual, "etilismo", valorPatologiaColuna_(r, 13, ["ETILISTA", "ETILISMO"]));
    atualizarSeInformado_(atual, "tabagismo", valorPatologiaColuna_(r, 14, ["TABAGISTA", "TABAGISMO"]));
    cids.forEach(cid => { if (atual.cids.indexOf(cid) === -1) atual.cids.push(cid); });
    familias.forEach(f => { if (atual.familiasCid.indexOf(f) === -1) atual.familiasCid.push(f); });
    porPessoa[r.key] = atual;
  });
  return {
    origem: { aba: CONFIG.sheets.patologias.name, headerRow: CONFIG.sheets.patologias.headerRow, headers: base.headers, linhasLidas: base.linhasLidas || 0 },
    registros: Object.keys(porPessoa).map(k => porPessoa[k])
  };
}

function atualizarSeInformado_(obj, campo, valor) {
  const limpo = limparTexto(valor);
  if (limpo && normalizarTexto(obj[campo]).indexOf("NAO INFORMADO") !== -1) obj[campo] = limpo;
}

function valorPatologiaColuna_(r, index, aliases) {
  for (let i = 0; i < aliases.length; i++) {
    const valor = limparTexto(r[aliases[i]]);
    if (valor) return valor;
  }
  return limparTexto((r._raw || [])[index]);
}

function extrairCidsPatologia_(r) {
  const cids = [];
  Object.keys(r).forEach(k => {
    if (/DOENCAS PREVIAS - CID/i.test(normalizarTexto(k))) {
      const cid = limparTexto(r[k]).toUpperCase();
      if (cid && cids.indexOf(cid) === -1) cids.push(cid);
    }
  });
  return cids;
}

function testarPatologias() {
  const dados = carregarPatologias();
  return { sucesso: true, registros: dados.registros.length, origem: dados.origem };
}
