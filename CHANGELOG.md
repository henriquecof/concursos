# Changelog

## [1.0.6] - 2026-06-11

### Adicionado
- Cronograma Inteligente: criação de cronograma/ciclo agora permite escolher quais matérias entram no plano automático. Por padrão todas vêm selecionadas; matérias desmarcadas não entram nas sugestões, prioridades, calendário, ciclo sugerido nem na estimativa, que passa a ser exibida como conclusão das matérias selecionadas quando o plano for parcial.
- Cronograma Inteligente: adicionado o botão **Editar Prioridades** em "Matérias por prioridade", permitindo forçar manualmente cada matéria como Prioridade Baixa, Média, Alta ou Máxima, ou voltar para o modo automático. Ao salvar, o cronograma é recalculado de hoje em diante com as novas prioridades.
- Cronograma Inteligente: no ajuste de ritmo, agora é possível limitar manualmente a quantidade máxima de tópicos sugeridos por dia de estudo, mesmo quando o usuário tem muitas horas disponíveis.
- Aba Matéria: adicionado o botão **Marcar Revisão** ao lado das ações do tópico/subtópico, permitindo agendar uma revisão manual por data exata ou atalhos de 5, 7, 15 e 30 dias sem precisar marcar o item como estudado.
- Aba Matéria: o histórico de lançamentos do ajuste manual agora permite editar sessões de estudo e lançamentos de questões já registrados, atualizando as estatísticas gerais sem precisar excluir ou zerar a matéria.
- Simulados: adicionados campo de tempo gasto na resolução e cálculo de ritmo em minutos por questão feita. No modo CESPE/CEBRASPE, questões deixadas em branco ficam fora do denominador do ritmo.

### Modificado
- Biblioteca de Editais Premium: cards com materiais de estudo linkados agora ganham destaque visual logo na listagem, incluindo selo e logos quando houver cadernos do Qconcursos, materiais do Estratégia, YouTube, Google Drive ou Tec Concursos.
- Aba Matéria: o botão **Acessar Materiais de Estudo** agora mostra ícones únicos dos tipos/provedores disponíveis no tópico ou subtópico, como Qconcursos, PDF, Google Drive, YouTube e Estratégia, sem repetir quando houver vários materiais do mesmo tipo.
- Aba Matéria: PDFs do Google Drive passam a exibir o logo do Drive; o ícone de PDF fica reservado para arquivos PDF locais ou links de PDF que não sejam do Drive.
- Aba Matéria: **Prompt Gemini Google Drive** foi renomeado para **Prompt Google Drive**. O conteúdo copiado agora fica limpo, começando apenas por `JSON DA MATERIA:` seguido da estrutura JSON da matéria.
- Aba Matéria: o botão **Exportar Template .JSON** foi removido do topo, mantendo o fluxo de IA concentrado em **Prompt Google Drive** e **Importar Links**.
- Dashboard: em **+ Adicionar Matéria > Clonar Matéria**, os cards dos concursos agora exibem também o nome do cargo, facilitando diferenciar concursos com nomes parecidos.
- Ciclo de Estudos: o modal **Editar ciclo** agora reorganiza os cards em tempo real durante o arraste, abrindo espaço visual para a matéria segurada antes de soltar.
- Sidebar: ícones principais do menu foram substituídos por Remix Icons profissionais, alternando automaticamente entre versão preenchida no modo escuro e contornada no modo claro.
- Dashboard e Métricas: os cards principais de estatísticas agora usam ícones profissionais para horas estudadas, questões resolvidas, taxa de acertos, último simulado e tópicos concluídos.
- Simulados: cards e painéis passaram a usar ícones profissionais para melhor nota, último simulado, média geral, nota de corte, evolução da nota e raio-x por matéria.
- Cronograma Inteligente: as telas de ritmo e estimativa passaram a mostrar um aviso de planejamento reforçando que as metas são apenas estimativas e que tópicos não finalizados serão empurrados automaticamente para os próximos dias de estudo.

### Corrigido
- Build Windows: a distribuição padrão foi migrada de PyInstaller para cx_Freeze para evitar falso positivo do Panda Dome (`Trj/GdSda.A`) que colocava o `TrackConcursos.exe` em quarentena. O release agora mantém PyInstaller apenas como fallback manual.
- Release Windows: adicionado smoke test obrigatório do executável antes de gerar o instalador; se o `.exe` não abrir, sumir ou for bloqueado durante o teste, a release é abortada.
- Aba Matéria/Revisões: badges de revisão agendada agora são clicáveis e levam para a aba **Revisões** com a revisão correspondente em destaque.
- Aba Matéria: o botão de sessão foi movido para junto do título **Questões** e renomeado para **Registrar questões e horas de estudo**.
- Aba Matéria: ao abrir um subtópico, a caixa de questões do tópico mãe fica temporariamente ocultada para reduzir poluição visual.
- Sidebar: reduzida a piscada visual durante a troca de abas. Os ícones Remix e os itens Cronograma/Flashcards agora já nascem no HTML inicial, e o card lateral do concurso fica oculto até estar hidratado com os dados reais.
- Aba Matéria: o menu de três pontinhos de tópicos/subtópicos foi simplificado, removendo a edição de materiais de estudo desse menu e mantendo o fluxo dedicado em **Acessar Materiais de Estudo**.
- Biblioteca de Editais Premium: filtro de bancas agora unifica variações de maiúsculas/minúsculas. Ex.: `Cesgranrio` e `CESGRANRIO` aparecem como uma única banca `CESGRANRIO`.
- Biblioteca de Editais Premium: detecção de materiais linkados ficou restrita aos links reais vinculados em `cadernos` ou a metadados explícitos, incluindo a linha `Materiais linkados:` no `.txt`, evitando falsos positivos por menções soltas em textos, prompts ou arquivos.
- Biblioteca de Editais Premium: cards com destaque de materiais linkados passaram a manter a mesma altura visual dos demais cards da grade.
- Biblioteca de Editais Premium: ao abrir a tela, o filtro de nível volta para **Todos** em vez de prender a listagem em **Não informado**.
- Biblioteca de Editais Premium: melhorada a detecção de escolaridade/nível a partir dos `.txt`, reconhecendo descrições como `Ensino Médio completo`.
- Cronograma Inteligente: no calendário, tópicos pendentes no dia atual agora exibem aviso informativo em vez de vermelho, com a mensagem "Se o tópico não for finalizado hoje, será empurrado para o próximo dia de estudo.".
- Cronograma inteligente agendado: corrigido o bug onde matérias finalizadas ou estudadas no dia de hoje sumiam da grade do dia em vez de exibir o status correto (verdinho riscado para concluído, laranjinha com "Estudo Iniciado" para em progresso).
- Calendário inteligente: ajustada a exibição e modal de detalhes para tratar o dia atual (hoje) de forma correta e sem oscilações visuais dinâmicas. Removido o risco (`line-through`) de tópicos não concluídos (`studied-past` e `unstudied-past`).
- Cronograma inteligente agendado: concluídos que foram sugeridos no dia deixam de aparecer como **Estudo Extra Concluído** no calendário. O rótulo de estudo extra agora fica reservado apenas para tópicos que não estavam agendados naquele dia e mesmo assim foram concluídos.
- Estudos de Hoje: o planejamento diário agora usa snapshot estável do dia, evitando que um tópico concluído desapareça e seja substituído automaticamente por outro que deveria entrar apenas no dia seguinte.
- Estudos de Hoje: tópicos extras concluídos hoje agora aparecem com destaque dourado, igual ao calendário, em vez de verde de tópico originalmente agendado.
- Estudos de Hoje: tópicos extras concluídos não substituem mais tópicos originalmente sugeridos para o dia.
- Estudos de Hoje: o número de tópicos sugeridos passa a respeitar a configuração de tempo disponível, minutos por tópico e limite manual de tópicos por dia.
- Cronograma inteligente agendado: melhorada a diversidade diária por matéria, reduzindo casos em que 3 ou 4 tópicos da mesma matéria ocupavam o mesmo dia apesar de existirem outras matérias elegíveis.
- Cronograma Inteligente: o botão de avançar/continuar do assistente de criação agora mantém toda a área clicável em telas pequenas.
- Cronograma Inteligente: a seção **Matérias por prioridade** não limita mais a listagem às 8 primeiras matérias; todas as matérias do plano aparecem no grid.
- Alertas de Foco: alertas personalizados definidos pelo usuário agora também aparecem na aba **Revisões**, não apenas os alertas críticos padrão do sistema.
- Alertas de Foco: o campo de meta aceita corretamente valores de 65 a 99, sem pular para outro número durante a digitação.

### Planejado
- Compartilhamento dos **Estudos de Hoje** com PDF e envio por WhatsApp/Telegram será retomado em uma versão futura, quando estiver pronto para lançamento.
- Raio-X da banca e cargo, extraído do Qconcursos ou Tec Concursos.
- Versão Web voltada principalmente para mobile.

## [1.0.5] - 2026-06-02

### Adicionado
- Biblioteca inteira de Editais Premium com instalação automática sincronizada com o catálogo online do site https://track-concursos.github.io/#/editais.
- Métricas opcionais de páginas lidas e minutos de videoaulas nas sessões de estudo.
- Cronograma Inteligente com configuração intuitiva. Opções de Cronograma Agendado ou Ciclo de Estudos. O cronograma sugere automaticamente tópicos para estudar e dá mais enfoque de estudo para matérias que tem muito peso no Painel da Prova.
- A interface agora possui um visual dinâmico em telas pequenas ou para tela redimensionada, reorganizando painéis evitando corte de textos e grids.
- Adicionado Alertas de Foco na aba revisões. Matérias e tópicos com desempenho crítico (desempenho em questões recentes abaixo de 65%) são mostrados para o usuário sugerindo uma revisão teórica do tópico até que o desempenho recente em questões melhore. Também é possível adicionar um Alerta de Foco personalizado.



### Modificado
- Aba Ajuda reformulada. Agora mostra guias sincronizados com o site https://track-concursos.github.io/#/guias
- `QUEST` virou `Caderno de Questões`; `VIDEO` virou `Videoaula`.
- Cadernos do Qconcursos e Tec Concursos, assim como videoaulas passaram a usar logos próprios.
- Links do Estratégia Concursos agora exibem o logo da coruja nos materiais vinculados.
- Logos dos materiais vinculados ficaram 150% maiores.
- Marcação de material estudado/assistido, edição de links e reordenação por arrastar. 
- Agora os materiais linkados ficam organizados dentro de um card para melhor visualização.
- Painel da Prova na Dashboard passou a exibir questões por bloco junto do peso/pontuação.
- Blocos CESPE/CEBRASPE no painel da Dashboard ficaram mais limpos, sem exibir `+1/-1` no cabeçalho.
- Quantidade de vagas agora aceita texto livre e o link do edital abre com `Ctrl + clique`.
- Ícone da Faixa Preta recebeu contorno para melhor contraste no modo escuro.
- Semanas seguidas de estudo viraram dias seguidos de estudo.
- Ao fechar o edital x1 agora ganha +1 nível de faixa automaticamente, recompensando o esforço.
- Estatísticas de fim de Ciclo de Estudos e histórico preparado para comparações futuras.
- A área onde ficavam os Cronogramas Semanais e Ciclo de Estudo clássicos agora é sincronizada com o Cronograma Inteligente. Ao optar pro Cronograma Agendado o painel mostrará os estudos do Dia de Hoje. Optando pelo Ciclo de Estudos o painel mostrará todo o ciclo, sugerindo um tópico de estudo para a matéria atual do ciclo.



### Corrigido
- Sidebar da Dashboard agora tem rolagem vertical em telas com pouca altura, mantendo menu, autoria e card do concurso acessiveis.
- Dashboard ganhou modo compacto inteligente para telas pequenas, realocando cronograma/ciclo/estudos do dia acima das matérias e organizando o Painel da Prova em coluna única.
- Métricas passam a empilhar os painéis principais em uma coluna em telas pequenas, dando mais espaço aos gráficos e listas.
- Janela do app deixa de voltar automaticamente para tela cheia ao navegar entre abas depois que o usuário redimensiona o programa.
- Atalho `Espaço` do cronômetro livre iniciado por tópico/subtópico agora pausa ou retoma o timer sem reiniciar a sessão.
- Confirmações do cronômetro para descartar tempo e fechar timer em andamento voltaram a ter opção de nunca mais mostrar o aviso.
- Delay no timer do cronômetro ao minimizar o app foi corrigido.
- Card lateral do concurso ganhou layout global fixo para manter logo, banca, cargo/salário e cobertura organizados em todas as abas, incluindo Ajuda.
- Flashcards, baralhos e histórico de revisão agora entram no backup do perfil e preservam dados legados da 1.0.4 durante a migração.
- Atualização 1.0.5 cria um backup pre-update do storage local antes da limpeza/migração, permitindo recuperar flashcards e dados antigos em casos extremos.
- Atualização da biblioteca premium agora força nova leitura dos detalhes `.txt`.

### Planejado
- Raio-X da banca e cargo, extraído do Qconcursos ou Tec Concursos
- Versão Web voltada principalmente para mobile.
