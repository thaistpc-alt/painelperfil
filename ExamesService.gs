function carregarExames() {
  return medirPerformance("carregarExames", () => {
    const cfg = CONFIG.sheets.exames;
    if (!cfg) {
      return {
        updatedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm"),
        registros: [],
        opcoes: opcoesComuns_([]),
        origem: { encontrada: false, mensagem: "Nenhuma aba de exames complementares está configurada na planilha atual." },
        examesValidos: CONFIG.exams
      };
    }
    const base = lerBase("exames");
    const examesValidos = CONFIG.exams.filter(nome => base.headers.some(h => normalizarTexto(h) === normalizarTexto(nome)));
    const registros = base.registros.map(r => {
      const exames = examesValidos.map(nome => {
        const valor = limparTexto(r[nome]);
        const n = normalizarTexto(valor);
        const realizado = n.indexOf("REALIZ") !== -1 || n.indexOf("APTO") !== -1 || n.indexOf("NORMAL") !== -1 || !!valor;
        const pendente = n.indexOf("PEND") !== -1 || n.indexOf("VENC") !== -1 || n.indexOf("NAO") !== -1;
        return { nome, valor: valor || "Não informado", realizado: realizado && !pendente, pendente };
      });
      return {
        key: r.key, mat: r.mat, nome: r.nome, status: r.status, setor: r.setor, funcao: r.funcao, sexo: r.sexo,
        exames
      };
    });
    return {
      updatedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm"),
      opcoes: opcoesComuns_(registros),
      registros,
      origem: { aba: cfg.name, encontrada: base.encontrada, headerRow: cfg.headerRow, headers: base.headers, linhasLidas: base.linhasLidas || 0 },
      examesValidos
    };
  });
}
