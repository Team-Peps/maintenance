(() => {
  'use strict';

  const config = window.MAINTENANCE_CONFIG || {};
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (id) => document.getElementById(id);

  const STATUS = {
    done: { text: 'OK', line: 'text-zinc-300', badge: 'text-peps-ok' },
    running: { text: '...', line: 'text-peps-yellow', badge: 'text-peps-yellow' },
    pending: { text: 'EN ATTENTE', line: 'text-peps-dim', badge: 'text-peps-dim' }
  };

  const NOTE_TYPES = {
    new: { label: 'Nouveau', classes: 'bg-peps-yellow text-peps-panel' },
    improvement: { label: 'Amélio', classes: 'bg-peps-line text-zinc-100' },
    fix: { label: 'Fix', classes: 'bg-[#1f2a22] text-peps-ok' }
  };

  const LINKS = {
    discord: 'Discord',
    x: 'X',
    twitch: 'Twitch'
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  /** Crée un élément avec des classes et un texte (jamais de innerHTML pour les données). */
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  /* ---------- Heure de retour ---------- */

  function renderReturnInfo() {
    const target = $('return-info');
    if (!config.returnAt) {
      target.textContent = 'très vite';
      return;
    }
    const date = new Date(config.returnAt);
    if (Number.isNaN(date.getTime())) {
      target.textContent = 'très vite';
      return;
    }
    const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const minutes = Math.round((date.getTime() - Date.now()) / 60000);

    if (minutes <= 0) {
      target.textContent = `d'un instant à l'autre (prévu à ${time})`;
    } else if (minutes < 60) {
      target.textContent = `vers ${time}, dans ${minutes} min`;
    } else {
      const sameDay = date.toDateString() === new Date().toDateString();
      const day = sameDay ? '' : `le ${date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} `;
      target.textContent = `${day}vers ${time}`;
    }
  }

  /* ---------- Patch notes ---------- */

  function renderNotes() {
    $('version').textContent = config.version || '';
    const list = $('notes');
    (config.notes || []).forEach((note) => {
      const type = NOTE_TYPES[note.type] || NOTE_TYPES.improvement;
      const item = el('li', 'flex items-start gap-3');
      item.append(
        el('span', `min-w-[58px] flex-none px-1.5 pt-[3px] pb-0.5 text-center font-display text-xs font-extrabold tracking-[.1em] uppercase ${type.classes}`, type.label),
        el('span', 'text-sm leading-[1.45] text-zinc-300', note.text)
      );
      list.append(item);
    });
  }

  /* ---------- Liens ---------- */

  function renderLinks() {
    const container = $('links');
    Object.entries(LINKS).forEach(([key, label]) => {
      const href = config.links && config.links[key];
      if (!href) return;
      const link = el('a', 'flex min-h-[50px] flex-[1_1_120px] items-center justify-center border border-[#34363b] font-display text-lg font-extrabold uppercase transition hover:-translate-x-[3px] hover:-translate-y-[3px] hover:border-peps-yellow hover:shadow-[5px_5px_0_#F2C832] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-peps-yellow', label);
      link.href = href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      container.append(link);
    });
  }

  /* ---------- Pied de page ---------- */

  function renderFooter() {
    $('year').textContent = String(new Date().getFullYear());
    if (config.contactEmail) {
      const link = $('contact-link');
      link.href = `mailto:${config.contactEmail}`;
      link.textContent = config.contactEmail;
      $('contact').classList.remove('hidden');
    }
  }

  /* ---------- Terminal ---------- */

  function progressOf(steps) {
    if (!steps.length) return 0;
    const score = steps.reduce((sum, s) => sum + (s.status === 'done' ? 1 : s.status === 'running' ? 0.5 : 0), 0);
    return Math.round((score / steps.length) * 100);
  }

  function asciiBar(percent) {
    const filled = Math.round(percent / 10);
    return `[${'▓'.repeat(filled)}${'░'.repeat(10 - filled)}]`;
  }

  async function typeText(node, text, speed) {
    if (reduceMotion) {
      node.textContent = text;
      return;
    }
    for (let i = 1; i <= text.length; i += 1) {
      node.textContent = text.slice(0, i);
      await sleep(speed);
    }
  }

  function logLine(prefix, text, status) {
    const s = STATUS[status] || STATUS.pending;
    const line = el('li', `flex gap-2.5 ${s.line} ${reduceMotion ? '' : 'animate-line-in'}`);
    line.append(
      el('span', 'flex-none text-[#4a4d54]', prefix),
      el('span', 'min-w-0 flex-1', text),
      el('span', `flex-none ${s.badge}`, s.text)
    );
    return line;
  }

  async function runTerminal() {
    const log = $('log');
    const steps = Array.isArray(config.steps) ? config.steps : [];
    const delay = reduceMotion ? 0 : 380;

    // Commande de départ, tapée caractère par caractère
    const command = el('li', 'flex gap-2.5 text-zinc-100');
    const prompt = el('span', 'flex-none', '>');
    const cmdText = el('span', 'min-w-0 flex-1');
    command.append(prompt, cmdText);
    log.append(command);
    await typeText(cmdText, '$ ./deploy.sh --env=prod', 35);
    await sleep(delay);

    for (let i = 0; i < steps.length; i += 1) {
      const step = steps[i];
      log.append(logLine(`[${String(i + 1).padStart(2, '0')}]`, step.label, step.status));
      await sleep(delay);
    }

    // Progression
    const percent = progressOf(steps);
    $('progress').classList.replace('hidden', 'flex');
    $('progress-ascii').textContent = asciiBar(percent);
    $('progress-pct').textContent = `${percent}%`;
    requestAnimationFrame(() => {
      $('progress-bar').style.width = `${percent}%`;
    });

    const allDone = steps.length > 0 && steps.every((s) => s.status === 'done');
    $('status-label').textContent = allDone ? 'online' : 'deploying';

    $('prompt').classList.remove('hidden');
  }

  /* ---------- Vérification du retour du site ---------- */

  function startHealthCheck() {
    const hc = config.healthCheck || {};
    if (!hc.url) return;

    const interval = Math.max(10, Number(hc.intervalSeconds) || 30) * 1000;

    const check = async () => {
      try {
        const res = await fetch(hc.url, { cache: 'no-store' });
        if (res.ok) {
          const banner = $('back-online');
          banner.classList.replace('hidden', 'flex');
          setTimeout(() => {
            window.location.href = hc.redirectTo || '/';
          }, 2500);
          return;
        }
      } catch {
        // Le site n'est pas encore revenu : on réessaie plus tard.
      }
      setTimeout(check, interval);
    };

    setTimeout(check, interval);
  }

  /* ---------- Initialisation ---------- */

  $('retry').addEventListener('click', () => window.location.reload());

  renderReturnInfo();
  setInterval(renderReturnInfo, 30000);
  renderNotes();
  renderLinks();
  renderFooter();
  runTerminal();
  startHealthCheck();
})();
