# SpecSync para Ford — vídeo de produto v7

Filme de vendas em português, produzido com Remotion em **1920 × 1080, 30 fps**.
A versão 7 combina quatro cenas da demonstração apresentada no Studio da porta
3100 com a abertura comercial, o grafo espacial original, a visão
executiva de mercado e o encerramento em três etapas. O acesso público ao
produto aparece por QR. A voz escolhida continua sendo a
**prévia ElevenLabs 01 — SpecSync Presenca 01**.

**V7 concluída e verificada em 13/09/2026:** a comparação usa um dataset editorial revisado
com fontes oficiais, separado do snapshot original da API. A composição mantém
**179,533333 segundos — 5.386 frames e 52 legendas**, aproximadamente 2min59,5s.
Locução, trilha `score-v5.wav` e QR permanecem inalterados. Assista à
[exportação v7](./out/specsync-ford-pitch-v7.mp4). A cópia canônica foi
atualizada, e a
[entrega v6 verificada](./out/specsync-ford-pitch-v6.mp4) permanece preservada.

## Assistir e editar

Na raiz do repositório:

```sh
npm ci
npm exec -- nx run pitch:studio
```

A entrada principal deste projeto é
<http://localhost:3300/SpecSyncFord>, composição `SpecSyncFord` do projeto Nx
`pitch`. O Studio da porta 3100 pertence à produção de origem e não é a
entrada da versão combinada. Seu worktree permanece inalterado.

O roteiro comercial está em `src/data/storyboard.json`. A composição reúne:

| Ordem | Conteúdo                                                      | Origem visual                                                  |
| ----- | ------------------------------------------------------------- | -------------------------------------------------------------- |
| 1     | A próxima vantagem competitiva começa na decisão              | Nova abertura em `src/scenes/Hook.tsx`                         |
| 2     | Pergunta sobre um veículo e seus atributos                    | Demo 3100, cena `03-AskSpecSync`                               |
| 3     | Pesquisa, evidência e revisão humana                          | Demo 3100, cena `04-Research`                                  |
| 4     | Especificações organizadas e lacunas explícitas               | Demo 3100, cena `05-StandardOutput`                            |
| 5     | Comparação de versões e acesso às fontes                      | Demo 3100, cena `06-Compare`                                   |
| 6     | AdvanceTrac, VSC e VSA: função comum e conhecimento conectado | Grafo original restaurado em `src/scenes/Ontology.tsx`         |
| 7     | Mercado, mix de versões, PowerPoint e relatório estratégico   | `src/scenes/Future.tsx`, conceito futuro identificado          |
| 8     | Como entregamos → meta de produtividade → próxima decisão     | `src/scenes/Close.tsx`, inspirado nas cenas 09/10 do demo 3100 |

As quatro cenas adaptadas em uso ficam em `src/demo/`; seus assets estão isolados em
`public/demo3100/`. São reencenações editoriais de fluxos existentes, com
dados e limitações documentados. Não são uma gravação contínua nem uma
medição de tempo de resposta. O antigo `src/demo/scenes/07-Ontology.tsx` fica
preservado como origem da v3 e não participa da composição atual.

A comparação v7 usa `public/data/comparison-verified-v7.json`: sete linhas
de motor, potência, torque, transmissão/sistema, tração, entre-eixos e
travessia de água. São **20 células preenchidas e uma lacuna**, a medida
em milímetros da Amarok MY26. Torque e entre-eixos substituem modos e reboque
para favorecer a comparação. Sobrepotência temporária, valores combinados
do sistema híbrido e conversão de torque permanecem qualificados. Esse
enriquecimento é editorial; não afirma que os novos dados foram retornados
pela API ou publicados no catálogo do produto. O snapshot original permanece
em `public/demo3100/data/comparison-raptor-amarok-shark.json`.
Fontes e limites: [Amarok](../../docs/research/specsync-ford-amarok-v7.md) e
[Shark](../../docs/research/specsync-ford-shark-v7.md).

A ontologia identifica o trio brasileiro como **exemplo explicativo de
normalização**; conectar a função ESC não torna os sistemas equivalentes.
O encerramento mostra “Como entregamos”, a transformação de aproximadamente
uma hora para minutos sob **“META DO PILOTO · REDUÇÃO A VALIDAR”**, e o convite
final. A redução é uma meta, sem resultado cronometrado alegado.
O último trecho recupera a fotografia da Raptor na metade direita, uma curva
Ford em movimento e o convite em tipografia animada. A imagem local
`public/demo3100/vehicles/ranger-raptor-trail.jpg` foi herdada da referência;
sua atribuição está registrada em PRODUCTION.

A visão futura trabalha participação nos emplacamentos, preço público
sugerido, mix de versões e cenários hipotéticos. A cena mostra apresentações
PPTX e relatórios DOCX com premissas e recomendações para um comitê executivo;
os dados são simulados e essas funcionalidades continuam propostas.

O QR aponta para [specsync.tubadev.com](https://specsync.tubadev.com/), com
**148 px** durante as quatro demonstrações, de **15,6 a 90,9 segundos**.
Fica a 48 px das bordas direita e inferior, com o rótulo único **“Teste agora”**
em 20 px e entrelinha de 24 px. O QR final permanece com 259 px nos
**últimos 10 segundos**, de 169,533333 a 179,533333 segundos.
O destino público foi validado, quatro stills da v6 foram decodificados e
o QR foi confirmado em cinco quadros do MP4, cobrindo as quatro demonstrações
e o encerramento.

Depois da geração, voz, trilha, efeitos e imagens são arquivos locais.
Renderizar não depende de login no SpecSync, banco de dados ou chamada a uma
API de IA. Gerar uma nova locução é uma etapa separada que usa ElevenLabs.

## Locução e sincronização

- `src/data/storyboard.json`: texto comercial, direção de fala e tempos das cenas.
- `src/data/eleven-voice.json`: voz 01 selecionada e configuração `eleven_v3`.
- `public/audio/eleven-v1/`: destino da nova locução; o nome identifica a primeira
  geração com a voz escolhida, não a versão do filme.
- `src/data/voice.json`: manifesto consumido pela composição, com arquivos,
  durações e legendas alinhadas.
- `public/specsync-ford.pt-BR.srt`: legendas externas geradas dos mesmos tempos.

O gerador `scripts/generate-eleven-narration.py` usa a biblioteca padrão Python
e `ffmpeg`/`ffprobe`. Para gerar ou retomar a locução, na raiz do repositório:

```sh
python3 apps/pitch/scripts/generate-eleven-narration.py \
  --storyboard apps/pitch/src/data/storyboard.json \
  --voice-config apps/pitch/src/data/eleven-voice.json \
  --output-dir apps/pitch/public/audio/eleven-v1 \
  --manifest apps/pitch/src/data/voice.json
```

Em um terminal interativo, a chave é solicitada sem exibi-la; também pode ser
fornecida pela variável `ELEVENLABS_API_KEY`. O script reutiliza respostas
armazenadas para a mesma solicitação, guarda áudio e alinhamento e preserva
snapshots dos manifestos anteriores. `--dry-run` apenas valida e informa o
cache; `--offline` usa somente respostas já armazenadas, sem chamar a API.
Use `--help` para as opções de geração por cena e saídas alternativas.

Na v5, somente `07-future` recebeu nova locução com a voz 01 em velocidade
natural: **30,88 segundos de áudio**, em uma cena de **979 frames / 32,633333
segundos**. Os sete outros arquivos foram reaproveitados. O hold visual de
`02-ask` passou de 14 para 13 segundos, sem acelerar a voz.
Os áudios mantêm normalização individual de aproximadamente
−16 LUFS e legendas alinhadas. Não reutilize o gerador Edge TTS das versões
anteriores para produzir a voz atual.

A locução mantém a velocidade natural da voz selecionada. Os tempos das
cenas, legendas e transições acompanham o storyboard final. Ao produzir outra
versão, regenere os tempos com o áudio. Os arquivos de audição e as vozes
anteriores são históricos.

A trilha atual é `public/audio/score-v5.wav`, sintetizada a 92 BPM e adaptada
ao storyboard, incluindo acentos nas palavras do encerramento. Para recriá-la,
com Python e NumPy disponíveis:

```sh
python3 apps/pitch/scripts/generate-score.py
```

O script gera somente a trilha v5; `score.wav`, `score-v3.wav` e `score-v4.wav` permanecem
como arquivos históricos. A composição aplica o volume da música e o
pipeline de exportação finaliza a mixagem.

O QR local pode ser reproduzido no macOS com os frameworks Core Image e
Vision, sem instalar pacote adicional no projeto:

```sh
swift apps/pitch/scripts/generate-qr.swift generate apps/pitch/public/brand/specsync-qr.svg
swift apps/pitch/scripts/generate-qr.swift verify /absolute/path/frame.png
```

A segunda operação decodifica uma imagem rasterizada ou quadro extraído do
vídeo e exige correspondência com o destino público configurado.

## Exportar e verificar

Requisitos: Node compatível com o workspace e `ffmpeg`/`ffprobe` no PATH.
O Remotion baixa o Chrome Headless Shell no primeiro render. Depois de integrar
a locução e revisar a composição:

```sh
npm exec -- nx run pitch:render
npm exec -- nx run pitch:verify
npm exec -- nx run pitch:stills
```

O render gera H.264 em CRF 18 e finaliza o áudio em AAC estéreo, 48 kHz,
192 kb/s, com alvo de −16 LUFS e pico de −1,5 dBTP. O MP4 possui `faststart`.
A medição final do MP4 v6 registrou **−16,12 LUFS, −2,63 dBTP e LRA de 5,4 LU**.
As fontes de áudio foram mantidas; a mixagem foi reexportada, sem alegação de
identidade binária do AAC entre versões.

- `out/specsync-ford-pitch-v7.mp4`: exportação identificada desta versão.
- `out/specsync-ford-pitch.mp4`: cópia canônica da exportação atual.
- `out/specsync-ford-pitch.raw.mp4`: intermediário de renderização.
- `out/stills/`: quadros para revisão visual.
- `out/verification.json`: relatório da execução mais recente da verificação.

O pipeline da v7 atualiza a cópia canônica e a v7; **preserva a v6 e as anteriores**.
Os arquivos `out/specsync-ford-pitch-v1.mp4` a
`out/specsync-ford-pitch-v6.mp4` identificam as entregas anteriores.
`out/` e `dist/` são ignorados pelo Git.

Se apenas a finalização de áudio mudar, `npm exec -- nx run pitch:master`
reutiliza o intermediário. Mudanças nas cenas ou nos tempos exigem novo render.
Para formatar e validar o código:

```sh
npm exec -- nx run pitch:format
npm exec -- nx run-many -t lint,typecheck,build -p pitch
```

## Validação atual e histórico

**V7 concluída:** comparação conferida com fontes oficiais, preservando
qualificadores e a única lacuna de travessia da Amarok. Render e verify
passaram: 179,533333 segundos, 5.386 frames, 52 legendas, 1920 × 1080,
30 fps, H.264 e AAC estéreo. Quatro stills e os quadros de tabela/painel de
fontes do MP4 foram aprovados; o QR passou em cinco quadros. O Studio abriu
sem erro, com 5.386 frames, preparado no frame 2.207.

A v7 e a cópia canônica têm **36.905.171 bytes**, SHA-256
`7fb51b9da01d2d5a886e077d846f46dde0588c3bf57cb771fdf5d02126aed9dc`.
O áudio mediu **−16,12 LUFS, −2,63 dBTP e LRA de 5,40 LU**.
A v6 foi preservada e conferida pelo hash registrado abaixo.
Evidências: [verificação](./out/verification-v7.json),
[dados](./out/data-verification-v7.json), [QR](./out/qr-verification-v7.json),
[áudio](./out/audio-levels-v7.json), [revisão visual](./out/visual-review-v7.json),
[checks](./out/checks-v7.log), [render](./out/render-v7.log),
[log de verificação](./out/verify-v7.log) e [quadros exportados](./out/review-export-v7/).

**Histórico v6:** Nx format, lint, typecheck, build, stills, render e verify
passaram, incluindo decodificação integral: 179,533333 segundos, 5.386 frames,
52 legendas, 1080p/30 fps, H.264 e AAC estéreo. O QR foi decodificado para a
URL exata aos 23, 40, 60, 86,666667 e 176 segundos do MP4. Quatro stills e o
quadro exportado de especificações foram aprovados visualmente. O Studio
abriu sem erro, preparado no frame 690.

A exportação tem **37.022.217 bytes**, SHA-256
`de811786e72a741c9babc8d4964dbc458afb8dbf3ca4bdd8e69b9bb2fde81413`.
A v5 foi preservada e conferida pelo hash registrado abaixo.
Evidências: [verificação v6](./out/verification-v6.json),
[QR](./out/qr-verification-v6.json), [áudio](./out/audio-levels-v6.json),
[checks](./out/checks-v6.log), [render](./out/render-v6.log),
[log de verificação](./out/verify-v6.log) e
[quadros exportados](./out/review-export-v6/).

**Histórico v5:** a transcrição independente de `07-future` coincidiu
com o roteiro sem diferenças lexicais. Os sete arquivos reaproveitados
conservam as revisões anteriores. A composição foi congelada após aprovação
dos stills; o QR foi decodificado nos assets de 185/259 px, em seis stills
e em cinco quadros extraídos do MP4. Nx format, lint, typecheck, build,
render e verify passaram, incluindo decodificação integral do arquivo.
Na revisão v5, o Studio apresentou 5.386 frames, sem erro, sem mudo e em
velocidade 1, preparado no frame 3.567.

Naquela entrega, o MP4 canônico e a v5 eram idênticos, com **37.154.685 bytes** e SHA-256
`96b5523f678944d6a28199a5444303902fc90355200ef1da1b8f99fd6667b70f`.
A exportação v4 foi preservada com seu hash original.

- [Verificação v5](./out/verification-v5.json),
  [níveis de áudio](./out/audio-levels-v5.json) e
  [QR no MP4](./out/qr-verification-v5.json).
- [Checks](./out/checks-v5.log), [render](./out/render-v5.log) e
  [verificação](./out/verify-v5.log).
- [Revisão lexical v5](./out/narration-v5-qa/README.md) e
  [transcrição de Future](./out/narration-v5-qa/07-future.json).
- [Stills da visão futura](./out/review-future-v5/) e
  [stills e assets de revisão do QR](./out/review-qr-v5/).
- [Quadros do MP4 final](./out/review-export-v5/README.md), incluindo geração,
  PowerPoint e relatório inspecionados visualmente. Os cinco quadros com QR
  passaram por revisão visual independente, sem sobreposição.

A transcrição automatizada confere conteúdo lexical; não é uma afirmação de
escuta humana nem uma avaliação de timbre ou atuação.

**Histórico v4:** a revisão lexical independente dos dois áudios novos confirmou todas
as frases. O encerramento coincide com o roteiro após normalização
ortográfica; a ontologia apresentou somente “Advance Track” na transcrição
do nome comercial “AdvanceTrac”. Isso é revisão automatizada por ASR, não
escuta humana ou avaliação de timbre. Os seis trechos reaproveitados conservam
a revisão v3, incluindo a segunda transcrição da cena de comparação.

Lint, typecheck e build passaram após a formatação e o congelamento do código.
O render concluiu em 1min44s, e a verificação aprovou 1080p/30 fps, H.264,
AAC estéreo, 175,9 segundos, 5.277 frames, oito cenas, 49 legendas, voz 01 em
velocidade natural e decodificação integral. O Studio abriu sem erro e com
5.277 frames. Naquela entrega, a cópia canônica e a v4 eram idênticas, com
37.202.279 bytes. Esses resultados não validam automaticamente a v5.

Evidências preservadas da v4:

- [Verificação v4](./out/verification-v4.json) e
  [medição de áudio](./out/audio-levels-v4.json).
- [Checks](./out/checks-v4.log), [render](./out/render-v4.log) e
  [verificação](./out/verify-v4.log).

- [Revisão lexical v4](./out/narration-v4-qa/README.md),
  [ontologia](./out/narration-v4-qa/06-ontology.json) e
  [encerramento](./out/narration-v4-qa/08-close.json).

A revisão visual incluiu oito stills do encerramento e 15 do grafo, com dois
revistos após ajustes de rodapé e nó central. Seis quadros extraídos do MP4
confirmaram legibilidade e encaixe das legendas:
[ontologia](./out/ontology-v4.jpg), [agentes](./out/agents-v4.jpg),
[entrega](./out/delivery-v4.jpg), [uma hora](./out/hour-v4.jpg),
[minutos](./out/minutes-v4.jpg) e [convite final](./out/close-v4.jpg).

**Histórico v3:** lint, typecheck, build, render e verificação passaram para
153,9 segundos, 4.617 frames e 39 legendas. A revisão visual incluiu cenas
isoladas, composição e quadros extraídos do MP4. Esses resultados pertencem
à entrega anterior e não validam o novo render.

- [Verificação preservada da v3](./out/verification-v3.json).
- [Medição de áudio v3](./out/audio-levels-v3.json).
- [Revisão lexical independente da locução](./out/narration-v3-qa/README.md).
- [Quadros da composição principal](./out/stills/) e
  [quadros das cenas de demonstração](./out/review-demo-v3/).

## Proveniência e limites

[PRODUCTION.md](./PRODUCTION.md) registra evidências, origem dos materiais e
histórico das versões. [A revisão v5](../../docs/research/specsync-ford-executive-future-v5.md)
registra fontes de mercado, limites dos indicadores, materiais executivos e QR.
[A revisão v4](../../docs/research/specsync-ford-ontology-finale-v4.md)
registra as fontes brasileiras, a auditoria dos termos e a meta de tempo.
[A integração v3](../../docs/research/specsync-ford-combined-v3.md) preserva o
histórico do transplante. [A direção visual v2](../../docs/research/specsync-ford-motion-direction-v2.md)
preserva a pesquisa de referências Ford e Remotion que informou o projeto.

Referências técnicas: [Remotion](https://www.remotion.dev/docs/),
[renderização](https://www.remotion.dev/docs/cli/render) e
[sincronização de áudio](https://www.remotion.dev/docs/using-audio).
