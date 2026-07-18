var CONFIG = {
  spreadsheetId: "1ap49yRtC1HfT89yYFMmHPXZlvUyLGqeEGx9LuwoD-rY",
  cachePrefix: "PAINEL_PERFIL_SAUDE_V80_",
  cacheTime: 300,
  pageSize: 50,
  sheets: {
    perfil: { name: "BD PERFIL", headerRow: 1, keyAliases: ["MAT", "NOME"] },
    patologias: { name: "BD PATOLOGIAS", headerRow: 1, keyAliases: ["COL_1", "NOME"], fieldFallbacks: { mat: "COL_1" } },
    vacinas: { name: "BD VACINAS", headerRow: 1, keyAliases: ["MAT", "NOME"] },
    afastamentos: { name: "BD AFASTAMENTOS", headerRow: 3, keyAliases: ["CHAPA", "NOME"] },
    exames: { name: "BD EXAMES COMPLEMENTARES", headerRow: 1, keyAliases: ["MAT", "NOME"] },
    acidentes: { name: "BD ACIDENTES", headerRow: 1, keyAliases: ["CÓD.", "MAT", "NOME"] },
    examesAcidentes: { name: "EXAMES ACIDENTES", headerRow: 2, keyAliases: ["MAT", "COLABORADOR ", "DATA DO ACIDENTE"] }
  },
  views: {
    perfil: "Perfil",
    patologias: "Patologias",
    afastamentos: "Afastamentos",
    vacinas: "Vacinas",
    exames: "Exames",
    seguimento: "SeguimentoExames",
    acidentes: "AcidentesBiologicos"
  },
  includes: {
    Style: true,
    JavaScript: true,
    Components: true
  },
  aliases: {
    mat: ["MAT", "MATRICULA", "MATRÍCULA", "CHAPA"],
    nome: ["NOME", "COLABORADOR", "COLABORADOR "],
    status: ["STATUS", "SITUAÇÃO", "SITUACAO", "SITUAÇÃO DO COLABORADOR"],
    funcao: ["FUNÇÃO", "FUNCAO", "CARGO"],
    setor: ["SETOR", "SETOR DO COLABORADOR"],
    sexo: ["SEXO"],
    idade: ["IDADE"],
    nascimento: ["DATA DE NASCIMENTO"],
    dataInicio: ["DTINICIO", "DATA INICIO", "DATA INÍCIO"],
    dataFim: ["DTFINAL", "DATA FIM", "DATA FINAL"],
    dias: ["QTD", "DIAS", "DIAS PERDIDOS"],
    cid: ["CID"],
    descricaoCid: ["DESCRICAO_CID", "DESCRIÇÃO CID", "DESCRICAO CID"],
    situacaoVacinal: ["SITUAÇÃO VACINAL"],
    esquemaDt: ["Esquema de dT"],
    hepB: ["SITUAÇÃO VACINAL - HEPATITE B"],
    covid: ["SITUAÇÃO VACINAL - COVID"],
    influenza: ["SITUAÇÃO VACINAL - INFLUENZA"],
    sarampo: ["SITUAÇÃO VACINAL - SARAMPO"],
    acidenteCodigo: ["CÓD.", "COD", "CÓDIGO"],
    acidenteData: ["DATA", "DATA DO ACIDENTE"],
    acidenteTipo: ["TIPO DE ACIDENTE"],
    acidenteParteCorpo: ["PARTE DO CORPO ATINGIDO"],
    acidenteAgente: ["AGENTE CAUSADOR"],
    acidenteProcedimento: ["PROCEDIMENTO (BIOLÓGICO)"],
    acidentePacienteFonte: ["PACIENTE", "PACIENTE-FONTE", "PACIENTE FONTE"],
    acidenteConclusao: ["CONCLUSÃO"],
    tratamentoPepRealizada: ["PEP REALIZADA?"],
    tratamentoStatus: ["STATUS"],
    tratamentoObs: ["OBS"]
  },
  cidFamilies: {
    A: "Infecciosas e parasitárias", B: "Infecciosas e parasitárias",
    C: "Neoplasias", D: "Sangue/imunidade/neoplasias",
    E: "Endócrinas, nutricionais e metabólicas",
    F: "Transtornos mentais e comportamentais",
    G: "Sistema nervoso", H: "Olhos, ouvidos e anexos",
    I: "Aparelho circulatório", J: "Aparelho respiratório",
    K: "Aparelho digestivo", L: "Pele e tecido subcutâneo",
    M: "Osteomusculares e tecido conjuntivo", N: "Aparelho geniturinário",
    O: "Gravidez, parto e puerpério", P: "Afecções perinatais",
    Q: "Malformações congênitas", R: "Sintomas e achados anormais",
    S: "Lesões e envenenamentos", T: "Lesões e envenenamentos",
    U: "Códigos especiais", V: "Causas externas", W: "Causas externas",
    X: "Causas externas", Y: "Causas externas", Z: "Fatores de saúde"
  },
  vaccines: [
    { id: "dt", label: "dT", statusAliases: ["Esquema de dT"], doseAliases: ["dT (1º DOSE)", "dT (2º DOSE)", "dT (3º DOSE)", "REFORÇO dT"] },
    { id: "hepB", label: "Hepatite B", statusAliases: ["SITUAÇÃO VACINAL - HEPATITE B"], doseAliases: ["HEP. B (1º DOSE)", "HEP. B (2º DOSE)", "HEP. B (3º DOSE)", "NOVO ESQ HEP B 1 DOSE", "NOVO ESQ HEP B 2 DOSE"] },
    { id: "covid", label: "COVID", statusAliases: ["SITUAÇÃO VACINAL - COVID"], doseAliases: ["ULTIMA DOSE"] }
  ],
  exams: [
    "ACUIDADE VISUAL", "AUDIOMETRIA", "ECG", "EEG", "ESPIROMETRIA", "HEMOGRAMA",
    "GLICEMIA", "RAIO X", "AVALIAÇÃO PSICOSSOCIAL"
  ],
  statusRules: {
    normalKeywords: ["ATIVO", "REABILITADO", "GESTANTE", "LICENCA MATERNIDADE", "LICENÇA MATERNIDADE"],
    exceptionalKeywords: ["DESLIG", "OBITO", "ÓBITO", "FALECID", "TRANSFER", "SUSPENS", "APOSENT", "AFASTADO", "INSS"]
  },
  treatmentWriteColumns: [
    { name: "PEP REALIZADA?", purpose: "Registrar se a PEP foi iniciada/realizada", defaultValue: "", suggestedAfter: "DATA DO ACIDENTE" },
    { name: "STATUS", purpose: "Situação atual do seguimento", defaultValue: "PENDENTE", suggestedAfter: "STATUS DAS SOROLOGIAS" },
    { name: "OBS", purpose: "Observações da tratativa", defaultValue: "", suggestedAfter: "STATUS" },
    { name: "TIPO DE SEGUIMENTO", purpose: "Classificar a tratativa como seguimento de acidente de trabalho ou investigação de dose de radiação", defaultValue: "Seguimento de acidente de trabalho", suggestedAfter: "OBS" },
    { name: "RESPONSÁVEL PELA TRATATIVA", purpose: "Usuário que atualizou a tratativa", defaultValue: "", suggestedAfter: "OBS" },
    { name: "DATA DA ÚLTIMA ATUALIZAÇÃO", purpose: "Data e hora da última gravação no painel", defaultValue: "", suggestedAfter: "RESPONSÁVEL PELA TRATATIVA" }
  ]
};
