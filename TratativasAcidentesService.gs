function salvarTratativaAcidente(payload) {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(20000)) return { sucesso: false, erro: "Não foi possível obter bloqueio de gravação. Tente novamente." };
  try {
    const entrada = payload || {};
    if (!entrada.rowNumber && !entrada.key) return { sucesso: false, erro: "Informe a linha ou chave da tratativa." };
    const cfg = CONFIG.sheets.examesAcidentes;
    const sheet = getSpreadsheet().getSheetByName(cfg.name);
    if (!sheet) return { sucesso: false, erro: "Aba EXAMES ACIDENTES não encontrada." };

    const headers = sheet.getRange(cfg.headerRow, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].map(h => limparTexto(h));
    const headerMap = montarMapaCabecalho(headers);
    const camposPermitidos = {
      pepRealizada: "PEP REALIZADA?",
      status: "STATUS",
      observacoes: "OBS",
      responsavel: "RESPONSÁVEL PELA TRATATIVA",
      atualizadoEm: "DATA DA ÚLTIMA ATUALIZAÇÃO"
    };
    const faltantes = Object.keys(camposPermitidos).map(k => camposPermitidos[k]).filter(nome => headerMap[normalizarTexto(nome)] === undefined);
    if (faltantes.length) {
      return { sucesso: false, erro: "Colunas de tratativa ausentes.", colunasAusentes: faltantes, colunasSugeridas: CONFIG.treatmentWriteColumns };
    }

    const row = localizarLinhaTratativa_(sheet, cfg, entrada);
    if (!row) return { sucesso: false, erro: "Tratativa não localizada para gravação." };

    const updates = {
      pepRealizada: limparTexto(entrada.pepRealizada),
      status: limparTexto(entrada.status),
      observacoes: limparTexto(entrada.observacoes),
      responsavel: Session.getActiveUser().getEmail() || "Usuário não identificado",
      atualizadoEm: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss")
    };
    Object.keys(updates).forEach(k => {
      const col = headerMap[normalizarTexto(camposPermitidos[k])] + 1;
      sheet.getRange(row, col).setValue(updates[k]);
    });
    return { sucesso: true, rowNumber: row, dados: updates };
  } catch (e) {
    return { sucesso: false, erro: e.message || String(e) };
  } finally {
    lock.releaseLock();
  }
}

function localizarLinhaTratativa_(sheet, cfg, entrada) {
  if (entrada.rowNumber && Number(entrada.rowNumber) > cfg.headerRow) return Number(entrada.rowNumber);
  const base = lerBase("examesAcidentes");
  const alvoKey = normalizarTexto(entrada.key);
  const alvoData = normalizarTexto(entrada.dataAcidente);
  const achado = base.registros.find(r => normalizarTexto(r.key) === alvoKey && (!alvoData || normalizarTexto(formatarData(r["DATA DO ACIDENTE"])) === alvoData));
  return achado ? achado._rowNumber : 0;
}
