(function () {
  if (!window.CT) return;

  function modeloTemplateEditalIA() {
    return {
      type: 'track_concursos_template_export',
      version: '2.0',
      templateKind: 'contest',
      rights: {
        copyright: 'Copyright (c) 2026 Michel Araujo. Todos os direitos reservados.',
        licenseType: 'uso-pessoal-nao-comercial',
        allowPersonalUse: true,
        allowCommercialUse: false,
        allowModification: false,
        allowRedistribution: false,
        notice: 'Arquivo gerado para importacao no Track Concursos.'
      },
      exportOptions: {
        includeLinks: false
      },
      concurso: {
        nome: 'Nome do Concurso',
        cargo: 'Cargo',
        banca: 'Banca',
        logoEmoji: null,
        logoBase64: null,
        dataProva: 'YYYY-MM-DD',
        preEdital: false,
        pontuacaoMax: null,
        vagas: null
      },
      materias: [
        {
          id: 'mat_001',
          nome: 'NOME DA MATERIA',
          ordem: 0,
          cadernos: [],
          topicos: [
            {
              id: 'top_001',
              nome: 'Nome do topico principal',
              ordem: 0,
              cadernos: [],
              subtopicos: [
                {
                  id: 'sub_001',
                  materiaId: 'mat_001',
                  nome: 'Nome do subtopico',
                  ordem: 0,
                  cadernos: []
                }
              ]
            }
          ]
        }
      ],
      simulados: [],
      estrutura: {
        cronoWeekly: null,
        cronoMats: null,
        cronoMode: null,
        ciclo: null,
        configProva: {
          groups: [
            {
              id: 'g_conhecimentos_gerais',
              name: 'Conhecimentos Gerais',
              items: [
                {
                  id: 'mat_001',
                  q: 10,
                  w: 1
                }
              ],
              q: 0,
              w: 1
            },
            {
              id: 'g_redacao',
              name: 'Redacao',
              type: 'redacao',
              items: [],
              q: 0,
              w: 1,
              pts: 100,
              redType: 'Dissertativa-Argumentativa',
              isClassificatoriaOnly: false,
              minPts: null
            }
          ]
        }
      }
    };
  }

  function gerarPromptTemplateEditalIA() {
    const modelo = modeloTemplateEditalIA();
    return [
      'Voce e um agente que transforma edital de concurso em um JSON importavel no Track Concursos.',
      'Sua resposta deve ser somente JSON valido. Nao use Markdown, comentarios, explicacoes, texto antes ou texto depois.',
      'Objetivo: preencher o modelo track_concursos_template_export com os dados do edital informado pelo usuario, incluindo concurso, data da prova, status pre/pos-edital, materias, topicos, subtopicos e painel da prova.',
      'Regras obrigatorias:',
      '1. Preserve exatamente os campos de topo: type, version, templateKind, rights, exportOptions, concurso, materias, simulados e estrutura.',
      '2. Use type="track_concursos_template_export", version="2.0" e templateKind="contest".',
      '3. Em concurso.dataProva use o formato YYYY-MM-DD. Se nao houver data clara, use null.',
      '4. Em concurso.preEdital use true quando for pre-edital ou quando nao houver edital publicado/data confiavel; use false quando for pos-edital.',
      '5. Se banca, cargo, vagas ou pontuacao maxima nao estiverem claros no texto, deixe string vazia ou null. Nao invente.',
      '6. Use IDs simples e consistentes: mat_001, mat_002; top_001, top_002; sub_001, sub_002. O campo subtopicos[].materiaId deve repetir o ID da materia pai.',
      '7. Preencha ordem em base zero conforme a sequencia do edital.',
      '8. Mantenha cadernos sempre como array vazio [] quando nao houver links de materiais.',
      '9. Separe materias exatamente como aparecem no edital, mas normalize caixa alta em materias quando fizer sentido.',
      '10. Em topicos, preserve 100% do conteudo do edital. Nao resuma, nao omita e nao agrupe itens para encurtar.',
      '11. Use subtopicos com moderacao: se o topico for uma unidade unica, use subtopicos: []. Nunca crie subtopico unico repetindo o topico.',
      '12. Nao divida automaticamente por virgula ou "e". Crie subtopicos apenas para assuntos claramente independentes para estudo separado.',
      '13. Divida por ponto e virgula quando houver lista de normas, leis, decretos, resolucoes, portarias, artigos ou atos numerados, criando um subtopico para cada item sem deixar nenhum de fora.',
      '14. Em listas de normas, prefixe cada item com o tipo do ato quando o contexto estiver no topico. Exemplo: "Resolucoes do CONTRAN: 04/1998" vira "Resolucao CONTRAN 04/1998".',
      '15. Nao separe expressoes integradas como "Compreensao e interpretacao de textos", "Reescrita de frases e paragrafos" ou "Gestao e avaliacao do desempenho".',
      '16. Nao crie assuntos que nao estejam no edital. Pode apenas reorganizar e verticalizar.',
      '17. simulados deve ser [] salvo se o edital trouxer simulados reais, o que normalmente nao acontece.',
      '18. estrutura.cronoWeekly, cronoMats, cronoMode e ciclo devem ficar null.',
      '19. estrutura.configProva deve ser um objeto com groups. Cada item de prova deve apontar para uma materia pelo mesmo ID usado em materias[].id.',
      '20. Para prova objetiva, use groups com name como "Conhecimentos Gerais", "Conhecimentos Especificos", "Basicos", "Especificos" ou o nome real do bloco no edital. Em cada item, use q para quantidade de questoes e w para peso por questao. Se o peso nao existir, use 1.',
      '21. Para redacao/discursiva, crie um group com type="redacao", items=[], pts com a pontuacao maxima, redType com o tipo se informado, isClassificatoriaOnly conforme o edital e minPts com a nota minima se existir.',
      '22. Se o edital nao informar a distribuicao da prova, use configProva: { "groups": [] }.',
      '23. O JSON final precisa ser importavel pelo Track Concursos sem ajustes manuais.',
      'Modelo obrigatorio a preencher:',
      JSON.stringify(modelo, null, 2),
      'Agora leia as informacoes do edital abaixo e retorne apenas o JSON final preenchido:',
      '[COLE AQUI O TEXTO DO EDITAL OU O JSON EXTRAIDO DO PDF]'
    ].join('\n\n');
  }

  function pacotePromptTemplateEditalIA() {
    return {
      type: 'track_concursos_ai_template_prompt',
      version: '1.0',
      generatedAt: new Date().toISOString(),
      outputExpected: 'track_concursos_template_export',
      prompt: gerarPromptTemplateEditalIA(),
      modelo: modeloTemplateEditalIA(),
      notas: [
        'O Track Concursos aceita estrutura.configProva como objeto neste pacote; ao exportar novamente, o app pode salvar esse campo como string JSON.',
        'Os IDs mat_001, top_001 e sub_001 sao IDs de trabalho. Na importacao, o Track gera IDs internos novos e remapeia o painel da prova pelas materias.',
        'Para IA local simples, envie primeiro o prompt e depois o texto do edital em blocos se o contexto for pequeno.'
      ]
    };
  }

  async function exportarPacotePromptTemplateEditalIA() {
    const pacote = pacotePromptTemplateEditalIA();
    const jsonStr = JSON.stringify(pacote, null, 2);
    if (window.pywebview && window.pywebview.api) {
      return window.pywebview.api.salvar_json_concurso('prompt_template_edital_ia', jsonStr);
    }

    const a = document.createElement('a');
    a.setAttribute('href', 'data:application/json;charset=utf-8,' + encodeURIComponent(jsonStr));
    a.setAttribute('download', 'prompt_template_edital_ia.json');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return { ok: true };
  }

  window.CT.modeloTemplateEditalIA = modeloTemplateEditalIA;
  window.CT.gerarPromptTemplateEditalIA = gerarPromptTemplateEditalIA;
  window.CT.pacotePromptTemplateEditalIA = pacotePromptTemplateEditalIA;
  window.CT.exportarPacotePromptTemplateEditalIA = exportarPacotePromptTemplateEditalIA;
})();
