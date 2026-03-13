/* --- Background canvas particles --- */
(function() {
  const canvas = document.getElementById('bg-canvas');
  const ctx = canvas.getContext('2d');
  let W, H, particles = [];

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function Particle() {
    this.x = Math.random() * W;
    this.y = Math.random() * H;
    this.vx = (Math.random() - 0.5) * 0.3;
    this.vy = (Math.random() - 0.5) * 0.3;
    this.r = Math.random() * 1.5 + 0.3;
    this.alpha = Math.random() * 0.5 + 0.1;
    this.color = Math.random() > 0.7 ? '#ff6a00' : '#ffffff';
  }

  function init() {
    resize();
    particles = [];
    for (let i = 0; i < 80; i++) particles.push(new Particle());
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.fill();
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;
    });
    ctx.globalAlpha = 0.04;
    ctx.strokeStyle = '#ff6a00';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          ctx.globalAlpha = 0.06 * (1 - dist / 120);
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  init();
  draw();
})();

/* --- Navbar scroll effect --- */
window.addEventListener('scroll', function() {
  document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 60);
});

/* ===========================
   PHONE MASK + VALIDATION
=========================== */

// DDDs válidos no Brasil
const DDDS_VALIDOS = [
  11,12,13,14,15,16,17,18,19, // SP
  21,22,24,                    // RJ
  27,28,                       // ES
  31,32,33,34,35,37,38,        // MG
  41,42,43,44,45,46,           // PR
  47,48,49,                    // SC
  51,53,54,55,                 // RS
  61,                          // DF
  62,64,                       // GO
  63,                          // TO
  65,66,                       // MT
  67,                          // MS
  68,                          // AC
  69,                          // RO
  71,73,74,75,77,              // BA
  79,                          // SE
  81,87,                       // PE
  82,                          // AL
  83,                          // PB
  84,                          // RN
  85,88,                       // CE
  86,89,                       // PI
  91,93,94,                    // PA
  92,97,                       // AM
  95,                          // RR
  96,                          // AP
  98,99                        // MA
];

function applyPhoneMask(input) {
  // Remove tudo que não for dígito
  let digits = input.value.replace(/\D/g, '').slice(0, 11);

  let formatted = '';
  if (digits.length === 0) {
    formatted = '';
  } else if (digits.length <= 2) {
    formatted = '(' + digits;
  } else if (digits.length <= 6) {
    formatted = '(' + digits.slice(0,2) + ') ' + digits.slice(2);
  } else if (digits.length <= 10) {
    // fixo: (XX) XXXX-XXXX
    formatted = '(' + digits.slice(0,2) + ') ' + digits.slice(2,6) + '-' + digits.slice(6);
  } else {
    // celular: (XX) XXXXX-XXXX
    formatted = '(' + digits.slice(0,2) + ') ' + digits.slice(2,7) + '-' + digits.slice(7);
  }

  input.value = formatted;
}

function validatePhone(input) {
  const digits = input.value.replace(/\D/g, '');

  // Tamanho mínimo: 10 dígitos (fixo) ou 11 (celular)
  if (digits.length < 10) return 'Número incompleto';

  const ddd = parseInt(digits.slice(0, 2), 10);
  if (!DDDS_VALIDOS.includes(ddd)) return 'DDD inválido';

  // Celular deve começar com 9
  if (digits.length === 11 && digits[2] !== '9') return 'Celular deve começar com 9';

  // Sequências inválidas (todos iguais)
  const numPart = digits.slice(2);
  if (/^(\d)\1+$/.test(numPart)) return 'Número inválido';

  return null; // válido
}

function showFieldError(input, msg) {
  input.classList.add('invalid');
  let err = input.parentElement.querySelector('.field-error');
  if (!err) {
    err = document.createElement('span');
    err.className = 'field-error';
    input.parentElement.appendChild(err);
  }
  err.textContent = msg;
}

function clearFieldError(input) {
  input.classList.remove('invalid');
  const err = input.parentElement.querySelector('.field-error');
  if (err) err.remove();
}

// Aplica máscara em tempo real
document.getElementById('f-whats').addEventListener('input', function() {
  applyPhoneMask(this);
  clearFieldError(this);
});

// Quando o browser preenche via autocomplete, formatar também
document.getElementById('f-whats').addEventListener('change', function() {
  applyPhoneMask(this);
});

document.getElementById('f-nome').addEventListener('input', function() {
  clearFieldError(this);
});

/* ===========================
   WORKER URL — altere após o deploy no Cloudflare
   Exemplo: https://lomazy-inpi.SEU-USUARIO.workers.dev
=========================== */
const WORKER_URL = 'https://lomazy-inpi.igororlandibarros.workers.dev';

/* --- Simulator flow: form -> loading (fetch real) -> result --- */

function submitLeadForm() {
  const nome  = document.getElementById('f-nome');
  const whats = document.getElementById('f-whats');
  const marca = document.getElementById('f-marca');
  const area  = document.getElementById('f-area');

  let valid = true;

  if (!nome.value.trim() || nome.value.trim().split(' ').length < 2) {
    showFieldError(nome, 'Informe nome e sobrenome');
    valid = false;
  } else { clearFieldError(nome); }

  const phoneErr = validatePhone(whats);
  if (phoneErr) {
    showFieldError(whats, phoneErr);
    valid = false;
  } else { clearFieldError(whats); }

  if (!marca.value.trim()) {
    showFieldError(marca, 'Informe o nome da marca');
    valid = false;
  } else { clearFieldError(marca); }

  if (!area.value) {
    showFieldError(area, 'Selecione uma área');
    valid = false;
  } else { clearFieldError(area); }

  if (!valid) return;

  const brandName = marca.value.trim();
  const areaVal   = area.value;

  // Envia lead por email (Google Apps Script)
  fetch('https://script.google.com/macros/s/AKfycbzwfMfL7blpGDSfgb0qdrXaHSnC546jCSTUu_SlZ-zTA0dyY-64vpLeRIecaBziA7QEhw/exec', {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      nome:     nome.value.trim(),
      whatsapp: whats.value.trim(),
      marca:    brandName,
      area:     areaVal,
    })
  }).catch(() => {});

   // Dispara conversão Google Ads
gtag('event', 'conversion', {
  'send_to': 'AW-18011864797/qlirCNzGwYccEN393IxD',
  'value': 1.0,
  'currency': 'BRL'
});

  // Vai para etapa de loading
  document.getElementById('stage-form').style.display    = 'none';
  document.getElementById('stage-loading').style.display = 'block';
  document.getElementById('loading-brand-name').textContent = '"' + brandName + '"';

  const steps = [
    { el: document.getElementById('step1'), spinner: document.getElementById('spinner1'), check: document.getElementById('check1') },
    { el: document.getElementById('step2'), spinner: document.getElementById('spinner2'), check: document.getElementById('check2') },
    { el: document.getElementById('step3'), spinner: document.getElementById('spinner3'), check: document.getElementById('check3') },
  ];

  steps.forEach(s => {
    s.el.classList.remove('active','done');
    s.check.style.display   = 'none';
    s.spinner.style.display = 'none';
  });

  // Dispara fetch para o Worker simultaneamente à animação
  const fetchPromise = fetch(
    WORKER_URL + '/busca?marca=' + encodeURIComponent(brandName) + '&area=' + encodeURIComponent(areaVal)
  ).then(r => r.json()).catch(() => null);

  // Anima os 3 passos (timing fixo para UX)
  let stepIndex = 0;
  function nextStep() {
    if (stepIndex >= steps.length) {
      // Animação terminou — espera o fetch se ainda não voltou
      fetchPromise.then(dados => showResult(brandName, dados));
      return;
    }
    const s = steps[stepIndex++];
    s.el.classList.add('active');
    s.spinner.style.display = 'block';
    setTimeout(() => {
      s.spinner.style.display = 'none';
      s.check.style.display   = 'block';
      s.el.classList.add('done');
      nextStep();
    }, 900 + stepIndex * 300);
  }
  setTimeout(nextStep, 200);
}

/* Renderiza o resultado — dados reais do INPI ou fallback */
function showResult(name, dados) {
  document.getElementById('stage-loading').style.display = 'none';
  document.getElementById('stage-result').style.display  = 'block';

  const resultEl = document.getElementById('search-result');
  const badge    = document.getElementById('result-badge');
  const title    = document.getElementById('result-title');
  const note     = document.getElementById('result-note');
  const tag      = document.getElementById('result-brand-tag');

  resultEl.className = 'search-result';
  tag.textContent    = name;

  // Remove tabela anterior se existir
  const oldTable = document.getElementById('result-table');
  if (oldTable) oldTable.remove();

  if (dados && dados.ok) {
    // ——— RESULTADO REAL DO INPI ———
    const v = dados.veredicto;

    if (v === 'conflito') {
      resultEl.classList.add('result-danger');
      badge.textContent = 'Conflito detectado';
      title.textContent = 'Marca idêntica já registrada no INPI';
      note.textContent  = 'Encontramos um registro ativo com o nome "' + name + '" na base do INPI para o seu segmento. Registrar essa marca pode ser indeferida. Nosso especialista pode avaliar alternativas e estratégias viáveis.';
    } else if (v === 'atencao') {
      resultEl.classList.add('result-warn');
      badge.textContent = 'Pedido ativo';
      title.textContent = 'Já existe um pedido em andamento no INPI';
      note.textContent  = 'Há um processo em análise para a marca "' + name + '" no INPI. Dependendo da classe, isso pode impactar o seu registro. Recomendamos uma análise detalhada antes de protocolar.';
    } else if (v === 'semelhante') {
      resultEl.classList.add('result-warn');
      badge.textContent = 'Marcas semelhantes';
      title.textContent = 'Encontramos marcas com nomes parecidos';
      note.textContent  = 'Não há registro idêntico a "' + name + '", mas existem marcas semelhantes no INPI. O examinador pode considerar conflito dependendo da classe. Uma análise especializada aumenta suas chances de aprovação.';
    } else {
      // livre ou disponivel
      resultEl.classList.add('result-ok');
      badge.textContent = 'Sem conflitos diretos';
      title.textContent = 'Nenhum registro idêntico encontrado';
      note.textContent  = dados.total === 0
        ? 'A marca "' + name + '" não aparece na base do INPI para o seu segmento. As chances de aprovação são boas — um especialista pode confirmar e iniciar o protocolo.'
        : 'A marca "' + name + '" não apresenta conflito direto na base do INPI. Há ' + dados.total + ' registro(s) com nomes próximos, mas nenhum idêntico na sua classe. Recomendamos análise antes do protocolo.';
    }

    // Tabela com os resultados encontrados (máx 5)
    if (dados.resultados && dados.resultados.length > 0) {
      const wrap = document.createElement('div');
      wrap.id = 'result-table';
      wrap.innerHTML = '<p class="result-table-label">Registros encontrados na base do INPI:</p>' +
        '<div class="result-rows">' +
        dados.resultados.map(r =>
          '<div class="result-row">' +
          '<span class="rr-marca">' + escHtml(r.marca) + '</span>' +
          '<span class="rr-status rr-' + r.status + '">' + escHtml(r.situacao) + '</span>' +
          '<span class="rr-titular">' + escHtml(r.titular || '—') + '</span>' +
          '</div>'
        ).join('') +
        '</div>';
      document.getElementById('search-result').appendChild(wrap);
    }

    // Adiciona badge "dados reais INPI"
    const src = document.createElement('p');
    src.className = 'result-fonte';
    src.textContent = 'Consulta realizada na base pública do INPI — ' + new Date().toLocaleDateString('pt-BR');
    document.getElementById('search-result').appendChild(src);

  } else {
    // ——— FALLBACK se o worker falhou ———
    resultEl.classList.add('result-warn');
    badge.textContent = 'Análise preliminar';
    title.textContent = 'Não foi possível consultar o INPI agora';
    note.textContent  = 'O sistema do INPI está temporariamente indisponível. Nosso especialista fará a busca completa e entra em contato com você em até 24h com o resultado detalhado.';
  }

  document.getElementById('stage-result').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function resetSimulator() {
  document.getElementById('stage-result').style.display  = 'none';
  document.getElementById('stage-loading').style.display = 'none';
  document.getElementById('stage-form').style.display    = 'block';
  ['f-nome','f-whats','f-marca'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('f-area').selectedIndex = 0;
  const oldTable = document.getElementById('result-table');
  if (oldTable) oldTable.remove();
}

/* --- FAQ accordion --- */
function toggleFaq(btn) {
  const item = btn.closest('.faq-item');
  const isOpen = item.classList.contains('open');
  document.querySelectorAll('.faq-item.open').forEach(el => el.classList.remove('open'));
  if (!isOpen) item.classList.add('open');
}

/* --- Scroll fade-in observer --- */
const observer = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      observer.unobserve(e.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));

/* ===========================
   ENERGY PARTICLES — travel along star edges
=========================== */
(function() {
  // Wait for DOM
  const edges = document.querySelectorAll('.star-edge');
  if (!edges.length) return;

  edges.forEach(function(edge) {
    const len = edge.getTotalLength ? edge.getTotalLength() : 600;
    const dotLen = 50;
    const dur = parseFloat(edge.style.getPropertyValue('--dur') || '8') * 1000;
    const delay = parseFloat(edge.style.getPropertyValue('--delay') || '0') * 1000;

    edge.style.strokeDasharray = dotLen + ' ' + (len + dotLen);
    edge.style.strokeDashoffset = len + dotLen;
    edge.style.opacity = '1';

    let start = null;

    function animate(ts) {
      if (!start) start = ts + delay;
      const elapsed = (ts - start) % dur;
      if (elapsed < 0) { requestAnimationFrame(animate); return; }

      const progress = elapsed / dur;
      // ease in-out sine
      const eased = -(Math.cos(Math.PI * progress) - 1) / 2;
      const offset = (len + dotLen) - eased * (len + dotLen * 2);

      // Fade in/out at extremes
      const fadeLen = 0.08;
      let alpha;
      if (progress < fadeLen)        alpha = progress / fadeLen;
      else if (progress > 1-fadeLen) alpha = (1-progress) / fadeLen;
      else                           alpha = 1;

      edge.style.strokeDashoffset = offset;
      edge.style.opacity = (alpha * 0.9).toFixed(3);

      requestAnimationFrame(animate);
    }

    setTimeout(function() {
      requestAnimationFrame(animate);
    }, delay);
  });
})();

/* ===========================
   HERO CANVAS — floating particles
=========================== */
(function() {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, pts = [];

  function resize() {
    W = canvas.width  = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
  }

  function Pt() {
    this.x  = Math.random() * W;
    this.y  = Math.random() * H;
    this.vx = (Math.random() - 0.5) * 0.18;
    this.vy = (Math.random() - 0.5) * 0.18;
    this.r  = Math.random() * 1.2 + 0.3;
    this.a  = Math.random() * 0.35 + 0.05;
    this.orange = Math.random() > 0.72;
  }

  function init() {
    resize();
    pts = [];
    const count = Math.min(55, Math.floor(W * H / 14000));
    for (let i = 0; i < count; i++) pts.push(new Pt());
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    pts.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.orange ? '#ff6a00' : '#ffffff';
      ctx.globalAlpha = p.a;
      ctx.fill();
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;
    });

    // Faint connecting lines between nearby particles
    ctx.lineWidth = 0.4;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x;
        const dy = pts[i].y - pts[j].y;
        const d  = Math.sqrt(dx*dx + dy*dy);
        if (d < 90) {
          ctx.globalAlpha = 0.04 * (1 - d/90);
          ctx.strokeStyle = '#ff6a00';
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[j].x, pts[j].y);
          ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', init);
  init();
  draw();
})();

/* ===========================
   MOUSE PARALLAX — hero star
=========================== */
(function() {
  const wrap = document.getElementById('hero-star-wrap');
  if (!wrap) return;
  let cx = 0, cy = 0, tx = 0, ty = 0;
  let raf;

  document.getElementById('hero').addEventListener('mousemove', function(e) {
    const rect = this.getBoundingClientRect();
    // Normalize -1 to 1
    cx = ((e.clientX - rect.left) / rect.width  - 0.5) * 2;
    cy = ((e.clientY - rect.top)  / rect.height - 0.5) * 2;
  });

  document.getElementById('hero').addEventListener('mouseleave', function() {
    cx = 0; cy = 0;
  });

  function loop() {
    // Smooth lerp toward target
    tx += (cx - tx) * 0.04;
    ty += (cy - ty) * 0.04;
    const maxShift = 10; // px — very subtle
    wrap.style.transform =
      'translate(calc(-50% + ' + (tx * maxShift) + 'px), calc(-50% + ' + (ty * maxShift) + 'px))';
    raf = requestAnimationFrame(loop);
  }
  loop();
})();
