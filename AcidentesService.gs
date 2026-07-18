function carregarAcidentes() {
  return medirPerformance("carregarAcidentes", () => {
    const preparado = prepararAcidentes_();
    const registros = limitarRegistrosTela_(preparado.registros);
    return {
      updatedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm"),
      opcoes: opcoesComuns_(preparado.registros),
      anos: Array.from(new Set(preparado.registros.map(r => r.ano).filter(Boolean))).sort(),
      registros: registros,
      origem: preparado.origem,
      totalRegistros: preparado.registros.length,
      retornoLimitado: registros.length < preparado.registros.length
    };
  });
}

function prepararAcidentes_() {
  const base = lerBase("acidentes");
  const perfil = mapaPerfil_();
  const registros = base.registros.map(r => {
    const key = keyPessoa(r.mat, r.nome);
    const pessoa = perfil[key] || {};
    const data = r.acidenteData || r["DATA"];
    const tipo = limparTexto(r.acidenteTipo || r["TIPO DE ACIDENTE"]) || "Não informado";
    const codigo = limparTexto(r.acidenteCodigo || r["CÓD."]);
    return {
      id: codigo || [key, formatarData(data), tipo].join("|"),
      key,
      mat: r.mat,
      nome: r.nome,
      status: pessoa.status || "Não informado",
      setor: limparTexto(r.setor) || pessoa.setor || "Não informado",
      funcao: limparTexto(r.funcao) || pessoa.funcao || "Não informado",
      sexo: pessoa.sexo || "Não informado",
      data: formatarData(data),
      ano: obterAno(data),
      mes: obterMes(data),
      tipo,
      conclusao: limparTexto(r.acidenteConclusao || r["CONCLUSÃO"]) || "Não informado",
      exposicao: tipo,
      material: limparTexto(r["PROCEDIMENTO (BIOLÓGICO)"]) || "Não informado",
      agente: limparTexto(r.acidenteAgente || r["AGENTE CAUSADOR"]) || "Não informado",
      parteCorpo: limparTexto(r.acidenteParteCorpo || r["PARTE DO CORPO ATINGIDO"]) || "Não informado",
      pacienteFonte: limparTexto(r.acidentePacienteFonte || r["PACIENTE"]) || "Não informado",
      pepIndicada: limparTexto(r["INDICAÇÃO DE PEP"]) || "Não informado"
    };
  });
  return {
    origem: { aba: CONFIG.sheets.acidentes.name, headerRow: CONFIG.sheets.acidentes.headerRow, headers: base.headers, linhasLidas: base.linhasLidas || 0 },
    registros
  };
}

function carregarTratativasAcidentes() {
  return medirPerformance("carregarTratativasAcidentes", () => {
    garantirColunasTratativasAcidentes();
    const acidentes = prepararAcidentes_().registros;
    const perfil = mapaPerfil_();
    const mapaAcidentes = montarMapaAcidentesParaSeguimento_(acidentes);
    const base = lerBase("examesAcidentes");
    const registros = base.registros.map(r => {
      const data = r["DATA DO ACIDENTE"] || r.acidenteData;
      const key = keyPessoa(r.mat, r.nome);
      const acidente = mapaAcidentes[key + "|" + formatarData(data)] || mapaAcidentes[key] || {};
      const pessoa = perfil[key] || {};
      const id = [limparTexto(r["COL_1"]) || "", key, formatarData(data)].join("|");
      return {
        id,
        rowNumber: r._rowNumber,
        key,
        mat: r.mat,
        nome: r.nome,
        setor: acidente.setor || pessoa.setor || "Não informado",
        funcao: acidente.funcao || pessoa.funcao || "Não informado",
        sexo: pessoa.sexo || "Não informado",
        tipoSeguimento: limparTexto(r["TIPO DE SEGUIMENTO"]) || "Seguimento de acidente de trabalho",
        status: r.tratamentoStatus || r["STATUS"] || "PENDENTE",
        statusEtapa: r.tratamentoStatus || r["STATUS"] || "PENDENTE",
        dataAcidente: formatarData(data),
        pepRealizada: r.tratamentoPepRealizada || r["PEP REALIZADA?"] || "",
        primeiroSeguimento: etapaSeguimento_(r, "1º SEGUIMENTO (30 dias)", "DATA DE REALIZAÇÃO 1º SEGUIMENTO ", "REALIZADO?", "STATUS DAS SOROLOGIAS"),
        segundoSeguimento: etapaSeguimento_(r, "DATA DE REALIZAÇÃO 2º SEGUIMENTO", "DATA DE REALIZAÇÃO 2º SEGUIMENTO", "REALIZADO?", "STATUS DAS SOROLOGIAS", 2),
        terceiroSeguimento: etapaSeguimento_(r, "DATA DE REALIZAÇÃO 3º SEGUIMENTO ", "DATA DE REALIZAÇÃO 3º SEGUIMENTO ", "REALIZADO?", "STATUS DAS SOROLOGIAS", 3),
        observacoes: r.tratamentoObs || r["OBS"] || ""
      };
    });
    const retorno = limitarRegistrosTela_(registros);
    return {
      updatedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm"),
      registros: retorno,
      opcoes: opcoesComuns_(registros),
      origem: { aba: CONFIG.sheets.examesAcidentes.name, headerRow: CONFIG.sheets.examesAcidentes.headerRow, headers: base.headers, linhasLidas: base.linhasLidas || 0 },
      totalRegistros: registros.length,
      retornoLimitado: retorno.length < registros.length,
      colunasSugeridas: CONFIG.treatmentWriteColumns
    };
  });
}

function montarMapaAcidentesParaSeguimento_(acidentes) {
  const mapa = {};
  acidentes.forEach(a => {
    if (a.key) {
      if (!mapa[a.key]) mapa[a.key] = a;
      if (a.data) mapa[a.key + "|" + a.data] = a;
    }
  });
  return mapa;
}

function etapaSeguimento_(r, prevista, realizada, feito, resultado, deslocamento) {
  const shift = deslocamento || 1;
  const raw = r._raw || [];
  const headers = r._headers || [];
  const previstaIdx = acharIndiceDuplicado_(headers, prevista, shift);
  const realIdx = acharIndiceDuplicado_(headers, realizada, shift);
  const feitoIdx = acharIndiceDuplicado_(headers, feito, shift);
  const resIdx = acharIndiceDuplicado_(headers, resultado, shift);
  const dataRealizada = realIdx >= 0 ? raw[realIdx] : "";
  const realizado = feitoIdx >= 0 ? raw[feitoIdx] : "";
  const resultadoValor = resIdx >= 0 ? raw[resIdx] : "";
  return {
    prevista: previstaIdx >= 0 ? raw[previstaIdx] : "",
    realizada: dataRealizada,
    realizado: realizado,
    resultado: resultadoValor,
    status: classificarStatusEtapa_(dataRealizada, realizado, resultadoValor)
  };
}

function acharIndiceDuplicado_(headers, nome, ocorrencia) {
  const alvo = normalizarTexto(nome);
  let atual = 0;
  for (let i = 0; i < headers.length; i++) {
    if (normalizarTexto(headers[i]) === alvo) {
      atual++;
      if (atual === ocorrencia) return i;
    }
  }
  return -1;
}

function classificarStatusEtapa_(dataRealizada, realizado, resultado) {
  const r = normalizarTexto(realizado + " " + resultado);
  if (r.indexOf("DISPENS") !== -1 || r.indexOf("FINALIZ") !== -1 || r.indexOf("ENCERR") !== -1) return "encerrado";
  if (r.indexOf("SIM") !== -1 || limparTexto(dataRealizada)) return "realizado";
  return "pendente";
}
