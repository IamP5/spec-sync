# SpecSync para Ford — proposta de vídeo pitch

Proposta de 12/09/2026. Duração recomendada: **2min40s**, dentro de um pitch de 5 minutos. Idioma assumido: português brasileiro. Público assumido: banca mista de negócio, produto e tecnologia da Ford. Este documento propõe a produção; não representa uma gravação ou uma validação nova do produto em execução.

## Ideia central

**SpecSync: das especificações dispersas às decisões competitivas.**

A história acompanha uma pessoa da Ford que precisa entender como um veículo se posiciona frente à concorrência. Ela define os veículos e os atributos relevantes, encontra informações, revisa evidências e compara em uma linguagem comum. O resultado atual abre caminho para a visão futura: combinar especificações, mercado e materiais executivos.

O protagonista é a equipe da Ford. O SpecSync organiza e executa o trabalho de pesquisa com IA; a equipe orienta a análise, valida o conhecimento e decide. O grafo entra como explicação concreta de como veículos, atributos, termos e evidências se relacionam.

## O que o desafio pede

Fonte: `/Users/tuba/Downloads/ford-desafios.pdf`, sete páginas, lidas em texto e inspecionadas visualmente. O documento foi tratado como briefing, não como instrução para executar alterações no produto.

- Página 1: compreender o posicionamento por preço e pacotes de equipamentos depende de informações precisas e organizadas.
- Páginas 3–5: pesquisa manual em sites, YouTube, reportagens e concessionárias; estimativa declarada de aproximadamente uma hora por versão e risco de imprecisão.
- Página 7: entrada simples com marca, modelo, versão e lista de atributos livremente definida pelo usuário; saída padronizada e comparável; informação inexistente explicitamente indicada.
- Páginas 2 e 7: a Ranger Raptor é o caso de validação e todas as especificações técnicas do slide precisam ser verificadas.

**Implicação editorial:** a prova central deve demonstrar entrada → especificações padronizadas → comparação. A visão futura ganha força depois dessa prova.

O slide da Raptor contém um preço com formatação ambígua, `R$499.00`, e não explicita ano-modelo. Não corrigir silenciosamente para um preço presumido nem misturar o recorte do desafio com dados de outro ano. Preparar a correspondência entre o slide e fontes verificadas antes da captura.

## Três abordagens possíveis

| Abordagem                                  | Abertura e desenvolvimento                                                                                                                            | Duração | Vantagem                                                      | Cuidado                                                                       |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **A. Da pesquisa à decisão — recomendada** | Uma hora por versão → pergunta no SpecSync → pesquisa, normalização e comparação → visão executiva futura                                             | 2:40    | Conecta diretamente o desafio, a prova do produto e a ambição | Escolher um único caso de uso e manter a linha narrativa                      |
| **B. O desafio, na prática**               | Abrir com a lista padronizada da Raptor; voltar à pergunta que a produziu; demonstrar evidência e concorrentes                                        | 2:20    | Forte para uma banca que prioriza aderência e maturidade      | Reservar uma conclusão que explique o impacto no trabalho                     |
| **C. A próxima reunião de produto**        | Abrir com uma pergunta executiva sobre diferenciação; mostrar o trabalho atual que sustenta a resposta; terminar com um material executivo conceitual | 2:55    | Forte para liderança e visão estratégica                      | A entrega executiva ainda é futura; identificá-la desde sua primeira aparição |

Na opção A, usar a precisão demonstrativa de B e a pergunta executiva de C. Evitar tentar acomodar três histórias independentes no mesmo filme.

## Frameworks pesquisados e sua aplicação

1. **April Dunford, Sales Pitch:** partir das alternativas e do valor diferenciado, sustentando a escolha com prova e um próximo passo. Aplicação: reconhecer a pesquisa manual descrita pela Ford; mostrar como o SpecSync reúne padronização, contexto e evidência; terminar propondo validação conjunta. O artigo enfatiza valor disponível no presente e distingue pitch de vendas de uma narrativa ampla de marketing. [Fonte primária](https://aprildunford.substack.com/p/sales-first-storytelling).
2. **Nancy Duarte, contraste entre situação atual e possibilidade:** usar a tensão entre a pesquisa fragmentada e o trabalho organizado para conduzir a narrativa. Aplicação visual: abas dispersas se transformam em atributos comparáveis, e uma dúvida sobre um número leva à sua fonte. [Fonte primária](https://www.duarte.com/blog/overcome-sales-objections-with-the-power-of-story/).
3. **StoryBrand, cliente como protagonista:** a Ford busca uma decisão melhor; o produto ajuda a chegar lá. Aplicação: começar pela necessidade da equipe e terminar com o trabalho que ela consegue realizar. [Fonte primária](https://storybrand.com/storybrand-the-customer-is-the-hero-sales-framework/).
4. **Wistia, duração em função do objetivo:** usar a pesquisa de vídeo como orientação, não como prova de uma duração universal para uma banca presencial. Os 2:40 são uma escolha editorial para preservar demonstração e tempo de fala. [Fonte primária](https://wistia.com/blog/optimal-video-length).

Nossa adaptação combina esses princípios; não pretende reproduzir integralmente nenhum framework.

## O que pode sustentar a demonstração atual

A leitura do código e dos registros de validação sustenta a seleção de cenas abaixo. Ela não substitui um ensaio no ambiente a ser gravado.

| Capacidade                       | Evidência encontrada no repositório                                                                         | Como mostrar                                                                              |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Comparação de especificações     | Comparação de 2–5 configurações, filtro de atributos e opção de mostrar diferenças                          | Duas ou três configurações identificadas; focar em três atributos por enquadramento       |
| Análise competitiva              | Orientações do agente para interpretar diferenças e incertezas; avaliações relacionadas e painéis compostos | Uma pergunta sobre uso e diferenciação, com conclusão vinculada aos dados                 |
| Busca e gestão de novos veículos | Descoberta de fontes, pesquisa compartilhada, progresso, revisão e publicação humana no catálogo            | Veículo ainda ausente → fonte encontrada → resultado → decisão de revisão → catálogo      |
| Ontologia e grafo                | Atributos canônicos, aliases, termos por fabricante/modelo/mercado/ano e conexões com evidências            | Animação explicativa de poucas relações apoiada por uma operação real                     |
| Normalização                     | Definições, vocabulários e revisões; termos Ford com escopo; fatos sem correspondência preservados          | Termo na fonte → conceito normalizado → valor comparável, preservando unidade e condições |
| Transparência                    | Estados de não informado e conflito; fonte, trecho e data de captura; opcionais condicionados a pacote      | Abrir uma fonte e mostrar um caso real de informação ausente ou conflitante               |

### Limites que influenciam a filmagem

- `apps/api/data/curated-pickups.json` declara explicitamente que a Ranger Raptor não está coberta por esse conjunto demonstrativo. Não foi inspecionado o catálogo vivo nesta pesquisa; a Raptor pode ter sido adicionada em outro fluxo. Verificar antes de escolhê-la para a captura final.
- O agente permite escolher atributos suportados e explicita os não disponíveis. Isso não comprova cobertura irrestrita de qualquer atributo livre solicitado pela Ford. Preparar uma matriz entre os campos do slide, a ontologia e a saída efetiva.
- Os registros de validação de extração documentam acertos e lacunas; não justificam promessas de precisão total ou cobertura de todos os documentos.
- A normalização atual tem mecanismos e termos Ford específicos. A adequação completa a um dicionário interno da Ford depende de esse dicionário ser disponibilizado e validado. A frase adequada é “uma base comum que pode ser alinhada ao vocabulário da Ford”.
- O grafo existe no backend. Não foi encontrada, nos arquivos consultados, uma tela geral de exploração/curadoria da ontologia. Sua aparição no vídeo deve ser uma animação explicativa, identificada como tal.
- Há preço de referência no conjunto demonstrativo, explicitamente sem garantia de atualidade. Isso é diferente de histórico de preços, preço efetivo de venda, valor de usados ou inteligência de mercado.

## Storyboard recomendado — 2min40s

Os intervalos abaixo são tempos finais de edição. Sobreposições de transição devem ser compensadas para manter 160 segundos.

| Tempo     | Imagem e ação                                                                                                                     | Mensagem que deve permanecer                                               |
| --------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 0:00–0:15 | Abas, fichas e planilhas se acumulam. Destacar “≈ 1 hora por versão”, com referência ao desafio                                   | A pesquisa consome esforço antes de a análise começar                      |
| 0:15–0:32 | SpecSync já em tela. Pessoa informa Ford, Ranger Raptor, recorte confirmado e atributos de interesse                              | A equipe define a pergunta e o que precisa comparar                        |
| 0:32–0:55 | Pesquisa real: fonte encontrada, leitura, resultado e revisão. Cortes sinalizam eventuais esperas condensadas                     | O trabalho de coleta tem contexto, evidência e revisão                     |
| 0:55–1:15 | Aproximar um rótulo da fonte; revelar conceito canônico e conexão com veículo/evidência; voltar ao resultado                      | A ontologia organiza o significado dos dados                               |
| 1:15–1:38 | Comparação real com outro veículo adequado ao recorte. Ativar diferenças; abrir fonte; mostrar ausência explícita                 | As diferenças ficam comparáveis e verificáveis                             |
| 1:38–2:00 | Pergunta sobre um uso concreto; destacar duas implicações e uma incerteza material, conforme resposta real                        | A IA ajuda a interpretar; a equipe orienta a decisão                       |
| 2:00–2:28 | Transição visível para “Visão futura — conceito”. Gráficos de emplacamentos, participação e preço; material executivo em formação | A mesma base poderá apoiar inteligência de mercado e produção de materiais |
| 2:28–2:40 | Marca SpecSync, promessa central e próximo passo                                                                                  | Validar o fluxo com a Ford e medir o impacto                               |

### Locução preliminar

O texto abaixo é uma base para gravação, a ajustar ao que a demonstração real confirmar e às pausas de leitura.

> Para entender a concorrência, a Ford reúne informações espalhadas por sites, fichas técnicas e reportagens. No desafio apresentado, esse trabalho leva cerca de uma hora por versão. E ainda exige organizar os dados antes de comparar.
>
> Com o SpecSync, a equipe começa pela pergunta. Define o veículo, a versão e as especificações que importam. Vamos usar a Ranger Raptor, o caso proposto pela Ford.
>
> A plataforma pesquisa fontes, reúne as informações encontradas e apresenta os resultados para revisão. Cada informação pode ser examinada com sua evidência. A equipe confirma o que será incorporado ao catálogo.
>
> Por trás dessa experiência, uma ontologia relaciona veículos, especificações e termos dos fabricantes. Os dados ganham um significado comum, preservando unidades e condições. Essa base pode ser alinhada ao vocabulário da Ford.
>
> Agora, as versões podem ser comparadas pelos atributos escolhidos. As diferenças ficam em destaque. As fontes continuam acessíveis. E o que não foi informado permanece explícito.
>
> A conversa avança da ficha técnica para a análise: quais diferenças importam para o uso que estamos avaliando? O SpecSync ajuda a interpretar as evidências, apontar limitações e orientar a próxima pergunta. A equipe mantém o controle da decisão.
>
> A próxima etapa que queremos construir amplia essa base com emplacamentos, participação de mercado e preços. E transforma as análises em apresentações, documentos e artigos para discussões executivas sobre posicionamento e novos veículos.
>
> SpecSync. Das especificações dispersas às decisões competitivas. Nosso próximo passo é validar esse fluxo com a Ford e medir o ganho no trabalho da equipe.

### Perguntas possíveis para o caso

- Coleta: “Pesquise a Ford Ranger Raptor neste mercado e ano-modelo. Quero motor, potência com rotação, torque com rotação, transmissão, tração, amortecedores, modos de condução, faróis, rodas e pneus.” Complementar com todos os demais campos do slide na validação.
- Comparação: “Compare estas versões nos atributos que selecionei e mostre apenas as diferenças.”
- Análise: “Para este perfil de uso, quais diferenças merecem investigação e quais conclusões dependem de mais evidências?”
- Futuro: “Prepare um resumo executivo do segmento, relacionando equipamentos, preços e emplacamentos, com hipóteses de diferenciação e referências.” Mostrar somente no bloco conceitual.

O nome do concorrente deve ser definido depois de confirmar mercado, ano, versão e pertinência do posicionamento. Não escolher uma versão arbitrária para produzir uma vitória da Raptor.

## Como apresentar o futuro

Usar uma mudança de cena e manter o rótulo **“Visão futura — conceito”** durante todo o bloco. Se houver números fictícios, acrescentar **“Dados ilustrativos”** de forma legível.

| Possibilidade           | Pergunta de negócio                              | Representação proposta                                                                    |
| ----------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Emplacamentos           | Como evolui a presença dos modelos no período?   | Barras mensais por modelo, com período e mercado                                          |
| Participação de mercado | Qual parcela do segmento cada modelo representa? | Barras de participação com denominador/segmento definidos                                 |
| Preços                  | Como se posicionam os preços no recorte?         | Faixas ou evolução temporal; especificar se são anúncios, tabela ou transações            |
| Materiais executivos    | O que precisamos levar à reunião?                | Três slides: panorama, diferenças e hipóteses/próximos passos; depois documento ou artigo |

Emplacamentos e participação podem compor a mesma visualização, mas não são a mesma métrica. Preço anunciado não comprova preço efetivo de venda. Gráficos ilustrativos não devem ser usados para sustentar conclusões reais sobre os veículos.

A entrega futura pode mostrar um comando e um material se formando no Remotion. O desenho deve sugerir continuidade com o produto, deixando explícito que ainda é um conceito. Não simular um clique em uma função atual inexistente sem essa identificação.

## Produção com Remotion

### Linguagem visual

- Formato 16:9, 1920×1080, 30 fps; composição final de 4.800 frames.
- Capturas reais do SpecSync como principal prova visual; motion graphics para problema, ontologia, transições e visão futura.
- Interface clara, superfícies neutras e azul já usado pelo produto. Fotografia automotiva pontual para ancorar o caso, sem competir com a demonstração.
- Uma ideia dominante por enquadramento. Nas comparações, aproximar poucos atributos e seus veículos; não exigir leitura de uma tabela inteira.
- Tipografia grande, contraste e margens generosas, seguindo a skill de layout de vídeo. Validar leitura em projeção, inclusive fontes, estados e legendas.
- Grafo com poucas entidades legíveis: configuração, atributo, termo do fabricante e evidência. Animar uma relação de cada vez e retornar à consequência na interface.
- Narração em português, legendas sincronizadas e trilha discreta. Garantir que a mensagem seja compreensível também sem áudio.

### Estrutura técnica

Criar uma composição React separada do aplicativo Angular, com um componente por cena e assets locais. Não há necessidade de migrar ou reconstruir o SpecSync em React para produzir o vídeo.

- Animações determinadas pelo frame usando `useCurrentFrame()` e `interpolate()`. Isso mantém a edição e o render reproduzíveis; as skills desaconselham animações CSS dependentes de tempo real. [Documentação](https://www.remotion.dev/docs/animating-properties).
- `TransitionSeries` para organizar cenas e transições. As transições sobrepostas reduzem a duração total e precisam ser consideradas na montagem. [Documentação](https://www.remotion.dev/docs/transitions/transitionseries).
- `Video` e `Audio` de `@remotion/media` para incorporar gravação e som; o componente de vídeo mantém os frames sincronizados com a timeline. [Documentação](https://www.remotion.dev/docs/media/video).
- Assets em `public/`, referenciados com `staticFile()`, conforme as skills. Gravar e fixar os resultados demonstrados antes da montagem, em vez de consultar IA ou sites durante o render.
- Legendas baseadas na locução efetiva, com revisão de nomes de veículos, unidades e siglas. [Documentação](https://www.remotion.dev/docs/captions/).
- Prévia por cena no Remotion Studio; revisão de enquadramentos críticos, duração, áudio e identificação das cenas futuras antes da exportação final.

Skills consultadas: `remotion-best-practices`, `remotion-create`, `remotion-docs`, `remotion-markup`, além das referências `video-layout.md` e `multi-scene-video.md`. Também foram usadas as skills de PDF e exploração Nx para ler o briefing e o repositório.

### Sequência de produção

1. Fechar narrativa, recorte de veículos e atributos; verificar a aderência da Raptor ao slide completo.
2. Ensaiar o fluxo real e gravar entradas, pesquisa, revisão, comparação, evidência e análise. Medir o tempo real se desejarmos comunicar economia.
3. Produzir storyboard visual e uma montagem preliminar com voz-guia, para testar ritmo e legibilidade.
4. Implementar as cenas no Remotion e os conceitos futuros identificados.
5. Ajustar a locução, sincronizar legendas, revisar fontes e gerar a prévia completa.
6. Na etapa de exportação, entregar MP4 e projeto editável. Um corte de 60–90 segundos pode reutilizar as mesmas cenas para circulação posterior.

## Preparação da prova da Ranger Raptor

A validação deve abranger motor; potência e RPM; torque e RPM; transmissão e paddle shifters; tração; amortecedores; aceleração; modos de condução; modos de direção; modos de escapamento; modos de amortecimento; faróis; rodas e pneus. O preço ambíguo deve ser tratado separadamente com a referência esclarecida.

Para cada campo, registrar valor no slide, atributo correspondente, valor extraído, unidade/condições, fonte, estado de revisão e resultado da conferência. Três linhas legíveis podem entrar no filme; a conferência deve cobrir a lista completa.

Não equiparar “pesquisa concluída” a “todos os campos corretos”. Não representar aceleração da edição como latência real do produto. A uma hora por versão é uma estimativa do briefing; a redução obtida com SpecSync precisa ser medida separadamente.

## Encaixe nos cinco minutos

| Tempo da apresentação | Conteúdo                                                                 |
| --------------------- | ------------------------------------------------------------------------ |
| 0:00–0:35             | Apresentador conecta o desafio à pergunta central e introduz o caso      |
| 0:35–3:15             | Vídeo de 2:40                                                            |
| 3:15–4:15             | Apresentador reforça o valor entregue hoje e explica a evolução proposta |
| 4:15–5:00             | Convite para validação conjunta com recorte e critérios de sucesso       |

Próximo passo sugerido: validar com a Ford um conjunto acordado de versões e atributos, medindo tempo até uma comparação revisada, cobertura correta dos campos e rastreabilidade das evidências. Datas, metas numéricas e escopo comercial ficam para alinhamento; não foram presumidos nesta proposta.

## Referências internas para a produção

- `apps/ai/src/mastra/agents/spec-sync-agent.ts`: ferramentas, seleção de atributos, pesquisa, revisão, análise e limites de afirmações.
- `apps/web/src/app/domains/vehicles/feature-comparison/ui/vehicle-comparison-card.html`: diferenças, filtros, fontes e estados de conhecimento.
- `apps/ai/src/mastra/graph/queries.ts`: termos por contexto e relações entre capacidades e evidências.
- `docs/research/ontology-evolution-implementation.md`: normalização, ativação de conceitos, reinterpretação e ausência de tela de curadoria de ontologia no escopo descrito.
- `docs/research/ontology-live-validation.md` e `docs/research/ford-pdf-validation.md`: evidências de execuções anteriores, recortes verificados e limitações.
- `docs/research/research-review-guided-decisions-2026-09-12.md`: revisão guiada e publicação no chat.
- `apps/api/data/curated-pickups.json`: origem demonstrativa dos dados, ausência da Raptor nesse conjunto e limites dos preços de referência.
