/* Legenda & Audiodescrição Viva — lógica da interface (100% local). */
(function () {
  'use strict';

  const state = { fileName: '', format: '', preset: 'standard', cues: [], audit: null, gaps: [], drafts: [], audioSilences: [] };

  const $ = (id) => document.getElementById(id);
  const fmt = (ms) => DescriptionStudio.formatClock(ms);
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const SAMPLE = `1
00:00:02,000 --> 00:00:05,400
- Você viu o que aconteceu?
- Não, cheguei agora.

2
00:00:06,000 --> 00:00:10,200
A porta bateu forte e todo mundo se assustou no corredor do prédio.

3
00:00:15,000 --> 00:00:16,000
[música tensa]

4
00:00:16,200 --> 00:00:22,800
Ele explicou que o projeto precisava de mais tempo porque a equipe toda estava aprendendo uma ferramenta nova.`;

  function setStatus(message, kind) {
    const el = $('status');
    el.textContent = message;
    el.dataset.kind = kind || 'info';
  }

  function analyze(rawText, fileName) {
    try {
      const parsed = SubtitleParser.parse(rawText);
      state.fileName = fileName || 'colado';
      state.format = parsed.format;
      state.cues = parsed.cues;
      state.audit = SubtitleAudit.audit(parsed.cues, state.preset);
      state.gaps = SubtitleAudit.findGaps(parsed.cues);
      state.drafts = state.gaps.map(() => '');
      state.audioSilences = [];
      render();
      setStatus(`Análise concluída: ${parsed.cues.length} trechos, ${state.gaps.length} janelas de audiodescrição.`, 'ok');
    } catch (err) {
      setStatus(err.message, 'error');
    }
  }

  function render() {
    const s = state.audit;
    $('results').hidden = false;
    $('stat-cues').textContent = String(s.stats.cues);
    $('stat-duration').textContent = fmt(s.stats.durationMs);
    $('stat-cps').textContent = String(s.stats.avgCps);
    $('stat-issues').textContent = `${s.bySeverity.error} / ${s.bySeverity.warning}`;
    $('stat-score').textContent = `${s.stats.score}/100`;
    $('score-bar').style.width = `${s.stats.score}%`;
    $('score-bar').dataset.level = s.stats.score >= 85 ? 'good' : s.stats.score >= 60 ? 'mid' : 'bad';

    renderIssues();
    renderGaps();
  }

  function renderIssues() {
    const body = $('issues-body');
    body.innerHTML = '';
    const issues = state.audit.issues;
    if (!issues.length) {
      body.innerHTML = '<tr><td colspan="5">Nenhum problema nas regras verificadas.</td></tr>';
      return;
    }
    issues.slice(0, 200).forEach((issue) => {
      const cue = state.cues[issue.cue - 1];
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${fmt(cue ? cue.start : 0)}</td>
        <td>${issue.cue}</td>
        <td><span class="badge ${issue.severity}">${issue.severity === 'error' ? 'erro' : 'aviso'}</span></td>
        <td>${esc(SubtitleAudit.RULES[issue.rule] ? SubtitleAudit.RULES[issue.rule].label : issue.rule)}</td>
        <td>${esc(issue.message)}${issue.suggestion ? ` <em>${esc(issue.suggestion)}</em>` : ''}</td>`;
      body.appendChild(tr);
    });
  }

  function renderGaps() {
    const list = $('gaps-list');
    list.innerHTML = '';
    if (!state.gaps.length) {
      list.innerHTML = '<p class="muted">Nenhuma janela de 3 s ou mais. Considere audiodescrição estendida ou transcrição descritiva.</p>';
      return;
    }

    state.gaps.forEach((gap, i) => {
      const item = document.createElement('article');
      item.className = 'gap';
      item.innerHTML = `
        <header>
          <strong>${fmt(gap.start)} – ${fmt(gap.end)}</strong>
          <span class="muted">${(gap.duration / 1000).toFixed(1)} s · após trecho ${gap.afterCue}</span>
        </header>
        <label class="sr-only" for="ad-${i}">Audiodescrição da janela ${i + 1}</label>
        <textarea id="ad-${i}" data-index="${i}" rows="2" placeholder="Descreva o que só é visível: cenário, ação, expressão, figurino.">${esc(state.drafts[i] || '')}</textarea>
        <div class="gap-actions">
          <button type="button" class="ghost" data-speak="${i}">Pré-ouvir</button>
          <span class="counter" data-counter="${i}">${(state.drafts[i] || '').length} caracteres</span>
        </div>`;
      list.appendChild(item);
    });

    list.querySelectorAll('textarea').forEach((el) => {
      el.addEventListener('input', (e) => {
        const idx = Number(e.target.dataset.index);
        state.drafts[idx] = e.target.value;
        const counter = list.querySelector(`[data-counter="${idx}"]`);
        if (counter) counter.textContent = `${e.target.value.length} caracteres`;
      });
    });

    list.querySelectorAll('[data-speak]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.speak);
        const text = state.drafts[idx];
        if (!text || !text.trim()) {
          setStatus('Escreva a descrição antes de pré-ouvir.', 'error');
          return;
        }
        if (!('speechSynthesis' in window)) {
          setStatus('Este navegador não tem síntese de voz.', 'error');
          return;
        }
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = 'pt-BR';
        utter.rate = 1.05;
        window.speechSynthesis.speak(utter);
        setStatus('Pré-ouvindo a descrição.', 'info');
      });
    });
  }

  function download(name, content, type) {
    const blob = new Blob([content], { type: type || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function baseName() {
    return (state.fileName || 'legenda').replace(/\.[^.]+$/, '');
  }

  function bind() {
    $('file').addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const text = await file.text();
      analyze(text, file.name);
    });

    $('btn-sample').addEventListener('click', () => {
      $('paste').value = SAMPLE;
      analyze(SAMPLE, 'exemplo.srt');
    });

    $('btn-paste').addEventListener('click', () => {
      const text = $('paste').value.trim();
      if (!text) {
        setStatus('Cole uma legenda .srt ou .vtt para analisar.', 'error');
        return;
      }
      analyze(text, 'colado.vtt');
    });

    $('btn-report-md').addEventListener('click', () => {
      if (!state.audit) return;
      download(
        `${baseName()}-relatorio.md`,
        DescriptionStudio.reportMarkdown({
          fileName: state.fileName,
          format: state.format,
          auditResult: state.audit,
          gaps: state.gaps,
          drafts: state.drafts,
        }),
        'text/markdown;charset=utf-8'
      );
    });

    $('btn-report-json').addEventListener('click', () => {
      if (!state.audit) return;
      const payload = {
        arquivo: state.fileName,
        formato: state.format,
        estatisticas: state.audit.stats,
        achados: state.audit.issues,
        janelas: state.gaps.map((g, i) => ({ inicio: g.start, fim: g.end, descricao: state.drafts[i] || '' })),
      };
      download(`${baseName()}-relatorio.json`, JSON.stringify(payload, null, 2), 'application/json');
    });

    $('btn-vtt').addEventListener('click', () => {
      if (!state.gaps.length) return;
      const written = state.drafts.filter((d) => String(d || '').trim()).length;
      if (!written) {
        setStatus('Escreva ao menos uma audiodescrição para exportar a trilha.', 'error');
        return;
      }
      download(`${baseName()}-descriptions.vtt`, DescriptionStudio.descriptionsVTT(state.gaps, state.drafts), 'text/vtt;charset=utf-8');
      setStatus(`Trilha .vtt gerada com ${written} descrição(ões).`, 'ok');
    });

    $('btn-transcript').addEventListener('click', () => {
      if (!state.cues.length) return;
      download(`${baseName()}-transcricao.txt`, DescriptionStudio.transcript(state.cues, state.gaps, state.drafts), 'text/plain;charset=utf-8');
    });

    $('audio').addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      setStatus('Analisando o áudio localmente…', 'info');
      try {
        const decoded = await AudioSilence.decodeAudioFile(file);
        state.audioSilences = AudioSilence.detectSilenceFromSamples(decoded.samples, decoded.sampleRate, {
          minSilenceMs: 1000,
        });
        renderAudioSilences(decoded.durationMs);
        setStatus(`Áudio analisado: ${state.audioSilences.length} silêncios de 1 s ou mais.`, 'ok');
      } catch (err) {
        setStatus('Não foi possível ler o áudio: ' + err.message, 'error');
      }
    });

    $('btn-copy').addEventListener('click', async () => {
      if (!state.audit) return;
      const text = DescriptionStudio.reportMarkdown({
        fileName: state.fileName,
        format: state.format,
        auditResult: state.audit,
        gaps: state.gaps,
        drafts: state.drafts,
      });
      try {
        await navigator.clipboard.writeText(text);
        setStatus('Relatório copiado.', 'ok');
      } catch (_e) {
        setStatus('O navegador bloqueou a cópia. Use o download.', 'error');
      }
    });
  }

  function renderAudioSilences(durationMs) {
    const box = $('audio-result');
    box.hidden = false;
    const overlap = state.audioSilences.filter((s) =>
      state.gaps.some((g) => s.start >= g.start - 500 && s.end <= g.end + 500)
    ).length;
    box.innerHTML = `
      <p><strong>${state.audioSilences.length}</strong> silêncios detectados em ${fmt(durationMs)} de áudio ·
      <strong>${overlap}</strong> coincidem com janelas entre legendas.</p>
      <ul class="inline-list">${state.audioSilences
        .slice(0, 12)
        .map((s) => `<li>${fmt(s.start)}–${fmt(s.end)}</li>`)
        .join('')}</ul>`;
  }

  document.addEventListener('DOMContentLoaded', () => {
    bind();
    const presetSelect = $('preset-select');
    if (presetSelect) {
      presetSelect.addEventListener('change', (e) => {
        state.preset = e.target.value || 'standard';
        if (state.cues.length) {
          state.audit = SubtitleAudit.audit(state.cues, state.preset);
          render();
          setStatus(`Preset atualizado para ${SubtitleAudit.PRESETS[state.preset]?.label || state.preset}.`, 'ok');
        }
      });
    }
    const batchInput = $('batch-subtitles');
    if (batchInput) {
      batchInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        const summary = [];
        for (const f of files) {
          try {
            const text = await f.text();
            const parsed = SubtitleParser.parse(text);
            const res = SubtitleAudit.audit(parsed.cues, state.preset);
            summary.push(`${f.name}: ${res.stats.score}/100 (${parsed.cues.length} trechos)`);
          } catch (_err) {
            summary.push(`${f.name}: erro ao ler`);
          }
        }
        $('batch-summary').textContent = `Lote (${files.length} arquivos): ` + summary.join(' | ');
      });
    }
    setStatus('Pronto. Nada é enviado para servidores: todo o processamento ocorre no seu navegador.', 'info');
  });
})();
