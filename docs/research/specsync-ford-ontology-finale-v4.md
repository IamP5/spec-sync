# SpecSync para Ford — ontologia e encerramento v4

Registro final de 13 de setembro de 2026. **Versão 4 concluída, renderizada
e verificada.** O vídeo tem **175,9 segundos e 5.277 frames a 30 fps**. Os dois
trechos alterados já foram gerados com a voz ElevenLabs 01 em velocidade
natural; os outros seis foram reaproveitados byte por byte da v3. A duração
medida da exportação coincide com o storyboard; os resultados de QA estão
registrados abaixo.

## Escopo da revisão

A v4 restaura a linguagem do grafo espacial original e usa um exemplo de
nomes comerciais encontrados no Brasil para explicar normalização semântica.
O encerramento recupera a progressão “Como entregamos” e convite final das
cenas 09 e 10 da produção de referência, com uma meta de produtividade
explicitamente identificada.

O roteiro vigente está em `apps/pitch/src/data/storyboard.json`. Os trechos
alterados são `06-ontology` e `08-close`, ambos com 28 segundos na composição
final. As quatro cenas importadas em uso continuam sendo pergunta,
pesquisa, especificações e comparação (`src/demo/scenes/03` a `06`).
`src/scenes/Ontology.tsx` retoma o grafo original; a cena importada
`07-Ontology.tsx` é histórica e não participa da composição v4.
A visão futura de mercado e materiais executivos continua
conceitual, conforme os limites documentados na
[integração v3](./specsync-ford-combined-v3.md).

## Referência visual de encerramento

Produção de origem: Studio em **3100**, worktree
`.claude/worktrees/specsync-ford-pitch-video-ee14cc/apps/pitch-video`.
Os arquivos abaixo foram consultados **somente para leitura**; o worktree
de origem permanece inalterado:

- `src/scenes/09-Governance.tsx`: fundo Ford Blue, mensagens de nuvem,
  rastreabilidade, comando humano e trabalho agêntico em sequência.
- `src/scenes/10-Ask.tsx`: transformação tipográfica de “1h” para “minutos”,
  seguida de marca, fotografia Raptor e convite final.

A referência informa ritmo, escala e composição. O novo `Close.tsx` organiza
28 segundos em três etapas: **Como entregamos → meta de produtividade → marca
e convite final**. A adaptação não herda as afirmações históricas “Validado
com a Ranger Raptor 2026” e “Desafio 01”.
“Dados na sua nuvem” descreve o modelo de entrega proposto, não uma instalação
já realizada na infraestrutura Ford. A transformação de tempo está
identificada como **meta**, não resultado medido.

O último trecho recupera a Raptor fotografada na metade direita, a curva Ford
em movimento e o convite em tipografia animada. O asset local
`apps/pitch/public/demo3100/vehicles/ranger-raptor-trail.jpg` foi copiado da
mesma referência. Seu README, seção “Data provenance”, linhas 68–70, atribui
a fotografia de uso à Ford.com, sem indicar URL específica de download nem
licença independente. Essa é a proveniência disponível; o registro não
atribui uma URL ou licença adicional.

A entrada da composição combinada continua sendo o projeto `pitch`,
`SpecSyncFord`, em <http://localhost:3300/SpecSyncFord>. Consultar a referência
em 3100 não muda o projeto de destino.

## Exemplo brasileiro: nomes comerciais e função comum

| Marca / termo          | Exemplo de aplicação brasileira | O que a fonte sustenta                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ford — ESP AdvanceTrac | Transit                         | O sistema inclui controle eletrônico de estabilidade, anticapotamento e outras assistências. [Ford Brasil](https://www.ford.com.br/content/ford/br/pt_br/compre-o-seu-content/offers-overlays/gallery-transit/overlay-3/)                                                                                                                                                     |
| Toyota — VSC           | Hilux SRV AT                    | A ficha identifica VSC como controle eletrônico de estabilidade e distingue A-TRC, controle eletrônico de tração. [Ficha oficial Toyota](https://media.toyota.com.br/d400f124-b3ac-4d73-a885-5d6828812f11.pdf)                                                                                                                                                                |
| Honda — VSA            | CR-V Advanced Hybrid            | A página brasileira apresenta assistência de tração e estabilidade; o manual explica que a função principal do VSA é ESC, com controle de tração adicional. [Produto Honda](https://www.honda.com.br/automoveis/crv), [manual Honda](https://www.honda.com.br/pos-venda/automoveis/sites/customer_service/files/qr_code/ManualCompleto2GNAP2DiAP2T/04_CondVeiculo_2GN-3.html) |

A consulta ocorreu em 13/09/2026. As páginas Ford e Honda foram abertas;
o conteúdo da ficha Toyota foi confirmado na indexação do domínio oficial,
mas sua abertura direta retornou HTTP 403 nesta sessão. Não foi atribuída
uma equivalência de desempenho a partir desses textos.

O conceito central recomendado é **controle eletrônico de estabilidade
(ESC)**. As conexões descrevem “inclui a função” ou “mapeado para a função”.
Não representam identidade entre pacotes completos:

- AdvanceTrac e VSA podem reunir funções adicionais ao controle de estabilidade.
- Disponibilidade e comportamento dependem de veículo, versão, ano, mercado
  e condições descritas pelo fabricante.
- A presença da função não estabelece a mesma calibração, desempenho,
  abrangência de sensores ou capacidade de condução autônoma.
- O exemplo não deve transportar a aplicação documentada da Transit para uma
  Ranger Raptor específica sem a respectiva evidência.

É uma alternativa mais delimitada para este filme do que tratar conjuntos
ADAS inteiros como sinônimos. A frase narrada “a função em comum” e a
preservação das diferenças de cada sistema mantêm essa distinção.

## O que já está representado no repositório

Auditoria limitada a código, migrations e dados locais versionáveis dos apps
API, AI e web. Não houve alteração de código, ativação de proposta ou consulta
direta ao banco de dados em execução.

| Evidência local                                                                                 | Conclusão permitida                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/data/curated-pickups.json`, definição `stability_control`, linha 867                  | A categoria “Controle de estabilidade” existe e sua definição exige preservar a implementação da marca nos qualificadores.                                            |
| Mesmo arquivo, observação da Hilux SRX Plus 2.8 AT Diesel, linha 1434                           | `qualifiers.manufacturer_term` conserva “VSC”, associado à categoria de estabilidade. A observação tem estado `CURATED_FROM_NOTES`, não validação primária nova.      |
| Identidade dessa Hilux nos dados curados                                                        | Ano 2026, `RESOLVED_FROM_NOTES`; o próprio registro informa que documentos de fabricante não foram verificados independentemente.                                     |
| `apps/api/src/main/resources/db/migration/V4__attribute_terminology.sql`                        | Há alias linguístico “controle de estabilidade”; o arquivo distingue aliases linguísticos de equivalências funcionais que exigem evidência separada.                  |
| `apps/api/src/main/resources/db/migration/V10__ontology_evolution.sql`                          | O modelo oferece termos de fabricante com marca, mercado, idioma, modelo, ano e referência de evidência. A migration consultada não ativa o trio AdvanceTrac/VSC/VSA. |
| `apps/api/src/main/java/com/fiap/ford/specsync/domain/ontology/Ontology.java`, método `resolve` | A resolução usa correspondência exata do termo e escopo; não infere equivalência por semelhança de nome.                                                              |

Não foram encontrados **AdvanceTrac** nem **VSA** no código ou nos dados de
produto examinados. **VSC** foi encontrado como termo preservado em uma
observação histórica e na fonte compilada Hilux, não como alias ativado nas
migrations examinadas. As ocorrências novas no roteiro e na voz do pitch não
são evidência de implementação do mapeamento no produto.

Na implementação visual, a cena está identificada como **“Exemplo explicativo
de normalização · fontes brasileiras”**. O mecanismo e a categoria são
existentes; o filme não demonstra o trio sendo resolvido numa consulta real
ao catálogo. A cobertura de termos ativados em outro ambiente de execução
não foi verificada nesta auditoria.

## Tempo por versão: referência e meta

O PDF fornecido pelo usuário,
[ford-desafios.pdf](/Users/tuba/Downloads/ford-desafios.pdf), foi conferido por
extração de texto e inspeção visual das páginas 5 e 6:

- A página 5 apresenta **“TEMPO ≈ 1 HORA POR VERSÃO”** como estimativa do
  processo manual descrito no briefing.
- A página 6, sob “AMANHÃ”, repete essa frase **riscada**, assim como o texto
  sobre processo manual. Não apresenta uma quantidade substituta de minutos.

Não foi localizada no PDF ou nos documentos de produção consultados uma
medição que demonstre o tempo obtido pelo SpecSync. A
[proposta original](./specsync-ford-video-pitch-proposal.md) já registra que
essa redução precisa ser medida separadamente. A edição condensada de uma
demonstração não fornece essa medição.

O roteiro atual explicita: **“A meta é clara: de cerca de uma hora por versão,
para minutos.”** A animação exibe **“META DO PILOTO · REDUÇÃO A VALIDAR”**.
Não é um resultado cronometrado: o material não deve receber percentual de
economia, quantidade exata de minutos ou linguagem de resultado já alcançado.

## Estado e evidências da produção

- Voz selecionada: ElevenLabs 01, `SpecSync Presenca 01`, configuração em
  `apps/pitch/src/data/eleven-voice.json`, mantida em velocidade natural.
- Composição atual: 175,9 segundos e 5.277 frames, com nova locução para
  ontologia e encerramento; duração confirmada na exportação.
- Trilha: `apps/pitch/public/audio/score-v4.wav`, original e procedural,
  adaptada à duração do storyboard e a palavras do novo encerramento.
- Pipeline: gera `apps/pitch/out/specsync-ford-pitch-v4.mp4` e atualiza a cópia
  canônica; preserva `specsync-ford-pitch-v3.mp4` e as versões anteriores.
- Os resultados de render, hashes, níveis de áudio, revisão lexical e QA
  documentados para a v3 pertencem à **v3**; não validam automaticamente a v4.
- A v4 possui checks, render, verificação integral e revisão visual próprios,
  concluídos conforme as evidências abaixo.
- README e PRODUCTION descrevem a entrega v4 concluída e sua reprodução,
  mantendo os resultados v3 explicitamente históricos.

## Verificação da exportação v4

Em **13/09/2026**, lint, typecheck e build passaram após formatação e
congelamento do código. O render concluiu em **1min44s**. A verificação,
registrada às **15:49:40 UTC / 12:49:40 de Brasília**, aprovou:

- 1920 × 1080, 30 fps, H.264 e áudio AAC estéreo;
- 175,9 segundos, 5.277 frames, oito cenas e 49 legendas;
- voz ElevenLabs 01 em velocidade natural e decodificação integral do MP4;
- cópia canônica idêntica à exportação v4, com **37.202.279 bytes**;
- Studio com 5.277 frames e sem erro de execução.

SHA-256 da v4:
`8271a2a42b0123681458da3bdc27bd66c10294d49980250131c89cd0f22b8fe5`.
A v3 preservada foi conferida com SHA-256
`f98a09b4e6ff5251cdad64d840298ecb81690c0596a5e42e26add6d025b6b3b0`.

O áudio final mediu **−16,24 LUFS, −1,88 dBTP e LRA de 8,4 LU**.
Evidências: [vídeo v4](../../apps/pitch/out/specsync-ford-pitch-v4.mp4),
[verificação preservada](../../apps/pitch/out/verification-v4.json),
[níveis de áudio](../../apps/pitch/out/audio-levels-v4.json),
[checks](../../apps/pitch/out/checks-v4.log),
[render](../../apps/pitch/out/render-v4.log) e
[verificação](../../apps/pitch/out/verify-v4.log).

A revisão visual incluiu oito stills de Close e 15 do grafo, com dois revistos
após correções de rodapé e nó central. Seis quadros extraídos do MP4 final
confirmaram legibilidade e encaixe das legendas:

- [Ontologia, 102 s](../../apps/pitch/out/ontology-v4.jpg).
- [Agentes, 115,5 s](../../apps/pitch/out/agents-v4.jpg).
- [Como entregamos, 153 s](../../apps/pitch/out/delivery-v4.jpg).
- [Uma hora, 159,4 s](../../apps/pitch/out/hour-v4.jpg).
- [Minutos, 164,2 s](../../apps/pitch/out/minutes-v4.jpg).
- [Raptor e convite, 172,9 s](../../apps/pitch/out/close-v4.jpg).

## Revisão lexical dos dois novos trechos

As duas falas foram transcritas por Gemini 2.5 Flash na Vertex AI sem receber
o texto esperado. O encerramento coincide com o roteiro após normalização
ortográfica. A ontologia tem todas as frases e somente a variação “Advance
Track” na grafia reconhecida de “AdvanceTrac”. Os seis arquivos restantes
são idênticos aos da v3 e conservam sua verificação, inclusive a segunda
transcrição da cena de comparação.

- [Método e resultado v4](../../apps/pitch/out/narration-v4-qa/README.md).
- [Relatório da ontologia](../../apps/pitch/out/narration-v4-qa/06-ontology.json).
- [Relatório do encerramento](../../apps/pitch/out/narration-v4-qa/08-close.json).

Isso é uma revisão automatizada das palavras, não prova de escuta humana,
avaliação de atuação, timbre ou qualidade de mixagem. Os relatórios preservam
transcrições, hashes dos áudios e respostas do serviço.
