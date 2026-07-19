function carregarVacinas() {
  limparCacheExecucaoBases_();

  return medirPerformance("carregarVacinas", function() {
    const preparado = prepararVacinas_();
    const registros = preparado.registros;

    return {
      updatedAt: Utilities.formatDate(
        new Date(),
        Session.getScriptTimeZone(),
        "dd/MM/yyyy HH:mm"
      ),

      opcoes: opcoesComuns_(registros),

      vacinas: [
        { id: "dt", label: "dT" },
        { id: "hepB", label: "Hepatite B" },
        { id: "covid", label: "COVID" }
      ],

      registros: registros,
      indicadores: calcularIndicadoresVacinas_(registros),
      graficos: calcularGraficosVacinas_(registros),

      origem: preparado.origem,
      totalRegistros: registros.length,
      retornoLimitado: false,

      regraPendencia: [
        "Situação geral: coluna D.",
        "dT: coluna K, valores COMPLETO ou INCOMPLETO.",
        "Hepatite B: coluna R, valores COMPLETO ou INCOMPLETO.",
        "COVID: coluna AA, valores VACINADO(A) ou NÃO VACINADO(A).",
        "Não são consideradas outras vacinas."
      ]
    };
  });
}

function prepararVacinas_() {
  const base = lerBase("vacinas");

  const registros = base.registros.map(function(r) {
    const situacaoGeralBruta = valorColunaVacina_(r, 3, [
      "SITUAÇÃO VACINAL",
      "SITUACAO VACINAL"
    ]);

    const dtBruto = valorColunaVacina_(r, 10, [
      "ESQUEMA DE DT",
      "ESQUEMA dT",
      "Esquema de dT"
    ]);

    const hepBBruto = valorColunaVacina_(r, 17, [
      "SITUAÇÃO VACINAL - HEPATITE B",
      "SITUACAO VACINAL - HEPATITE B",
      "HEPATITE B"
    ]);

    const covidBruto = valorColunaVacina_(r, 26, [
      "SITUAÇÃO VACINAL - COVID",
      "SITUACAO VACINAL - COVID",
      "COVID"
    ]);

    const situacaoGeral = classificarSituacaoGeralVacinal_(situacaoGeralBruta);
    const dt = classificarCompletoIncompleto_(dtBruto);
    const hepB = classificarCompletoIncompleto_(hepBBruto);
    const covid = classificarCovid_(covidBruto);

    const pendencias = [];
    const naoInformadas = [];

    if (dt.status === "Pendente") pendencias.push("dT");
    if (hepB.status === "Pendente") pendencias.push("Hepatite B");
    if (covid.status === "Pendente") pendencias.push("COVID");

    if (dt.status === "Não informado") naoInformadas.push("dT");
    if (hepB.status === "Não informado") naoInformadas.push("Hepatite B");
    if (covid.status === "Não informado") naoInformadas.push("COVID");

    return {
      key: r.key,
      mat: r.mat,
      nome: r.nome,
      status: r.status,
      setor: r.setor,
      funcao: r.funcao,
      sexo: r.sexo,

      situacaoVacinalOriginal: situacaoGeralBruta,
      situacaoVacinal: situacaoGeral.status,
      completoGeral: situacaoGeral.status === "Completo",
      pendenteGeral: situacaoGeral.status === "Pendente",
      naoInformadoGeral: situacaoGeral.status === "Não informado",

      vacinas: {
        dt: {
          label: "dT",
          valorOriginal: dtBruto,
          situacao: dt.status,
          completa: dt.status === "Completo"
        },
        hepB: {
          label: "Hepatite B",
          valorOriginal: hepBBruto,
          situacao: hepB.status,
          completa: hepB.status === "Completo"
        },
        covid: {
          label: "COVID",
          valorOriginal: covidBruto,
          situacao: covid.status,
          completa: covid.status === "Completo"
        }
      },

      pendencias: pendencias,
      naoInformadas: naoInformadas,

      dtSituacao: dt.status,
      hepBSituacao: hepB.status,
      covidSituacao: covid.status,

      dtProximoReforco: limparTexto(r["PRÓXIMO REFORÇO DT"] || r["PROXIMO REFORCO DT"]),
      dtDatas: [
        r["dT (1º DOSE)"],
        r["dT (2º DOSE)"],
        r["dT (3º DOSE)"],
        r["REFORÇO dT"]
      ].filter(Boolean),

      hepBDatas: [
        r["HEP. B (1º DOSE)"],
        r["HEP. B (2º DOSE)"],
        r["HEP. B (3º DOSE)"],
        r["NOVO ESQ HEP B 1 DOSE"],
        r["NOVO ESQ HEP B 2 DOSE"]
      ].filter(Boolean),

      covidDatas: [
        r["ULTIMA DOSE"]
      ].filter(Boolean),

      vacinaEventos: eventosVacinaPorAno_(
        [
          r["dT (1º DOSE)"],
          r["dT (2º DOSE)"],
          r["dT (3º DOSE)"],
          r["REFORÇO dT"]
        ].filter(Boolean),
        "dT"
      ).concat(
        eventosVacinaPorAno_(
          [
            r["HEP. B (1º DOSE)"],
            r["HEP. B (2º DOSE)"],
            r["HEP. B (3º DOSE)"],
            r["NOVO ESQ HEP B 1 DOSE"],
            r["NOVO ESQ HEP B 2 DOSE"]
          ].filter(Boolean),
          "Hepatite B"
        )
      ).concat(
        eventosVacinaPorAno_(
          [r["ULTIMA DOSE"]].filter(Boolean),
          "COVID"
        )
      )
    };
  });

  return {
    origem: {
      aba: CONFIG.sheets.vacinas.name,
      headerRow: CONFIG.sheets.vacinas.headerRow,
      headers: base.headers,
      linhasLidas: base.linhasLidas || 0,
      performance: base.performance
    },
    registros: registros
  };
}

/**
 * Usa primeiro o cabeçalho; se não encontrar, usa o índice fixo informado.
 * Índices são zero-based:
 * D=3, K=10, R=17, AA=26.
 */
function valorColunaVacina_(registro, indiceZeroBased, aliases) {
  for (let i = 0; i < (aliases || []).length; i++) {
    const valor = limparTexto(registro[aliases[i]]);
    if (valor) return valor;
  }

  return limparTexto((registro._raw || [])[indiceZeroBased]);
}

function classificarSituacaoGeralVacinal_(valor) {
  const s = normalizarTexto(valor);

  if (!s) {
    return { status: "Não informado" };
  }

  if (
    s.indexOf("PENDENCIA VACINAL") !== -1 ||
    s.indexOf("PENDÊNCIA VACINAL") !== -1
  ) {
    return { status: "Pendente" };
  }

  if (
    s.indexOf("VACINAS ATUALIZADAS") !== -1 ||
    s.indexOf("VACINA ATUALIZADA") !== -1 ||
    s.indexOf("ATUALIZAD") !== -1
  ) {
    return { status: "Completo" };
  }

  return { status: "Não informado" };
}

function classificarCompletoIncompleto_(valor) {
  const s = normalizarTexto(valor);

  if (!s) {
    return { status: "Não informado" };
  }

  if (s.indexOf("INCOMPLETO") !== -1) {
    return { status: "Pendente" };
  }

  if (s.indexOf("COMPLETO") !== -1) {
    return { status: "Completo" };
  }

  return { status: "Não informado" };
}

function classificarCovid_(valor) {
  const s = normalizarTexto(valor);

  if (!s) {
    return { status: "Não informado" };
  }

  if (
    s.indexOf("NAO VACINADO") !== -1 ||
    s.indexOf("NÃO VACINADO") !== -1
  ) {
    return { status: "Pendente" };
  }

  if (s.indexOf("VACINADO") !== -1) {
    return { status: "Completo" };
  }

  return { status: "Não informado" };
}

function calcularIndicadoresVacinas_(registros) {
  const total = (registros || []).length;

  const completos = registros.filter(function(r) {
    return r.situacaoVacinal === "Completo";
  }).length;

  const pendentes = registros.filter(function(r) {
    return r.situacaoVacinal === "Pendente";
  }).length;

  const naoInformados = registros.filter(function(r) {
    return r.situacaoVacinal === "Não informado";
  }).length;

  return {
    totalColaboradores: total,
    completos: completos,
    pendentes: pendentes,
    naoInformados: naoInformados,

    dt: contarSituacoesVacina_(registros, "dtSituacao"),
    hepB: contarSituacoesVacina_(registros, "hepBSituacao"),
    covid: contarSituacoesVacina_(registros, "covidSituacao")
  };
}

function contarSituacoesVacina_(registros, campo) {
  const resultado = {
    completo: 0,
    pendente: 0,
    naoInformado: 0
  };

  (registros || []).forEach(function(r) {
    const valor = r[campo];

    if (valor === "Completo") resultado.completo++;
    else if (valor === "Pendente") resultado.pendente++;
    else resultado.naoInformado++;
  });

  return resultado;
}

function calcularGraficosVacinas_(registros) {
  const pendenciasPorVacina = {
    "dT": 0,
    "Hepatite B": 0,
    "COVID": 0
  };

  const pendenciasPorSetor = {};
  const pendenciasPorFuncao = {};

  (registros || []).forEach(function(r) {
    (r.pendencias || []).forEach(function(vacina) {
      pendenciasPorVacina[vacina] =
        (pendenciasPorVacina[vacina] || 0) + 1;
    });

    if ((r.pendencias || []).length) {
      addGrupo(pendenciasPorSetor, r.setor, 1);
      addGrupo(pendenciasPorFuncao, r.funcao, 1);
    }
  });

  return {
    pendenciasPorVacina: [
      { nome: "dT", quantidade: pendenciasPorVacina["dT"] || 0 },
      { nome: "Hepatite B", quantidade: pendenciasPorVacina["Hepatite B"] || 0 },
      { nome: "COVID", quantidade: pendenciasPorVacina["COVID"] || 0 }
    ],
    pendenciasPorSetor: toArrayGrupo(pendenciasPorSetor),
    pendenciasPorFuncao: toArrayGrupo(pendenciasPorFuncao)
  };
}

function eventosVacinaPorAno_(datas, tipo) {
  return (datas || [])
    .map(function(data) {
      return {
        tipo: tipo,
        ano: obterAnoVacina_(data)
      };
    })
    .filter(function(e) {
      return e.ano;
    });
}

function obterAnoVacina_(valor) {
  const texto = limparTexto(valor);

  if (!texto) {
    return "";
  }

  const match = texto.match(/\b(19\d{2}|20\d{2})\b/);

  if (!match) {
    return "";
  }

  const ano = Number(match[1]);
  const anoAtual = new Date().getFullYear() + 1;

  return ano >= 1990 && ano <= anoAtual ? String(ano) : "";
}

function diagnosticarVacinasIndicadores() {
  limparCacheExecucaoBases_();

  const preparado = prepararVacinas_();
  const indicadores = calcularIndicadoresVacinas_(preparado.registros);
  const graficos = calcularGraficosVacinas_(preparado.registros);

  const resultado = {
    sucesso: true,
    origem: preparado.origem,
    indicadores: indicadores,
    graficos: graficos,
    amostra: preparado.registros.slice(0, 10).map(function(r) {
      return {
        mat: r.mat,
        nome: r.nome,
        situacaoVacinalOriginal: r.situacaoVacinalOriginal,
        situacaoVacinal: r.situacaoVacinal,
        dt: r.vacinas.dt,
        hepB: r.vacinas.hepB,
        covid: r.vacinas.covid,
        pendencias: r.pendencias,
        naoInformadas: r.naoInformadas
      };
    })
  };

  Logger.log(JSON.stringify(resultado, null, 2));
  return resultado;
}

function testarVacinas() {
  const dados = carregarVacinas();

  return {
    sucesso: true,
    registros: dados.registros.length,
    totalRegistros: dados.totalRegistros,
    retornoLimitado: dados.retornoLimitado,
    indicadores: dados.indicadores,
    regraPendencia: dados.regraPendencia,
    performance: dados.performance
  };
}
