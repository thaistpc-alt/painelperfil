function carregarResumoPerfil() {
  return medirPerformance("carregarResumoPerfil", () => {
    const perfil = carregarRegistrosPerfil_();
    const patologias = prepararPatologias_();
    const afastamentos = prepararAfastamentos_();
    const vacinas = prepararVacinas_();
    const acidentes = prepararAcidentes_();

    const mapaPat = {};
    patologias.registros.forEach(r => { mapaPat[r.key] = r; });
    const mapaVac = {};
    vacinas.registros.forEach(r => { mapaVac[r.key] = r; });
    const mapaAfast = {};
    afastamentos.registros.forEach(r => { mapaAfast[r.key] = (mapaAfast[r.key] || 0) + 1; });
    const mapaAcid = {};
    acidentes.registros.forEach(r => { mapaAcid[r.key] = (mapaAcid[r.key] || 0) + 1; });

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
        patologiasComCid: patologias.registros.filter(r => r.cids.length).length,
        eventosAfastamento: afastamentos.registros.length,
        registrosVacinas: vacinas.registros.length,
        eventosAcidentes: acidentes.registros.length
      }
    };
  });
}

function testarPerfilSaude() {
  const dados = carregarResumoPerfil();
  return { sucesso: true, colaboradores: dados.colaboradores.length, performance: dados.performance };
}
