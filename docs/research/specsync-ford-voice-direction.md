# SpecSync × Ford — direção de locução

Pesquisa consultada em 13 de setembro de 2026 UTC (12 de setembro no Brasil).

## Direção atual: ElevenLabs / publicidade automotiva

O usuário pediu uma interpretação mais “Raça Forte” e indicou o teaser oficial [Mudar o nível da competição era só o começo. Vem ai F-150 Raptor.](https://www.youtube.com/watch?v=u_FeNdhzCoM), do canal Ford Brasil. O vídeo tem 50 segundos e foi publicado em 28 de agosto de 2026. Em seguida, solicitou explicitamente testar ElevenLabs e forneceu acesso à API. Essa orientação substitui a preferência anterior pela atuação executiva discreta.

Foram geradas **três vozes originais com Voice Design v3 (`eleven_ttv_v3`)**, usando o mesmo roteiro de 60 palavras. O briefing descreve um locutor brasileiro entre 45 e 55 anos, baixo-barítono grave, ressonância de peito, textura áspera e rouca, dicção clara, pausas estratégicas e força controlada. As descrições são metas da direção; a escolha deve ser feita ouvindo os resultados.

O Voice Design retorna três prévias. Elas estão em `apps/pitch/out/voice-auditions/elevenlabs/eleven-presenca-01.mp3`, `eleven-presenca-02.mp3` e `eleven-presenca-03.mp3`, com 27,17, 27,64 e 28,03 segundos, respectivamente. Os arquivos para audição com volume normalizado usam o sufixo `-review.wav`. O manifesto `voice-design.json` guarda o texto, as configurações, os identificadores temporários das vozes geradas e hashes dos arquivos. As vozes ainda não foram adicionadas como vozes permanentes à conta.

A masterização usa `apps/pitch/scripts/master-voice-auditions.py`. As versões finais para audição ficam na subpasta `apps/pitch/out/voice-auditions/elevenlabs/mastered/`: `*-review.wav` contém a voz isolada e `*-com-trilha.wav` contém a mesma voz com a trilha original do pitch. A transcrição automática identificou o fechamento completo nas três amostras; não foi usada para classificar qualidade vocal.

O pedido reproduzível fica em `apps/pitch/src/data/voice-design-eleven.json`. O gerador `apps/pitch/scripts/generate-eleven-voice-design.py` usa `ELEVENLABS_API_KEY` ou entrada secreta com `getpass`, sem gravar a credencial no projeto. O teste inicial incluiu `quality`, que a API informou ser exclusivo do modelo v2; o pedido v3 foi corrigido e concluído. [API de Voice Design](https://elevenlabs.io/docs/api-reference/text-to-voice/design).

Nenhum áudio dos comerciais Ford foi enviado como referência de clonagem ou incorporado às amostras. O caminho usado foi a criação original por descrição. Para clonar a voz específica do locutor com Instant Voice Cloning, o ElevenLabs exige que o usuário confirme direito e consentimento. Em Professional Voice Cloning, o próprio locutor precisa criar e verificar a voz em sua conta e compartilhá-la. [Instant Voice Cloning](https://elevenlabs.io/docs/eleven-creative/voices/voice-cloning/instant-voice-cloning), [Professional Voice Clone de outra pessoa](https://elevenlabs.io/docs/help-center/product/voices/voice-cloning/can-i-create-a-professional-voice-clone-of-someone-elses-voice).

As amostras permanecem separadas do vídeo completo. A integração deverá alinhar a montagem e as legendas à interpretação escolhida.

## Limites dos testes anteriores

O vídeo de referência foi aberto no navegador para confirmar título, canal e duração. Houve análise multimodal automatizada com Gemini 2.5 Pro, mas os julgamentos de timbre se mostraram inconsistentes: algumas respostas descreveram características vocais e outras informaram ter recebido apenas transcrição. Portanto, os relatórios de avaliação guardados na pasta de trabalho não estabelecem qualidade perceptiva nem equivalência sonora com a referência.

Os testes C, D e E usaram Gemini; F e G usaram OpenAI Onyx. Eles ficam preservados como experimentos, sem substituir a locução do vídeo. A transcrição da tomada F não incluiu o último trecho do roteiro, motivo para não promovê-la à versão final. A tomada G usa um texto alternativo de 40 palavras em formato de manifesto. O teste ElevenLabs retoma o texto original de 60 palavras para comparar as três vozes nas mesmas condições.

## Primeiro teste de direção

As amostras usam **Gemini 2.5 Pro TTS**, pelo acesso Vertex AI já configurado, com duas interpretações do mesmo texto e da mesma voz. A direção preferida para uma reunião Ford é uma conversa segura de um especialista: curiosidade na pergunta, clareza no problema, uma pequena mudança de energia quando o produto aparece e convicção no fechamento.

O teste inicial com `gemini-3.1-flash-tts-preview` retornou áudio uma vez, descartado por uma validação de MIME sensível a maiúsculas que foi corrigida. As duas solicitações seguintes retornaram HTTP 400. Em vez de persistir nessa versão preview, as amostras foram produzidas com `gemini-2.5-pro-tts`. Isso documenta o resultado desta sessão; não estabelece uma taxa geral de confiabilidade dos modelos.

As amostras são um teste de direção. Elas ainda não substituem a locução do vídeo v2. Não houve comparação auditiva controlada entre fornecedores; não há fundamento para transformar o ranking por estrelas do texto de referência em uma classificação objetiva.

## O que mudar na locução

O gerador atual usa `pt-BR-AntonioNeural` pelo Edge TTS. Não recebe instruções de atuação. O código tenta aumentar a velocidade em passos de oito pontos percentuais quando o áudio excede o espaço da cena. Isso pode prejudicar as pausas e a progressão do argumento.

O novo processo deve começar pela intenção de cada passagem:

| Momento                | Intenção                                    | Tratamento                                                                           |
| ---------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------ |
| Desafio                | Reconhecer um trabalho que a equipe conhece | Pergunta direta, pausa para reflexão e peso factual em “uma hora por versão”         |
| Entrada do produto     | Mostrar uma possibilidade concreta          | Pequeno aumento de energia, pronúncia clara de SpecSync                              |
| Pesquisa e comparação  | Acompanhar o produto em uso                 | Verbos encadeados, pausas nas mudanças de ação, tempo para o olhar acompanhar a tela |
| Ontologia e evidências | Explicar por que a informação é confiável   | Clareza, ritmo ligeiramente mais calmo, termos técnicos sem solenidade               |
| Análise                | Dar espaço à decisão da equipe              | Perguntas interpretadas como perguntas, fechamento seguro                            |
| Futuro                 | Apresentar a próxima etapa                  | Entusiasmo contido; deixar audível que ainda queremos construir essas funções        |
| Encerramento           | Convidar à validação                        | Curto, resolvido e natural                                                           |

Humanização aqui significa variação de intenção, ritmo, acentuação e respiração. Risadas, sussurros, suspiros e hesitações artificiais não são necessários para este filme.

## Texto do teste

> Quanto tempo sua equipe precisa para entender um concorrente?
>
> No desafio apresentado pela Ford, a pesquisa manual leva cerca de uma hora por versão.
>
> Com o SpecSync, você começa pela pergunta. A plataforma busca informações na internet, compara especificações de veículos e mantém as fontes acessíveis.
>
> A equipe confere as evidências e avança para o que importa: a próxima decisão.

O texto tem 60 palavras. O tempo deve ser medido no áudio gerado. “Uma hora por versão” é atribuído ao desafio apresentado, sem alegar uma economia de tempo já medida. A pronúncia de trabalho de SpecSync é o composto inglês “spec sync”, aproximadamente “spék-sink”.

**A — Especialista executivo próximo:** voz Algieba; direção de aproximadamente 140 palavras por minuto, pergunta com curiosidade, pausa após o problema e convicção tranquila no final.

**B — Lançamento tech com energia contida:** mesma voz Algieba; direção de aproximadamente 150 palavras por minuto, mais brilho na entrada do produto e impulso nos verbos, desacelerando no fechamento.

As velocidades e as pausas no prompt são direções de atuação, não garantias temporais do modelo. O teste mantém texto e voz iguais para tornar a diferença de interpretação mais fácil de avaliar.

## Fornecedores e evidências

| Opção         | Verificado em documentação oficial                                                                                                                 | Uso proposto                                                                |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Gemini TTS    | `gemini-3.1-flash-tts-preview` e `gemini-2.5-pro-tts`; pt-BR; direção por linguagem natural; vozes predefinidas; acesso Vertex AI na região global | Amostras com 2.5 Pro; 3.1 preview apresentou erros nesta sessão             |
| Eleven v3     | Modelo `eleven_v3`; português; tags expressivas; pausas e controle de pronúncia documentados                                                       | Candidato a um teste posterior com voz brasileira escolhida por audição     |
| Hume Octave 2 | Português disponível em preview; `description` com instruções de atuação ainda consta como “coming soon” para a versão 2                           | Não assumir que entrega atualmente o mesmo controle de atuação em português |

Fontes primárias:

- [Google Cloud — Gemini TTS, modelos, idiomas e Vertex AI](https://docs.cloud.google.com/text-to-speech/docs/gemini-tts).
- [Google AI — direção de voz, cena, interpretação e roteiro](https://ai.google.dev/gemini-api/docs/speech-generation).
- [ElevenLabs — modelos](https://elevenlabs.io/docs/overview/models).
- [ElevenLabs — boas práticas de interpretação](https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices).
- [ElevenLabs — pausas e fonemas](https://elevenlabs.io/docs/help-center/technical/do-pauses-and-ssml-phoneme-tags-work-with-the-api).
- [Hume — diferenças entre versões](https://dev.hume.ai/docs/text-to-speech-tts/overview).
- [Hume — instruções de atuação e suporte por versão](https://dev.hume.ai/docs/text-to-speech-tts/acting-instructions).

## Integração com Remotion

1. Escolher a interpretação ouvindo sotaque, pronúncia da marca, pausas, ênfases e segurança no final das frases.
2. Fixar a voz e a direção geral; gerar cada cena com sua intenção específica, mantendo contexto de continuidade.
3. Conferir o áudio contra o roteiro. Modelos generativos podem omitir, acrescentar ou pronunciar palavras de modo inesperado.
4. Ajustar os cortes e o movimento da interface ao áudio escolhido. Preservar pausas de leitura visual e evitar acelerar a locução para cumprir durações preexistentes.
5. Alinhar novamente as legendas ao áudio, revisar transições e mixar a trilha abaixo da voz.

O roteiro e as instruções reproduzíveis ficam em `apps/pitch/src/data/voice-audition.json`. O gerador `apps/pitch/scripts/generate-voice-audition.py` usa Application Default Credentials, produz WAV PCM mono de 24 kHz e salva metadados sem credenciais. As amostras ficam em `apps/pitch/out/voice-auditions/`.

Para gerar uma amostra no projeto autorizado:

```bash
python3 apps/pitch/scripts/generate-voice-audition.py apps/pitch/src/data/voice-audition.json --take a-executivo-proximo --project fiap-challenge-ford --output-dir apps/pitch/out/voice-auditions
```

O gerador reutiliza uma amostra quando a requisição é idêntica e rejeita a substituição silenciosa de um arquivo de outra versão.

## Amostras entregues

| Amostra                      | Duração medida | Arquivo para audição                                               |
| ---------------------------- | -------------- | ------------------------------------------------------------------ |
| A — Executivo próximo        | 30,13 s        | `apps/pitch/out/voice-auditions/a-executivo-proximo-review.wav`    |
| B — Tech com energia contida | 26,17 s        | `apps/pitch/out/voice-auditions/b-tech-energia-contida-review.wav` |

Os arquivos para audição foram normalizados para volumes comparáveis: −16,14 e −16,23 LUFS, com pico verdadeiro de −1,5 dBTP. São WAV PCM de 48 kHz, derivados dos originais de 24 kHz; a conversão não aumenta o detalhe da gravação. Não houve alteração de velocidade. Os dois arquivos foram decodificados integralmente sem erros.

A transcrição automática, feita com Gemini 2.5 Flash sem receber o roteiro esperado, reconheceu português brasileiro e não indicou cortes finais. Na amostra A, o conteúdo correspondeu ao texto, desconsiderando pontuação e a separação gráfica de “Spec Sync”. Na B, o transcritor registrou “da internet” onde o roteiro usa “na internet”; pode ser uma variação da geração ou da transcrição e deve ser conferida na audição. Isso não muda a demonstração, mas reforça a necessidade de alinhar as legendas à tomada escolhida. Esta verificação automatizada não substitui a avaliação humana de naturalidade.

Metadados, transcrições e medidas ficam ao lado dos WAVs, em `apps/pitch/out/voice-auditions/`. O vídeo v2 e suas legendas continuam com a locução anterior até a escolha e a integração da nova interpretação.
