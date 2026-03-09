/**
 * LOMAZY — Cloudflare Worker v14 — PRODUÇÃO
 * Parser completo e testado com dados reais do INPI
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json; charset=utf-8',
};

const BASE = 'https://busca.inpi.gov.br';
const UA   = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const AREA_TO_CLASSES = {
  'Moda e vestuário':       '25',
  'Alimentação e bebidas':  '30',
  'Tecnologia e software':  '42',
  'Saúde e beleza':         '03',
  'Educação':               '41',
  'E-commerce':             '35',
  'Serviços profissionais': '35',
  'Indústria e comércio':   '40',
  'Entretenimento':         '41',
  'Outra':                  '',
};

const SITUACAO_MAP = [
  { match: 'alto renome', status: 'registrada', label: 'Alto Renome' },
  { match: 'concedido',   status: 'registrada', label: 'Registrada'  },
  { match: 'registrad',   status: 'registrada', label: 'Registrada'  },
  { match: 'prorrogad',   status: 'registrada', label: 'Registrada'  },
  { match: 'vigente',     status: 'registrada', label: 'Registrada'  },
  { match: 'exame',       status: 'atencao',    label: 'Em análise'  },
  { match: 'oposic',      status: 'atencao',    label: 'Em análise'  },
  { match: 'publicad',    status: 'atencao',    label: 'Em análise'  },
  { match: 'aguardand',   status: 'atencao',    label: 'Em análise'  },
  { match: 'deposit',     status: 'atencao',    label: 'Em análise'  },
  { match: 'arquivad',    status: 'disponivel', label: 'Arquivado'   },
  { match: 'indeferid',   status: 'disponivel', label: 'Indeferido'  },
  { match: 'caducad',     status: 'disponivel', label: 'Caducado'    },
  { match: 'extint',      status: 'disponivel', label: 'Extinto'     },
  { match: 'nulidad',     status: 'disponivel', label: 'Nulidade'    },
  { match: 'cancelad',    status: 'disponivel', label: 'Cancelado'   },
];

function normalizarSituacao(raw) {
  if (!raw) return { status: 'atencao', label: 'Em análise' };
  const lower = raw.toLowerCase();
  for (const s of SITUACAO_MAP) {
    if (lower.includes(s.match)) return { status: s.status, label: s.label };
  }
  return { status: 'atencao', label: raw.trim().slice(0, 40) };
}

function ws(s) { return s.replace(/\s+/g, ' ').trim(); }

function getCookies(resp) {
  const out = [];
  resp.headers.forEach((v, k) => {
    if (k.toLowerCase() === 'set-cookie') out.push(v.split(';')[0]);
  });
  return out;
}

function mergeCookies(...arrays) {
  const map = new Map();
  for (const arr of arrays) {
    for (const c of arr) {
      const eq = c.indexOf('=');
      const name = eq > -1 ? c.slice(0, eq).trim() : c.trim();
      if (name) map.set(name, c);
    }
  }
  return [...map.values()].join('; ');
}

async function obterSessao() {
  const h = { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'pt-BR,pt;q=0.9' };
  const r1 = await fetch(`${BASE}/pePI/servlet/LoginController?action=GoToPage&pageName=Marcas`, { redirect: 'manual', headers: h });
  const c1 = getCookies(r1);
  const r2 = await fetch(`${BASE}/pePI/servlet/LoginController?action=login`, {
    redirect: 'follow',
    headers: { ...h, 'Referer': `${BASE}/pePI/servlet/LoginController?action=GoToPage&pageName=Marcas`, 'Cookie': c1.join('; ') },
  });
  const c2 = getCookies(r2);
  const cookie2 = mergeCookies(c1, c2);
  const r3 = await fetch(`${BASE}/pePI/jsp/marcas/Pesquisa_classe_basica.jsp`, {
    redirect: 'follow',
    headers: { ...h, 'Referer': `${BASE}/pePI/servlet/LoginController?action=login`, 'Cookie': cookie2 },
  });
  const c3 = getCookies(r3);
  return mergeCookies(c1, c2, c3);
}

function parseINPI(html, marcaBuscada) {
  const resultados = [];
  const trRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let tr;

  while ((tr = trRe.exec(html)) !== null) {
    const bloco = tr[1];

    // Número: link com dígitos OU célula com "-" (alto renome sem processo)
    const numMatch = bloco.match(/<a\b[^>]*>\s*(\d{7,10})\s*<\/a>/)
                  || bloco.match(/<td[^>]*>\s*(-)\s*<\/td>/);
    if (!numMatch) continue;
    const numero = numMatch[1];

    // Marca: texto dentro de <b>
    const marcaMatch = bloco.match(/<b>\s*[\r\n\s]*([^\r\n<]{1,80}?)[\r\n\s]*<\/b>/i);
    if (!marcaMatch) continue;
    const marca = ws(marcaMatch[1]);
    if (!marca || marca.length < 1) continue;

    // Situação: td.left.padding-5 OU alt do img de situação (alto renome)
    const sitMatch = bloco.match(/class="left padding-5"[^>]*>[\s\S]*?<font[^>]*>([\s\S]*?)<\/font>/i)
                  || bloco.match(/alt="([^"]+)"/i);
    const situacaoRaw = sitMatch ? ws(sitMatch[1]) : '';

    // Titular
    const titMatch = bloco.match(/class="normal titular-marcas">([\s\S]*?)<\/font>/i);
    const titular = titMatch ? ws(titMatch[1]) : '';

    // Classe
    const clsMatch = bloco.match(/class="normal titulo-marcas">([\s\S]*?)<\/font>/i);
    const classe = clsMatch ? ws(clsMatch[1]) : '';

    const { status, label } = normalizarSituacao(situacaoRaw);
    resultados.push({ numero, marca: marca.toUpperCase(), situacao: label, status, titular, classe });
  }

  const norm = marcaBuscada.toLowerCase().trim();

  // Veredicto baseado em correspondência exata de nome
  const identicas   = resultados.filter(r => r.marca.toLowerCase().trim() === norm && r.status === 'registrada');
  const emAndamento = resultados.filter(r => r.marca.toLowerCase().trim() === norm && r.status === 'atencao');
  const semelhantes = resultados.filter(r => r.marca.toLowerCase().includes(norm) && r.status === 'registrada');
  const totalAtivos = resultados.filter(r => r.status !== 'disponivel').length;

  let veredicto;
  if      (identicas.length > 0)   veredicto = 'conflito';
  else if (emAndamento.length > 0) veredicto = 'atencao';
  else if (semelhantes.length > 0) veredicto = 'semelhante';
  else if (resultados.length === 0) veredicto = 'disponivel';
  else                              veredicto = 'livre';

  return {
    veredicto,
    total: resultados.length,
    total_ativos: totalAtivos,
    resultados,
  };
}

async function buscarMarca(marca, classe, cookie) {
  for (const exata of ['sim', 'nao']) {
    const body = new URLSearchParams({
      buscaExata: exata, txt: '', marca,
      classeInter: classe || '', registerPerPage: '50',
      botao: 'pesquisar', Action: 'searchMarca',
      tipoPesquisa: 'BY_MARCA_CLASSIF_BASICA',
    });

    const resp = await fetch(`${BASE}/pePI/servlet/MarcasServletController`, {
      method: 'POST', redirect: 'follow',
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': BASE,
        'Referer': `${BASE}/pePI/jsp/marcas/Pesquisa_classe_basica.jsp`,
        'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin', 'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'Cookie': cookie,
      },
      body: body.toString(),
    });

    if (!resp.ok) throw new Error(`INPI HTTP ${resp.status}`);
    const html = await resp.text();
    if (html.includes('F_LoginCliente')) throw new Error('sessao_invalida');

    const dados = parseINPI(html, marca);
    if (dados.total > 0 || exata === 'nao') return { ...dados, html_len: html.length };
  }
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url = new URL(request.url);

    if (url.pathname === '/') {
      return new Response(JSON.stringify({ ok: true, servico: 'Lomazy INPI v14' }), { headers: CORS });
    }

    if (url.pathname === '/debug') {
      try {
        const marca  = url.searchParams.get('marca') || 'natura';
        const classe = url.searchParams.get('classe') || '';
        const cookie = await obterSessao();
        const dados  = await buscarMarca(marca, classe, cookie);
        return new Response(JSON.stringify({ servico: 'v14', ...dados }), { headers: CORS });
      } catch (e) {
        return new Response(JSON.stringify({ erro: e.message }), { headers: CORS });
      }
    }

    if (url.pathname !== '/busca') {
      return new Response(JSON.stringify({ erro: 'Não encontrado' }), { status: 404, headers: CORS });
    }

    const marca = url.searchParams.get('marca')?.trim();
    const area  = url.searchParams.get('area')?.trim() || '';
    if (!marca || marca.length < 2) {
      return new Response(JSON.stringify({ erro: 'Informe a marca' }), { status: 400, headers: CORS });
    }

    const classe = AREA_TO_CLASSES[area] ?? '';

    try {
      const cookie = await obterSessao();
      const dados  = await buscarMarca(marca, classe, cookie);
      return new Response(JSON.stringify({
        ok: true, marca, area, ...dados,
        fonte: 'INPI pePI — dados públicos',
        consultado: new Date().toISOString(),
      }), { headers: CORS });
    } catch (err) {
      return new Response(JSON.stringify({
        ok: false, erro: 'Erro ao consultar o INPI', detalhe: err.message,
      }), { status: 502, headers: CORS });
    }
  },
};