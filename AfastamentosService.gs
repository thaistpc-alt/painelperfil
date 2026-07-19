function carregarAfastamentos() {
  limparCacheExecucaoBases_();

  return medirPerformance("carregarAfastamentos", function() {
    const preparado = prepararAfastamentos_();
    const registros = preparado.registros;
    const indicadores = calcularIndicadoresAfastamentos_(registros);
    const graficos = calcularGraficosAfastamentos_(registros);

    return {
      updatedAt: Utilities.formatDate(
        new Date(),
        Session.getScriptTimeZone(),
        "dd/MM/yyyy HH:mm"
      ),

      opcoes: opcoesComuns_(registros),

      anos: Array.from(
        new Set(
          registros
            .map(function(r) { return r.ano; })
            .filter(Boolean)
        )
      ).sort(),

      /*
       * Mantido temporariamente para compatibilidade com o frontend atual.
       * Na próxima etapa, a tabela passará a usar paginação real.
       */
      registros: registros,

      indicadores: indicadores,
      graficos: graficos,

      origem: preparado.origem,
      totalRegistros: registros.length,
      retornoLimitado: false,

      colunasIndicadores: {
        totalAfastamentos: "cada linha válida de BD AFASTAMENTOS",
        colaborador: "CHAPA quando preenchida; NOME como fallback",
        dataAno: "DTINICIO",
        diasPerdidos: "QTD sem preenchimento artificial",
        cid: "CID",
        setor: "SETOR",
        funcao: "FUNÇÃO"
      },

      observacoes: [
        "Registros sem QTD são mantidos com zero dias e contabilizados separadamente em diasNaoInformados.",
        "Os indicadores são calculados sobre toda a base válida, sem corte de 1.200 registros."
      ]
    };
  });
}

function prepararAfastamentos_() {
  const base = lerBase("afastamentos");
  const perfil = mapaPerfil_();

  const registros = base.registros.map(function(r) {
    const key = keyPessoa(r.mat, r.nome);
    const pessoa = perfil[key] || {};
    const cid = limparTexto(r.cid).toUpperCase();
    const diasInformados = limparTexto(r.dias) !== "";
    const dias = diasInformados ? numeroSeguro(r.dias) : 0;

    return {
      key: key,
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

      dias: dias,
      diasInformados: diasInformados,

      cid: cid,
      descricaoCid: r.descricaoCid,
      familiaCid: familiaCid(cid)
    };
  });

  return {
    origem: {
      aba: CONFIG.sheets.afastamentos.name,
      headerRow: CONFIG.sheets.afastamentos.headerRow,
      headers: base.headers,
      linhasLidas: base.linhasLidas || 0,
      performance: base.performance
    },
    registros: registros
  };
}

function calcularIndicadoresAfastamentos_(registros) {
  const pessoas = {};
  const cids = {};
  const familias = {};

  let totalDias = 0;
  let comCid = 0;
  let semCid = 0;
  let cidF = 0;
  let cidM = 0;
  let diasNaoInformados = 0;

  (registros || []).forEach(function(r) {
    if (r.key) {
      pessoas[r.key] = true;
    }

    if (r.diasInformados) {
      totalDias += numeroSeguro(r.dias);
    } else {
      diasNaoInformados++;
    }

    if (r.cid) {
      comCid++;
      cids[r.cid] = (cids[r.cid] || 0) + 1;
    } else {
      semCid++;
    }

    if (r.familiaCid) {
      familias[r.familiaCid] = (familias[r.familiaCid] || 0) + 1;
    }

    if (r.familiaCid === "F") {
      cidF++;
    }

    if (r.familiaCid === "M") {
      cidM++;
    }
  });

  const total = (registros || []).length;
  const maiorFamilia = maiorGrupoAfastamentos_(familias);

  return {
    totalAfastamentos: total,
    colaboradoresDistintos: Object.keys(pessoas).length,
    diasPerdidos: totalDias,
    mediaDias: total ? totalDias / total : 0,
    comCid: comCid,
    semCid: semCid,
    cidF: cidF,
    cidM: cidM,
    maiorFamiliaCid: maiorFamilia,
    cidsDistintos: Object.keys(cids).length,
    diasNaoInformados: diasNaoInformados
  };
}

function calcularGraficosAfastamentos_(registros) {
  const porMes = {};
  const porSetor = {};
  const porFuncao = {};
  const porCid = {};
  const porFamilia = {};

  for (let mes = 1; mes <= 12; mes++) {
    porMes[mes] = 0;
  }

  (registros || []).forEach(function(r) {
    if (r.mes) {
      porMes[r.mes] = (porMes[r.mes] || 0) + 1;
    }

    addGrupo(porSetor, r.setor, 1);
    addGrupo(porFuncao, r.funcao, 1);

    if (r.cid) {
      porCid[r.cid] = (porCid[r.cid] || 0) + 1;
    }

    if (r.familiaCid) {
      porFamilia[r.familiaCid] = (porFamilia[r.familiaCid] || 0) + 1;
    }
  });

  return {
    porMes: Object.keys(porMes)
      .map(function(mes) {
        return {
          mes: Number(mes),
          nome: nomeMesAfastamentos_(Number(mes)),
          quantidade: porMes[mes]
        };
      })
      .sort(function(a, b) { return a.mes - b.mes; }),

    porSetor: toArrayGrupo(porSetor),
    porFuncao: toArrayGrupo(porFuncao),
    topCids: toArrayGrupo(porCid, 10),

    porFamiliaCid: Object.keys(porFamilia)
      .map(function(letra) {
        return {
          nome: letra + " - " + descricaoFamiliaCid(letra),
          familia: letra,
          quantidade: porFamilia[letra]
        };
      })
      .sort(function(a, b) {
        return b.quantidade - a.quantidade || a.nome.localeCompare(b.nome);
      })
  };
}

function maiorGrupoAfastamentos_(grupo) {
  const lista = Object.keys(grupo || {})
    .map(function(chave) {
      return {
        familia: chave,
        descricao: descricaoFamiliaCid(chave),
        quantidade: grupo[chave]
      };
    })
    .sort(function(a, b) {
      return b.quantidade - a.quantidade;
    });

  return lista[0] || {
    familia: "",
    descricao: "Não informado",
    quantidade: 0
  };
}

function nomeMesAfastamentos_(mes) {
  const nomes = [
    "",
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez"
  ];

  return nomes[mes] || String(mes || "");
}

function diagnosticarAfastamentosIndicadores() {
  limparCacheExecucaoBases_();

  const preparado = prepararAfastamentos_();
  const indicadores = calcularIndicadoresAfastamentos_(preparado.registros);
  const graficos = calcularGraficosAfastamentos_(preparado.registros);

  const resultado = {
    sucesso: true,
    origem: preparado.origem,
    indicadores: indicadores,
    graficos: {
      porMes: graficos.porMes,
      topCids: graficos.topCids,
      porFamiliaCid: graficos.porFamiliaCid.slice(0, 10)
    }
  };

  Logger.log(JSON.stringify(resultado, null, 2));
  return resultado;
}

function testarAfastamentos() {
  const dados = carregarAfastamentos();

  return {
    sucesso: true,
    registros: dados.registros.length,
    totalRegistros: dados.totalRegistros,
    retornoLimitado: dados.retornoLimitado,
    indicadores: dados.indicadores,
    colunasIndicadores: dados.colunasIndicadores,
    performance: dados.performance
  };
}
