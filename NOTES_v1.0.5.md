# Changelog

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
