# Legenda & Audiodescrição Viva: estúdio local de auditoria de legendas e apoio à audiodescrição

**Arthur Alves Ferreira (Ferreira, A. A.)**
OlacDev · <https://olacdev.com/>

*Artigo técnico-científico — versão de trabalho (pré-print interno). Não publicado em repositório de dados. Sem DOI atribuído nesta versão.*

---

## Resumo

Legendas geradas automaticamente e fluxos de audiodescrição artesanais concentram falhas justamente nos critérios que a WCAG 2.2 exige para conteúdo pré-gravado: identificação de falantes e de sons relevantes (1.2.2), descrição de informação visual (1.2.3) e audiodescrição quando há pausas suficientes no áudio (1.2.5). Ferramentas de correção costumam ser pagas, dependem de envio de mídia a servidores de terceiros ou não oferecem diagnóstico mensurável. Este trabalho apresenta o **Legenda & Audiodescrição Viva**, um estúdio web *client-side* que (i) audita arquivos `.srt`/`.vtt` por regras determinísticas (CPS, CPL, número de linhas, duração, sobreposição e trechos vazios), (ii) identifica janelas temporais com 3 s ou mais entre falas, candidatas a audiodescrição, (iii) confirma essas janelas contra silêncios reais detectados localmente no áudio, (iv) apoia a redação das descrições com pré-escuta por síntese de voz e (v) exporta trilha `descriptions.vtt`, transcrição descritiva, relatório em Markdown e JSON. O aplicativo não realiza requisições de rede após o carregamento, tem política de segurança de conteúdo restritiva e é validado por 52 testes automatizados. Discutem-se limites do indicador de conformidade e a distinção entre triagem automatizada e auditoria humana.

**Palavras-chave:** acessibilidade digital; legendas; audiodescrição; WCAG 2.2; WebVTT; tecnologia assistiva; privacidade.

## 1. Introdução

A legenda é, para pessoas surdas ou com deficiência auditiva, a única via de acesso ao conteúdo falado; para pessoas com deficiência visual, a audiodescrição é a via de acesso ao conteúdo visual. Ambas são tecnologias assistivas de baixo custo relativo e alto impacto, e ambas são exigidas por norma: no Brasil, a Lei Brasileira de Inclusão (Lei nº 13.146/2015) e a ABNT NBR 15290 tratam da acessibilidade na comunicação; internacionalmente, as Diretrizes de Acessibilidade para Conteúdo Web (WCAG) 2.2 estabelecem os critérios de sucesso 1.2.2 (legendas), 1.2.3 (audiodescrição ou alternativa em mídia alternativa) e 1.2.5 (audiodescrição).

Na prática, três obstáculos se repetem em equipes pequenas — escolas, ONGs, produtores independentes e setores públicos:

1. **Diagnóstico ausente.** Legendas automáticas são aceitas sem medição de velocidade de leitura (caracteres por segundo, CPS) ou de comprimento de linha (caracteres por linha, CPL), gerando trechos ilegíveis mesmo quando o texto está "correto".
2. **Informação não verbal omitida.** Sons ambientais e musicais relevantes (`[música tensa]`, `[porta batendo]`) e a identificação de falantes são justamente o que diferencia legenda descritiva de transcrição literal.
3. **Fluxo de audiodescrição fragmentado.** Encontrar onde a descrição cabe — sem cobrir diálogo — exige escutar o áudio repetidas vezes, e gerar a trilha no formato aceito pelo player exige conhecimento de WebVTT.

Ferramentas comerciais resolvem parte disso, mas cobram por licença, exigem upload de mídia e raramente expõem o critério de decisão. Este artigo descreve uma alternativa determinística e local, com código aberto.

**Objetivo.** Apresentar o desenho, a implementação e a validação de um estúdio web que audita legendas, localiza janelas para audiodescrição e produz artefatos prontos para revisão humana, sem enviar dados a servidores.

## 2. Fundamentação

### 2.1 Métricas de legibilidade

A velocidade de leitura de legendas é convencionalmente limitada a 17–20 caracteres por segundo, faixa adotada por guias de legendagem profissionais e por recomendações derivadas da EBU. Acima de 20 CPS, a leitura deixa de ser confortável para a maior parte do público, e para leitores com baixa visão ou dificuldades cognitivas o efeito é mais severo. O comprimento de linha, por sua vez, deve permanecer em torno de 42 caracteres, com no máximo duas linhas, para reduzir o movimento sacádico de retorno.

### 2.2 Audiodescrição e janelas de fala

A audiodescrição inserida (SC 1.2.5) pressupõe silêncio suficiente para descrever sem sobrepor fala. Quando não há pausas, a norma admite audiodescrição estendida — pausar o vídeo —, o que muda o fluxo de reprodução. Identificar automaticamente intervalos entre legendas com duração mínima de 3 s produz uma lista de candidatos verificável; a decisão final permanece humana, pois só o autor sabe o que é visualmente relevante.

### 2.3 Privacidade como requisito de projeto

Mídia de terceiros (aulas, entrevistas, depoimentos) frequentemente contém dados pessoais. Um fluxo que exige upload cria obrigações de tratamento de dados que equipes pequenas não têm estrutura para assumir. Processar tudo no navegador elimina essa transferência e simplifica a conformidade com a LGPD.

## 3. Método

### 3.1 Arquitetura

Aplicação estática, sem dependências de execução, organizada em cinco módulos independentes e testáveis isoladamente:

| Módulo | Responsabilidade |
| --- | --- |
| `parser.js` | Leitura de `.srt` e `.vtt`: timestamps (com e sem hora), remoção de BOM, normalização de CRLF, descarte de blocos `NOTE`/`STYLE`/`REGION`, remoção de tags de posicionamento, ordenação por tempo |
| `audit.js` | Regras determinísticas por trecho e entre trechos; cálculo de estatísticas e índice de conformidade |
| `descriptions.js` | Construção de cues de audiodescrição, exportação WebVTT, transcrição descritiva e relatório |
| `audio.js` | Decodificação local via Web Audio API e detecção de silêncios por janelas RMS com limiar em dB |
| `app.js` | Interface: entrada, renderização, edição das descrições, pré-escuta, downloads |

Cada módulo usa o padrão UMD mínimo, permitindo uso no navegador (`window.SubtitleAudit`) e em Node (`require`), o que viabiliza os testes automatizados sem navegador.

### 3.2 Regras de auditoria

| Regra | Limite | Severidade |
| --- | --- | --- |
| CPS | > 17 aviso; > 20 erro | aviso / erro |
| CPL | > 42 aviso; > 46 erro | aviso / erro |
| Linhas por trecho | > 2 | aviso |
| Duração | < 1 s ou > 7 s | aviso |
| Sobreposição temporal | início de um trecho antes do fim do anterior | erro |
| Trecho vazio | sem caracteres após remoção de tags | erro |
| Janela de audiodescrição | intervalo ≥ 3 s | informativo |

O CPS é calculado como caracteres não brancos, descontadas tags HTML, divididos pela duração em segundos. O índice de conformidade parte de 100 e desconta 4 pontos por erro e 1,5 por aviso, truncado em [0, 100]. Trata-se de um indicador de triagem — não de uma certificação de conformidade — e esse limite é declarado na interface e no relatório gerado.

### 3.3 Detecção de silêncios

O áudio é decodificado localmente (`decodeAudioData`), convertido a mono por média dos canais e analisado em janelas de 50 ms. Para cada janela calcula-se o RMS e o nível em dB (`20·log10(rms)`); janelas abaixo de −40 dB são marcadas como silenciosas, e sequências contínuas de ao menos 1 s são reportadas. O resultado é cruzado com as janelas entre legendas para indicar coincidência.

### 3.4 Geração de artefatos

- **`descriptions.vtt`**: um cue por janela preenchida, iniciando após o começo da janela (deslocamento de até 500 ms proporcional à folga) e terminando no fim da janela.
- **Transcrição descritiva**: linhas ordenadas no tempo, com falas e descrições intercaladas, marcadas com `AUDIODESCRIÇÃO:`.
- **Relatório Markdown/JSON**: estatísticas, lista de achados com regra e sugestão, janelas e descrições, além de nota metodológica.

## 4. Validação

A suíte usa `node:test`, sem dependências externas, com 52 testes distribuídos em cinco arquivos:

| Arquivo | Foco | Testes |
| --- | --- | --- |
| `parser.test.js` | formatos, timestamps, ordenação, BOM/CRLF, erros de entrada | 11 |
| `audit.test.js` | CPS, CPL, linhas, duração, sobreposição, janelas, índice | 17 |
| `descriptions.test.js` | trilha VTT, transcrição, relatório | 6 |
| `audio.test.js` | silêncios sintéticos, limiar, bordas do sinal | 8 |
| `page.test.js` | integridade da página: referências locais, rótulos, CSP, créditos | 9 |

Os testes de áudio usam sinais sintéticos com taxa de amostragem reduzida (1 kHz) para tornar as asserções determinísticas. Os testes de página verificam que todo arquivo referenciado existe e que todo campo de formulário possui rótulo associado — barreiras comuns e baratas de detectar.

Resultado da execução: **52 testes, 52 aprovados, 0 falhas**.

## 5. Acessibilidade da própria ferramenta

Uma ferramenta de acessibilidade precisa ser acessível. Foram adotados: HTML semântico com região `main` única; link de salto; foco visível de 3 px com deslocamento; rótulos explícitos em todos os campos; `role="status"` com `aria-live="polite"` para todo retorno do sistema; contraste AA nos temas claro e escuro; respeito a `prefers-color-scheme`, `prefers-reduced-motion` e estilos de impressão; tamanho de alvo de toque adequado nos controles principais.

Limitação declarada: o processamento depende de JavaScript, pois é executado inteiramente no cliente. A página informa isso e não promete funcionamento sem script.

## 6. Limitações

1. **Triagem, não auditoria final.** As regras não avaliam sincronia fina, segmentação semântica, nem adequação cultural das descrições.
2. **Dependência de entrada bem formada.** Arquivos com timestamps corrompidos podem perder trechos silenciosamente; o parser sinaliza apenas ausência total de cues válidos.
3. **Detecção de silêncio sensível a mixagem.** Ruído de fundo acima do limiar faz janelas reais desaparecerem; o limiar é fixo em −40 dB nesta versão.
4. **Sem verificação automática de conteúdo.** Identificar `[música tensa]` ausente exigiria comparação com o áudio, fora do escopo atual.
5. **Sem teste com usuários nesta etapa.** A validação é técnica e normativa; um estudo com legendistas e audiodescritores é o próximo passo metodológico.

## 7. Trabalhos relacionados

Ferramentas de legendagem profissional (por exemplo, editores dedicados com controle de CPS) oferecem métricas semelhantes, mas são proprietárias e orientadas a fluxo de estúdio. Validadores de acessibilidade web avaliam a presença de faixas de legenda no HTML, não a qualidade do arquivo. Plataformas de vídeo geram legendas automáticas com boa cobertura lexical e baixa descrição de sons não verbais. O presente trabalho se posiciona no intervalo entre esses três: diagnóstico de qualidade do arquivo, apoio à audiodescrição e custo zero de infraestrutura.

## 8. Conclusão

O Legenda & Audiodescrição Viva demonstra que uma parcela relevante do controle de qualidade de legendas e do fluxo inicial de audiodescrição pode ser resolvida com regras explícitas, executadas localmente, em uma aplicação estática. O ganho não é substituir o profissional, mas dar a ele um diagnóstico mensurável e um rascunho estruturado, reduzindo retrabalho e tornando o critério de decisão auditável. Como continuação, prevê-se: limiar de silêncio ajustável, exportação de `SRT` corrigido, verificação de consistência de identificação de falantes e estudo de usabilidade com legendistas e audiodescritores.

## Referências

ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS. **NBR 15290**: Acessibilidade em comunicação na televisão. Rio de Janeiro: ABNT, 2005.

BRASIL. **Lei nº 13.146, de 6 de julho de 2015**. Institui a Lei Brasileira de Inclusão da Pessoa com Deficiência (Estatuto da Pessoa com Deficiência). Brasília, DF: Presidência da República, 2015.

BRASIL. **Lei nº 12.527, de 18 de novembro de 2011**. Lei de Acesso à Informação. Brasília, DF, 2011.

BRASIL. **Lei nº 13.709, de 14 de agosto de 2018**. Lei Geral de Proteção de Dados Pessoais (LGPD). Brasília, DF, 2018.

EUROPEAN BROADCASTING UNION. **EBU Tech 3343**: Guidelines for production and implementation of subtitles. Genebra: EBU, 2016.

FERREIRA, A. A. **Legenda & Audiodescrição Viva**: estúdio local de auditoria de legendas e apoio à audiodescrição. 2026. Software. Disponível em: <https://github.com/ArthurAlvDev/midia-acessivel-studio>.

W3C. **Web Content Accessibility Guidelines (WCAG) 2.2**. Recommendation. 2023. Diretriz 1.2 — Time-based Media. Disponível em: <https://www.w3.org/TR/WCAG22/>.

W3C. **WebVTT: The Web Video Text Tracks Format**. Candidate Recommendation Draft. 2024. Disponível em: <https://www.w3.org/TR/webvtt1/>.

---

### Nota sobre publicação

Este texto é um pré-print interno. **Não houve submissão a periódico nem depósito em repositório de dados nesta etapa.** A versão citável do software é o repositório público indicado acima, sob licença MIT.
