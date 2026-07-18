function carregarResumoPerfil() {
  return medirPerformance("carregarResumoPerfil", () => {
    const perfil = carregarRegistrosPerfil_();
    const patologias = executarModuloSeguro_("patologias", prepararPatologias_, { registros: [] });
    const vacinas = executarModuloSeguro_("vacinas", prepararVacinas_, { registros: [] });
    const afastamentos = executarModuloSeguro_("afastamentosPerfil", prepararAfastamentosPerfil_, { registros: [] });

    const mapaPat = {};
    (patologias.registros || []).forEach(r => { mapaPat[r.key] = r; });

    const mapaVac = {};
    (vacinas.registros || []).forEach(r => { mapaVac[r.key] = r; });

    const mapaAfast = {};
    (afastamentos.registros || []).forEach(r => {
      if (r.key) mapaAfast[r.key] = (mapaAfast[r.key] || 0) + 1;
    });

    const colaboradores = perfil.map(p => {
      const pat = mapaPat[p.key] || {};
      const vac = mapaVac[p.key] || {};
      return {
        key: p.key,
        mat: p.mat,
        nome: p.nome,
        status: p.status,
        setor: p.setor,
        funcao: p.funcao,
        sexo: p.sexo,
        idade: p.idade,
        cids: pat.cids || [],
        familiasCid: pat.familiasCid || [],
        atividadeFisica: pat.atividadeFisica || "Não informado",
        tabagismo: pat.tabagismo || "Não informado",
        etilismo: pat.etilismo || "Não informado",
        vacCompleta: !!vac.completoGeral,
        vacPendencias: vac.pendencias || [],
        vacinas: vac.vacinas || {},
        vacinaEventos: vac.vacinaEventos || [],
        afastamentos: mapaAfast[p.key] || 0
      };
    });

    const eventosAfastamentos = (afastamentos.registros || []).map(r => ({
      key: r.key,
      ano: r.ano,
      mes: r.mes,
      cid: r.cid,
      familiaCid: r.familiaCid
    }));

    return {
      updatedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm"),
      opcoes: opcoesComuns_(colaboradores),
      anos: anosPerfil_(colaboradores, eventosAfastamentos),
      colaboradores,
      eventos: {
        afastamentos: eventosAfastamentos
      },
      diagnosticoResumo: {
        colaboradoresPerfil: colaboradores.length,
        patologiasComCid: (patologias.registros || []).filter(r => (r.cids || []).length).length,
        eventosAfastamento: (afastamentos.registros || []).length,
        registrosVacinas: (vacinas.registros || []).length
      },
      observacoes: [
        "O Perfil carrega BD PERFIL com agregados leves de Vacinas, Patologias e Afastamentos. As tabelas completas ficam nos menus especificos."
      ]
    };
  });
}

function anosPerfil_(colaboradores, afastamentos) {
  const mapa = {};
  (afastamentos || []).forEach(e => { if (e.ano) mapa[e.ano] = true; });
  (colaboradores || []).forEach(r => {
    (r.vacinaEventos || []).forEach(e => { if (e.ano) mapa[e.ano] = true; });
  });
  return Object.keys(mapa).map(Number).filter(Boolean).sort();
}

function prepararAfastamentosPerfil_() {
  const base = lerBase("afastamentos");
  return {
    origem: { aba: CONFIG.sheets.afastamentos.name, headerRow: CONFIG.sheets.afastamentos.headerRow, linhasLidas: base.linhasLidas || 0 },
    registros: (base.registros || []).map(r => ({
      key: keyPessoa(r.mat, r.nome),
      ano: obterAno(r.dataInicio),
      mes: obterMes(r.dataInicio),
      cid: limparTexto(r.cid).toUpperCase(),
      familiaCid: familiaCid(r.cid)
    })).filter(r => r.key)
  };
}

function testarPerfilSaude() {
  const dados = carregarResumoPerfil();
  return { sucesso: true, colaboradores: dados.colaboradores.length, performance: dados.performance };
}

function executarModuloSeguro_(nome, fn, fallback) {
  try {
    return fn();
  } catch (e) {
    const ret = fallback || {};
    ret.erro = "Falha ao carregar " + nome + ": " + (e && e.message ? e.message : e);
    return ret;
  }
}
