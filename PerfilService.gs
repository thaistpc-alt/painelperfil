function carregarResumoPerfil() {
  return medirPerformance("carregarResumoPerfil", () => {
    const perfil = carregarRegistrosPerfil_();
    const vacinas = executarModuloSeguro_("vacinas", prepararVacinas_, { registros: [] });

    const mapaPat = {};
    const patologias = { registros: [] };
    const mapaVac = {};
    vacinas.registros.forEach(r => { mapaVac[r.key] = r; });
    const mapaAfast = {};
    const afastamentos = { registros: [] };
    const mapaAcid = {};
    const acidentes = { registros: [] };

    const colaboradores = perfil.map(p => {
      const pat = mapaPat[p.key] || {};
      const vac = mapaVac[p.key] || {};
      return {
        key: p.key, mat: p.mat, nome: p.nome, status: p.status, setor: p.setor, funcao: p.funcao,
        sexo: p.sexo, idade: p.idade,
        cids: pat.cids || [],
        familiasCid: pat.familiasCid || [],
        atividadeFisica: pat.atividadeFisica || "Não informado",
        tabagismo: pat.tabagismo || "Não informado",
        vacCompleta: !!vac.completoGeral,
        vacPendencias: vac.pendencias || [],
        afastamentos: mapaAfast[p.key] || 0,
        acidentes: mapaAcid[p.key] || 0
      };
    });

    return {
      updatedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm"),
      opcoes: opcoesComuns_(colaboradores),
      colaboradores,
      eventos: {
        afastamentos: afastamentos.registros.map(r => ({ key: r.key, ano: r.ano, mes: r.mes, cid: r.cid, familiaCid: r.familiaCid })),
        acidentes: acidentes.registros.map(r => ({ key: r.key, ano: r.ano, mes: r.mes, tipo: r.tipo }))
      },
      diagnosticoResumo: {
        colaboradoresPerfil: colaboradores.length,
        patologiasComCid: null,
        eventosAfastamento: null,
        registrosVacinas: vacinas.registros.length,
        eventosAcidentes: null
      },
      observacoes: [
        "A abertura carrega Perfil e Vacinas. Patologias, Afastamentos e Acidentes são carregados sob demanda nas respectivas abas para evitar timeout."
      ]
    };
  });
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
