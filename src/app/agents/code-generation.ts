import { projectFileExists, readProjectFile } from '../../project-file-store.js';
import { AIProviderRouter } from '../ai/provider-router.js';
import { addStagedFile, listStagedFiles } from '../web/staged-files.js';
import type { AgentDefinition, AgentRun } from './models.js';
import { extractRequestedFilePath, shouldRequirePlan } from './routing.js';

export type ProjectStack = {
  name: string;
  defaultPath: string;
};

export async function detectProjectStack(projectRoot: string): Promise<ProjectStack> {
  let stack: ProjectStack = { name: 'html', defaultPath: 'public/index.html' };

  try {
    const pkgRaw = await readProjectFile(projectRoot, 'package.json');
    const pkg = JSON.parse(pkgRaw.content) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    if (deps['next']) {
      stack = { name: 'Next.js', defaultPath: 'app/page.tsx' };
    } else if (deps['vue']) {
      stack = { name: 'Vue', defaultPath: 'src/App.vue' };
    } else if (deps['svelte'] || deps['@sveltejs/kit']) {
      stack = { name: 'Svelte', defaultPath: 'src/routes/+page.svelte' };
    } else if (deps['react'] || deps['vite']) {
      stack = { name: 'React/Vite', defaultPath: 'src/App.tsx' };
    } else if (deps['express']) {
      stack = { name: 'Express/Node', defaultPath: 'src/server.ts' };
    }
  } catch {
    /* use html default */
  }

  return stack;
}

export function defaultPathForAgent(agentId: string, stack: ProjectStack): string {
  switch (agentId) {
    case 'backend_agent':
      if (stack.name === 'Next.js') return 'app/api/route.ts';
      if (stack.defaultPath.includes('server')) return stack.defaultPath;
      return 'src/app/web/server.ts';
    case 'refactor_agent':
      return stack.defaultPath;
    case 'ui_agent':
    case 'site_builder_agent':
      if (stack.name === 'Express/Node') return 'public/index.html';
      return stack.defaultPath;
    default:
      return stack.defaultPath;
  }
}

export function languageForPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || 'txt';
  const map: Record<string, string> = {
    tsx: 'typescript',
    ts: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    vue: 'vue',
    svelte: 'svelte',
    html: 'html',
    css: 'css',
    md: 'markdown',
    json: 'json',
  };
  return map[ext] || 'text';
}

export function agentCodegenPersona(agentId: string): string {
  switch (agentId) {
    case 'backend_agent':
      return 'Voce e um engenheiro backend senior. Foque em APIs, validacao, tipos, seguranca, observabilidade, tratamento de erro e codigo limpo pronto para manutencao.';
    case 'refactor_agent':
      return 'Voce e um especialista em refatoracao senior. Melhore estrutura, legibilidade, coesao e testabilidade sem mudar comportamento externo.';
    case 'ui_agent':
      return 'Voce e um engenheiro frontend/UI senior. Foque em layout moderno, responsivo, acessivel, estados vazios/carregando/erro e componentes claros.';
    case 'site_builder_agent':
    default:
      return 'Voce e um builder full-stack senior focado em sites e apps web modernos, com design profissional, copy realista, arquitetura simples e codigo completo.';
  }
}

export const PROFESSIONAL_CODE_STANDARDS = [
  'Entregar codigo completo do arquivo alvo, nao um trecho solto.',
  'Evitar placeholders genericos, lorem ipsum e TODOs sem implementacao.',
  'Incluir estados reais de UX quando aplicavel: vazio, carregando, erro, sucesso e responsividade.',
  'Usar nomes claros, funcoes pequenas e separar dados/configuracoes repetidas em constantes.',
  'Manter acessibilidade basica: labels, aria quando necessario, contraste e navegacao por teclado.',
  'Manter seguranca: nao expor segredos, nao usar eval, nao criar fetch inseguro nem HTML nao sanitizado.',
  'Preservar compatibilidade com a stack detectada e com o arquivo existente.',
  'Preferir mudancas pequenas e revisaveis, mas com acabamento de produto.',
];

function buildProfessionalStandardsBlock() {
  return PROFESSIONAL_CODE_STANDARDS.map((item) => `- ${item}`).join('\n');
}

function codeFenceLanguage(language: string) {
  if (language === 'typescript') return 'ts';
  if (language === 'javascript') return 'js';
  if (language === 'markdown') return 'md';
  return language;
}

function titleFromGoal(goal: string) {
  const cleaned = goal
    .replace(/[`"'<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return 'Nexus Codex';
  return cleaned.length > 64 ? `${cleaned.slice(0, 61).trim()}...` : cleaned;
}

type SiteBrief = {
  brand: string;
  pageTitle: string;
  eyebrow: string;
  headline: string;
  lead: string;
  primaryCta: string;
  secondaryCta: string;
  contactHref: string;
  contactLabel: string;
  heroImage?: string;
  heroImageAlt: string;
  heroCaption: string;
  metrics: Array<{ value: string; label: string }>;
  features: Array<{ title: string; text: string }>;
  menuItems: Array<{ name: string; description: string; price: string }>;
  testimonials: Array<{ quote: string; author: string }>;
  panelTitle: string;
  panelText: string;
};

function inferSiteBrief(goal: string): SiteBrief {
  const lowered = goal.toLowerCase();
  const requestedTitle = titleFromGoal(goal);

  if (/(cafeteria|caf[eé]|coffee|barista)/.test(lowered)) {
    return {
      brand: 'Cafeteria Aurora',
      pageTitle: 'Cafeteria Aurora',
      eyebrow: 'Cafe especial, brunch e encontros',
      headline: 'Cafe de origem, comida fresca e um canto bom para desacelerar.',
      lead: 'Uma cafeteria moderna com graos selecionados, cardapio artesanal e atendimento acolhedor para quem quer trabalhar, encontrar amigos ou levar um espresso perfeito.',
      primaryCta: 'Ver cardapio',
      secondaryCta: 'Reservar mesa',
      contactHref:
        'https://wa.me/5500000000000?text=Quero%20reservar%20uma%20mesa%20na%20Cafeteria%20Aurora',
      contactLabel: 'Chamar no WhatsApp',
      heroImage: 'assets/bakery-hero.webp',
      heroImageAlt: 'Bolos artesanais, doces e cafe em uma bancada clara de cafeteria',
      heroCaption: 'Bolos da casa, cafes especiais e brunch preparado todos os dias.',
      metrics: [
        { value: '4.9', label: 'avaliacao dos clientes' },
        { value: '12h', label: 'de cafeteria aberta' },
        { value: '18', label: 'metodos e bebidas' },
        { value: '100%', label: 'graos selecionados' },
      ],
      features: [
        {
          title: 'Cardapio autoral',
          text: 'Espressos, filtrados, cold brew, paes de fermentacao natural, bolos da casa e opcoes leves para brunch.',
        },
        {
          title: 'Ambiente para ficar',
          text: 'Mesas confortaveis, tomadas bem posicionadas, Wi-Fi estavel e uma trilha sonora pensada para concentrar.',
        },
        {
          title: 'Torra e origem',
          text: 'Graos de pequenos produtores, preparo calibrado por baristas e sugestoes claras para cada paladar.',
        },
      ],
      menuItems: [
        {
          name: 'Espresso + fatia da casa',
          description: 'Cafe intenso com bolo fresco do dia.',
          price: 'R$ 24',
        },
        {
          name: 'Cold brew cremoso',
          description: 'Extraido a frio, servido com espuma leve.',
          price: 'R$ 18',
        },
        {
          name: 'Brunch Aurora',
          description: 'Pao artesanal, fruta, doce pequeno e cafe.',
          price: 'R$ 46',
        },
      ],
      testimonials: [
        { quote: 'Ambiente lindo, cafe impecavel e bolo realmente fresco.', author: 'Marina S.' },
        { quote: 'Virei cliente da semana. O atendimento e muito cuidadoso.', author: 'Joao P.' },
      ],
      panelTitle: 'Passe hoje para provar o cafe da semana.',
      panelText:
        'Use o contato para reservar mesa, encomendar bolos ou falar com a equipe sobre eventos pequenos e encontros corporativos.',
    };
  }

  if (/(bolo|bolos|confeitaria|doceria|doce|sobremesa)/.test(lowered)) {
    return {
      brand: 'Atelie Dona Nuvem',
      pageTitle: 'Atelie Dona Nuvem',
      eyebrow: 'Bolos artesanais sob encomenda',
      headline: 'Bolos bonitos, massa fresca e recheios que viram assunto.',
      lead: 'Uma vitrine digital para encomendas de bolos, doces finos e sobremesas feitas com acabamento profissional, ingredientes frescos e sabor de receita cuidada.',
      primaryCta: 'Ver sabores',
      secondaryCta: 'Fazer encomenda',
      contactHref: 'https://wa.me/5500000000000?text=Quero%20fazer%20uma%20encomenda%20de%20bolo',
      contactLabel: 'Pedir orcamento',
      heroImage: 'assets/bakery-hero.webp',
      heroImageAlt:
        'Bolo artesanal decorado com morangos, chocolate e creme em bancada de confeitaria',
      heroCaption: 'Bolos sob encomenda com acabamento elegante e recheios generosos.',
      metrics: [
        { value: '48h', label: 'para encomendas simples' },
        { value: '24', label: 'sabores combinaveis' },
        { value: '4.8', label: 'media de avaliacao' },
        { value: '100%', label: 'feito sob demanda' },
      ],
      features: [
        {
          title: 'Sabores por ocasiao',
          text: 'Aniversario, casamento civil, cafe da tarde, corporativo e presentes personalizados.',
        },
        {
          title: 'Acabamento premium',
          text: 'Coberturas lisas, flores, toppers discretos e paleta visual combinada com o evento.',
        },
        {
          title: 'Pedido sem confusao',
          text: 'Escolha tamanho, recheio, data de retirada e receba confirmacao clara pelo WhatsApp.',
        },
      ],
      menuItems: [
        {
          name: 'Chocolate belga',
          description: 'Massa cacau, brigadeiro cremoso e ganache brilhante.',
          price: 'a partir de R$ 96',
        },
        {
          name: 'Ninho com morango',
          description: 'Creme de leite Ninho, morangos frescos e massa baunilha.',
          price: 'a partir de R$ 112',
        },
        {
          name: 'Red velvet',
          description: 'Massa aveludada, cream cheese e finalizacao minimalista.',
          price: 'a partir de R$ 128',
        },
        {
          name: 'Cenoura com brigadeiro',
          description: 'Receita afetiva com cobertura densa e decoracao delicada.',
          price: 'a partir de R$ 86',
        },
      ],
      testimonials: [
        {
          quote: 'O bolo chegou impecavel, lindo nas fotos e delicioso ate o ultimo pedaco.',
          author: 'Camila R.',
        },
        {
          quote:
            'A encomenda foi simples, clara e o acabamento ficou mais bonito que a referencia.',
          author: 'Renata M.',
        },
        { quote: 'Virou nosso fornecedor oficial de aniversarios da familia.', author: 'Lucas A.' },
      ],
      panelTitle: 'Transforme sua ideia em um bolo pronto para foto.',
      panelText:
        'Envie a data, quantidade de convidados e referencia visual para receber uma sugestao completa.',
    };
  }

  return {
    brand: requestedTitle,
    pageTitle: requestedTitle,
    eyebrow: 'Experiencia digital profissional',
    headline: requestedTitle,
    lead: 'Uma pagina responsiva com proposta clara, hierarquia visual forte, secoes objetivas e chamadas de acao prontas para transformar visitantes em contatos.',
    primaryCta: 'Conhecer proposta',
    secondaryCta: 'Falar com a equipe',
    contactHref: 'mailto:contato@example.com',
    contactLabel: 'Enviar mensagem',
    heroImage: 'assets/bakery-hero.webp',
    heroImageAlt: 'Imagem editorial de produto usada como exemplo visual da landing page',
    heroCaption: 'Visual de produto para dar contexto real a primeira dobra da pagina.',
    metrics: [
      { value: '01', label: 'mensagem principal clara' },
      { value: '03', label: 'secoes de conversao' },
      { value: '100%', label: 'layout responsivo' },
      { value: 'A11y', label: 'base acessivel' },
    ],
    features: [
      {
        title: 'Oferta direta',
        text: 'Hero com promessa forte, texto curto e botoes que guiam o visitante para a proxima acao.',
      },
      {
        title: 'Conteudo escaneavel',
        text: 'Cards com beneficios, prova social e informacoes organizadas para leitura rapida.',
      },
      {
        title: 'Pronto para evoluir',
        text: 'HTML completo em um arquivo, facil de revisar, aplicar e transformar em componentes depois.',
      },
    ],
    menuItems: [
      {
        name: 'Oferta principal',
        description: 'Descricao objetiva do produto ou servico mais importante.',
        price: 'Destaque',
      },
      {
        name: 'Plano sob medida',
        description: 'Opcao para clientes que precisam falar com a equipe.',
        price: 'Contato',
      },
      {
        name: 'Pacote completo',
        description: 'Uma alternativa mais robusta para vender valor.',
        price: 'Premium',
      },
    ],
    testimonials: [
      { quote: 'A pagina ficou clara, bonita e facil de entender.', author: 'Cliente beta' },
      {
        quote: 'A proposta aparece rapido e o contato esta sempre a mao.',
        author: 'Equipe comercial',
      },
    ],
    panelTitle: 'Revise a proposta e ajuste o tom da marca.',
    panelText:
      'Este fallback local cria uma base profissional quando nenhum provider de IA esta ativo.',
  };
}

function buildProfessionalHtmlFallback(goal: string) {
  const brief = inferSiteBrief(goal);
  const title = brief.pageTitle;
  const metrics = brief.metrics
    .map(
      (metric) =>
        `            <div class="metric"><strong>${metric.value}</strong><span>${metric.label}</span></div>`,
    )
    .join('\n');
  const features = brief.features
    .map(
      (feature) => `        <article class="feature">
          <h3>${feature.title}</h3>
          <p>${feature.text}</p>
        </article>`,
    )
    .join('\n');
  const menuItems = brief.menuItems
    .map(
      (item) => `        <article class="menu-item">
          <div>
            <h3>${item.name}</h3>
            <p>${item.description}</p>
          </div>
          <strong>${item.price}</strong>
        </article>`,
    )
    .join('\n');
  const testimonials = brief.testimonials
    .map(
      (item) => `        <figure class="testimonial">
          <blockquote>${item.quote}</blockquote>
          <figcaption>${item.author}</figcaption>
        </figure>`,
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #fff8f5;
      --surface: #ffffff;
      --surface-soft: #fff0ed;
      --text: #2c1916;
      --muted: #745a55;
      --accent: #b83254;
      --accent-2: #3f7d5c;
      --cocoa: #623827;
      --line: #ead8d1;
      --shadow: 0 18px 42px rgba(75, 38, 28, 0.14);
      font-family: Inter, "Segoe UI", Arial, sans-serif;
    }

    * { box-sizing: border-box; }

    html {
      scroll-behavior: smooth;
    }

    body {
      margin: 0;
      min-height: 100vh;
      color: var(--text);
      background: linear-gradient(180deg, #fff8f5 0%, #fff 42%, #f6fbf4 100%);
    }

    .page {
      width: min(1180px, calc(100% - 32px));
      margin: 0 auto;
      padding: 18px 0 56px;
    }

    .nav, .feature, .menu-item, .testimonial, .panel {
      border: 1px solid var(--line);
      background: rgba(255, 255, 255, 0.86);
      box-shadow: var(--shadow);
    }

    .nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 12px 14px;
      border-radius: 8px;
      position: sticky;
      top: 16px;
      z-index: 10;
      backdrop-filter: blur(16px);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 800;
      letter-spacing: 0;
    }

    .brand-mark {
      width: 34px;
      height: 34px;
      display: grid;
      place-items: center;
      border-radius: 8px;
      background: var(--accent);
      color: #fff;
    }

    .nav-actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .button {
      border: 0;
      border-radius: 8px;
      padding: 11px 15px;
      color: #fff;
      background: var(--accent);
      font-weight: 800;
      text-decoration: none;
      box-shadow: 0 12px 28px rgba(184, 50, 84, 0.22);
      white-space: nowrap;
    }

    .button.secondary {
      color: var(--text);
      background: #fff;
      box-shadow: none;
      border: 1px solid var(--line);
    }

    .hero {
      display: grid;
      grid-template-columns: minmax(0, 0.92fr) minmax(360px, 1.08fr);
      gap: 36px;
      align-items: center;
      min-height: calc(100vh - 96px);
      padding: 52px 0 44px;
    }

    .eyebrow {
      display: inline-flex;
      gap: 8px;
      align-items: center;
      color: var(--accent);
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      font-size: 0.76rem;
    }

    h1 {
      margin: 18px 0 18px;
      font-size: clamp(2.5rem, 6vw, 4.9rem);
      line-height: 0.98;
      letter-spacing: 0;
      max-width: 10ch;
    }

    .lead {
      color: var(--muted);
      font-size: clamp(1rem, 2vw, 1.18rem);
      line-height: 1.7;
      max-width: 62ch;
    }

    .hero-actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: 28px;
    }

    .hero-media {
      display: grid;
      gap: 14px;
    }

    .hero-photo {
      margin: 0;
      border-radius: 8px;
      overflow: hidden;
      background: var(--surface);
      border: 1px solid var(--line);
      box-shadow: var(--shadow);
    }

    .hero-photo img {
      display: block;
      width: 100%;
      aspect-ratio: 4 / 3;
      object-fit: cover;
    }

    .hero-photo figcaption {
      padding: 12px 14px;
      color: var(--muted);
      font-size: 0.94rem;
      background: #fff;
    }

    .metric-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .metric {
      border-radius: 8px;
      padding: 16px;
      background: var(--surface-soft);
      border: 1px solid var(--line);
    }

    .metric strong {
      display: block;
      font-size: 1.55rem;
      color: var(--cocoa);
    }

    .metric span {
      color: var(--muted);
      font-size: 0.9rem;
    }

    .features {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
      margin: 22px 0;
    }

    .feature {
      border-radius: 8px;
      padding: 20px;
    }

    .feature h3 {
      margin: 0 0 8px;
      font-size: 1rem;
    }

    .feature p {
      margin: 0;
      color: var(--muted);
      line-height: 1.55;
    }

    .section-head {
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: 20px;
      margin: 32px 0 14px;
    }

    .section-head h2 {
      margin: 0;
      font-size: clamp(1.8rem, 3vw, 2.6rem);
      line-height: 1.08;
    }

    .menu-grid, .testimonials {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }

    .menu-item {
      border-radius: 8px;
      padding: 18px;
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: start;
    }

    .menu-item h3, .testimonial blockquote {
      margin: 0;
    }

    .menu-item p {
      margin: 7px 0 0;
      color: var(--muted);
      line-height: 1.55;
    }

    .menu-item strong {
      color: var(--accent);
      white-space: nowrap;
    }

    .testimonial {
      border-radius: 8px;
      padding: 20px;
    }

    .testimonial blockquote {
      color: var(--text);
      font-size: 1.05rem;
      line-height: 1.55;
    }

    .testimonial figcaption {
      margin-top: 12px;
      color: var(--accent-2);
      font-weight: 800;
    }

    .panel {
      margin-top: 22px;
      border-radius: 8px;
      padding: 22px;
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 18px;
      align-items: center;
    }

    @media (max-width: 860px) {
      .hero, .features, .panel, .menu-grid, .testimonials, .section-head {
        grid-template-columns: 1fr;
      }

      .hero {
        min-height: auto;
        padding-top: 38px;
      }

      h1 {
        max-width: 100%;
      }

      .nav {
        align-items: flex-start;
        flex-direction: column;
      }

      .nav-actions, .hero-actions {
        width: 100%;
      }

      .button {
        text-align: center;
        flex: 1 1 180px;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <nav class="nav" aria-label="Navegacao principal">
      <div class="brand">
        <span class="brand-mark">${brief.brand.slice(0, 1).toUpperCase()}</span>
        <span>${brief.brand}</span>
      </div>
      <div class="nav-actions">
        <a class="button secondary" href="#features">${brief.primaryCta}</a>
        <a class="button" href="#contact">${brief.contactLabel}</a>
      </div>
    </nav>

    <main>
      <section class="hero" id="start">
        <div>
          <span class="eyebrow">${brief.eyebrow}</span>
          <h1>${brief.headline}</h1>
          <p class="lead">${brief.lead}</p>
          <div class="hero-actions">
            <a class="button" href="#features">${brief.primaryCta}</a>
            <a class="button secondary" href="#contact">${brief.secondaryCta}</a>
          </div>
        </div>

        <div class="hero-media">
          <figure class="hero-photo">
            <img src="${brief.heroImage}" alt="${brief.heroImageAlt}">
            <figcaption>${brief.heroCaption}</figcaption>
          </figure>
          <div class="metric-grid">
${metrics}
          </div>
        </div>
      </section>

      <div class="section-head">
        <div>
          <span class="eyebrow">Por que escolher</span>
          <h2>Feito para ser bonito no evento e memoravel no sabor.</h2>
        </div>
        <p class="lead">Cada detalhe da encomenda foi pensado para reduzir atrito: escolha, confirme e acompanhe tudo com clareza.</p>
      </div>

      <section class="features" id="features">
${features}
      </section>

      <section aria-labelledby="menu-title">
        <div class="section-head">
          <div>
            <span class="eyebrow">Cardapio</span>
            <h2 id="menu-title">Sabores favoritos para pedir hoje.</h2>
          </div>
          <p class="lead">Valores iniciais para bolos pequenos. O orcamento final depende do tamanho, recheio e decoracao.</p>
        </div>
        <div class="menu-grid">
${menuItems}
        </div>
      </section>

      <section aria-labelledby="reviews-title">
        <div class="section-head">
          <div>
            <span class="eyebrow">Depoimentos</span>
            <h2 id="reviews-title">Clientes que voltam na proxima festa.</h2>
          </div>
        </div>
        <div class="testimonials">
${testimonials}
        </div>
      </section>

      <section class="panel" id="contact">
        <div>
          <span class="eyebrow">Contato rapido</span>
          <h2>${brief.panelTitle}</h2>
          <p class="lead">${brief.panelText}</p>
        </div>
        <a class="button" href="${brief.contactHref}">${brief.contactLabel}</a>
      </section>
    </main>
  </div>
</body>
</html>
`;
}

function buildProfessionalMarkdownFallback(goal: string, targetPath: string, projectRoot: string) {
  const title =
    targetPath
      .split('/')
      .pop()
      ?.replace(/\.(md|markdown)$/i, '') || 'Documento';
  return `# ${title}

## Objetivo

${goal}

## Resumo profissional

Este documento foi preparado pelo Nexus Codex como uma proposta revisavel. Ele deve servir como base clara para evoluir o projeto com seguranca, contexto e validacao.

## Contexto

- Projeto: \`${projectRoot}\`
- Fluxo recomendado: plano -> patch review -> aplicacao aprovada -> build/typecheck/testes
- Nivel de confianca: rascunho local, revisar antes de aplicar

## Proposta

1. Revisar o objetivo e confirmar se o escopo esta correto.
2. Aplicar a mudanca somente pelo Patch Review.
3. Rodar validacoes controladas apos aplicar.
4. Registrar decisoes importantes na documentacao do projeto.

## Checklist de qualidade

- [ ] O conteudo esta alinhado ao objetivo do usuario.
- [ ] Nao ha segredo, token ou dado sensivel no arquivo.
- [ ] O texto esta claro para outro desenvolvedor entender depois.
- [ ] Os proximos passos estao objetivos.
`;
}

function buildProfessionalTypeScriptFallback(goal: string) {
  return `export interface NexusGeneratedResult {
  title: string;
  summary: string;
  status: "draft" | "ready";
  nextSteps: string[];
}

export function createNexusGeneratedResult(): NexusGeneratedResult {
  return {
    title: "Proposta Nexus Codex",
    summary: ${JSON.stringify(titleFromGoal(goal))},
    status: "draft",
    nextSteps: [
      "Revisar o patch gerado pelo Nexus.",
      "Adaptar nomes e contratos ao projeto real.",
      "Rodar typecheck/build antes de considerar pronto."
    ]
  };
}
`;
}

export function buildProfessionalFallbackContent(input: {
  goal: string;
  targetPath: string;
  projectRoot: string;
  agentId?: string;
}) {
  const lower = input.targetPath.toLowerCase();
  if (lower.endsWith('.html') || lower.endsWith('.htm')) {
    return buildProfessionalHtmlFallback(input.goal);
  }
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) {
    return buildProfessionalMarkdownFallback(input.goal, input.targetPath, input.projectRoot);
  }
  if (/\.(ts|tsx|js|jsx)$/.test(lower)) {
    return buildProfessionalTypeScriptFallback(input.goal);
  }
  if (lower.endsWith('.json')) {
    return JSON.stringify(
      {
        generatedBy: 'Nexus Codex',
        status: 'draft',
        objective: input.goal,
        reviewRequired: true,
      },
      null,
      2,
    );
  }
  return `Nexus Codex generated draft

Objective:
${input.goal}

Review this proposal before applying it to the active project.
`;
}

export type GenerateCodeInput = {
  agent: AgentDefinition;
  run: AgentRun;
  goal: string;
  skipPlan?: boolean;
};

export type GenerateCodeResult = {
  path: string;
  content: string;
  language: string;
  stack: ProjectStack;
  provider: string;
  model: string | null;
};

export async function generateCodeWithLLM(input: GenerateCodeInput): Promise<GenerateCodeResult> {
  const { agent, run, goal } = input;
  const actualGoal = goal.replace('++CONFIRM_PLAN++', '').trim();
  const stack = await detectProjectStack(run.projectRoot);
  const draftPath = extractRequestedFilePath(actualGoal) || defaultPathForAgent(agent.id, stack);
  const language = languageForPath(draftPath);
  const fileExt = draftPath.split('.').pop() || 'html';

  const stagedFiles = await listStagedFiles();
  const existingStaged = stagedFiles.find((f) => f.path === draftPath);

  let existingOnDisk = '';
  let baselineContent: string | null = null;
  try {
    if (await projectFileExists(run.projectRoot, draftPath)) {
      existingOnDisk = (await readProjectFile(run.projectRoot, draftPath)).content;
      baselineContent = existingOnDisk;
    }
  } catch {
    existingOnDisk = '';
    baselineContent = null;
  }

  const persona = agentCodegenPersona(agent.id);
  const router = new AIProviderRouter();

  let prompt = `${persona}

Voce esta trabalhando dentro do Nexus Codex, um IDE local com Patch Review. O usuario reclamou que codigo basico nao serve: entregue nivel profissional, completo e revisavel.

Pedido do usuario: "${actualGoal}"
Stack do projeto: ${stack.name}
Arquivo alvo: ${draftPath}
Linguagem esperada: ${language}
Agente: ${agent.name}

Padrao minimo de qualidade:
${buildProfessionalStandardsBlock()}

`;

  if (existingStaged?.content) {
    prompt += `Conteudo atual em staging:\n\`\`\`${language}\n${existingStaged.content}\n\`\`\`\n\n`;
  } else if (existingOnDisk) {
    prompt += `Conteudo atual no disco:\n\`\`\`${language}\n${existingOnDisk}\n\`\`\`\n\n`;
  }

  prompt += `Gere o codigo COMPLETO e funcional para este arquivo.

Regras finais:
- Nao responda com explicacao fora do bloco de codigo.
- Nao diga "aqui esta"; entregue somente o bloco.
- Nao deixe funcoes vazias, TODOs ou mock visual pobre.
- Se for UI, inclua hierarquia visual forte, responsividade, copy real e estados de interacao.
- Se for backend, inclua validacao de input, erros claros e tipos/contratos consistentes.
- Se estiver editando arquivo existente, preserve o que ja funciona e melhore sem apagar contexto importante.
- Retorne APENAS o codigo dentro de um bloco \`\`\`${codeFenceLanguage(language)} ... \`\`\``;

  const response = await router.routeChatRequest({
    messages: [{ role: 'user', content: prompt }],
    context: `Geracao de codigo Nexus Codex para ${draftPath}`,
    goal: actualGoal,
    allowPremium: true,
  });

  if (!response.ok && !response.response) {
    throw new Error(response.message || 'Nenhum provider de IA respondeu');
  }

  let content = response.response || '';
  const codeMatch = content.match(/```(?:\w+)?\s*([\s\S]*?)```/);
  if (codeMatch) {
    content = codeMatch[1].trim();
  }

  if (!content.trim()) {
    throw new Error('IA retornou conteudo vazio. Configure um provider em Configuracoes > IA.');
  }

  if (content.trim().length < 160 && !['json', 'markdown'].includes(language)) {
    throw new Error('IA retornou codigo curto demais para uma proposta profissional.');
  }

  await addStagedFile({
    projectRoot: run.projectRoot,
    path: draftPath,
    language,
    content,
    baselineContent,
    source: agent.id,
    run_id: run.id,
  });

  return {
    path: draftPath,
    content,
    language,
    stack,
    provider: response.provider,
    model: response.model,
  };
}

export { shouldRequirePlan, extractRequestedFilePath };
