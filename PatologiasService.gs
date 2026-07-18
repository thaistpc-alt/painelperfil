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
      key: r.key, mat: r.mat, nome: r.nome, status: r.status, setor: r.setor, funcao: r.funcao,
      sexo: r.sexo, idade: numeroSeguro(r.idade), cids: [], familiasCid: [],
      atividadeFisica: limparTexto(r["PRATICA ATIVIDADE"]) || limparTexto(r["PRATICA EXERCÍCIOS"]) || "Não informado",
      tabagismo: limparTexto(r["TABAGISTA"]) || "Não informado"
    };
    cids.forEach(cid => { if (atual.cids.indexOf(cid) === -1) atual.cids.push(cid); });
    familias.forEach(f => { if (atual.familiasCid.indexOf(f) === -1) atual.familiasCid.push(f); });
    porPessoa[r.key] = atual;
  });
  return {
    origem: { aba: CONFIG.sheets.patologias.name, headerRow: CONFIG.sheets.patologias.headerRow, headers: base.headers, linhasLidas: base.linhasLidas || 0 },
    registros: Object.keys(porPessoa).map(k => porPessoa[k])
  };
}

function extrairCidsPatologia_(r) {
  const cids = [];
  Object.keys(r).forEach(k => {
    if (/DOENÇAS PREVIAS - CID/i.test(k) || /DOENCAS PREVIAS - CID/i.test(normalizarTexto(k))) {
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
