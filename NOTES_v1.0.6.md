# Changelog

## [1.0.6] 

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
- Sidebar: ícones principais do menu foram substituídos por Remix Icons profissionais, alternando automaticamente entre versão preenchida no modo escuro e contornada no modo claro.
- Dashboard e Métricas: os cards principais de estatísticas agora usam ícones profissionais para horas estudadas, questões resolvidas, taxa de acertos, último simulado e tópicos concluídos.
- Simulados: cards e painéis passaram a usar ícones profissionais para melhor nota, último simulado, média geral, nota de corte, evolução da nota e raio-x por matéria.
- Cronograma Inteligente: as telas de ritmo e estimativa passaram a mostrar um aviso de planejamento reforçando que as metas são apenas estimativas e que tópicos não finalizados serão empurrados automaticamente para os próximos dias de estudo.

### Corrigido
- Aba Matéria/Revisões: badges de revisão agendada agora são clicáveis e levam para a aba **Revisões** com a revisão correspondente em destaque.
- Aba Matéria: o botão de sessão foi movido para junto do título **Questões** e renomeado para **Registrar questões e horas de estudo**.
- Aba Matéria: ao abrir um subtópico, a caixa de questões do tópico mãe fica temporariamente ocultada para reduzir poluição visual.
- Sidebar: reduzida a piscada visual durante a troca de abas. Os ícones Remix e os itens Cronograma/Flashcards agora já nascem no HTML inicial, e o card lateral do concurso fica oculto até estar hidratado com os dados reais.
- Aba Matéria: o menu de três pontinhos de tópicos/subtópicos foi simplificado, removendo a edição de materiais de estudo desse menu e mantendo o fluxo dedicado em **Acessar Materiais de Estudo**.
- Biblioteca de Editais Premium: filtro de bancas agora unifica variações de maiúsculas/minúsculas. Ex.: `Cesgranrio` e `CESGRANRIO` aparecem como uma única banca `CESGRANRIO`.
- Biblioteca de Editais Premium: detecção de materiais linkados ficou restrita aos links reais vinculados em `cadernos` ou a metadados explícitos, incluindo a linha `Materiais linkados:` no `.txt`, evitando falsos positivos por menções soltas em textos, prompts ou arquivos.
- Biblioteca de Editais Premium: cards com destaque de materiais linkados passaram a manter a mesma altura visual dos demais cards da grade.
- Biblioteca de Editais Premium: ao abrir a tela, o filtro de nível volta para **Todos** em vez de prender a listagem em **Não informado**.
- Cronograma Inteligente: no calendário, tópicos pendentes no dia atual agora exibem aviso informativo em vez de vermelho, com a mensagem "Se o tópico não for finalizado hoje, será empurrado para o próximo dia de estudo.".
- Cronograma inteligente agendado: corrigido o bug onde matérias finalizadas ou estudadas no dia de hoje sumiam da grade do dia em vez de exibir o status correto.
- Calendário inteligente: ajustada a exibição e modal de detalhes para tratar o dia atual corretamente e sem oscilações visuais dinâmicas.
- Cronograma inteligente agendado: tópicos concluídos que foram sugeridos no dia deixam de aparecer como **Estudo Extra Concluído** no calendário. O rótulo de estudo extra agora fica reservado apenas para tópicos que não estavam agendados naquele dia e mesmo assim foram concluídos.
- Estudos de Hoje: o planejamento diário agora usa snapshot estável do dia, evitando que um tópico concluído desapareça e seja substituído automaticamente por outro que deveria entrar apenas no dia seguinte.
- Estudos de Hoje: tópicos extras concluídos hoje aparecem com destaque dourado, igual ao calendário, em vez de verde de tópico originalmente agendado.
- Estudos de Hoje: tópicos extras concluídos não substituem mais tópicos originalmente sugeridos para o dia.
- Estudos de Hoje: o número de tópicos sugeridos passa a respeitar a configuração de tempo disponível, minutos por tópico e limite manual de tópicos por dia.
- Cronograma inteligente agendado: melhorada a diversidade diária por matéria, reduzindo casos em que várias sugestões da mesma matéria ocupavam o mesmo dia apesar de existirem outras matérias elegíveis.
- Cronograma Inteligente: o botão de avançar/continuar do assistente de criação agora mantém toda a área clicável em telas pequenas.
- Cronograma Inteligente: a seção **Matérias por prioridade** não limita mais a listagem às 8 primeiras matérias; todas as matérias do plano aparecem no grid.
- Alertas de Foco: alertas personalizados definidos pelo usuário agora também aparecem na aba **Revisões**, não apenas os alertas críticos padrão do sistema.
- Alertas de Foco: o campo de meta aceita corretamente valores de 65 a 99, sem pular para outro número durante a digitação.

### Planejado 🔮
- Compartilhamento dos **Estudos de Hoje** com PDF e envio por WhatsApp/Telegram será retomado em uma versão futura, quando estiver pronto para lançamento.
- Raio-X da banca e cargo, extraído do Qconcursos ou Tec Concursos.
- Versão Web voltada principalmente para mobile.
- Sincronização de flashcards com o Anki
- Cadernos de Anotações por tópico/subtópico permitindo o usuário registrar anotações, mapas mentais e infográficos sobre o assunto

Envie sugestões e reportes de bugs 🐛 Bons estudos!
