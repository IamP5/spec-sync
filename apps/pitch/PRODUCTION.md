# Registro de produção — SpecSync para Ford

Produção iniciada em 12 de setembro de 2026; revisões v3–v7 em 13 de setembro.
O PDF fornecido pelo usuário e a
[proposta inicial](../../docs/research/specsync-ford-video-pitch-proposal.md)
são fontes de contexto. A narrativa atual é um pitch comercial do produto;
não apresenta o trabalho como resposta ao “desafio Ford”.

## Estado da versão 7

**V7 concluída e verificada em 13/09/2026.** A comparação usa
`public/data/comparison-verified-v7.json`, enriquecimento editorial com fontes
oficiais brasileiras, separado do snapshot original da API. São sete linhas:
motor, potência, torque, transmissão/sistema, tração, entre-eixos e travessia
de água; **20 células preenchidas e uma lacuna**. A Amarok MY26 permanece
sem cota de travessia em milímetros, pois o manual fornece um limite físico.
Torque e entre-eixos substituem modos e reboque para melhorar a comparabilidade.

Os qualificadores preservam overboost temporário da Amarok, potência/torque
combinados da Shark e conversão de 65 kgf·m para aproximadamente 637 Nm.
As células VW foram conferidas contra as fontes já pesquisadas, inclusive
os 3.097 mm do manual MY26 e seu escopo geral. Fontes e aplicabilidade:
[Amarok v7](../../docs/research/specsync-ford-amarok-v7.md) e
[Shark v7](../../docs/research/specsync-ford-shark-v7.md).

Os novos dados não são apresentados como retorno da API nem publicação no
catálogo de produção. O snapshot original permanece preservado. Locução,
trilha `score-v5.wav`, QR, 179,533333 segundos, 5.386 frames e 52 legendas
continuam iguais. Render e verify passaram. A
[exportação v7](./out/specsync-ford-pitch-v7.mp4) e a cópia canônica atualizada
têm **36.905.171 bytes**, SHA-256
`7fb51b9da01d2d5a886e077d846f46dde0588c3bf57cb771fdf5d02126aed9dc`.
A v6 foi preservada e conferida pelo hash registrado no histórico.

O MP4 confirmou 179,533333 segundos, 5.386 frames, 52 legendas, 1920 × 1080,
30 fps, H.264 e AAC estéreo. O áudio mediu **−16,12 LUFS, −2,63 dBTP e
LRA de 5,40 LU**. Quatro stills, nos frames 2.207/2.277/2.447/2.657, foram
aprovados, incluindo o painel de fontes pelo revisor BYD. A tabela e o painel
extraídos do MP4 foram inspecionados e aprovados. O QR passou nesses quatro
frames do vídeo e no encerramento aos 176 segundos. O Studio abriu sem erro,
com 5.386 frames, preparado no frame 2.207.

Evidências: [verificação](./out/verification-v7.json),
[dados](./out/data-verification-v7.json), [QR](./out/qr-verification-v7.json),
[áudio](./out/audio-levels-v7.json), [revisão visual](./out/visual-review-v7.json),
[formatação](./out/format-v7.log), [checks](./out/checks-v7.log),
[stills](./out/stills-v7.log), [render](./out/render-v7.log),
[log de verificação](./out/verify-v7.log) e [quadros exportados](./out/review-export-v7/).

## Histórico da versão 6

A v6 altera somente o QR durante as quatro demonstrações: **148 px**,
quatro pixels por módulo, no canto inferior direito, a 48 px de ambas as
bordas, com o rótulo único **“Teste agora”** em 20 px e entrelinha de 24 px.
O QR de encerramento mantém 259 px. Os intervalos permanecem de 15,6 a 90,9
segundos na demonstração e de 169,533333 a 179,533333 segundos no final.

A composição mantém **179,533333 segundos, 5.386 frames e 52 legendas**.
A locução e `public/audio/score-v5.wav` são as mesmas da v5. Não houve
alteração do roteiro nem geração de áudio nesta revisão.

Nx format, lint, typecheck e build passaram após o congelamento do código.
Quatro stills foram decodificados para a URL exata e aprovados visualmente:
[qr-stills-v6.json](./out/qr-stills-v6.json).

**V6 concluída e verificada em 13/09/2026.** Nx format, lint, typecheck, build,
stills, render e verify passaram, incluindo decodificação integral. O MP4
confirmou 179,533333 segundos, 5.386 frames, 52 legendas, 1920 × 1080, 30 fps,
H.264 e AAC estéreo. A exportação `out/specsync-ford-pitch-v6.mp4` tem
**37.022.217 bytes**, SHA-256
`de811786e72a741c9babc8d4964dbc458afb8dbf3ca4bdd8e69b9bb2fde81413`.
A cópia canônica foi atualizada e a v5 preservada com seu hash registrado abaixo.

O QR foi decodificado para a URL exata nos quadros de 23, 40, 60, 86,666667
e 176 segundos do MP4. Os quatro stills da demonstração e o quadro exportado
de especificações foram aprovados visualmente. O Studio abriu sem erro,
preparado no frame 690. O áudio final mediu **−16,12 LUFS, −2,63 dBTP e LRA
5,4 LU**; as fontes são as mesmas, mas a mixagem foi reexportada e o AAC não
é binariamente idêntico ao da v5.

Evidências: [vídeo v6](./out/specsync-ford-pitch-v6.mp4),
[verificação](./out/verification-v6.json), [QR](./out/qr-verification-v6.json),
[áudio](./out/audio-levels-v6.json), [checks](./out/checks-v6.log),
[render](./out/render-v6.log), [log de verificação](./out/verify-v6.log) e
[quadros exportados](./out/review-export-v6/).

## Histórico da versão 5

A v5 mantém as quatro cenas de demonstração 03–06 do Studio da porta 3100,
o grafo espacial original e o encerramento em três etapas da v4. A revisão
refaz `Future.tsx` em torno de inteligência de mercado, PowerPoint e
relatórios estratégicos; acrescenta QR para o produto nas demonstrações e
no convite final. A entrada continua `SpecSyncFord`, projeto `pitch`,
Studio da porta 3300. O worktree de referência permanece inalterado.

Somente `07-future` recebeu nova locução ElevenLabs 01 em velocidade natural;
sete arquivos foram reaproveitados. A composição atual tem **179,533333
segundos, 5.386 frames a 30 fps e 52 legendas**. Future possui 30,88 segundos
de áudio em 979 frames de cena, ou 32,633333 segundos. O hold visual de
`02-ask` foi reduzido de 14 para 13 segundos sem acelerar a voz.
As fontes temporais são `src/data/storyboard.json` e `src/data/voice.json`.

**Versão 5 concluída, renderizada e verificada em 13/09/2026.** A transcrição
independente da nova locução não apresentou diferenças lexicais. O QR foi
decodificado nos assets, em seis stills e em cinco quadros do MP4 final.
Nx format, lint, typecheck, build, render e verify passaram, incluindo
decodificação integral e correspondência entre composição e arquivo.

A exportação identificada é `out/specsync-ford-pitch-v5.mp4`; o pipeline
também atualiza `out/specsync-ford-pitch.mp4`, a cópia canônica. As exportações
v1–v4 são preservadas. Os resultados anteriores são históricos e não validam
automaticamente esta revisão.

## Evidências e escolhas editoriais atuais

| Trecho             | Material e significado                                                                                     | Limite da demonstração                                                                                           |
| ------------------ | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Abertura comercial | Qualidade da decisão e inteligência sobre o produto                                                        | Não promete economia de tempo medida, liderança ou resultado garantido                                           |
| Pergunta           | Reencenação da entrada conversacional e seleção de atributos                                               | O ano-modelo solicitado precisa ser confrontado com as evidências                                                |
| Pesquisa           | Busca de fonte Ford, captura de evidência e revisão de transmissão                                         | 1 configuração, 4 achados mapeados, 3 aguardando mapeamento; 2 selecionados e 0 publicados                       |
| Especificações     | Dados do catálogo Raptor organizados em formato comum                                                      | Campos ausentes permanecem “Não informado”; não são preenchidos por inferência                                   |
| Comparação         | Dataset editorial v7, com fontes oficiais, para Raptor, Amarok V6 Extreme e Shark GS                       | 20 células preenchidas e uma lacuna; qualificadores preservados, sem alegar retorno da API ou superioridade      |
| Ontologia          | Grafo espacial original, com AdvanceTrac, VSC e VSA conectados à função ESC                                | Exemplo explicativo; os pacotes não são equivalentes e o trio não foi demonstrado numa consulta real             |
| Visão futura       | Participação nos emplacamentos, preço público sugerido, mix de versões, PowerPoint e relatório estratégico | Cenários hipotéticos e dados simulados, com identificação persistente; não demonstra exportadores já disponíveis |
| Encerramento       | Como entregamos → meta de reduzir a pesquisa de aproximadamente 1h para minutos → convite                  | Meta do piloto, redução a validar; não declara tempo medido ou implantação já realizada na Ford                  |

As cenas do produto são reencenações editoriais em React, com interface e
tipografia adaptadas ao filme. Dados de catálogo, estados de revisão e
evidências sustentam o conteúdo; o arranjo visual não representa uma nova
interface já entregue. As esperas são condensadas e os movimentos são
coreografados. O filme não mede latência do produto.

A pesquisa preserva a revisão humana: “Automática de 10 velocidades” é
comparada com a expressão “AT de 10 velocidades” da fonte. A seleção mostrada
não confirma a identidade da versão e não publica dados. A narração fala em
**informação validada** ampliando o conhecimento, não em toda busca se tornando
automaticamente um registro aprovado.

O snapshot original `public/demo3100/data/comparison-raptor-amarok-shark.json`
registra Raptor/Amarok 2026 e Shark 2025 como retornados pelo ambiente.
Nas versões anteriores ele alimentava a comparação e o painel de fontes.
A v7 usa o arquivo editorial separado, que explicita aplicabilidade, unidades,
qualificadores e URLs primárias. A associação da ficha Shark de 06/2025 ao
recorte GS 2025 tem limites documentados; não deriva apenas da data da ficha.
Ausência de cota de travessia na Amarok não significa desvantagem comprovada.

A ontologia existe no repositório, incluindo
`apps/ai/src/mastra/graph/ontology-projection.mjs`,
`apps/ai/src/mastra/ingestion/ontology.ts` e o domínio correspondente na API.
A consulta de recuperação pelo grafo falhou durante a captura original;
aquele fluxo de comparação usou o catálogo. A v4 identifica o grafo como
“Exemplo explicativo de normalização · fontes brasileiras”. A categoria
`stability_control` existe e VSC aparece como qualificador histórico em dados
curados; AdvanceTrac e VSA não foram encontrados como termos ativados no
código e dados locais examinados. O exemplo não prova cobertura operacional
do trio. Alinhamento integral com termos internos Ford não foi validado.

As fontes oficiais brasileiras sustentam uma **função comum de controle
eletrônico de estabilidade**, preservando as diferenças dos pacotes. A
[pesquisa v4](../../docs/research/specsync-ford-ontology-finale-v4.md) detalha
as fontes Ford/Transit, Toyota/Hilux e Honda, além da auditoria local.

O encerramento deriva das cenas `09-Governance.tsx` e `10-Ask.tsx` da referência
em 3100, consultada somente para leitura. O rótulo da transformação temporal
é “META DO PILOTO · REDUÇÃO A VALIDAR”. A estimativa de aproximadamente uma
hora vem da página 5 do PDF; a página 6 a mostra riscada, sem tempo substituto.
Não foi localizada medição de minutos obtidos pelo SpecSync. “Dados na sua
nuvem” descreve o modelo de entrega, não instalação já executada na Ford.

Participação nos emplacamentos, inteligência de preços e geração de
apresentações PPTX e relatórios DOCX permanecem **visão futura**. A v5 usa
preço público sugerido, não afirma observar preços transacionados. Mix de
versões e lacunas de portfólio são cenários para análise; volume não prova
receita ou margem. As peças exibem hipóteses, fontes e premissas para um
comitê executivo de produto, marketing e vendas. Artigos continuam parte da
visão original, sem protagonismo nesta cena.

A análise textual atual não equivale à exportação desses materiais. Um
atributo de preço de referência no catálogo também não comprova integração
de preços de mercado. A [pesquisa v5](../../docs/research/specsync-ford-executive-future-v5.md)
documenta as fontes e distinções de mercado.

## Acesso público e QR

O QR aponta para [SpecSync](https://specsync.tubadev.com/). O destino foi
aberto no navegador, mostrando “New chat”, catálogo e “Sign in”; essa visita
não verificou um fluxo autenticado. Na v6, a demonstração usa o código de
148 px no canto inferior direito com “Teste agora”; os intervalos de exibição
e o código final de 259 px são mantidos. A v5 usava 185 px na demonstração.

`scripts/generate-qr.swift` usa Core Image para gerar
`public/brand/specsync-qr.svg` e Vision para conferir imagens rasterizadas,
sem dependência nova no projeto. O código tem correção Q e quatro módulos
de área branca em cada lado. Na **v5**, os assets e seis stills foram decodificados
com o destino correto. No MP4 daquela versão, Apple Vision confirmou a URL exata em
cinco quadros, aos 23, 40, 60, 80 e 176 segundos, cobrindo cada demonstração e
o convite final. Evidências: [stills](./out/review-qr-v5/) e
[relatório de leitura no MP4](./out/qr-verification-v5.json).

## Transplante da demonstração

Origem local, mantida sem alterações durante esta integração:
`.claude/worktrees/specsync-ford-pitch-video-ee14cc/apps/pitch-video`.
Os números 03–06 identificam as quatro cenas importadas em uso desde a v4, não a
ordem final de capítulos. A cena 07 foi usada na v3 e permanece como histórico.

| Origem                             | Destino nesta produção                                  |
| ---------------------------------- | ------------------------------------------------------- |
| `src/scenes/03-AskSpecSync.tsx`    | `src/demo/scenes/03-AskSpecSync.tsx`                    |
| `src/scenes/04-Research.tsx`       | `src/demo/scenes/04-Research.tsx`                       |
| `src/scenes/05-StandardOutput.tsx` | `src/demo/scenes/05-StandardOutput.tsx`                 |
| `src/scenes/06-Compare.tsx`        | `src/demo/scenes/06-Compare.tsx`                        |
| `src/scenes/07-Ontology.tsx`       | `src/demo/scenes/07-Ontology.tsx`, somente histórico v3 |

Auxiliares ficam sob `src/demo/ui/`, com tema, fonte, `SceneShell`, leitura
de dados e adaptação de tempo locais. Os assets copiados ficam isolados em
`public/demo3100/`: marca Ford, imagem Raptor, efeitos e snapshot de comparação.
Nenhum import de renderização depende do worktree de origem.

Na adaptação foram corrigidos os contadores de pesquisa e o estado de revisão,
substituídos o conflito de torque sem evidência e a referência incorreta à S10,
e removidas afirmações de normalização Ford concluída e conversão de unidades
não demonstrada. A integração não herda automaticamente todas as alegações
editoriais da produção de origem.

## Voz, trilha e materiais locais

- **Voz atual selecionada:** prévia ElevenLabs 01, `SpecSync Presenca 01`,
  configurada em `src/data/eleven-voice.json` com `eleven_v3`. É uma voz
  sintética desenhada para esta produção; não é clonagem do locutor Ford.
  A direção pede presença, firmeza e pausas, em português brasileiro.
- **Locução v5:** `07-future` novo e sete trechos reaproveitados da v4,
  gerenciados por `scripts/generate-eleven-narration.py`,
  em `public/audio/eleven-v1/`, com voz `Uag7PYOaSMVtYRkk9R00`, velocidade
  natural (`rate: 0`) e normalização individual de aproximadamente −16 LUFS.
  `src/data/voice.json`, o storyboard e o SRT canônicos foram atualizados.
  A revisão lexical independente por ASR conferiu o trecho novo sem diferenças;
  os sete restantes conservam a evidência anterior. Não houve alegação de escuta humana.
  O script preserva respostas, áudio original, alinhamento, medições e
  snapshots dos manifestos; credenciais não são gravadas nesses arquivos.
- **Referência de atitude:** [vídeo oficial Ford Brasil da F-150 Raptor](https://www.youtube.com/watch?v=u_FeNdhzCoM),
  “Mudar o nível da competição era só o começo. Vem ai F-150 Raptor.”,
  publicado em 28 de agosto de 2026. A referência não identifica publicamente
  o locutor e não deve ser atribuída à campanha de 2024. Seu áudio não é
  incorporado ao pitch.
- `public/audio/score-v5.wav`: trilha original sintetizada matematicamente por
  `scripts/generate-score.py`, sem samples de gravações comerciais. A produção
  tem 92 BPM e segue a duração e as transições do storyboard, com acentos
  sincronizados a palavras do encerramento. `score.wav`, `score-v3.wav` e `score-v4.wav`
  preservam as trilhas anteriores.
- `public/audio/sfx/` e `public/demo3100/sfx/`: efeitos pontuais locais de clique,
  troca e movimento, provenientes dos assets de exemplo oficiais Remotion.
- `public/fonts/inter-latin.woff2`: Inter distribuída via Google Fonts, com
  licença SIL Open Font License em `public/fonts/OFL.txt`. Ford F-1 foi
  consultada como referência, sem copiar ou distribuir o arquivo proprietário.
- `public/demo3100/brand/ford-script-action-blue.svg`: marca copiada dos assets
  da produção de origem; o script Ford já era utilizado no produto web.
- `public/demo3100/vehicles/ranger-raptor-hero.jpg`: imagem de fabricante mantida
  na produção de origem; o snapshot registra a [página oficial Raptor](https://www.ford.com.br/picapes/ranger-raptor/raptor-4wd-at/)
  como origem de sua imagem de catálogo.
- `public/demo3100/vehicles/ranger-raptor-trail.jpg`: asset local copiado da
  produção de referência em 3100. O README daquela produção, na seção
  “Data provenance” (linhas 68–70), atribui a fotografia de uso à Ford.com.
  Ele não fornece URL específica do arquivo nem uma licença independente;
  este registro não inventa esses dados. Desde a v4, a Raptor ocupa a metade direita
  do encerramento, com curva Ford em movimento e convite tipográfico.

Todos os materiais usados no render são locais. “Sintético” descreve a voz,
a trilha procedural e a reencenação gráfica; não significa que as fotografias
Ford tenham sido geradas por IA. Gerar a voz usa um serviço externo e ocorre
separadamente da renderização. Credenciais não integram os assets.

## Histórico preservado: versões 1 e 2

As versões anteriores tinham 160 segundos e abriam com a estimativa de
aproximadamente uma hora de pesquisa por versão, oriunda do PDF Ford.
Essa estimativa era contexto do briefing, não ganho de produtividade medido.
A abertura da v3 substituiu esse argumento por uma promessa comercial sem número.
A v4 conserva essa abertura e recupera a estimativa no encerramento como meta.

A comparação v1/v2 usava **Raptor × Ranger XL** porque os atributos da Hilux
SRX/SRX Plus não estavam disponíveis no catálogo consultado; a Limited também
não foi localizada naquela sessão. Esse recorte histórico não limita a nova
comparação Raptor × Amarok × Shark, baseada em outro snapshot.

Materiais históricos mantidos:

- `public/brand/raptor-1.jpg`: extração da página 2 do `ford-desafios.pdf`
  fornecido pelo usuário. O uso no pitch solicitado não concede licença
  independente de reutilização.
- `public/captures/`: capturas reais de `http://localhost:4200/`, produzidas em
  conversas de demonstração. A pesquisa capturada usou a
  [página Performance da Raptor](https://www.ford.com.br/picapes/ranger-raptor/performance/).
- Fontes abertas na comparação original: [ficha Raptor](https://www.ford.com.br/content/dam/Ford/website-assets/latam/br/nameplate/2025/ranger-raptor/pdf/fbr-ranger-raptor-ficha-tecnica.pdf)
  e [ficha Ranger](https://www.ford.com.br/content/dam/Ford/website-assets/latam/br/nameplate/2025/nova-geracao-ranger/update-images/pdf/fbr-nova-ford-ranger-ficha-tecnica.pdf).
- `public/audio/01-challenge.mp3` e demais MP3 diretamente em `public/audio/`:
  locução anterior `pt-BR-AntonioNeural`, produzida com `edge-tts 7.2.8`.
  `generate-voiceover.py` pertence a esse fluxo anterior; não é o gerador atual.
- Arquivos de audição e `voice-design-eleven.json`: histórico da escolha de voz.
  O texto de audição pode conter a abertura antiga; o roteiro vigente é
  `storyboard.json`.
- `out/specsync-ford-pitch-v1.mp4` e `out/specsync-ford-pitch-v2.mp4`:
  exportações anteriores, preservadas quando disponíveis no ambiente local.

A v2 removeu o enquadramento de apresentação, ampliou a interface e introduziu
movimento de câmera, digitação, cursor, painéis e grafo espacial. Sua pesquisa
de marca e movimento permanece em
[Direção visual v2](../../docs/research/specsync-ford-motion-direction-v2.md).

## Revisão da locução v5

A nova locução `07-future`, de 30,88 segundos, passou por transcrição
independente sem diferenças lexicais em relação ao roteiro. Os sete arquivos
reutilizados mantêm as verificações anteriores. Evidências:
[método e resultado v5](./out/narration-v5-qa/README.md) e
[transcrição](./out/narration-v5-qa/07-future.json).
É uma verificação automatizada do conteúdo, não escuta humana nem aprovação
subjetiva do timbre, atuação ou mixagem.

## Histórico de verificação: v5

Entrega verificada em **13/09/2026**, às **16:26:31 UTC / 13:26:31 de Brasília**.

| Verificação                                                       | Resultado                                                                                 |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Nx `pitch:format`, `pitch:lint`, `pitch:typecheck`, `pitch:build` | Aprovados após congelamento da implementação                                              |
| `pitch:render` e `pitch:verify`                                   | Aprovados, incluindo decodificação integral do MP4                                        |
| Vídeo                                                             | 1920 × 1080, 30 fps, H.264, 179,533333 segundos, 5.386 frames                             |
| Áudio                                                             | AAC estéreo; −16,12 LUFS, −2,63 dBTP, LRA 5,4 LU                                          |
| Locução e legendas                                                | 8 cenas, 52 legendas, ElevenLabs 01 em velocidade natural                                 |
| QR no MP4                                                         | URL exata confirmada por Apple Vision em 5 quadros, nas 4 demonstrações e no encerramento |
| Studio                                                            | 5.386 frames, sem erro, sem mudo, velocidade 1; preparado no frame 3.567                  |

Naquela entrega, a exportação v5 e a cópia canônica eram idênticas: **37.154.685 bytes**, SHA-256
`96b5523f678944d6a28199a5444303902fc90355200ef1da1b8f99fd6667b70f`.
A v4 permaneceu preservada, conferida com SHA-256
`8271a2a42b0123681458da3bdc27bd66c10294d49980250131c89cd0f22b8fe5`.

Evidências: [vídeo v5](./out/specsync-ford-pitch-v5.mp4),
[verificação](./out/verification-v5.json), [áudio](./out/audio-levels-v5.json),
[checks](./out/checks-v5.log), [render](./out/render-v5.log) e
[log de verificação](./out/verify-v5.log).
Os campos `input_i`, `input_tp` e `input_lra` da medição são os níveis do
MP4 analisado; `output_*` são projeções do filtro, não outra exportação.

A [revisão de Future](./out/review-future-v5/) e os
[stills do QR](./out/review-qr-v5/) foram aprovados antes do render.
O agente responsável inspecionou visualmente os quadros do MP4 com
[geração](./out/review-export-v5/generation.png),
[PowerPoint](./out/review-export-v5/powerpoint.png) e
[relatório](./out/review-export-v5/report.png).
O [registro dos quadros exportados](./out/review-export-v5/README.md) e o
[relatório do QR](./out/qr-verification-v5.json) preservam essa verificação.
Os cinco quadros reais com QR também passaram por revisão visual independente,
sem sobreposição ou correção necessária.

Os resultados abrangem integridade técnica, níveis de áudio, leitura do QR,
conteúdo lexical automatizado e revisão visual. Não afirmam escuta humana
integral nem avaliação subjetiva de atuação e timbre.

## Histórico da revisão de locução: v4

Os dois novos trechos foram enviados a Gemini 2.5 Flash na Vertex AI com
instrução de transcrição literal, sem o texto esperado. O encerramento confere
após normalização de pontuação, caixa e grafia da marca. A ontologia contém
todas as frases, com a única variação ortográfica “Advance Track” na transcrição
do nome “AdvanceTrac”. Os seis áudios reutilizados são idênticos aos anteriores
e conservam a verificação lexical v3, incluindo a segunda análise da cena 05.

Evidências: [método e resultado](./out/narration-v4-qa/README.md),
[ontologia](./out/narration-v4-qa/06-ontology.json) e
[encerramento](./out/narration-v4-qa/08-close.json).
Esta revisão automatizada não equivale a escuta humana nem avalia timbre,
atuação ou mixagem. As medições e a revisão visual do arquivo exportado estão
registradas separadamente abaixo.

## Histórico de verificação: v4

Entrega verificada em **13/09/2026**, às **15:49:40 UTC / 12:49:40 de Brasília**.

| Verificação                                       | Resultado                                                     |
| ------------------------------------------------- | ------------------------------------------------------------- |
| Nx `pitch:lint`, `pitch:typecheck`, `pitch:build` | Aprovados após formatação e congelamento do código            |
| `pitch:render`                                    | Aprovado; execução de 1min44s                                 |
| `pitch:verify`                                    | Aprovado, incluindo decodificação integral do arquivo         |
| Vídeo                                             | 1920 × 1080, 30 fps, H.264, 175,9 segundos, 5.277 frames      |
| Áudio                                             | AAC estéreo; −16,24 LUFS, −1,88 dBTP e LRA 8,4 LU             |
| Locução e legendas                                | 8 cenas, 49 legendas, voz ElevenLabs 01 em velocidade natural |
| Studio                                            | 5.277 frames, sem erro de execução                            |

Naquela entrega, a exportação v4 e a cópia canônica eram idênticas: **37.202.279 bytes**, SHA-256
`8271a2a42b0123681458da3bdc27bd66c10294d49980250131c89cd0f22b8fe5`.
A exportação v3 foi conferida e permanece preservada com SHA-256
`f98a09b4e6ff5251cdad64d840298ecb81690c0596a5e42e26add6d025b6b3b0`.

Evidências da entrega:

- [Vídeo v4](./out/specsync-ford-pitch-v4.mp4) e
  [relatório preservado](./out/verification-v4.json).
- [Checks](./out/checks-v4.log), [render](./out/render-v4.log) e
  [verificação](./out/verify-v4.log).
- [Medição do áudio v4](./out/audio-levels-v4.json): `input_i`, `input_tp` e
  `input_lra` são os níveis do MP4 analisado. Os campos `output_*` projetam a
  saída do filtro de análise e não representam outra exportação.

A revisão visual incluiu oito stills de Close e 15 do grafo; dois foram
revistos após ajustes no rodapé e no nó central. A inspeção adicional dos
seis quadros abaixo, extraídos do **MP4 final**, confirmou conteúdo legível e
legendas encaixadas:

| Tempo no MP4 | Quadro inspecionado                                     |
| ------------ | ------------------------------------------------------- |
| 102 s        | [Ontologia](./out/ontology-v4.jpg)                      |
| 115,5 s      | [Agentes e conhecimento conectado](./out/agents-v4.jpg) |
| 153 s        | [Como entregamos](./out/delivery-v4.jpg)                |
| 159,4 s      | [Referência de uma hora](./out/hour-v4.jpg)             |
| 164,2 s      | [Meta em minutos](./out/minutes-v4.jpg)                 |
| 172,9 s      | [Raptor e convite final](./out/close-v4.jpg)            |

Essas evidências são de inspeção visual, integridade técnica, níveis de áudio
e revisão lexical automatizada. Não constituem afirmação de escuta humana
do filme ou aprovação subjetiva de atuação e timbre.

## Histórico de verificação: v3

Verificação da entrega **v3** em **13/09/2026**, registrada às
**15:22:48 UTC / 12:22:48 de Brasília**:

| Verificação                                       | Resultado                                                               |
| ------------------------------------------------- | ----------------------------------------------------------------------- |
| Nx `pitch:lint`, `pitch:typecheck`, `pitch:build` | Aprovados após as correções visuais                                     |
| `pitch:render` e `pitch:verify`                   | Aprovados                                                               |
| Vídeo                                             | 1920 × 1080, 30 fps, H.264, 153,9 segundos, 4.617 frames                |
| Áudio                                             | AAC estéreo; medição final de −16,22 LUFS e −1,70 dBTP                  |
| Locução e legendas                                | 8 cenas, 39 legendas, voz ElevenLabs 01, velocidade natural (`rate: 0`) |
| Integridade                                       | Decodificação integral do MP4 aprovada                                  |
| Studio                                            | Entrada 3300/SpecSyncFord com duração correta e sem erro de execução    |

Naquela entrega, as cópias canônica e v3 eram idênticas: **28.090.806 bytes**, SHA-256
`f98a09b4e6ff5251cdad64d840298ecb81690c0596a5e42e26add6d025b6b3b0`.
A v2 permaneceu preservada, SHA-256
`d0c11034ea8104b4d86ac2d429bcfaf9b13ce22ac74072c34b6a1d234642b300`.

Evidências locais:

- [Relatório preservado da v3](./out/verification-v3.json), com metadados, hash,
  alinhamento e resultado da decodificação.
- [Medição de áudio v3](./out/audio-levels-v3.json). Os campos `input_i` e
  `input_tp` medem o MP4 analisado; os campos `output_*` são a projeção do filtro
  usado para análise, não uma segunda entrega.
- [Revisão da locução](./out/narration-v3-qa/README.md),
  [resumo lexical](./out/narration-v3-qa/summary.json) e
  [segunda análise da cena 05](./out/narration-v3-qa/05-compare-secondary-pro.json).
- [15 quadros de cenas isoladas](./out/review-demo-v3/) e
  [quadros da composição principal](./out/stills/), cuja revisão incluiu
  16 quadros e quatro novas renderizações de pontos selecionados.

A revisão visual corrigiu herança de cor em painéis e grafo, corte da lista
de especificações, margem do termo “power” e trajetórias do cursor. O painel
de evidências ganhou uma ação visível para abrir as fontes dos veículos.
Quadros extraídos do MP4 final em 72, 126 e 151 segundos também foram
inspecionados: produto, visão futura, encerramento e legendas correspondem
à composição pretendida.

Na verificação lexical, Gemini 2.5 Flash transcreveu os oito áudios sem receber
o texto esperado. Sete coincidiram após normalização ortográfica. Duas pequenas
variantes da cena 05 foram resolvidas pela segunda transcrição independente
com Gemini 2.5 Pro, que coincidiu com o roteiro. Não foram detectadas cláusulas
omitidas ou finais truncados. Essa verificação não avalia atuação, timbre ou
qualidade de pronúncia e não constitui escuta humana.

**Histórico de validação anterior, não validação da v3:** foram registrados
`pitch:lint`, `pitch:typecheck`, `pitch:build`, os checks restantes do gateway
e os 22 testes de scripts como aprovados. A revisão visual anterior incluiu
oito cenas, três estados de comparação e uma transição; o Studio abriu sem erro.
A verificação completa do monorepo parou no build de IA porque o Mastra recusou
construir enquanto o servidor de desenvolvimento daquela pasta estava ativo.
O servidor não foi encerrado e o build não foi forçado.
