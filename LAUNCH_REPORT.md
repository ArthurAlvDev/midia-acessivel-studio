# Launch Report — Legenda & Audiodescrição Viva (ACC-007)

**Data:** 19/11/2026
**Projeto:** `midia-acessivel-studio`
**Licença:** MIT
**Responsável:** Ferreira, A. A. (OlacDev)

## Estado

| Etapa | Estado | Evidência |
| --- | --- | --- |
| Build local | Concluído | 13 arquivos, sem dependências de execução |
| Testes | 52/52 | `node --test tests/*.test.js` |
| GitHub | Publicado | `ArthurAlvDev/midia-acessivel-studio` (branch `main`) |
| Vercel | Publicado | `https://midia-acessivel-studio.vercel.app` (HTTP 200) |
| Domínio próprio | Pendente de DNS | `legenda.olacdev.com` adicionado ao projeto, aguardando CNAME no Cloudflare |
| Artigo | Pronto (não publicado) | `ARTIGO_CIENTIFICO.md`; sem submissão e sem depósito em repositório |

## Escopo entregue

- Parser `.srt`/`.vtt` com normalização (BOM, CRLF, `NOTE`/`STYLE`/`REGION`, tags de posição) e ordenação.
- Auditoria determinística: CPS, CPL, linhas, duração, sobreposição, trechos vazios.
- Índice de conformidade 0–100 declarado como triagem, não certificação.
- Janelas de audiodescrição (≥ 3 s), com edição e pré-escuta por síntese de voz.
- Detecção local de silêncios (RMS, 50 ms, limiar −40 dB, mínimo 1 s).
- Exportação: `descriptions.vtt`, transcrição descritiva, relatório `.md` e `.json`.
- Segurança: CSP restritiva, sem requisições externas, sem cookies/analytics; cabeçalhos em `vercel.json`.
- Marca: rodapé com "Made by OlacDev" e link para olacdev.com.

## Verificações executadas

- `node --test`: 52 testes, 52 aprovados.
- Smoke test HTTP local: `/`, `src/*.js`, `src/styles.css` e `exemplo.srt` retornam 200.
- Produção: `https://midia-acessivel-studio.vercel.app/` retorna 200 com o título esperado.
- Integridade: todos os arquivos referenciados pelo HTML existem; todos os campos têm rótulo.

## Pendências e riscos

1. **DNS do domínio próprio** — criar CNAME `legenda` → `d11d0cd5f972267c.vercel-dns-017.com` no Cloudflare (ou um `*.olacdev.com` único para todos os sites).
2. **Sem teste com usuários** — declarado como limitação no artigo.
3. **Detecção de silêncio com limiar fixo** — próximo incremento: limiar ajustável na interface.
4. **GitHub Actions bloqueado** na conta (faturamento); CI local é o que valida hoje.

## Próximo passo sugerido

Teste rápido com um legendista e um audiodescritor; depois, expor limiar de silêncio e exportação de `.srt` corrigido.
