function carregarExames() {
  return medirPerformance("carregarExames", () => {
    const cfg = CONFIG.sheets.exames;
    if (!cfg) {
      return {
        updatedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm"),
        registros: [],
        opcoes: opcoesComuns_([]),
        origem: { encontrada: false, mensagem: "Nenhuma aba de exames complementares esta configurada na planilha atual." },
        examesValidos: CONFIG.exams
      };
    }

    const base = lerBase("exames");
    const porPessoa = {};
    base.registros.forEach(r => {
      const exameOriginal = limparTexto(r["EXAMES"]);
      const exame = classificarExameComplementar_(exameOriginal);
      if (!exame) return;

      const resultado = limparTexto(r["RESULTADO"]);
      const acao = valorPorHeaderNormalizado_(r, "ACAO CASO ALTERADO");
      const statusExame = normalizarTexto(resultado + " " + acao);
      const pendente = !resultado || statusExame.indexOf("PEND") !== -1 || statusExame.indexOf("VENC") !== -1 || statusExame.indexOf("NAO REALIZ") !== -1;
      const item = {
        nome: exame,
        descricao: exameOriginal,
        data: formatarData(r["DATA"]),
        resultado: resultado || "Nao informado",
        realizado: !pendente,
        pendente: pendente
      };

      if (!porPessoa[r.key]) {
        porPessoa[r.key] = {
          key: r.key,
          mat: r.mat,
          nome: r.nome,
          status: r.status,
          setor: r.setor,
          funcao: r.funcao,
          sexo: r.sexo,
          exames: []
        };
      }
      porPessoa[r.key].exames.push(item);
    });

    const registros = Object.keys(porPessoa).map(k => porPessoa[k]);
    const retorno = limitarRegistrosTela_(registros);
    return {
      updatedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm"),
      opcoes: opcoesComuns_(registros),
      registros: retorno,
      origem: { aba: cfg.name, encontrada: base.encontrada, headerRow: cfg.headerRow, headers: base.headers, linhasLidas: base.linhasLidas || 0 },
      examesValidos: CONFIG.exams,
      totalRegistros: registros.length,
      retornoLimitado: retorno.length < registros.length
    };
  });
}

function classificarExameComplementar_(nome) {
  const alvo = normalizarTexto(nome);
  if (!alvo) return "";
  for (let i = 0; i < CONFIG.exams.length; i++) {
    const exame = CONFIG.exams[i];
    if (alvo.indexOf(normalizarTexto(exame)) !== -1) return exame;
  }
  return "";
}

function valorPorHeaderNormalizado_(reg, headerNormalizado) {
  const alvo = normalizarTexto(headerNormalizado);
  const headers = reg._headers || [];
  for (let i = 0; i < headers.length; i++) {
    if (normalizarTexto(headers[i]) === alvo) return limparTexto(reg[headers[i]]);
  }
  return "";
}
