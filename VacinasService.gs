function carregarVacinas() {
  return medirPerformance("carregarVacinas", () => {
    const preparado = prepararVacinas_();
    const registros = limitarRegistrosTela_(preparado.registros);
    return {
      updatedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm"),
      opcoes: opcoesComuns_(preparado.registros),
      vacinas: CONFIG.vaccines.map(v => ({ id: v.id, label: v.label })),
      registros: registros,
      origem: preparado.origem,
      totalRegistros: preparado.registros.length,
      retornoLimitado: registros.length < preparado.registros.length,
      regraPendencia: "Prioridade: coluna consolidada da vacina; depois esquema consolidado; por último doses."
    };
  });
}

function prepararVacinas_() {
  const base = lerBase("vacinas");
  const registros = base.registros.map(r => {
    const vacinas = {};
    const pendencias = [];
    CONFIG.vaccines.forEach(v => {
      const situacao = primeiroValorAliases_(r, v.statusAliases);
      const doses = (v.doseAliases || []).map(a => limparTexto(r[a])).filter(Boolean);
      const completa = vacinaCompleta_(situacao, doses, v.id);
      vacinas[v.id] = { label: v.label, situacao: situacao || (doses.length ? "Doses registradas" : "Não informado"), completa };
      if (!completa) pendencias.push(v.label);
    });
    const situacaoGeral = limparTexto(r.situacaoVacinal);
    const completoGeral = normalizarTexto(situacaoGeral).indexOf("ATUALIZAD") !== -1 || pendencias.length === 0;
    return {
      key: r.key, mat: r.mat, nome: r.nome, status: r.status, setor: r.setor, funcao: r.funcao, sexo: r.sexo,
      situacaoVacinal: situacaoGeral || (completoGeral ? "Completo" : "Pendente"),
      vacinas,
      completoGeral,
      pendencias,
      dtProximoReforco: r["PRÓXIMO REFORÇO DT"],
      dtDatas: ["dT (1º DOSE)", "dT (2º DOSE)", "dT (3º DOSE)", "REFORÇO dT"].map(c => r[c]).filter(Boolean),
      hepBDatas: ["HEP. B (1º DOSE)", "HEP. B (2º DOSE)", "HEP. B (3º DOSE)", "NOVO ESQ HEP B 1 DOSE", "NOVO ESQ HEP B 2 DOSE"].map(c => r[c]).filter(Boolean)
    };
  });
  return {
    origem: { aba: CONFIG.sheets.vacinas.name, headerRow: CONFIG.sheets.vacinas.headerRow, headers: base.headers, linhasLidas: base.linhasLidas || 0 },
    registros
  };
}

function primeiroValorAliases_(r, aliases) {
  for (let i = 0; i < aliases.length; i++) {
    const v = limparTexto(r[aliases[i]]);
    if (v) return v;
  }
  return "";
}

function vacinaCompleta_(situacao, doses, vacinaId) {
  const s = normalizarTexto(situacao);
  if (s) {
    if (s.indexOf("NAO VACIN") !== -1 || s.indexOf("NÃO VACIN") !== -1 || s.indexOf("INCOMPLE") !== -1 || s.indexOf("PEND") !== -1) return false;
    if (s.indexOf("COMPLE") !== -1 || s.indexOf("VACINAD") !== -1 || s.indexOf("IMUNIZ") !== -1 || s.indexOf("ATUALIZ") !== -1) return true;
  }
  if (vacinaId === "covid") return doses.length >= 1;
  if (vacinaId === "dt") return doses.length >= 3;
  if (vacinaId === "hepB") return doses.length >= 3;
  return false;
}

function testarVacinas() {
  const dados = carregarVacinas();
  return { sucesso: true, registros: dados.registros.length, regraPendencia: dados.regraPendencia };
}

function diagnosticarVacinasIndicadores() {
  return carregarVacinas();
}
