# Amarok brasileira — evidências para comparação v7

Consulta em **13/09/2026**, limitada a fontes oficiais da Volkswagen do
Brasil. Referência comercial: **Amarok V6 Extreme**, incluída na página
brasileira vigente, que também identifica a atualização **MY26**. Não foram
usadas especificações da Amarok global de outro mercado. Código e dataset
da comparação permanecem inalterados por esta pesquisa.

## Fontes e aplicabilidade

- **P1 — [Amarok, Volkswagen do Brasil](https://www.vw.com.br/pt/carros/amarok.html):**
  resumo técnico, seções “Motor”, “Mais potência para o campo”, “V6 Extreme”,
  FAQ e “AdBlue® (Arla 32): nova tecnologia da Amarok MY26”. Os dados de
  motorização são apresentados para a linha V6; equipamentos específicos da
  Extreme aparecem separadamente.
- **M1 — [Manual Amarok MY26 Brasil][manual]:** edição 08/2025, listado como
  “Amarok 2026” na [biblioteca oficial de manuais](https://www.vw.com.br/pt/servicos-e-acessorios/servicos-e-produtos/manuais-e-garantia/manuais.html).
  Tabelas gerais; não discriminam Extreme. Páginas citadas são as impressas.

## Sete linhas propostas para a tabela do vídeo

| Campo         | Valor / unidade                                       | Fonte e locator                                                 | Trecho literal curto / limite                                            |
| ------------- | ----------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Motor         | 3.0 V6 TDI, turbodiesel                               | P1, “Motor”                                                     | “V6 3.0 TDI”                                                             |
| Potência      | **258 cv nominais**; **272 cv em overboost por 10 s** | P1, “Motor” e “Mais potência para o campo”                      | “258 cv”; não apresentar o pico temporário como potência contínua        |
| Transmissão   | Automática, **8 velocidades**                         | P1, resumo técnico inicial                                      | “Automática de 8 velocidades”                                            |
| Tração        | **4Motion, 4×4 permanente**                           | P1, resumo técnico inicial                                      | “4Motion (4x4 Permanente)”                                               |
| Torque        | **580 Nm**; a página também informa 59,1 kgfm         | P1, FAQ sobre potência no campo; seção “Motor”                  | “580 Nm”; alternativa mais comparável à contagem de modos                |
| Entre-eixos   | **3.097 mm**                                          | [M1, p.268, tabela “Dimensões”, linha G][manual268]             | “Distância entre eixos”; tabela do modelo básico, sem divisão por versão |
| Imersão em mm | **Sem medida em mm confirmada para MY26**             | [M1, p.107, “Travessia de trechos alagados em ruas”][manual107] | Limite físico: “borda inferior da carroceria”; velocidade de passo       |

A página comercial relaciona a linha V6 e a Extreme, mas não representa uma
auditoria de um chassi individual. Para a célula de imersão, usar **“Sem
medida em mm”**; no painel de evidências, explicar o limite físico descrito.
Não converter esse limite em milímetros nem transportar o número de outro
ano-modelo. Modos de transmissão, funções off-road e modos de terreno não
devem virar uma contagem única como se fossem categorias equivalentes.

## Fatos adicionais e divergências

- **Reboque:** [M1 p.269][manual269] informa **2.705–2.740 kg com freio** e
  **750 kg sem freio**, ambos em aclives até **8%**. Não há associação dos
  extremos da faixa à versão Extreme. Não escolher um deles por inferência.
- **0–100 km/h:** [M1 p.269][manual269] informa **8,1 s**, para modelo básico;
  P1 divulga **8 s**. Registrar a divergência de precisão; não atribuir 8,1 s
  a um ensaio específico da Extreme.
- **Condições:** M1 pp.266/268 admite variações por configuração e prioriza
  os documentos do veículo. A tabela não é homologação individual.

Recomendação editorial: manter **258 cv** no valor principal, com overboost
como qualificador; preferir **torque** à contagem de modos. Reboque e
aceleração ficam documentados, sem necessidade de entrar nas sete linhas
escolhidas. Não preencher a lacuna de imersão apenas para completar o quadro.

## Evidência local

O PDF oficial foi baixado, o texto extraído e as páginas 107, 268 e 269
inspecionadas visualmente:

- [PDF local](../../apps/pitch/out/research-v7/amarok/Manual_Amarok_MY26_Brasil.pdf)
- [Texto extraído](../../apps/pitch/out/research-v7/amarok/Manual_Amarok_MY26_Brasil.txt)
- [p.107 — travessia](../../apps/pitch/out/research-v7/amarok/manual-p107.png)
- [p.268 — dimensões](../../apps/pitch/out/research-v7/amarok/manual-p268.png)
- [p.269 — motorização e cargas](../../apps/pitch/out/research-v7/amarok/manual-p269.png)

SHA-256 do PDF:
`0005816506eabffedb390fac4a1630c30770440a01740c9ae6dea25534e58b14`.
No visualizador PDF, as páginas impressas 107/268/269 correspondem às
páginas físicas 108/269/270. A pesquisa não executou o produto nem alterou
README, PRODUCTION ou dados de comparação.

[manual]: https://www.vw.com.br/idhub/content/dam/onehub_pkw/importers/br/literatura-de-bordo/manual-amarok/my26/Manual%20de%20instru%C3%A7%C3%B5es_Amarok_MY26_Brasil.pdf
[manual107]: https://www.vw.com.br/idhub/content/dam/onehub_pkw/importers/br/literatura-de-bordo/manual-amarok/my26/Manual%20de%20instru%C3%A7%C3%B5es_Amarok_MY26_Brasil.pdf#page=108
[manual268]: https://www.vw.com.br/idhub/content/dam/onehub_pkw/importers/br/literatura-de-bordo/manual-amarok/my26/Manual%20de%20instru%C3%A7%C3%B5es_Amarok_MY26_Brasil.pdf#page=269
[manual269]: https://www.vw.com.br/idhub/content/dam/onehub_pkw/importers/br/literatura-de-bordo/manual-amarok/my26/Manual%20de%20instru%C3%A7%C3%B5es_Amarok_MY26_Brasil.pdf#page=270
