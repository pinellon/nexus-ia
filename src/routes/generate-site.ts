// src/routes/generate-site.ts
// Full site-generation pipeline:
// 1. Load template from src/templates/<template>/
// 2. Use LLM to generate values for all {{placeholder}} markers
// 3. Inject values into the HTML
// 4. Serve result as JSON, ZIP download, or deploy to Vercel/Netlify

import express from 'express';
import path from 'node:path';
import { readFile, readdir, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createReadStream, existsSync, createWriteStream } from 'node:fs';
// @ts-expect-error - ZipArchive is exported in archiver v8 but typings are outdated
import { ZipArchive } from 'archiver';
import { AIProviderRouter } from '../app/ai/provider-router.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// ─── Types ────────────────────────────────────────────────────────────────────

export type SiteTemplate = 'landing-page' | 'blog' | 'portfolio' | 'ecommerce' | 'custom';

export interface GenerateRequest {
  description: string;
  template?: SiteTemplate;
  deployTarget?: 'vercel' | 'netlify';
  vercelToken?: string;
  netlifyToken?: string;
}

interface SiteFile {
  name: string;
  content: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractPlaceholders(html: string): string[] {
  const matches = html.matchAll(/\{\{(\w+)\}\}/g);
  const unique = new Set<string>();
  for (const m of matches) unique.add(m[1]);
  return [...unique];
}

async function loadTemplate(template: SiteTemplate): Promise<SiteFile[]> {
  const dir = path.resolve(__dirname, '..', 'templates', template);
  const names = await readdir(dir);
  return Promise.all(
    names.map(async (name) => ({
      name,
      content: await readFile(path.join(dir, name), 'utf-8'),
    })),
  );
}

function injectValues(html: string, values: Record<string, string>): string {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? `{{${key}}}`);
}

async function generateValuesWithLLM(
  description: string,
  placeholders: string[],
  template: SiteTemplate,
): Promise<Record<string, string>> {
  const router = new AIProviderRouter();

  const prompt = `You are a professional copywriter and web designer.
The user wants a "${template}" website.
User description: "${description}"

Generate values for each of these template placeholders (JSON only, no markdown):
${placeholders.map((p) => `- ${p}`).join('\n')}

Rules:
- Write in Brazilian Portuguese (pt-BR) unless the description is in another language
- Values must be concise and professional
- For "cta" fields: use compelling action verbs (e.g. "Começar Grátis", "Ver Portfólio")
- For "headline": be impactful, max 5 words
- For "headline_accent": complementary phrase, max 4 words
- For "subheadline": clear value proposition, max 20 words
- For "meta_description": SEO-friendly, 150 chars max
- For "title": page title with brand, 60 chars max
- For "stat_*_value": realistic numbers with units (e.g. "+10k usuários", "4.9★")
- For "stat_*_label": short label (e.g. "Mais de")
- For "features": return 3 HTML cards using this exact pattern:
  <div class="feature-card"><div class="feature-icon">EMOJI</div><h3>TITLE</h3><p>DESCRIPTION</p></div>
- For "products" (ecommerce): return 4 HTML cards:
  <div class="product-card"><div class="product-img">EMOJI</div><div class="product-info"><h3>NAME</h3><span class="price">R$ PRICE</span><span class="old-price">R$ OLD</span><button class="add-to-cart">Adicionar</button></div></div>
- For "projects" (portfolio): return 3 HTML cards:
  <div class="project-card"><h3>NAME</h3><p>DESCRIPTION</p><div class="project-tags"><span class="project-tag">TECH</span></div></div>
- For "posts" (blog): return 3 HTML articles:
  <article class="post-card"><p class="date">DATE</p><h2>TITLE</h2><p>EXCERPT</p><a href="#" class="read-more">Ler mais →</a></article>
- brand: short company/personal name

Return ONLY valid JSON: { "placeholder": "value", ... }`;

  const response = await router.routeChatRequest({
    messages: [{ role: 'user', content: prompt }],
    context: 'Site generator – placeholder values',
    goal: 'Generate website content',
    allowPremium: true,
    forceLocal: false,
  });

  if (!response.ok || !response.response) {
    throw new Error('LLM não respondeu: ' + (response.message ?? 'erro desconhecido'));
  }

  // Parse JSON from response (may be wrapped in markdown)
  const raw = response.response;
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, raw];
  const jsonStr = jsonMatch[1]?.trim() ?? raw.trim();
  const start = jsonStr.indexOf('{');
  const end = jsonStr.lastIndexOf('}');
  return JSON.parse(jsonStr.slice(start, end + 1)) as Record<string, string>;
}

async function generateCompleteSiteWithLLM(
  description: string,
  styleHint: string,
): Promise<string> {
  const router = new AIProviderRouter();

  const prompt = `You are a world-class web designer and front-end developer.
Create a premium, professional, and state-of-the-art website based on the user's description:
"${description}"

Style hint: ${styleHint}

Guidelines:
- Return the COMPLETE single-file HTML code.
- Include a beautiful modern CSS style block inside <head>. Use curated dark/light color palettes, smooth gradients, premium typography (import Inter or Outfit from Google Fonts), glassmorphism, nice cards, custom buttons, hover transitions, and a clean grid layout.
- The website must be fully responsive (mobile-friendly).
- Write all copy in Portuguese (pt-BR).
- Do not use any generic placeholders. Write real, high-quality, persuasive copywriting for headers, services, about section, products/pricing, reviews, contact forms, etc.
- Add some interactive JavaScript features (e.g., interactive booking calculator, tab switcher, FAQ accordion, theme toggle, or animations).
- Return ONLY the raw HTML code starting with <!DOCTYPE html> and ending with </html>. Do not wrap in markdown blocks.`;

  const response = await router.routeChatRequest({
    messages: [{ role: 'user', content: prompt }],
    context: 'Custom Site Generator – Full Code Generation',
    goal: 'Generate custom website HTML',
    allowPremium: true,
    forceLocal: false,
  });

  if (!response.ok || !response.response) {
    throw new Error('LLM não respondeu: ' + (response.message ?? 'erro desconhecido'));
  }

  const raw = response.response;
  const htmlMatch = raw.match(/```(?:html)?\s*([\s\S]*?)```/) || [null, raw];
  return htmlMatch[1]?.trim() ?? raw.trim();
}

function generateValuesOfflineFallback(
  description: string,
  template: SiteTemplate,
): Record<string, string> {
  const desc = description.toLowerCase();

  // Heuristic brand extraction
  let brand = 'Nexus';
  const brandMatch = description.match(
    /(?:chamado|chamada|nome de|empresa|marca)\s+([A-Za-z0-9À-ÿ\s\-]+)/i,
  );
  if (brandMatch && brandMatch[1]) {
    brand = brandMatch[1].split(/[,\.]/)[0].trim();
  } else {
    // Determine default brand based on theme keywords if not explicitly named
    if (/(bolo|doce|confeitaria|padaria|sobremesa)/.test(desc)) {
      brand = 'Doce Sabor';
    } else if (/(tomate|horta|vegetal|fruta|org[aâ]nico|alimento)/.test(desc)) {
      brand = 'Horta Fresca';
    } else if (/(roupa|vestido|moda|camisa|cal[cç]ado|estilo)/.test(desc)) {
      brand = 'Estilo Único';
    } else {
      const words = description.split(/\s+/).filter((w) => w.length > 2);
      if (words.length > 0) {
        brand = words[0].charAt(0).toUpperCase() + words[0].slice(1);
      }
    }
  }

  // Define themed presets
  let title = `${brand} — Soluções Inteligentes`;
  let metaDescription = `Descubra os serviços e soluções incríveis oferecidos por ${brand}. Criado profissionalmente com IA.`;
  let cta = 'Começar Agora';
  let badge = 'Novidade ✨';
  let headline = 'Transforme seus resultados';
  let headlineAccent = 'com tecnologia';
  let subheadline =
    'Plataforma inovadora focada em alta performance, usabilidade e resultados reais para seu negócio.';
  const email = 'contato@exemplo.com';

  // Template-specific fields
  let stat1Label = 'Clientes Satisfeitos';
  let stat1Value = '+10k';
  let stat2Label = 'Avaliação Média';
  let stat2Value = '4.9★';
  let stat3Label = 'Economia Gerada';
  let stat3Value = '40%';
  let featuresHeadline = 'Recursos incríveis para você';
  let featuresHtml = '';
  let ctaHeadline = 'Pronto para escalar seu projeto?';
  let ctaSubheadline =
    'Crie sua conta em menos de 2 minutos e comece a ver os resultados hoje mesmo.';

  let postsHtml = '';

  let contactHeadline = 'Vamos trabalhar juntos?';
  let contactSubheadline = 'Se você tem um projeto desafiador ou uma ideia inovadora, fale comigo.';
  let contactCta = 'Enviar E-mail';
  let projectsHtml = '';

  let promoText = 'FRETE GRÁTIS PARA TODO O BRASIL NAS COMPRAS ACIMA DE R$ 199';
  let bannerHeadline = 'Oferta Especial de Lançamento';
  let bannerSubheadline = 'Use o cupom NEXUS20 e ganhe 20% de desconto em todo o site.';
  let bannerCta = 'Resgatar Desconto';
  let footerDescription = `A melhor seleção de produtos premium escolhidos a dedo para garantir a máxima qualidade e satisfação de nossos clientes.`;
  let productsHtml = '';

  // ─── Theme: Confeitaria / Bolos ───────────────────────────────────────────
  if (/(bolo|doce|confeitaria|padaria|sobremesa)/.test(desc)) {
    title = `${brand} — Bolos e Doces Artesanais`;
    metaDescription = `Os melhores bolos caseiros, artísticos e doces finos de ${brand}. Feitos sob encomenda com ingredientes nobres.`;
    cta = 'Fazer Encomenda';
    badge = 'Doces Artesanais 🍰';
    headline = 'Bolos e doces feitos';
    headlineAccent = 'com amor';
    subheadline =
      'Receitas tradicionais e criações artísticas exclusivas para celebrar os melhores momentos da sua vida.';

    stat1Label = 'Bolos Entregues';
    stat1Value = '+5.000';
    stat2Label = 'Ingredientes';
    stat2Value = '100% Nobres';
    stat3Label = 'Satisfação';
    stat3Value = '4.9★';
    featuresHeadline = 'Por que escolher nossos doces?';
    featuresHtml = `
      <div class="feature-card"><div class="feature-icon">🍰</div><h3>Matéria-prima Nobre</h3><p>Usamos apenas chocolate belga, frutas frescas, manteiga e insumos de altíssima qualidade.</p></div>
      <div class="feature-card"><div class="feature-icon">🚗</div><h3>Entrega Segura</h3><p>Transportamos seu bolo em embalagens térmicas especiais para chegar impecável na sua festa.</p></div>
      <div class="feature-card"><div class="feature-icon">🎨</div><h3>Design Personalizado</h3><p>Criamos decorações exclusivas e personalizadas de acordo com o tema do seu evento.</p></div>
    `;
    ctaHeadline = 'Quer um bolo personalizado para sua festa?';
    ctaSubheadline = 'Fale conosco pelo WhatsApp agora mesmo e monte o bolo dos seus sonhos.';

    postsHtml = `
      <article class="post-card"><p class="date">Hoje</p><h2>Como escolher o tamanho certo do bolo para seu evento</h2><p>Um guia completo de proporções por convidado para evitar desperdícios e garantir que todos fiquem satisfeitos.</p><a href="#" class="read-more">Ler mais →</a></article>
      <article class="post-card"><p class="date">Ontem</p><h2>5 dicas para manter seu bolo caseiro fofinho por mais tempo</h2><p>Truques simples de armazenamento e técnicas de preparo usadas por confeiteiros profissionais.</p><a href="#" class="read-more">Ler mais →</a></article>
      <article class="post-card"><p class="date">Há 3 dias</p><h2>A história do Red Velvet: da tradição americana ao nosso menu</h2><p>Descubra as origens desse bolo clássico e como adaptamos a receita com nosso exclusivo cream cheese.</p><a href="#" class="read-more">Ler mais →</a></article>
    `;

    contactHeadline = 'Quer adoçar o seu dia?';
    contactSubheadline =
      'Entre em contato para encomendar bolos decorados, docinhos ou kits de festa personalizados.';
    contactCta = 'Fazer Pedido';
    projectsHtml = `
      <div class="project-card"><h3>Bolo de Casamento 3 Andares</h3><p>Decoração clássica com flores de açúcar esculpidas à mão e recheio de nozes.</p><div class="project-tags"><span class="project-tag">Casamentos</span><span class="project-tag">Pasta Americana</span></div></div>
      <div class="project-card"><h3>Mesa de Doces Finos</h3><p>Produção completa de brigadeiros gourmet, camafeus e trufas decoradas para festas.</p><div class="project-tags"><span class="project-tag">Eventos</span><span class="project-tag">Doces Finos</span></div></div>
      <div class="project-card"><h3>Bolo Infantil Temático</h3><p>Bolo esculpido e decorado em 3D com personagens modelados à mão.</p><div class="project-tags"><span class="project-tag">Aniversários</span><span class="project-tag">Modelagem</span></div></div>
    `;

    promoText = 'FAÇA SEU PEDIDO HOJE E GANHE 10% DE DESCONTO NO PRIMEIRO BOLO';
    bannerHeadline = 'Encomende seu Kit Festa Completo';
    bannerSubheadline = 'Bolo de 2kg + 50 docinhos tradicionais com preço promocional exclusivo.';
    bannerCta = 'Ver Kits Festa';
    footerDescription =
      'Confeitaria artesanal dedicada a criar memórias inesquecíveis através do sabor clássico dos melhores ingredientes.';
    productsHtml = `
      <div class="product-card"><div class="product-img">🍰</div><div class="product-info"><h3>Bolo de Cenoura com Brigadeiro Gourmet</h3><span class="price">R$ 45,00</span><span class="old-price">R$ 55,00</span><button class="add-to-cart">Adicionar</button></div></div>
      <div class="product-card"><div class="product-img">🧁</div><div class="product-info"><h3>Torta de Limão com Merengue Suíço</h3><span class="price">R$ 59,00</span><span class="old-price">R$ 69,00</span><button class="add-to-cart">Adicionar</button></div></div>
      <div class="product-card"><div class="product-img">🍫</div><div class="product-info"><h3>Caixa Presente 12 Brigadeiros Belgas</h3><span class="price">R$ 35,00</span><span class="old-price">R$ 42,00</span><button class="add-to-cart">Adicionar</button></div></div>
      <div class="product-card"><div class="product-img">🍓</div><div class="product-info"><h3>Naked Cake de Frutas Vermelhas (1,5kg)</h3><span class="price">R$ 95,00</span><span class="old-price">R$ 120,00</span><button class="add-to-cart">Adicionar</button></div></div>
    `;
  }
  // ─── Theme: Hortifrúti / Tomates ──────────────────────────────────────────
  else if (/(tomate|horta|vegetal|fruta|org[aâ]nico|alimento)/.test(desc)) {
    title = `${brand} — Tomates e Orgânicos Frescos`;
    metaDescription = `Tomates selecionados e verduras orgânicas cultivadas de forma sustentável por ${brand}. Direto da terra para sua mesa.`;
    cta = 'Ver Produtos';
    badge = '100% Orgânico 🌱';
    headline = 'Sabor e frescor direto';
    headlineAccent = 'do produtor';
    subheadline =
      'Frutas, verduras e legumes frescos, livres de pesticidas e colhidos no momento exato da maturação.';

    stat1Label = 'Hectares Cultivados';
    stat1Value = '50+';
    stat2Label = 'Parceiros';
    stat2Value = '120 Famílias';
    stat3Label = 'Selo Orgânico';
    stat3Value = 'Certificado';
    featuresHeadline = 'O diferencial dos nossos produtos';
    featuresHtml = `
      <div class="feature-card"><div class="feature-icon">🌱</div><h3>Sem Agrotóxicos</h3><p>Cultivamos alimentos puros e saudáveis através de processos biológicos e sustentáveis.</p></div>
      <div class="feature-card"><div class="feature-icon">🚜</div><h3>Logística Rápida</h3><p>Colhemos na madrugada e entregamos na sua casa no mesmo dia para garantir o frescor absoluto.</p></div>
      <div class="feature-card"><div class="feature-icon">👩‍🌾</div><h3>Apoio Local</h3><p>Valorizamos a agricultura familiar, pagando um preço justo aos pequenos produtores da região.</p></div>
    `;
    ctaHeadline = 'Quer receber alimentos frescos toda semana?';
    ctaSubheadline =
      'Conheça nossos planos de assinatura de cestas orgânicas e receba saúde na sua porta.';

    postsHtml = `
      <article class="post-card"><p class="date">Hoje</p><h2>Licopeno: O segredo dos benefícios do tomate para a saúde</h2><p>Entenda por que o tomate vermelho é um poderoso antioxidante e como consumi-lo para absorver mais nutrientes.</p><a href="#" class="read-more">Ler mais →</a></article>
      <article class="post-card"><p class="date">Ontem</p><h2>Receita fácil de molho rústico de tomate italiano caseiro</h2><p>Passo a passo rápido para preparar um molho encorpado, aromático e perfeito para suas massas.</p><a href="#" class="read-more">Ler mais →</a></article>
      <article class="post-card"><p class="date">Há 3 dias</p><h2>Como conservar legumes e verduras orgânicos por mais tempo</h2><p>Dicas simples de higienização e embalagem para manter o frescor dos seus alimentos na geladeira.</p><a href="#" class="read-more">Ler mais →</a></article>
    `;

    contactHeadline = 'Fale com nosso produtor';
    contactSubheadline = 'Dúvidas sobre entregas, pedidos corporativos ou parcerias comerciais?';
    contactCta = 'Enviar Mensagem';
    projectsHtml = `
      <div class="project-card"><h3>Estufa Hidropônica Automatizada</h3><p>Implementação de estufa inteligente de tomate cereja com controle digital de nutrientes.</p><div class="project-tags"><span class="project-tag">Hidropatia</span><span class="project-tag">Tecnologia</span></div></div>
      <div class="project-card"><h3>Horta Urbana Comunitária</h3><p>Projeto de revitalização e plantio de hortaliças em espaços públicos urbanos.</p><div class="project-tags"><span class="project-tag">Social</span><span class="project-tag">Sustentabilidade</span></div></div>
      <div class="project-card"><h3>Irrigação por Gotejamento Solar</h3><p>Criação de um sistema sustentável de irrigação de baixo consumo de água alimentado por energia solar.</p><div class="project-tags"><span class="project-tag">Eco</span><span class="project-tag">Irrigação</span></div></div>
    `;

    promoText = 'FRETE GRÁTIS NAS COMPRAS ACIMA DE R$ 80 — PRODUTOS DIRETO DA TERRA';
    bannerHeadline = 'Assine nossa Cesta Orgânica Semanal';
    bannerSubheadline =
      'Selecione seus itens favoritos e monte um plano recorrente com 15% de desconto fixo.';
    bannerCta = 'Escolher Cesta';
    footerDescription =
      'Compromisso com o meio ambiente e com a sua saúde, levando alimentos puros e deliciosos até a sua mesa.';
    productsHtml = `
      <div class="product-card"><div class="product-img">🍅</div><div class="product-info"><h3>Tomate Italiano Orgânico (1kg)</h3><span class="price">R$ 11,90</span><span class="old-price">R$ 15,90</span><button class="add-to-cart">Adicionar</button></div></div>
      <div class="product-card"><div class="product-img">🥬</div><div class="product-info"><h3>Cesta Legumes Orgânicos Variados</h3><span class="price">R$ 49,00</span><span class="old-price">R$ 59,00</span><button class="add-to-cart">Adicionar</button></div></div>
      <div class="product-card"><div class="product-img">🍇</div><div class="product-info"><h3>Tomate Cereja Sweet Grape (250g)</h3><span class="price">R$ 6,50</span><span class="old-price">R$ 7,90</span><button class="add-to-cart">Adicionar</button></div></div>
      <div class="product-card"><div class="product-img">🏺</div><div class="product-info"><h3>Molho de Tomate Rústico (450ml)</h3><span class="price">R$ 16,00</span><span class="old-price">R$ 20,00</span><button class="add-to-cart">Adicionar</button></div></div>
    `;
  }
  // ─── Theme: Moda / Roupas ────────────────────────────────────────────────
  else if (/(roupa|vestido|moda|camisa|cal[cç]ado|estilo)/.test(desc)) {
    title = `${brand} — Moda e Estilo Contemporâneo`;
    metaDescription = `Coleções exclusivas de vestuário e acessórios na loja ${brand}. Compre moda sustentável com caimento premium.`;
    cta = 'Comprar Coleção';
    badge = 'Coleção Nova ✨';
    headline = 'Estilo e conforto para';
    headlineAccent = 'o seu dia a dia';
    subheadline =
      'Cortes atemporais, tecidos sustentáveis de alto padrão e caimento perfeito que valoriza a sua personalidade.';

    stat1Label = 'Modelos Exclusivos';
    stat1Value = '500+';
    stat2Label = 'Tecidos';
    stat2Value = '100% Ecológicos';
    stat3Label = 'Trocas';
    stat3Value = 'Grátis (30d)';
    featuresHeadline = 'O padrão de qualidade da nossa marca';
    featuresHtml = `
      <div class="feature-card"><div class="feature-icon">✨</div><h3>Algodão Egípcio</h3><p>Roupas fabricadas com as fibras de algodão mais longas e macias do mercado mundial.</p></div>
      <div class="feature-card"><div class="feature-icon">🧵</div><h3>Alta Costura</h3><p>Costuras reforçadas e acabamento manual impecável para garantir máxima durabilidade.</p></div>
      <div class="feature-card"><div class="feature-icon">♻️</div><h3>Moda Consciente</h3><p>Processo de fabricação eco-friendly com tinturas naturais e embalagens biodegradáveis.</p></div>
    `;
    ctaHeadline = 'Ganhe 15% de desconto no seu primeiro pedido';
    ctaSubheadline =
      'Cadastre-se na nossa newsletter e receba lançamentos exclusivos e ofertas antecipadas.';

    postsHtml = `
      <article class="post-card"><p class="date">Hoje</p><h2>Como criar um guarda-roupa cápsula funcional para trabalho</h2><p>Aprenda a escolher 10 peças-chave de alta qualidade que podem ser combinadas em mais de 30 looks diferentes.</p><a href="#" class="read-more">Ler mais →</a></article>
      <article class="post-card"><p class="date">Ontem</p><h2>As cores que vão dominar a moda urbana na próxima estação</h2><p>Uma análise das paletas e tons em alta no streetwear europeu e como integrá-los no seu estilo diário.</p><a href="#" class="read-more">Ler mais →</a></article>
      <article class="post-card"><p class="date">Há 3 dias</p><h2>Como lavar e conservar suas peças de linho e algodão nobre</h2><p>Dicas e cuidados essenciais de lavagem e secagem para evitar encolhimento e manter as roupas novas por anos.</p><a href="#" class="read-more">Ler mais →</a></article>
    `;

    contactHeadline = 'Atendimento ao Cliente';
    contactSubheadline = 'Dúvidas sobre tamanhos, tabela de medidas ou políticas de trocas?';
    contactCta = 'Falar Conosco';
    projectsHtml = `
      <div class="project-card"><h3>Desfile Primavera-Verão 2025</h3><p>Desenvolvimento conceitual e produção executiva da coleção de alfaiataria sustentável.</p><div class="project-tags"><span class="project-tag">Passarela</span><span class="project-tag">Design</span></div></div>
      <div class="project-card"><h3>Lookbook Editorial Minimalista</h3><p>Fotografia e styling para a nova coleção de roupas básicas atemporais.</p><div class="project-tags"><span class="project-tag">Editorial</span><span class="project-tag">Fotografia</span></div></div>
      <div class="project-card"><h3>Parceria Sustentável</h3><p>Campanha de reciclagem de tecidos antigos em parceria com cooperativas de costureiras locais.</p><div class="project-tags"><span class="project-tag">Eco</span><span class="project-tag">Circular</span></div></div>
    `;

    promoText = 'FRETE GRÁTIS EM COMPRAS ACIMA DE R$ 199 E TROCA GRÁTIS DE 30 DIAS';
    bannerHeadline = 'Grande Liquidação de Estação';
    bannerSubheadline =
      'Leve 3 peças selecionadas e pague apenas 2 usando o cupom MODA3X2 no checkout.';
    bannerCta = 'Ver Produtos Selecionados';
    footerDescription =
      'Criando vestuários sofisticados, duráveis e confortáveis para pessoas que valorizam estilo e sustentabilidade.';
    productsHtml = `
      <div class="product-card"><div class="product-img">👕</div><div class="product-info"><h3>Camiseta Algodão Egípcio Minimalista</h3><span class="price">R$ 79,00</span><span class="old-price">R$ 99,00</span><button class="add-to-cart">Adicionar</button></div></div>
      <div class="product-card"><div class="product-img">👖</div><div class="product-info"><h3>Calça Chino Slim Comfort</h3><span class="price">R$ 159,00</span><span class="old-price">R$ 199,00</span><button class="add-to-cart">Adicionar</button></div></div>
      <div class="product-card"><div class="product-img">🧥</div><div class="product-info"><h3>Jaqueta Corta-Vento Impermeável</h3><span class="price">R$ 219,00</span><span class="old-price">R$ 279,00</span><button class="add-to-cart">Adicionar</button></div></div>
      <div class="product-card"><div class="product-img">👟</div><div class="product-info"><h3>Tênis Casual Slip-on em Couro Eco</h3><span class="price">R$ 249,00</span><span class="old-price">R$ 299,00</span><button class="add-to-cart">Adicionar</button></div></div>
    `;
  }
  // ─── Theme: Tecnologia / SaaS (Default) ──────────────────────────────────
  else {
    featuresHtml = `
      <div class="feature-card"><div class="feature-icon">⚡</div><h3>Ultra Velocidade</h3><p>Infraestrutura moderna e otimizada para carregar suas páginas instantaneamente.</p></div>
      <div class="feature-card"><div class="feature-icon">🛡️</div><h3>Segurança Integrada</h3><p>Seus dados e informações sempre protegidos com criptografia de ponta a ponta.</p></div>
      <div class="feature-card"><div class="feature-icon">📊</div><h3>Analytics Completo</h3><p>Painel inteligente para acompanhar cada métrica e tomar decisões baseadas em dados.</p></div>
    `;
    postsHtml = `
      <article class="post-card"><p class="date">Hoje</p><h2>Como começar seu novo projeto de forma profissional</h2><p>Dicas essenciais e ferramentas de ponta para iniciar sua jornada com excelência no mercado atual.</p><a href="#" class="read-more">Ler mais →</a></article>
      <article class="post-card"><p class="date">Ontem</p><h2>As tendências de design e desenvolvimento para os próximos anos</h2><p>Uma análise profunda sobre o que há de mais moderno em interfaces e arquitetura de software.</p><a href="#" class="read-more">Ler mais →</a></article>
      <article class="post-card"><p class="date">Há 3 dias</p><h2>Guia prático para escalar sua aplicação com segurança</h2><p>Aprenda a estruturar servidores e bancos de dados para aguentar milhões de acessos simultâneos.</p><a href="#" class="read-more">Ler mais →</a></article>
    `;
    projectsHtml = `
      <div class="project-card"><h3>Plataforma SaaS</h3><p>Desenvolvimento completo de um painel financeiro interativo em tempo real.</p><div class="project-tags"><span class="project-tag">React</span><span class="project-tag">Node.js</span></div></div>
      <div class="project-card"><h3>E-commerce Moderno</h3><p>Loja virtual otimizada com checkout em 1 clique e design focado em conversão.</p><div class="project-tags"><span class="project-tag">Next.js</span><span class="project-tag">Stripe</span></div></div>
      <div class="project-card"><h3>App Mobile Nativo</h3><p>Aplicativo de delivery e logística integrada com mapas e notificações push.</p><div class="project-tags"><span class="project-tag">React Native</span><span class="project-tag">Firebase</span></div></div>
    `;
    productsHtml = `
      <div class="product-card"><div class="product-img">🎧</div><div class="product-info"><h3>Headphone Premium Noise Cancelling</h3><span class="price">R$ 599,00</span><span class="old-price">R$ 799,00</span><button class="add-to-cart">Adicionar</button></div></div>
      <div class="product-card"><div class="product-img">⌚</div><div class="product-info"><h3>Smartwatch Monitor Cardíaco</h3><span class="price">R$ 299,00</span><span class="old-price">R$ 399,00</span><button class="add-to-cart">Adicionar</button></div></div>
      <div class="product-card"><div class="product-img">🎒</div><div class="product-info"><h3>Mochila Impermeável Anti-Furto</h3><span class="price">R$ 189,00</span><span class="old-price">R$ 249,00</span><button class="add-to-cart">Adicionar</button></div></div>
      <div class="product-card"><div class="product-img">🔌</div><div class="product-info"><h3>Carregador Sem Fio por Indução</h3><span class="price">R$ 99,00</span><span class="old-price">R$ 149,00</span><button class="add-to-cart">Adicionar</button></div></div>
    `;
  }

  // Base setup
  const base: Record<string, string> = {
    brand,
    name: brand,
    title,
    meta_description: metaDescription,
    cta,
    badge,
    headline,
    headline_accent: headlineAccent,
    subheadline,
    footer_text: `© ${new Date().getFullYear()} ${brand}. Todos os direitos reservados.`,
    email,
  };

  if (template === 'landing-page') {
    return {
      ...base,
      stat_1_label: stat1Label,
      stat_1_value: stat1Value,
      stat_2_label: stat2Label,
      stat_2_value: stat2Value,
      stat_3_label: stat3Label,
      stat_3_value: stat3Value,
      features_headline: featuresHeadline,
      features: featuresHtml,
      cta_headline: ctaHeadline,
      cta_subheadline: ctaSubheadline,
    };
  }

  if (template === 'blog') {
    return {
      ...base,
      title: `Blog Oficial — ${brand}`,
      posts: postsHtml,
    };
  }

  if (template === 'portfolio') {
    return {
      ...base,
      contact_headline: contactHeadline,
      contact_subheadline: contactSubheadline,
      contact_cta: contactCta,
      contact_base_url: '#',
      projects: projectsHtml,
    };
  }

  if (template === 'ecommerce') {
    return {
      ...base,
      promo_text: promoText,
      banner_headline: bannerHeadline,
      banner_subheadline: bannerSubheadline,
      banner_cta: bannerCta,
      footer_description: footerDescription,
      products: productsHtml,
    };
  }

  return base;
}

async function buildZip(files: SiteFile[], outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outPath);
    const archive = new ZipArchive({ zlib: { level: 9 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    for (const file of files) {
      archive.append(file.content, { name: file.name });
    }
    archive.finalize();
  });
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /api/generate-site
 * Body: { description, template?, deployTarget?, vercelToken?, netlifyToken? }
 * Returns: { ok, files, zipUrl }
 */
router.post('/generate-site', async (req, res) => {
  const {
    description = '',
    template = 'landing-page',
    deployTarget,
    vercelToken,
    netlifyToken,
  } = req.body as GenerateRequest;

  if (!description.trim()) {
    return res.status(400).json({ ok: false, error: 'description é obrigatório' });
  }

  try {
    let generatedFiles: { name: string; content: string }[] = [];

    let values: Record<string, string> = {};

    if (template === 'custom') {
      try {
        const customHtml = await generateCompleteSiteWithLLM(description, template);
        generatedFiles = [{ name: 'index.html', content: customHtml }];
      } catch (err) {
        console.warn('[generate-site] Custom LLM failed, using offline fallback:', err);
        // Fall back to offline themed landing page
        values = generateValuesOfflineFallback(description, 'landing-page');
        const filesTemplate = await loadTemplate('landing-page');
        generatedFiles = filesTemplate.map((file) => ({
          name: file.name,
          content: injectValues(file.content, values),
        }));
      }
    } else {
      // 1. Load template files
      const files = await loadTemplate(template as SiteTemplate);

      // 2. Extract placeholders from all files
      const allPlaceholders = new Set<string>();
      for (const file of files) {
        for (const p of extractPlaceholders(file.content)) {
          allPlaceholders.add(p);
        }
      }

      // 3. Generate values with LLM (with offline heuristic fallback)
      if (allPlaceholders.size > 0) {
        try {
          values = await generateValuesWithLLM(
            description,
            [...allPlaceholders],
            template as SiteTemplate,
          );
        } catch (err) {
          console.warn('[generate-site] LLM failed, using offline fallback:', err);
          values = generateValuesOfflineFallback(description, template as SiteTemplate);
        }
      }

      // 4. Inject values into files
      generatedFiles = files.map((file) => ({
        name: file.name,
        content: injectValues(file.content, values),
      }));
    }

    // 5. Build ZIP
    const tmpDir = path.resolve(__dirname, '../../.tmp-preview');
    await mkdir(tmpDir, { recursive: true });
    const zipName = `site-${Date.now()}.zip`;
    const zipPath = path.join(tmpDir, zipName);
    await buildZip(generatedFiles, zipPath);

    // 6. Deploy if requested
    let deployUrl: string | null = null;
    if (deployTarget === 'vercel' && vercelToken) {
      deployUrl = await deployToVercel(generatedFiles, vercelToken, description);
    } else if (deployTarget === 'netlify' && netlifyToken) {
      deployUrl = await deployToNetlify(generatedFiles, netlifyToken, description);
    }

    return res.json({
      ok: true,
      files: generatedFiles,
      values,
      zipUrl: `/api/download-site/${zipName}`,
      deployUrl,
    });
  } catch (error) {
    console.error('[generate-site]', error);
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Erro interno na geração',
    });
  }
});

/**
 * GET /api/download-site/:filename
 * Serves the generated ZIP file
 */
router.get('/download-site/:filename', async (req, res) => {
  const filename = path.basename(req.params.filename ?? '');
  if (!filename.endsWith('.zip')) {
    return res.status(400).json({ ok: false, error: 'Arquivo inválido' });
  }
  const tmpDir = path.resolve(__dirname, '../../.tmp-preview');
  const zipPath = path.join(tmpDir, filename);
  if (!existsSync(zipPath)) {
    return res.status(404).json({ ok: false, error: 'Arquivo não encontrado' });
  }
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="site.zip"`);
  createReadStream(zipPath).pipe(res);
});

/**
 * GET /api/templates
 * Lists all available templates
 */
router.get('/templates', async (_req, res) => {
  const templatesDir = path.resolve(__dirname, '..', 'templates');
  try {
    const entries = await readdir(templatesDir, { withFileTypes: true });
    const templates = entries.filter((e) => e.isDirectory()).map((e) => e.name);
    return res.json({ ok: true, templates });
  } catch {
    return res.json({ ok: true, templates: ['landing-page', 'blog', 'portfolio', 'ecommerce'] });
  }
});

// ─── Deploy helpers ───────────────────────────────────────────────────────────

async function deployToVercel(
  files: SiteFile[],
  token: string,
  projectName: string,
): Promise<string> {
  const slug = projectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 40);

  const filesPayload = files.map((f) => ({
    file: f.name,
    data: Buffer.from(f.content).toString('base64'),
    encoding: 'base64',
  }));

  const resp = await fetch('https://api.vercel.com/v13/deployments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: `nexus-site-${slug}`,
      files: filesPayload,
      projectSettings: { framework: null },
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Vercel deploy falhou: ${err}`);
  }

  const data = (await resp.json()) as { url?: string; alias?: string[] };
  return `https://${data.url ?? data.alias?.[0] ?? 'vercel.app'}`;
}

async function deployToNetlify(
  files: SiteFile[],
  token: string,
  siteName: string,
): Promise<string> {
  const slug = siteName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 40);

  // Create site first
  const siteResp = await fetch('https://api.netlify.com/api/v1/sites', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: `nexus-${slug}-${Date.now()}` }),
  });

  if (!siteResp.ok) {
    throw new Error(`Netlify create site falhou: ${await siteResp.text()}`);
  }

  const site = (await siteResp.json()) as { id: string; url: string };

  // Build a temp zip to upload
  const tmpDir = path.resolve(__dirname, '../../.tmp-preview');
  await mkdir(tmpDir, { recursive: true });
  const zipPath = path.join(tmpDir, `netlify-${Date.now()}.zip`);
  await buildZip(files, zipPath);

  const zipBuffer = await readFile(zipPath);

  const deployResp = await fetch(`https://api.netlify.com/api/v1/sites/${site.id}/deploys`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/zip',
    },
    body: zipBuffer,
  });

  // Cleanup temp zip
  await rm(zipPath).catch(() => null);

  if (!deployResp.ok) {
    throw new Error(`Netlify deploy falhou: ${await deployResp.text()}`);
  }

  return site.url;
}

// ─── Register ─────────────────────────────────────────────────────────────────

export function registerGenerateSiteRoutes(app: express.Express) {
  app.use('/api', router);
}
