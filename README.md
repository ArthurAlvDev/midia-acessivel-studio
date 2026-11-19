# Legenda & Audiodescrição Viva

Estúdio web **100% local** para auditar legendas (`.srt` / `.vtt`), medir velocidade de leitura (CPS) e comprimento de linha (CPL), encontrar **pausas naturais para audiodescrição** e exportar trilha `descriptions.vtt`, transcrição descritiva e relatório.

Nenhum arquivo é enviado a servidores: todo o processamento acontece no navegador.

- Site: <https://legenda.olacdev.com>
- Licença: MIT
- Feito por **OlacDev** — <https://olacdev.com/>

## Por que existe

Legendas automáticas erram justamente no que a WCAG 1.2.2 exige: identificação de falantes, sons relevantes (`[música tensa]`, `[porta batendo]`), ritmo de leitura e quebra de linha. E cumprir a audiodescrição (WCAG 1.2.3 / 1.2.5) costuma depender de softwares de estúdio pagos.

Esta ferramenta cobre o diagnóstico e o rascunho:

1. **Auditoria determinística** — CPS, CPL, número de linhas, duração, sobreposição e trechos vazios, com referência à regra violada.
2. **Janelas de audiodescrição** — intervalos de 3 s ou mais entre falas, prontos para receber descrição escrita.
3. **Confirmação por áudio** — detecção local de silêncios reais (Web Audio API, limiar de −40 dB) para validar as janelas.
4. **Exportação** — `descriptions.vtt` (`<track kind="descriptions">`), transcrição descritiva em texto, relatório `.md` e `.json`.
5. **Pré-escuta** — leitura da descrição com a voz do sistema antes de gravar.

## Como usar

1. Abra o site (ou sirva a pasta localmente).
2. Envie o `.srt`/`.vtt` ou cole o conteúdo.
3. Leia o resumo e a tabela de achados.
4. Escreva as descrições nas janelas encontradas.
5. Exporte a trilha, a transcrição e o relatório.

Opcional: envie o áudio do vídeo para cruzar silêncios reais com as janelas de legenda.

## Regras verificadas

| Regra | Limite | Referência |
| --- | --- | --- |
| CPS (caracteres/s) | aviso > 17 · erro > 20 | WCAG 1.2.2 / EBU |
| CPL (caracteres/linha) | aviso > 42 · erro > 46 | legibilidade |
| Linhas por trecho | máximo 2 | legibilidade |
| Duração do trecho | 1 s – 7 s | boas práticas |
| Sobreposição | proibida | WCAG 1.2.2 |
| Janela de audiodescrição | ≥ 3 s | WCAG 1.2.5 |

O índice de conformidade parte de 100 e desconta 4 pontos por erro e 1,5 por aviso, limitado a 0–100. É um indicador de triagem, não uma certificação.

## Estrutura

```
index.html          interface (HTML semântico, atalho de foco, ARIA live)
src/parser.js       parser SRT/VTT (timestamps, notas, tags de posição)
src/audit.js        auditoria determinística + detecção de janelas
src/descriptions.js trilha .vtt, transcrição e relatório
src/audio.js        silêncios via Web Audio API (local)
src/app.js          ligação da interface
src/styles.css      tema claro/escuro, contraste, foco visível
tests/              43 testes (node:test), sem dependências
```

## Desenvolvimento

```bash
npm test        # 43 testes
npm run serve   # http://localhost:8080
```

Requisitos: Node.js 20+ apenas para testes/servidor local. O site é estático.

## Acessibilidade do próprio site

- HTML semântico, hierarquia de títulos e `main` único.
- Alvo de toque ≥ 44 px nos controles principais.
- Foco visível de 3 px, contraste AA no tema claro e escuro.
- `role="status"` com `aria-live="polite"` para todo retorno do sistema.
- Respeito a `prefers-reduced-motion` e `prefers-color-scheme`.
- Funciona sem JavaScript? Não — o processamento é local e depende de JS; a página informa isso na interface.

## Privacidade

Sem cookies, sem analytics, sem fontes externas, sem requisições de rede após o carregamento. A `Content-Security-Policy` restringe scripts e estilos à própria origem.

## Licença

MIT — veja [LICENSE](LICENSE).

Citação sugerida:

> FERREIRA, A. A. **Legenda & Audiodescrição Viva: estúdio local de auditoria de legendas e apoio à audiodescrição**. 2026. Software. Disponível em: <https://legenda.olacdev.com>.
