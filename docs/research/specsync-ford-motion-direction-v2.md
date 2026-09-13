# Direção visual v2 — SpecSync para Ford

Pesquisa e revisão em 12/13 de setembro de 2026. Esta revisão substitui a linguagem de apresentação da primeira versão por um filme de produto: a interface conduz a demonstração, com aproximações, entrada de painéis, digitação e continuidade de ações.

## Referências consultadas

| Referência                                                                                              | Evidência e uso                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Ford Digital Experience — EUA](https://www.ford.com/technology/ford-digital-experience/)               | Página aberta e inspecionada visualmente. Hero com o painel inteiro, fotografia em grande escala e texto simples sobre a imagem. O DOM mostrou FordMotion em navegação e títulos internos, com Antenna ainda presente em alguns elementos.                                 |
| [The All-New Ford Digital Experience — canal oficial Ford](https://www.youtube.com/watch?v=gua3EB5KjDU) | Foram inspecionados quadros em 0:00, 0:14 e 0:36. Pessoas em contexto alternam com detalhes em perspectiva das interfaces. Aplicação: tratar a interface como objeto de produto, alternando contexto e aproximação.                                                        |
| [Ford Pro AI — EUA](https://www.fordpro.com/en-us/intelligence/fleet-ai/)                               | Página e DOM inspecionados. O botão Watch Video usa RGB 6/111/239 (#066FEF), títulos usam Ford F-1 e textos/botões usam Inter. Headings em #001025 e presença visual de azul profundo/branco. A narrativa liga perguntas concretas a respostas baseadas em dados da frota. |
| [Introducing Ford Pro AI — canal oficial Ford Pro](https://www.youtube.com/watch?v=TVmxp_0BMik)         | Foram inspecionados quadros em aproximadamente 0:10, 0:31, 0:52 e 1:23. Interface conversacional em grande escala, poucos elementos e progressão de pergunta para resultado.                                                                                               |
| [Introducing Linear Agent](https://linear.app/changelog/2026-03-24-introducing-linear-agent)            | Player oficial aberto e reproduzido; abertura inspecionada em perspectiva, com a interface sobre fundo escuro. Página relaciona contexto disperso, pergunta, síntese e ação. Não há evidência de que este vídeo tenha sido feito em Remotion.                              |
| [Showcase oficial Remotion](https://www.remotion.dev/showcase)                                          | Galeria consultada pela web e pelo navegador. O shell da galeria abriu, mas os cards não foram disponibilizados nessa sessão; nenhum exemplo específico foi falsamente atribuído ou descrito como assistido.                                                               |
| [Typeframes — caso oficial Remotion](https://www.remotion.dev/success-stories/typeframes)               | Evidência documental complementar de utilização de Remotion Player e Lambda em produção de vídeos de produto. Não é uma certificação estética do nosso filme.                                                                                                              |

As observações de vídeo são análises de quadros e navegação nos players, não uma avaliação completa da trilha e de cada corte dos filmes. Não encontrei um manual público acessível que determine as curvas e durações do motion design Ford. As curvas de câmera e os tempos abaixo são decisões desta produção, inspiradas nas referências, não normas oficiais da marca.

## Sistema visual aplicado

- Azul profundo #00095B, azul de ação #066FEF, branco e preto azulado. Ambos os azuis foram verificados diretamente no DOM do site Ford Pro: #066FEF no botão Watch Video e #00095B nos itens da navegação.
- Inter local, também observada no site Ford Pro. A fonte proprietária Ford F-1 não foi copiada ou distribuída.
- Interface ocupando o quadro, sem cabeçalho numerado, rodapé corporativo, grade decorativa ou coluna lateral explicativa.
- Tipografia de abertura de aproximadamente 166 px; valores e conceitos em foco com 44–110 px. Metadados secundários menores. Resultados importantes recebem pausas; movimento ocorre na entrada, seleção e mudança de contexto.
- Câmera em perspectiva na entrada do produto e nos materiais futuros, máscaras direcionais e painel de evidências conectado ao cursor.
- Grafo espacial projetado deterministicamente, com relações e pulsos direcionais. Representação explicativa da ontologia, sem afirmar que seja uma tela funcional já entregue.
- Trilha instrumental original de 92 BPM, efeitos pontuais e mixagem voltada à locução.

## Demonstração e integridade

As cenas atuais combinam uma **reencenação editorial da interface existente** em React, com tipografia ampliada, e capturas reais do produto. O layout foi adaptado ao filme; não é uma gravação contínua nem uma interface nova já implementada. Dados, estados de revisão e limitações vêm das capturas da primeira produção. A análise inclui um resumo editorial identificado e retorna à resposta real.

A captura adicional `public/captures/11-catalog.png` registra o catálogo atual da Ranger. Sua consulta criou uma nova conversa de demonstração; não publicou dados. Ela é material de produção, não uma alegação de que o recorte BR 2027 exibido ali valide o recorte BR 2026 da comparação.

A cena futura tem identificação permanente e dados ilustrativos. Preços de referência no catálogo atual não equivalem à comparação futura de preços praticados no mercado. Não há promessa de resultados de produtividade medidos ou de emplacamentos/market share já integrados.

O resultado permanece com 160 segundos para caber no pitch de cinco minutos. A primeira exportação foi preservada como `out/specsync-ford-pitch-v1.mp4`.
