function carregarAfastamentos() {
  return medirPerformance("carregarAfastamentos", () => {
    const preparado = prepararAfastamentos_();
    return {
      updatedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm"),
      opcoes: opcoesComuns_(preparado.registros),
      anos: Array.from(new Set(preparado.registros.map(r => r.ano).filter(Boolean))).sort(),
      registros: preparado.registros,
      origem: preparado.origem,
      colunasIndicadores: {
        totalAfastamentos: "cada linha válida de BD AFASTAMENTOS",
        colaborador: "CHAPA quando preenchida; NOME como fallback",
        dataAno: "DTINICIO",
        diasPerdidos: "QTD",
        cid: "CID",
        setor: "SETOR",
        funcao: "FUNÇÃO"
      }
    };
  });
}

function prepararAfastamentos_() {
  const base = lerBase("afastamentos");
  const perfil = mapaPerfil_();
  const registros = base.registros.map(r => {
    const key = keyPessoa(r.mat, r.nome);
    const pessoa = perfil[key] || {};
    const cid = limparTexto(r.cid).toUpperCase();
    return {
      key,
      mat: r.mat,
      nome: r.nome,
      status: pessoa.status || "Não informado",
      setor: limparTexto(r.setor) || pessoa.setor || "Não informado",
      funcao: limparTexto(r.funcao) || pessoa.funcao || "Não informado",
      sexo: pessoa.sexo || "Não informado",
      dataInicio: formatarData(r.dataInicio),
      dataFim: formatarData(r.dataFim),
      ano: obterAno(r.dataInicio),
      mes: obterMes(r.dataInicio),
      dias: numeroSeguro(r.dias) || 1,
      cid,
      descricaoCid: r.descricaoCid,
      familiaCid: familiaCid(cid)
    };
  });
  return {
    origem: { aba: CONFIG.sheets.afastamentos.name, headerRow: CONFIG.sheets.afastamentos.headerRow, headers: base.headers, linhasLidas: base.linhasLidas || 0 },
    registros
  };
}

function testarAfastamentos() {
  const dados = carregarAfastamentos();
  return { sucesso: true, registros: dados.registros.length, colunasIndicadores: dados.colunasIndicadores };
}
