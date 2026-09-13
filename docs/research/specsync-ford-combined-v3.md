# SpecSync para Ford — integração do filme v3

Registro final de 13 de setembro de 2026. **Versão 3 concluída, renderizada
e verificada**, com oito falas geradas e alinhadas e revisão visual concluída.

## Decisão editorial

A v3 reúne a demonstração de produto do Studio em 3100 e as cenas de visão
futura e encerramento do projeto em 3300. Uma nova abertura comercial apresenta
a vantagem de decidir com conhecimento conectado. A narrativa deixa de usar
“desafio Ford”, pesquisa de uma hora ou linguagem de trabalho acadêmico.

A sequência acompanha uma ação reconhecível: fazer uma pergunta, pesquisar,
revisar evidências, consultar especificações, comparar versões e entender o
conhecimento que sustenta as análises. Só então apresenta a evolução proposta:
produto e mercado na mesma decisão, com materiais para a reunião executiva.

O roteiro é `apps/pitch/src/data/storyboard.json`. Após gerar a voz em sua
velocidade natural, a montagem tem **153,9 segundos — 4.617 frames**, dentro
do objetivo de aproximadamente dois a três minutos. O planejamento mínimo
era de 152 segundos; os inícios e durações foram ajustados ao áudio medido.
Tempos da produção de origem não são os tempos finais da v3.

## Composição e origem

A entrada principal permanece `SpecSyncFord`, em
<http://localhost:3300/SpecSyncFord>, no projeto Nx `pitch`.
A produção de origem está em
`.claude/worktrees/specsync-ford-pitch-video-ee14cc/apps/pitch-video`,
associada ao Studio em 3100. O transplante é feito para este projeto; o
worktree de origem permanece inalterado e não é dependência do render.

| Ordem v3 | Componente                              | Papel na venda                                                    |
| -------- | --------------------------------------- | ----------------------------------------------------------------- |
| 1        | `src/scenes/Hook.tsx`                   | Abrir com a próxima vantagem competitiva e a qualidade da decisão |
| 2        | `src/demo/scenes/03-AskSpecSync.tsx`    | Mostrar o início simples do trabalho                              |
| 3        | `src/demo/scenes/04-Research.tsx`       | Tornar pesquisa, fonte e revisão compreensíveis                   |
| 4        | `src/demo/scenes/05-StandardOutput.tsx` | Mostrar o resultado organizado, inclusive as lacunas              |
| 5        | `src/demo/scenes/06-Compare.tsx`        | Demonstrar comparação e evidência por valor                       |
| 6        | `src/demo/scenes/07-Ontology.tsx`       | Explicar relações e significado compartilhado                     |
| 7        | `src/scenes/Future.tsx`                 | Apresentar a visão de mercado e geração de materiais              |
| 8        | `src/scenes/Close.tsx`                  | Convidar a colocar a inteligência a serviço da Ford               |

Os caminhos da tabela são relativos a `apps/pitch`. Auxiliares ficam em
`src/demo/ui/`, `src/demo/scenes/SceneShell.tsx`, `src/demo/theme.ts`,
`src/demo/fonts.ts`, `src/demo/data.ts` e `src/demo/timing.tsx`. A adaptação de
tempo deve acompanhar a duração de destino, inclusive nas interações e efeitos.

Assets transplantados, sob `apps/pitch/public/demo3100/`:

- `brand/ford-script-action-blue.svg`;
- `vehicles/ranger-raptor-hero.jpg`;
- `sfx/mouse-click.wav`, `sfx/switch.wav`, `sfx/whoosh.wav`;
- `data/comparison-raptor-amarok-shark.json`.

## Ajustes factuais da adaptação

As telas são reencenações editoriais de fluxos e dados existentes, ampliadas
para o filme. Não são uma gravação contínua, uma prova de latência ou uma nova
interface já entregue. A demonstração conserva as limitações relevantes:

- Pesquisa: uma configuração, quatro achados mapeados e três aguardando
  mapeamento. A revisão mostra transmissão, com duas seleções e zero publicações.
  A identidade da versão permanece pendente de confirmação nesse fluxo.
- A referência incorreta à S10 foi substituída pela Amarok V6 Extreme do
  snapshot. A comparação inclui Raptor e Amarok 2026 e Shark GS 2025, com fontes
  por configuração, campos ausentes e ressalvas de aplicabilidade.
- O conflito de torque sem evidência foi removido. O painel “Evidências da
  comparação” conserva os movimentos do original e passa a ler trechos e URLs
  reais do snapshot: motor Ford, diesel Volkswagen e gasolina/eletricidade BYD.
  Não usa citações inventadas de imprensa nem antecipa uma funcionalidade futura.
- A ontologia é identificada como visualização explicativa. Não há afirmação
  de que toda resposta use o grafo, de alinhamento integral já validado com os
  termos Ford ou de conversão de unidades que a demonstração não comprove.
- A narração fala em informação **validada** ampliando o conhecimento e usa
  motorização e transmissão como exemplos; não promete publicação automática
  nem superioridade comercial comprovada.

`Future.tsx` conserva os rótulos de conceito futuro e dados ilustrativos.
Emplacamentos, participação de mercado, comparação de preços de venda e
exportação de apresentações, documentos e artigos são propostas de evolução.
O encadeamento visual é mercado → posicionamento/novo veículo → materiais.
As transições acompanham a montagem final com a locução gerada.

## Direção de voz e som

O usuário selecionou a prévia **ElevenLabs 01**, `SpecSync Presenca 01`.
A configuração vigente está em `src/data/eleven-voice.json`, com `eleven_v3`.
A voz é sintética, desenhada para a produção, com direção de presença e
convicção em português brasileiro. Não é uma clonagem do locutor da Ford.

A [referência oficial da F-150 Raptor](https://www.youtube.com/watch?v=u_FeNdhzCoM)
fornecida pelo usuário tem o título “Mudar o nível da competição era só o
começo. Vem ai F-150 Raptor.” e foi publicada pelo Ford Brasil em 28 de agosto
de 2026. Essa identificação não permite atribuir seu locutor ou vinculá-la à
campanha de 2024. O pitch usa locução e trilha próprias, sem incorporar seu áudio.

`scripts/generate-eleven-narration.py` gerou os oito trechos selecionados. Sua
interface foi conferida no script e em `--help`: `--storyboard`, `--voice-config`,
`--output-dir` e `--manifest` definem as entradas e saídas principais.
O [README](../../apps/pitch/README.md#locução-e-sincronização) contém o comando
completo. `--dry-run` valida sem escrita ou chamada à API; `--offline` permite
montar a partir das respostas já armazenadas. O script usa chave do ambiente
ou prompt oculto no terminal, sem colocá-la nos assets.

Os WAV normalizados individualmente para aproximadamente −16 LUFS ficam em
`public/audio/eleven-v1/`. `src/data/voice.json`, storyboard e SRT canônicos
foram atualizados, preservando velocidade natural (`rate: 0`) e snapshots
anteriores. Os áudios antigos e os textos de audição permanecem históricos.

Trilha instrumental procedural e efeitos pontuais são locais.
`public/audio/score-v3.wav` acompanha os tempos do storyboard final;
encerramento e legendas também usam a duração atual. A trilha histórica
`score.wav` permanece preservada. A renderização usa arquivos locais e não
chama serviços de voz ou o backend do produto.

## Entrega e validação

- [Versão identificada](../../apps/pitch/out/specsync-ford-pitch-v3.mp4).
- [Cópia canônica](../../apps/pitch/out/specsync-ford-pitch.mp4).
- Preservadas: exportações v1 e v2; a v3 não sobrescreve a v2.
- [Verificação da entrega](../../apps/pitch/out/verification.json).
- [Medição do áudio final](../../apps/pitch/out/audio-levels-v3.json).
- [Revisão lexical da narração](../../apps/pitch/out/narration-v3-qa/README.md).
- [Stills da composição](../../apps/pitch/out/stills/) e
  [stills da demonstração isolada](../../apps/pitch/out/review-demo-v3/).

Lint, typecheck e build passaram após as correções visuais, assim como
`pitch:render` e `pitch:verify`. O MP4 foi verificado em 1080p/30 fps, H.264,
AAC estéreo, **153,9 segundos e 4.617 frames**, com oito cenas, 39 legendas,
voz 01 em velocidade natural e decodificação integral aprovada. A medição da
mixagem final foi **−16,22 LUFS e −1,70 dBTP**.

As cópias canônica e v3 têm 28.090.806 bytes e SHA-256 idêntico:
`f98a09b4e6ff5251cdad64d840298ecb81690c0596a5e42e26add6d025b6b3b0`.
A v2 preservada tem SHA-256
`d0c11034ea8104b4d86ac2d429bcfaf9b13ce22ac74072c34b6a1d234642b300`.

A revisão visual cobriu 15 quadros isolados, 16 quadros da composição e quatro
novas renderizações de pontos selecionados. Corrigiu cores, recortes e cursor;
o Studio em 3300 abriu sem erro e com a duração correta. Quadros extraídos do
MP4 em 72, 126 e 151 segundos confirmaram produto, futuro, encerramento e
legendas. A revisão lexical independente por ASR conferiu as oito falas.
Pequenas variantes reconhecidas por Flash na cena 05 foram resolvidas por uma
segunda transcrição com Pro. Essa evidência não representa escuta humana nem
avaliação de timbre ou atuação.

[README do projeto](../../apps/pitch/README.md) contém os comandos Nx disponíveis.
[Registro de produção](../../apps/pitch/PRODUCTION.md) preserva materiais,
limites e resultados históricos. A [pesquisa visual v2](./specsync-ford-motion-direction-v2.md)
continua sendo a referência documentada para paleta Ford, tipografia e motion
design, sem ser apresentada como um manual oficial de animação da marca.
