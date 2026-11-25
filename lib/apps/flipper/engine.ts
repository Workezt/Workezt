/* eslint-disable */
// @ts-nocheck — copia literal del motor JavaScript de OR-K Flipper (ver encabezado)
/* =====================================================================
   OR-K FLIPPER · MOTOR DE CÁLCULO Y PROPUESTA
   Copia fiel del motor de OR-K Flipper (archivo HTML independiente):
   sin dependencias del DOM, todos los importes en ENTEROS COP y porcentajes
   en puntos básicos. No editar las fórmulas sin revisar el original.
   ===================================================================== */
const ORK_ASSETS = {};
const Engine = (() => {
  'use strict';

  const SCHEMA_VERSION = 1;
  const APPROVED_STATES = ['Aprobada', 'En ejecución', 'Terminada'];
  const REQUEST_STATES = ['Pendiente', 'Estimada', 'Aprobada', 'En ejecución', 'Terminada'];
  const PRIORITIES = ['Baja', 'Media', 'Alta'];
  const QUOTE_STATES = ['Borrador', 'Presentada', 'Aprobada', 'Rechazada', 'Vencida'];

  /* ---------- utilidades ---------- */
  const uid = (p = 'id') => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const int = (v) => { const n = Math.round(Number(String(v ?? '').toString().replace(/[^\d.-]/g, ''))); return Number.isFinite(n) ? n : 0; };
  const nonNeg = (v) => Math.max(0, int(v));
  const pctToBp = (v) => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? Math.round(n * 100) : 0; };
  /** a * bp / 10000 redondeado al peso (half-up, simétrico) */
  const applyBp = (amount, bp) => {
    const raw = amount * bp; const sign = raw < 0 ? -1 : 1;
    return sign * Math.floor((Math.abs(raw) + 5000) / 10000);
  };
  const roundDiv = (a, b) => (b === 0 ? 0 : Math.round(a / b));

  function fmtCOP(n) {
    const v = int(n); const s = Math.abs(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (v < 0 ? '-$' : '$') + s;
  }
  function fmtNum(n) { return int(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

  /** Reparte un entero total según pesos (enteros o decimales) con
   *  método de mayor residuo. Devuelve enteros que suman exactamente
   *  round(total * sum(w) / denom), con tope en total. */
  function splitInt(total, weights, denom) {
    const sw = weights.reduce((a, b) => a + b, 0);
    if (!denom || sw <= 0 || total <= 0) return weights.map(() => 0);
    const target = Math.min(total, Math.round(total * Math.min(sw, denom) / denom));
    const raw = weights.map((w) => (total * w) / denom);
    const base = raw.map((r) => Math.floor(r));
    let rest = target - base.reduce((a, b) => a + b, 0);
    const order = raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0]);
    for (let k = 0; k < order.length && rest > 0; k++) { if (weights[order[k][1]] > 0) { base[order[k][1]]++; rest--; } }
    return base;
  }

  /* ---------- catálogo inicial (v2) ----------
     Cada recurso tiene:
       perUnit   cantidad incluida por unidad
       refValue  valor de referencia (COP) dentro del paquete; la suma
                 perUnit × refValue de los recursos = precio del paquete
       hours     horas internas estimadas por elemento (nunca se muestran al cliente)
       adjustable si el cliente puede quitar o agregar elementos
     fixedHours: horas internas fijas por unidad (planeación, informes, reuniones). */
  const CATALOG_REV = 5;
  const TECH_WORK_TYPES = ['Nueva herramienta', 'Landing page o micrositio', 'Dashboard o tablero de indicadores', 'Integración sencilla (API o webhook)', 'Automatizaciones básicas', 'Formularios y validaciones', 'Reportes', 'Herramientas comerciales pequeñas', 'Ajustes de interfaz', 'Mejoras de funcionalidades existentes', 'Mantenimiento correctivo', 'Soporte técnico', 'Otros requerimientos aprobados'];
  /* Colores por capacidad (paleta OR-K): amatista, magenta, cobre y lirio. */
  const CAP_COLORS = { cap_tech: '#9B4DFF', cap_design: '#E0218A', cap_community: '#D08A5B', cap_marketing: '#7C83F0' };
  const COMBO_CAPS = ['cap_tech', 'cap_design', 'cap_community', 'cap_marketing'];
  function defaultCatalog() {
    return [
      {
        id: 'cap_tech', code: 'TECH', name: 'Technology & Development',
        tagline: 'Desarrollo tecnológico y evolución de plataformas',
        description: 'Capacidad mensual de evolución tecnológica sobre plataformas existentes: mejoras funcionales, ajustes, automatizaciones básicas y soporte, con seguimiento técnico.',
        price: 5000000, unitLabel: 'Unidad mensual', active: true, taxable: true, color: CAP_COLORS.cap_tech, icon: 'code', engine: 'requests', fixedHours: 6,
        resources: [
          { key: 'hours', label: 'Horas técnicas', short: 'h', perUnit: 32, allocatable: true, refValue: 156250, hours: 1, adjustable: true },
          { key: 'requests', label: 'Solicitudes pequeñas', short: 'sol.', perUnit: 4, allocatable: true, refValue: 0, hours: 0, adjustable: false }
        ],
        workTypes: ['Nueva herramienta', 'Landing page o micrositio', 'Dashboard o tablero de indicadores', 'Integración sencilla (API o webhook)', 'Automatizaciones básicas', 'Formularios y validaciones', 'Reportes', 'Herramientas comerciales pequeñas', 'Ajustes de interfaz', 'Mejoras de funcionalidades existentes', 'Mantenimiento correctivo', 'Soporte técnico', 'Otros requerimientos aprobados'],
        included: ['Bolsa de 32 horas técnicas mensuales', 'Hasta 4 solicitudes pequeñas de desarrollo', 'Mantenimiento correctivo menor', 'Mejoras funcionales sobre plataformas existentes', 'Ajustes de interfaz y de experiencia de usuario', 'Formularios, reportes y herramientas comerciales sencillas', 'Automatizaciones básicas', 'Seguimiento y reporte técnico mensual'],
        limits: ['Máximo 32 horas mensuales por unidad', 'Máximo 4 solicitudes pequeñas por unidad', 'Contratar varias unidades no garantiza la viabilidad técnica de cualquier solicitud'],
        exclusions: ['Desarrollo de nuevas plataformas completas', 'Integraciones complejas con ERP', 'Aplicaciones móviles completas', 'Arquitectura tecnológica de gran escala', 'Infraestructura cloud y hosting', 'Licencias y servicios externos', 'Desarrollos que requieran análisis técnico especial'],
        conditions: 'Los trabajos excluidos se cotizan como proyectos independientes.',
        extras: []
      },
      {
        id: 'cap_design', code: 'DESIGN', name: 'Corporate Design',
        tagline: 'Diseño corporativo, comercial y publicitario',
        description: 'Diseño mensual de piezas gráficas corporativas y comerciales y un catálogo, distribuibles entre las marcas del cliente.',
        price: 3800000, unitLabel: 'Unidad mensual', active: true, taxable: true, color: CAP_COLORS.cap_design, icon: 'pen', engine: 'buckets', fixedHours: 0,
        resources: [
          { key: 'pieces', label: 'Piezas gráficas (una sola pieza)', short: 'piezas', perUnit: 10, allocatable: true, refValue: 250000, hours: 2, adjustable: true },
          { key: 'catalog', label: 'Catálogo (hasta 10 hojas)', short: 'catálogo', perUnit: 1, allocatable: true, refValue: 1300000, hours: 14, adjustable: true }
        ],
        deliverables: [],
        included: ['10 piezas gráficas de una sola pieza: banners, flyers, pendones o merchandising', '1 catálogo de hasta 10 hojas', 'Distribución libre de las piezas entre las marcas', 'Hasta dos rondas razonables de ajustes por entregable'],
        limits: ['Las cantidades por tipo no son intercambiables', 'Los ajustes se realizan dentro del alcance aprobado de cada pieza'],
        exclusions: ['Fotografía', 'Catálogos de más de 10 hojas', 'Renders e ilustraciones técnicas complejas', 'Traducciones', 'Diagramaciones extraordinarias'],
        conditions: 'No incluye fotografía. Para generar imágenes con inteligencia artificial, el cliente asume una suscripción mensual de ChatGPT y una de Gemini, pagadas a OR-K o abiertas a nombre del cliente con acceso para OR-K.',
        extras: []
      },
      {
        id: 'cap_community', code: 'COMMUNITY', name: 'Community & Content',
        tagline: 'Gestión de redes sociales y contenido corporativo',
        description: 'Contenido original mensual para redes sociales con planeación editorial, copywriting, programación y análisis de resultados.',
        price: 3800000, unitLabel: 'Unidad mensual', active: true, taxable: true, color: CAP_COLORS.cap_community, icon: 'chat', engine: 'buckets', fixedHours: 10,
        resources: [
          { key: 'posts', label: 'Publicaciones de grilla (post, carrusel o one slide)', short: 'posts', perUnit: 8, allocatable: true, refValue: 190000, hours: 1.5, adjustable: true },
          { key: 'reels', label: 'Reels editados', short: 'reels', perUnit: 4, allocatable: true, refValue: 427500, hours: 2.5, adjustable: true },
          { key: 'stories', label: 'Historias de imagen', short: 'historias', perUnit: 8, allocatable: true, refValue: 71250, hours: 0.5, adjustable: true }
        ],
        included: ['8 publicaciones de grilla: post sencillo, carrusel o one slide', '4 reels editados', '8 historias de imagen', 'Planeación editorial y calendario mensual', 'Copywriting y programación', 'Informe mensual y reunión de resultados de hasta 45 minutos'],
        limits: ['Cada concepto original equivale a un entregable', 'Publicar una pieza en dos redes no duplica el número de contenidos', 'Las cantidades por tipo no son intercambiables'],
        exclusions: ['Fotografía', 'Producción audiovisual presencial', 'Gestión comunitaria (respuesta de comentarios y mensajes)'],
        conditions: 'Los reels incluyen edición con material suministrado por el cliente. No incluye fotografía; para imágenes con inteligencia artificial, el cliente asume una suscripción mensual de ChatGPT y una de Gemini, pagadas a OR-K o abiertas a nombre del cliente con acceso para OR-K.',
        extras: []
      },
      {
        id: 'cap_marketing', code: 'MARKETING', name: 'Marketing & Performance',
        tagline: 'Marketing digital y publicidad orientada a resultados',
        description: 'Gestión profesional de campañas en Meta Ads y Google Ads: planeación, segmentación, optimización semanal, seguimiento de conversiones y reporte.',
        price: 5000000, unitLabel: 'Unidad mensual', active: true, taxable: true, color: CAP_COLORS.cap_marketing, icon: 'chart', engine: 'buckets', fixedHours: 6,
        resources: [
          { key: 'meta', label: 'Campañas Meta Ads', short: 'Meta', perUnit: 2, allocatable: true, refValue: 1666667, hours: 8, adjustable: true },
          { key: 'google', label: 'Campañas Google Ads', short: 'Google', perUnit: 1, allocatable: true, refValue: 1666666, hours: 8, adjustable: true }
        ],
        included: ['2 campañas activas en Meta Ads', '1 campaña activa en Google Ads', 'Planeación publicitaria y segmentación', 'Optimización semanal y seguimiento básico de conversiones', 'Dashboard e informe mensual', 'Reunión mensual de performance'],
        limits: ['La inversión publicitaria (pauta) no está incluida en los honorarios', 'Las creatividades las produce OR-K solo para marcas que también tienen Community & Content; en los demás casos el cliente las suministra'],
        exclusions: ['Presupuesto de pauta en plataformas', 'Producción de creatividades para marcas sin Community & Content'],
        conditions: 'Los indicadores son objetivos y campos de seguimiento; no constituyen resultados garantizados.',
        extras: [], usesAdBudget: true
      }
    ];
  }

  const DEFAULT_KPIS = ['Alcance', 'Impresiones', 'Clics', 'CTR', 'CPC', 'Leads', 'Costo por lead', 'Leads calificados', 'Solicitudes de cotización', 'Conversiones', 'Ventas atribuibles', 'ROAS (si existe información verificable)'];

  function defaultSettings() {
    return {
      companyName: 'OR-K', tagline: 'Business Innovation & Technology', motto: 'Understand. Transform. Scale.',
      ivaPct: 19, marginTargetPct: 60, marginTolerancePct: 5, maxDiscountPct: 15, validityDays: 30, catalogRev: CATALOG_REV,
      pricing: defaultPricing(), team: defaultTeam(), capProfiles: defaultCapProfiles(),
      quotePrefix: 'ORK', enableOtherMedia: false, logo: null,
      kpiCatalog: DEFAULT_KPIS.slice(),
      supplementTemplates: [
        { id: 'st_coord', name: 'Coordinación de múltiples responsables', description: 'Interlocución con varios responsables por marca.', value: 0, periodicity: 'Mensual' },
        { id: 'st_accounts', name: 'Diferentes cuentas publicitarias', description: 'Gestión de cuentas publicitarias independientes por marca.', value: 0, periodicity: 'Mensual' },
        { id: 'st_calendars', name: 'Distintos calendarios editoriales', description: 'Calendarios y líneas editoriales separadas.', value: 0, periodicity: 'Mensual' },
        { id: 'st_platforms', name: 'Varias plataformas tecnológicas', description: 'Intervención sobre más de una plataforma.', value: 0, periodicity: 'Mensual' },
        { id: 'st_approvals', name: 'Procesos de aprobación independientes', description: 'Flujos de aprobación separados por marca.', value: 0, periodicity: 'Mensual' },
        { id: 'st_meetings', name: 'Reuniones adicionales', description: 'Sesiones adicionales a las incluidas.', value: 0, periodicity: 'Mensual' }
      ],
      conditions: [
        'Valores expresados en pesos colombianos (COP). Los honorarios de OR-K se presentan antes de IVA; el IVA se liquida a la tasa vigente.',
        'Los honorarios corresponden a capacidades mensuales recurrentes según las unidades contratadas.',
        'La inversión publicitaria (pauta) no está incluida en los honorarios de OR-K, se presenta por separado y puede ser facturada directamente al cliente por las plataformas.',
        'Licencias, hosting, infraestructura cloud, producción audiovisual presencial y servicios de terceros se cotizan por separado.',
        'Los requerimientos que excedan el alcance de las capacidades contratadas se cotizan como ampliaciones o proyectos independientes.',
        'Cada entregable de diseño incluye hasta dos rondas razonables de ajustes dentro del alcance aprobado.',
        'Los indicadores de desempeño se presentan como objetivos y campos de seguimiento, no como resultados garantizados.',
        'Ninguna capacidad incluye fotografía. Para la generación de imágenes con inteligencia artificial, el cliente asume el costo de una suscripción mensual de ChatGPT y una de Gemini, pagadas a OR-K o abiertas a nombre del cliente con acceso para OR-K.',
        'La oferta «Paquete completo» aplica únicamente cuando se contratan las cuatro capacidades sin modificar su contenido.'
      ]
    };
  }

  /** Reglas comerciales de precio. Se copian a cada cotización (reglas históricas). */
  function defaultPricing() {
    return { removalPenaltyPct: 20, additionSurchargePct: 20, floorPct: 50, maxHoursPerUnit: 40, comboEnabled: true, comboPct: 20, comboTiers: [0, 8, 12, 20], comboCapIds: COMBO_CAPS.slice(), volumeEnabled: true, volumeTiers: [0, 10, 15, 20] };
  }
  /** Costos por unidad = 25% del costo mensual del profesional + 25% de sobrecosto
   *  (espacio, energía, licencias, plataformas de IA). Desarrollador y marketero:
   *  $5.000.000; diseñador y community: $2.500.000 + 53% prestaciones = $3.825.000. */
  function presetCosts() { return {}; }
  /** Perfiles del equipo. Costo por cuenta = costo mensual empresa × (1 + sobrecosto) / cuentas por profesional. */
  function defaultTeam() {
    return [
      { id: 'tm_dev', name: 'Desarrollador junior', salary: 3000000, monthlyCost: 5000000, overheadPct: 25, accounts: 4 },
      { id: 'tm_mkt', name: 'Especialista en marketing digital', salary: 3000000, monthlyCost: 5000000, overheadPct: 25, accounts: 4 },
      { id: 'tm_des', name: 'Diseñador gráfico', salary: 2500000, monthlyCost: 3825000, overheadPct: 25, accounts: 4 },
      { id: 'tm_cm', name: 'Community manager', salary: 2500000, monthlyCost: 3825000, overheadPct: 25, accounts: 4 }
    ];
  }
  function defaultCapProfiles() { return { cap_tech: 'tm_dev', cap_marketing: 'tm_mkt', cap_design: 'tm_des', cap_community: 'tm_cm' }; }
  function profileUnitCost(p) { if (!p) return 0; return Math.round(applyBp(nonNeg(p.monthlyCost), 10000 + pctToBp(p.overheadPct)) / Math.max(1, nonNeg(p.accounts) || 1)); }
  function profileFor(settings, line) { const id = line.profileId || (settings.capProfiles || {})[line.capId]; return (settings.team || []).find((t) => t.id === id) || null; }
  /** Reparte el precio del paquete entre los valores de referencia, conservando proporciones. */
  function rebalanceRefs(cap) {
    const rs = cap.resources.filter((r) => nonNeg(r.perUnit) > 0 && nonNeg(r.refValue) > 0);
    const tot = rs.reduce((a, r) => a + nonNeg(r.perUnit) * nonNeg(r.refValue), 0); if (!tot) return cap;
    const price = nonNeg(cap.price);
    rs.forEach((r) => { r.refValue = Math.round(price * nonNeg(r.refValue) / tot); });
    const diff = price - rs.reduce((a, r) => a + r.perUnit * r.refValue, 0);
    const one = rs.find((r) => r.perUnit === 1); if (one) one.refValue += diff;
    return cap;
  }
  function defaultCosts(catalog) {
    const c = {}; const pre = presetCosts();
    (catalog || defaultCatalog()).forEach((cap) => { c[cap.id] = pre[cap.id] ? { ...pre[cap.id] } : emptyCost(); });
    return c;
  }
  function emptyCost() { return { direct: null, operating: null, coordination: null, other: null, hoursContracted: null, hoursProductive: null }; }

  function defaultState() {
    const catalog = defaultCatalog();
    return {
      schema: SCHEMA_VERSION, app: 'OR-K Flipper',
      settings: defaultSettings(), catalog, costs: defaultCosts(catalog),
      clients: [], quotes: [], counters: { quote: 0 },
      activeClientId: null, mode: 'internal', draft: null
    };
  }

  /* ---------- clientes ---------- */
  function newClient(data = {}) {
    return {
      id: uid('cli'), name: String(data.name || '').trim(), legalName: data.legalName || '', contact: data.contact || '',
      email: data.email || '', phone: data.phone || '', notes: data.notes || '', createdAt: new Date().toISOString(),
      brands: (data.brands || []).map((b) => ({ id: uid('brd'), name: typeof b === 'string' ? b : b.name, active: true }))
    };
  }
  function demoClient() {
    return newClient({ name: 'Flipper Beta', legalName: 'Empresa de demostración S.A.S.', notes: 'Cliente de demostración. Editable.', brands: ['Beta Industrial', 'Beta Energy', 'Beta Plastic', 'Beta Structure', 'Beta Import'] });
  }

  /* ---------- cotizaciones ---------- */
  function nextQuoteNumber(state) {
    const year = new Date().getFullYear();
    const prefix = (state.settings.quotePrefix || 'ORK').replace(/[^A-Za-z0-9]/g, '') || 'ORK';
    const used = new Set(state.quotes.map((q) => q.number));
    let n = (state.counters.quote || 0); let num;
    do { n++; num = `${prefix}-${year}-${String(n).padStart(4, '0')}`; } while (used.has(num));
    state.counters.quote = n;
    return num;
  }

  function newQuote(state, client) {
    const today = new Date().toISOString().slice(0, 10);
    return {
      id: uid('q'), number: null, name: client ? `Propuesta OR-K Flipper — ${client.name}` : 'Nueva propuesta',
      groupId: uid('grp'), scenarioName: 'Escenario A — Esencial',
      clientId: client ? client.id : null, client: client ? snapshotClient(client) : null,
      brandIds: client ? client.brands.filter((b) => b.active).map((b) => b.id) : [],
      date: today, validityDays: state.settings.validityDays, status: 'Borrador',
      ivaBp: pctToBp(state.settings.ivaPct), maxDiscountPct: state.settings.maxDiscountPct,
      rules: clone(state.settings.pricing || defaultPricing()), comboOff: false,
      catalog: {}, lines: [], supplements: [], discounts: [], adBudget: {},
      shareMode: 'consumption', conditions: state.settings.conditions.slice(), privateNotes: '', clientNotes: '',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), tariffsDate: new Date().toISOString()
    };
  }
  function snapshotClient(c) { return { id: c.id, name: c.name, legalName: c.legalName, contact: c.contact, email: c.email, phone: c.phone, brands: c.brands.map((b) => ({ id: b.id, name: b.name, active: b.active })) }; }

  /** Congela la tarifa de la capacidad dentro de la cotización (tarifas históricas). */
  function ensureCapSnapshot(quote, cap) {
    if (!quote.catalog[cap.id]) quote.catalog[cap.id] = clone(cap);
    return quote.catalog[cap.id];
  }
  function newLine(quote, cap, opts = {}) {
    ensureCapSnapshot(quote, cap);
    const line = { uid: uid('ln'), capId: cap.id, qty: 1, mode: opts.mode || 'shared', brandIds: (opts.brandIds || []).slice(), extras: {}, adjust: {}, requests: [], items: [], alloc: {}, kpis: [], manualShares: {} };
    quote.lines.push(line);
    return line;
  }
  function capOf(quote, line) { return quote.catalog[line.capId]; }

  /* ---------- capacidad y consumo ---------- */
  function lineCapacity(quote, line) {
    const cap = capOf(quote, line); const out = {};
    cap.resources.forEach((r) => { out[r.key] = Math.max(0, nonNeg(r.perUnit) * nonNeg(line.qty) + int((line.adjust || {})[r.key])); });
    (cap.extras || []).forEach((ex) => { const n = nonNeg(line.extras[ex.id]); if (n && out[ex.resourceKey] !== undefined) out[ex.resourceKey] += nonNeg(ex.amount) * n; });
    return out;
  }
  /** Horas internas estimadas de una línea y su límite (máx. por unidad × unidades). */
  function lineHours(quote, line) {
    const cap = capOf(quote, line); const c = lineCapacity(quote, line);
    const hasModel = cap.resources.some((r) => Number(r.hours) > 0) || Number(cap.fixedHours) > 0;
    const used = Math.round((Number(cap.fixedHours || 0) * nonNeg(line.qty) + cap.resources.reduce((a, r) => a + c[r.key] * Number(r.hours || 0), 0)) * 10) / 10;
    const unit = Number(cap.fixedHours || 0) + cap.resources.reduce((a, r) => a + nonNeg(r.perUnit) * Number(r.hours || 0), 0);
    const max = nonNeg((quote.rules || {}).maxHoursPerUnit) * nonNeg(line.qty);
    return { used, unit, max, hasModel: hasModel && max > 0 };
  }
  /** Ajuste de precio por quitar (crédito parcial) o agregar (recargo) elementos. */
  function lineAdjustment(quote, line) {
    const cap = capOf(quote, line); const rules = quote.rules || {}; const base = nonNeg(line.qty) * nonNeg(cap.price);
    let amount = 0; const detail = [];
    cap.resources.forEach((r) => {
      const d = int((line.adjust || {})[r.key]); if (!d || !nonNeg(r.refValue)) return;
      const raw = Math.abs(d) * nonNeg(r.refValue);
      const a = d < 0 ? -applyBp(raw, 10000 - pctToBp(rules.removalPenaltyPct)) : applyBp(raw, 10000 + pctToBp(rules.additionSurchargePct));
      amount += a; detail.push({ key: r.key, label: r.label, delta: d, amount: a });
    });
    const floor = applyBp(base, pctToBp(rules.floorPct));
    let floorApplied = false;
    if (base + amount < floor) { amount = floor - base; floorApplied = true; }
    return { amount, detail, floorApplied, customized: detail.length > 0 };
  }
  /** Marcas de una línea de Marketing cuyas creatividades produce OR-K (tienen Community) o el cliente. */
  function creativeSource(quote, line) {
    const ork = []; const client = [];
    line.brandIds.forEach((b) => { (quote.lines.some((l) => l.capId === 'cap_community' && l.brandIds.includes(b)) ? ork : client).push(b); });
    return { ork, client };
  }
  function isComplete(line) { return !Object.values(line.adjust || {}).some((v) => int(v) !== 0) && !Object.values(line.extras || {}).some((v) => nonNeg(v) > 0); }
  function deliverableOf(cap, id) { return (cap.deliverables || []).find((d) => d.id === id); }

  /** Consumo por recurso, total y por marca. */
  function lineUsage(quote, line) {
    const cap = capOf(quote, line); const total = {}; const byBrand = {};
    cap.resources.forEach((r) => { total[r.key] = 0; });
    const add = (b, k, v) => { if (!byBrand[b]) byBrand[b] = {}; byBrand[b][k] = (byBrand[b][k] || 0) + v; total[k] = (total[k] || 0) + v; };
    if (cap.engine === 'requests') {
      // Las solicitudes aprobadas comprometen sus horas aprobadas; las pendientes o estimadas reservan sus horas estimadas.
      total.hoursApproved = 0; total.hoursReserved = 0;
      line.requests.forEach((rq) => {
        const appr = APPROVED_STATES.includes(rq.status); const hrs = appr ? nonNeg(rq.approvedHours) : nonNeg(rq.estHours);
        add(rq.brandId, 'hours', hrs); add(rq.brandId, 'requests', 1);
        if (appr) total.hoursApproved += hrs; else total.hoursReserved += hrs;
      });
    } else if (cap.engine === 'points') {
      line.items.forEach((it) => { const d = deliverableOf(cap, it.deliverableId); if (d) add(it.brandId, 'points', nonNeg(d.points) * nonNeg(it.qty)); });
    } else {
      Object.entries(line.alloc || {}).forEach(([b, res]) => Object.entries(res || {}).forEach(([k, v]) => { if (nonNeg(v)) add(b, k, nonNeg(v)); }));
    }
    return { total, byBrand };
  }

  /* ---------- validación ---------- */
  function validateQuote(quote) {
    const errors = []; const warnings = [];
    const E = (msg, lineUid, code) => errors.push({ msg, lineUid, code }); const W = (msg, lineUid, code) => warnings.push({ msg, lineUid, code });
    if (!quote.client || !quote.client.name) E('La cotización no tiene cliente.');
    if (!quote.brandIds.length) E('Selecciona al menos una marca participante.');
    if (!quote.lines.length) W('La propuesta aún no tiene capacidades.');
    const brandName = (id) => (quote.client?.brands.find((b) => b.id === id) || {}).name || 'marca eliminada';
    quote.lines.forEach((line) => {
      const cap = capOf(quote, line); if (!cap) { E('Capacidad sin tarifa registrada.', line.uid); return; }
      const nm = cap.name;
      if (nonNeg(line.qty) < 1) E(`${nm}: debe tener al menos 1 unidad.`, line.uid);
      if (!line.brandIds.length) E(`${nm}: asigna al menos una marca beneficiaria.`, line.uid);
      if (line.mode === 'exclusive' && line.brandIds.length > 1) E(`${nm}: una capacidad exclusiva solo puede pertenecer a una marca.`, line.uid);
      line.brandIds.forEach((b) => { if (!quote.brandIds.includes(b)) E(`${nm}: ${brandName(b)} no participa en la propuesta.`, line.uid); });
      const capy = lineCapacity(quote, line); const use = lineUsage(quote, line);
      cap.resources.forEach((r) => {
        if ((use.total[r.key] || 0) > capy[r.key]) E(`${nm}: ${r.label} asignadas ${fmtNum(use.total[r.key])} de ${fmtNum(capy[r.key])} disponibles. Contrata una ampliación o reduce la asignación.`, line.uid, 'over');
      });
      const hrs = lineHours(quote, line);
      if (hrs.hasModel && hrs.used > hrs.max) E(`${nm}: el contenido supera la capacidad máxima por unidad (25% de ocupación del profesional). Agrega una unidad o reduce elementos.`, line.uid, 'hours');
      Object.keys(use.byBrand).forEach((b) => { if (!line.brandIds.includes(b)) E(`${nm}: hay recursos asignados a ${brandName(b)}, que no es beneficiaria de esta capacidad.`, line.uid, 'foreign'); });
      if (cap.engine === 'requests') line.requests.forEach((rq) => {
        if (!String(rq.name || '').trim()) E(`${nm}: hay una solicitud sin nombre.`, line.uid);
        if (nonNeg(rq.consumedHours) > nonNeg(rq.approvedHours) && APPROVED_STATES.includes(rq.status)) E(`${nm}: «${rq.name}» tiene más horas consumidas que aprobadas.`, line.uid);
      });
      if (line.mode === 'shared' && line.brandIds.length > 2) W(`${nm} se comparte entre ${line.brandIds.length} marcas: puede existir complejidad operativa adicional. Evalúa si corresponde un suplemento (nunca se agrega automáticamente).`, line.uid, 'complexity');
      if (quote.shareMode === 'manual' && line.mode === 'shared') {
        const s = line.brandIds.reduce((a, b) => a + pctToBp(line.manualShares[b] || 0), 0);
        if (s > 10000) E(`${nm}: la participación manual suma más de 100%.`, line.uid);
      }
    });
    const t = computeTotals(quote);
    t.discountIssues.forEach((m) => E(m));
    quote.discounts.forEach((d) => { if (d.type === 'pct' && pctToBp(d.value) > pctToBp(quote.maxDiscountPct)) W(`El descuento «${d.reason || 'sin motivo'}» supera el máximo sugerido de ${quote.maxDiscountPct}%.`); if (!String(d.reason || '').trim()) W('Hay un descuento sin motivo registrado.'); if (!String(d.authorizedBy || '').trim()) W('Hay un descuento sin responsable que lo autorice.'); });
    return { errors, warnings, ok: errors.length === 0 };
  }

  /* ---------- motor de cotización ---------- */
  function computeTotals(quote) {
    const lines = quote.lines.map((line) => {
      const cap = capOf(quote, line); const qty = nonNeg(line.qty); const unitPrice = nonNeg(cap?.price);
      const base = qty * unitPrice;
      let extrasAmt = 0; const extrasDetail = [];
      (cap?.extras || []).forEach((ex) => { const n = nonNeg(line.extras[ex.id]); if (n) { const a = n * nonNeg(ex.price); extrasAmt += a; extrasDetail.push({ name: ex.name, qty: n, price: nonNeg(ex.price), amount: a }); } });
      const adj = cap ? lineAdjustment(quote, line) : { amount: 0, detail: [], floorApplied: false, customized: false };
      return { uid: line.uid, capId: line.capId, name: cap?.name || '—', qty, unitPrice, base, adjustAmt: adj.amount, adjustDetail: adj.detail, floorApplied: adj.floorApplied, customized: adj.customized, complete: isComplete(line), extrasAmt, extrasDetail, gross: base + adj.amount + extrasAmt, taxable: cap?.taxable !== false, discount: 0 };
    });
    const services = lines.reduce((a, l) => a + l.base, 0);
    const adjustments = lines.reduce((a, l) => a + l.adjustAmt, 0);
    const extras = lines.reduce((a, l) => a + l.extrasAmt, 0);
    const approvedSupp = quote.supplements.filter((s) => s.approved);
    const suppRecurring = approvedSupp.filter((s) => s.periodicity !== 'Único').reduce((a, s) => a + nonNeg(s.value), 0);
    const suppOneTime = approvedSupp.filter((s) => s.periodicity === 'Único').reduce((a, s) => a + nonNeg(s.value), 0);
    const suppRecurringTaxable = approvedSupp.filter((s) => s.periodicity !== 'Único' && s.taxable !== false).reduce((a, s) => a + nonNeg(s.value), 0);
    const suppOneTimeTaxable = approvedSupp.filter((s) => s.periodicity === 'Único' && s.taxable !== false).reduce((a, s) => a + nonNeg(s.value), 0);
    const commercial = services + adjustments + extras + suppRecurring;

    // Descuentos: primero los de línea, luego los globales sobre el saldo
    const discountIssues = []; const discountRows = [];
    let lineDiscTotal = 0; let lineDiscTaxable = 0;
    // Oferta paquete completo: N combos = mínimo de unidades completas de cada capacidad del combo
    const combo = { enabled: false, count: 0, amount: 0, missing: [], customized: [], pct: 0 };
    const rules = quote.rules || {};
    // Oferta paquete completo (combo) y descuento por volumen: por cada unidad se aplica el MAYOR de los dos, nunca ambos.
    const volume = { enabled: false, amount: 0, tiers: [] };
    const capsIds = rules.comboCapIds || [];
    /* Descuento por combinación de capacidades: cuantas más capacidades distintas (sin personalizar)
       se contratan juntas, mayor el descuento. Las unidades se agrupan en «juegos»: el juego j reúne la
       j-ésima unidad completa de cada capacidad que tenga al menos j unidades completas; el % depende de
       cuántas capacidades tiene el juego (2, 3 o 4 = paquete completo). Descuento por volumen: 2.ª, 3.ª,
       4.ª+ unidad de una misma capacidad. Por cada unidad se aplica el MAYOR de los dos, nunca ambos. */
    const comboTiers = Array.isArray(rules.comboTiers) ? rules.comboTiers.map((x) => Number(x) || 0) : capsIds.map((_, i) => (i === capsIds.length - 1 ? Number(rules.comboPct) || 0 : 0));
    const tierFor = (size) => (size >= 1 ? comboTiers[Math.min(size, comboTiers.length) - 1] || 0 : 0);
    combo.tiers = comboTiers; combo.capsTotal = capsIds.length;
    const compUnits = {};
    if (rules.comboEnabled && comboTiers.some((x) => x > 0)) {
      combo.enabled = true; combo.pct = tierFor(capsIds.length); combo.off = !!quote.comboOff;
      capsIds.forEach((cid) => {
        const all = quote.lines.filter((l) => l.capId === cid); const comp = all.filter((l) => isComplete(l));
        if (!all.length) combo.missing.push(cid); else if (!comp.length) combo.customized.push(cid);
        compUnits[cid] = comp.reduce((a, l) => a + nonNeg(l.qty), 0);
      });
      combo.count = capsIds.length ? Math.min(...capsIds.map((c) => compUnits[c])) : 0;
      combo.present = capsIds.filter((c) => compUnits[c] > 0).length;
      combo.currentPct = tierFor(combo.present); combo.nextPct = combo.present < capsIds.length ? tierFor(combo.present + 1) : 0;
    }
    const setSize = (j) => capsIds.filter((c) => (compUnits[c] || 0) >= j).length;
    const tiers = rules.volumeEnabled && Array.isArray(rules.volumeTiers) ? rules.volumeTiers.map((x) => Number(x) || 0) : null;
    if (tiers) { volume.enabled = true; volume.tiers = tiers; }
    const comboActive = combo.enabled && !quote.comboOff;
    const setRows = {};
    [...new Set(quote.lines.map((l) => l.capId))].forEach((cid) => {
      let compIdx = 0; let idx = 0; const inCombo = comboActive && capsIds.includes(cid);
      quote.lines.filter((l) => l.capId === cid).forEach((l) => {
        const t = lines.find((x) => x.uid === l.uid); const complete = isComplete(l); let cAmt = 0; let vAmt = 0;
        for (let u = 0; u < nonNeg(l.qty); u++) {
          idx++;
          const vPct = tiers ? (tiers[Math.min(idx, tiers.length) - 1] || 0) : 0;
          let cPct = 0; let size = 0;
          if (inCombo && complete) { compIdx++; size = setSize(compIdx); cPct = size >= 2 ? tierFor(size) : 0; }
          if (cPct > 0 && cPct >= vPct) { const amt = applyBp(t.unitPrice, pctToBp(cPct)); cAmt += amt; const k = size + ':' + cPct; setRows[k] = setRows[k] || { size, pct: cPct, amount: 0 }; setRows[k].amount += amt; }
          else if (vPct > 0) vAmt += applyBp(t.unitPrice, pctToBp(vPct));
        }
        t.comboDisc = cAmt; t.volumeDisc = vAmt; t.discount += cAmt + vAmt; lineDiscTotal += cAmt + vAmt; if (t.taxable) lineDiscTaxable += cAmt + vAmt;
        combo.amount += cAmt; volume.amount += vAmt;
      });
    });
    combo.rows = Object.values(setRows).sort((x, y) => y.size - x.size);
    combo.rows.forEach((r) => {
      const full = r.size >= capsIds.length;
      discountRows.push({ id: 'combo' + r.size, label: full ? `Oferta paquete completo OR-K Flipper (${r.pct}%)` : `Descuento por combinación de ${r.size} capacidades (${r.pct}%)`, target: full ? 'Paquete completo' : `${r.size} capacidades`, type: 'pct', value: r.pct, amount: r.amount, authorizedBy: '', combo: true });
    });
    if (volume.amount) discountRows.push({ id: 'volume', label: 'Descuento por volumen (unidades adicionales)', target: 'Unidades adicionales', type: 'fixed', value: volume.amount, amount: volume.amount, authorizedBy: '', volume: true });
    quote.discounts.filter((d) => d.target && d.target !== 'all').forEach((d) => {
      const l = lines.find((x) => x.uid === d.target);
      if (!l) { discountIssues.push('Un descuento apunta a una capacidad que ya no existe en la propuesta.'); return; }
      const room = l.gross - l.discount;
      let amt = d.type === 'pct' ? applyBp(l.gross, pctToBp(d.value)) : nonNeg(d.value);
      if (d.type === 'pct' && pctToBp(d.value) > 10000) discountIssues.push(`El descuento sobre ${l.name} supera el 100%.`);
      if (amt > room) { discountIssues.push(`El descuento sobre ${l.name} (${fmtCOP(amt)}) supera la base aplicable (${fmtCOP(room)}).`); amt = room; }
      l.discount += amt; lineDiscTotal += amt; if (l.taxable) lineDiscTaxable += amt;
      discountRows.push({ id: d.id, label: d.reason || 'Descuento', target: l.name, type: d.type, value: d.value, amount: amt, authorizedBy: d.authorizedBy || '' });
    });
    let globalBase = commercial - lineDiscTotal; let globalDisc = 0;
    quote.discounts.filter((d) => !d.target || d.target === 'all').forEach((d) => {
      let amt = d.type === 'pct' ? applyBp(globalBase, pctToBp(d.value)) : nonNeg(d.value);
      if (d.type === 'pct' && pctToBp(d.value) > 10000) discountIssues.push('Un descuento porcentual supera el 100%.');
      const room = globalBase - globalDisc;
      if (amt > room) { discountIssues.push(`Un descuento global (${fmtCOP(amt)}) supera la base aplicable (${fmtCOP(room)}).`); amt = Math.max(0, room); }
      globalDisc += amt;
      discountRows.push({ id: d.id, label: d.reason || 'Descuento', target: 'Subtotal comercial', type: d.type, value: d.value, amount: amt, authorizedBy: d.authorizedBy || '' });
    });
    const discounts = lineDiscTotal + globalDisc;
    const net = commercial - discounts;

    // Base gravable: los descuentos globales se prorratean por proporción gravada
    const taxableGrossAfterLine = lines.filter((l) => l.taxable).reduce((a, l) => a + l.gross, 0) - lineDiscTaxable + suppRecurringTaxable;
    const globalDiscTaxable = globalBase > 0 ? Math.round(globalDisc * taxableGrossAfterLine / globalBase) : 0;
    const taxableNet = Math.max(0, taxableGrossAfterLine - globalDiscTaxable);
    const iva = applyBp(taxableNet, nonNeg(quote.ivaBp));
    const totalServices = net + iva;

    // reparto de descuentos globales a líneas (para rentabilidad y participación)
    const shares = splitInt(globalDisc, lines.map((l) => l.gross - l.discount).concat([suppRecurring]), globalBase || 1);
    lines.forEach((l, i) => { l.discount += shares[i] || 0; l.net = l.gross - l.discount; });

    // Pauta: separada, sin IVA de OR-K
    const ad = { meta: 0, google: 0, other: 0, byBrand: {} };
    quote.brandIds.forEach((b) => { const a = quote.adBudget[b] || {}; const row = { meta: nonNeg(a.meta), google: nonNeg(a.google), other: nonNeg(a.other) }; ad.meta += row.meta; ad.google += row.google; ad.other += row.other; ad.byBrand[b] = row; });
    ad.total = ad.meta + ad.google + ad.other;

    const oneTimeIva = applyBp(suppOneTimeTaxable, nonNeg(quote.ivaBp));
    return {
      lines, services, adjustments, combo, volume, extras, suppRecurring, suppOneTime, commercial, discounts, discountRows, discountIssues, net,
      taxableNet, iva, ivaBp: nonNeg(quote.ivaBp), totalServices, ad, totalInvestment: totalServices + ad.total,
      oneTime: { subtotal: suppOneTime, iva: oneTimeIva, total: suppOneTime + oneTimeIva }
    };
  }

  /* ---------- distribución por marca ---------- */
  function computeDistribution(quote) {
    const totals = computeTotals(quote);
    const brands = {}; const brandList = quote.brandIds.map((id) => (quote.client?.brands.find((b) => b.id === id)) || { id, name: '(marca)' });
    brandList.forEach((b) => { brands[b.id] = { id: b.id, name: b.name, lines: [], exclusiveValue: 0, sharedValue: 0, ad: totals.ad.byBrand[b.id] || { meta: 0, google: 0, other: 0 } }; });
    const byLine = quote.lines.map((line) => {
      const cap = capOf(quote, line); const t = totals.lines.find((x) => x.uid === line.uid); const capy = lineCapacity(quote, line); const use = lineUsage(quote, line);
      const alloc = cap.resources.filter((r) => r.allocatable);
      const beneficiaries = line.brandIds.filter((b) => brands[b]);
      let values;
      if (line.mode === 'exclusive') values = beneficiaries.map(() => t.net);
      else if (quote.shareMode === 'manual') values = splitInt(t.net, beneficiaries.map((b) => pctToBp(line.manualShares[b] || 0)), 10000);
      else {
        // Pesos enteros exactos: participación = promedio de (consumo / capacidad) por recurso asignable
        const gcd = (a, b) => (b ? gcd(b, a % b) : a); const lcm = (a, b) => a / gcd(a, b) * b;
        const ks = cap.engine === 'buckets' ? alloc.filter((r) => capy[r.key] > 0).map((r) => r.key) : [cap.engine === 'points' ? 'points' : 'hours'].filter((k) => capy[k] > 0);
        const L = ks.reduce((a, k) => lcm(a, capy[k]), 1);
        const w = beneficiaries.map((b) => { const u = use.byBrand[b] || {}; return ks.reduce((a, k) => a + Math.min(u[k] || 0, capy[k]) * (L / capy[k]), 0); });
        values = ks.length ? splitInt(t.net, w, L * ks.length) : beneficiaries.map(() => 0);
      }
      const assigned = values.reduce((a, b) => a + b, 0);
      const perBrand = beneficiaries.map((b, i) => {
        const u = use.byBrand[b] || {};
        const detail = describeUsage(quote, line, b);
        const row = { brandId: b, usage: u, detail, value: line.mode === 'exclusive' ? t.net : values[i] };
        if (line.mode === 'exclusive') brands[b].exclusiveValue += t.net; else brands[b].sharedValue += values[i];
        brands[b].lines.push({ uid: line.uid, capName: cap.name, color: cap.color, mode: line.mode, usage: u, detail, value: row.value, resources: cap.resources });
        return row;
      });
      return { uid: line.uid, cap, mode: line.mode, qty: line.qty, capacity: capy, used: use.total, net: t.net, perBrand, unassigned: line.mode === 'exclusive' ? 0 : t.net - assigned };
    });
    return { brands: brandList.map((b) => brands[b.id]), byLine, totals };
  }

  function describeUsage(quote, line, brandId) {
    const cap = capOf(quote, line); const out = [];
    if (cap.engine === 'requests') line.requests.filter((r) => r.brandId === brandId).forEach((r) => out.push(`${r.name}${r.workType ? ' (' + r.workType + ')' : ''} · ${APPROVED_STATES.includes(r.status) ? nonNeg(r.approvedHours) + ' h aprobadas' : nonNeg(r.estHours) + ' h reservadas'} · ${r.status}`));
    else if (cap.engine === 'points') line.items.filter((i) => i.brandId === brandId).forEach((i) => { const d = deliverableOf(cap, i.deliverableId); if (d) out.push(`${nonNeg(i.qty)} × ${d.name} (${nonNeg(i.qty) * nonNeg(d.points)} pts)`); });
    else { const a = line.alloc[brandId] || {}; cap.resources.forEach((r) => { if (nonNeg(a[r.key])) out.push(`${nonNeg(a[r.key])} ${r.label.toLowerCase()}`); }); }
    return out;
  }

  /* ---------- rentabilidad interna ---------- */
  function costConfigured(c) { return !!c && ['direct', 'operating', 'coordination', 'other'].some((k) => c[k] !== null && c[k] !== '' && c[k] !== undefined); }
  function computeProfitability(quote, costs, settings) {
    const t = computeTotals(quote);
    const target = pctToBp(settings.marginTargetPct); const tol = pctToBp(settings.marginTolerancePct);
    const classify = (bp) => (bp < target - tol ? 'below' : bp > target + tol ? 'above' : 'within');
    let pending = false; let costTotal = 0;
    const lines = t.lines.map((l) => {
      const c = costs[l.capId]; const lineObj = quote.lines.find((x) => x.uid === l.uid); const prof = profileFor(settings, lineObj);
      if (!prof && !costConfigured(c)) { pending = true; return { ...l, configured: false }; }
      const extra = c ? ['direct', 'operating', 'coordination', 'other'].reduce((a, k) => a + nonNeg(c[k]), 0) : 0;
      const perUnit = profileUnitCost(prof) + extra;
      const line = quote.lines.find((x) => x.uid === l.uid); const hrs = lineHours(quote, line);
      const cost = hrs.hasModel && hrs.unit > 0 ? Math.round(perUnit * hrs.used / hrs.unit) : perUnit * l.qty; costTotal += cost;
      const margin = l.net - cost; const bp = l.net > 0 ? Math.round(margin * 10000 / l.net) : 0;
      return { ...l, configured: true, cost, margin, marginBp: bp, status: classify(bp), profile: prof, perUnitCost: perUnit };
    });
    const revenue = t.net; const margin = revenue - costTotal; const bp = revenue > 0 ? Math.round(margin * 10000 / revenue) : 0;
    return { lines, pending: pending || !lines.length, revenue, cost: costTotal, margin, marginBp: bp, status: classify(bp), target, tol };
  }

  /* ---------- estado efectivo / migración / importación ---------- */
  function effectiveStatus(q, today = new Date()) {
    if (['Aprobada', 'Rechazada', 'Vencida'].includes(q.status)) return q.status;
    const d = new Date(q.date + 'T00:00:00'); d.setDate(d.getDate() + nonNeg(q.validityDays));
    return d < new Date(today.toISOString().slice(0, 10) + 'T00:00:00') ? 'Vencida' : q.status;
  }
  function expiryDate(q) { const d = new Date(q.date + 'T00:00:00'); d.setDate(d.getDate() + nonNeg(q.validityDays)); return d.toISOString().slice(0, 10); }

  function validateBackup(obj) {
    const errs = [];
    if (!obj || typeof obj !== 'object') return ['El archivo no contiene un objeto JSON válido.'];
    if (!['OR-K Flipper', 'OR-K FLEX'].includes(obj.app)) errs.push('El archivo no es un respaldo de OR-K Flipper.');
    if (typeof obj.schema !== 'number') errs.push('Falta la versión de esquema.');
    else if (obj.schema > SCHEMA_VERSION) errs.push('El respaldo proviene de una versión más reciente de OR-K Flipper.');
    ['clients', 'quotes', 'catalog'].forEach((k) => { if (!Array.isArray(obj[k])) errs.push(`Falta la colección «${k}».`); });
    if (!obj.settings || typeof obj.settings !== 'object') errs.push('Falta la configuración comercial.');
    if (errs.length) return errs;
    obj.clients.forEach((c, i) => { if (!c.id || !String(c.name || '').trim()) errs.push(`Cliente ${i + 1}: falta identificador o nombre.`); if (!Array.isArray(c.brands)) errs.push(`Cliente ${c.name || i + 1}: marcas inválidas.`); });
    obj.catalog.forEach((c, i) => { if (!c.id || !Array.isArray(c.resources) || !['requests', 'points', 'buckets'].includes(c.engine)) errs.push(`Capacidad ${i + 1}: estructura inválida.`); });
    obj.quotes.forEach((q, i) => { if (!q.id || !Array.isArray(q.lines) || typeof q.catalog !== 'object' || !Array.isArray(q.brandIds)) errs.push(`Cotización ${q.number || i + 1}: estructura inválida.`); });
    return errs.slice(0, 12);
  }
  function normalizeState(s) {
    const d = defaultState();
    const out = Object.assign(d, s);
    out.settings = Object.assign(defaultSettings(), s.settings || {});
    out.costs = Object.assign(defaultCosts(out.catalog), s.costs || {});
    out.counters = Object.assign({ quote: 0 }, s.counters || {});
    out.settings.pricing = Object.assign(defaultPricing(), out.settings.pricing || {});
    if (!Array.isArray(out.settings.team)) out.settings.team = defaultTeam();
    out.settings.capProfiles = Object.assign(defaultCapProfiles(), out.settings.capProfiles || {});
    const fixQ = (q) => { if (!q) return; q.supplements ||= []; q.discounts ||= []; q.adBudget ||= {}; if (!q.rules) q.rules = { ...defaultPricing(), comboEnabled: false, maxHoursPerUnit: 0, volumeEnabled: false }; q.lines.forEach((l) => { l.extras ||= {}; l.adjust ||= {}; l.requests ||= []; l.items ||= []; l.alloc ||= {}; l.kpis ||= []; l.manualShares ||= {}; }); };
    out.quotes.forEach(fixQ); fixQ(out.draft);
    // Un borrador nuevo (aún sin número) siempre usa las reglas comerciales vigentes, incluidos los descuentos.
    const modern = (r) => r && Array.isArray(r.comboTiers) && r.comboEnabled && r.volumeEnabled && nonNeg(r.maxHoursPerUnit) > 0;
    if (out.draft && !out.draft.number && !modern(out.draft.rules)) out.draft.rules = clone(out.settings.pricing);
    // Migración del catálogo inicial a la revisión 2 (las cotizaciones guardadas conservan sus copias)
    const rev0 = s.settings?.catalogRev || 1;
    out.app = 'OR-K Flipper';
    if (rev0 < 2) {
      const defs = defaultCatalog(); const pre = presetCosts();
      out.catalog = [...defs, ...out.catalog.filter((c) => !defs.some((d) => d.id === c.id))];
      defs.forEach((d) => { if (!costConfigured(out.costs[d.id])) out.costs[d.id] = emptyCost(); });
      if (Number(out.settings.marginTargetPct) === 40) out.settings.marginTargetPct = 60;
      defaultSettings().conditions.slice(-2).forEach((c) => { if (!out.settings.conditions.includes(c)) out.settings.conditions.push(c); });
      out._migrated = 2;
    }
    if (rev0 < 4) {
      const old = { cap_tech: ['#3578FF'], cap_design: ['#6815D5'], cap_community: ['#9B4DFF'], cap_marketing: ['#31065C', '#5E6BFF'] };
      out.catalog.forEach((c) => { if (old[c.id] && old[c.id].includes(String(c.color).toUpperCase())) c.color = CAP_COLORS[c.id]; });
      if (!Array.isArray(out.settings.pricing.comboTiers)) out.settings.pricing.comboTiers = [0, 8, 12, Number(out.settings.pricing.comboPct) || 20];
      out.settings.catalogRev = Math.max(out.settings.catalogRev || 0, 4);
    }
    if (rev0 < 5) {
      const merge = (cap) => { if (cap && cap.id === 'cap_tech' && Array.isArray(cap.workTypes)) cap.workTypes = [...TECH_WORK_TYPES, ...cap.workTypes.filter((w) => !TECH_WORK_TYPES.includes(w))]; };
      out.catalog.forEach(merge); [...out.quotes, out.draft].forEach((q) => { if (q && q.catalog) merge(q.catalog.cap_tech); });
      out.settings.catalogRev = CATALOG_REV;
    }
    return out;
  }
  /** Copia de exportación: solo datos que el usuario guardó. */
  function backupPayload(state) { const s = clone(state); s.exportedAt = new Date().toISOString(); return s; }

  return {
    SCHEMA_VERSION, APPROVED_STATES, REQUEST_STATES, PRIORITIES, QUOTE_STATES, DEFAULT_KPIS,
    uid, clone, int, nonNeg, pctToBp, applyBp, roundDiv, splitInt, fmtCOP, fmtNum,
    defaultCatalog, defaultSettings, defaultCosts, emptyCost, defaultState,
    newClient, demoClient, snapshotClient, newQuote, nextQuoteNumber, ensureCapSnapshot, newLine, capOf,
    CATALOG_REV, COMBO_CAPS, CAP_COLORS, defaultPricing, presetCosts, defaultTeam, defaultCapProfiles, profileUnitCost, profileFor, rebalanceRefs, lineHours, lineAdjustment, isComplete, creativeSource,
    rulesAreModern: (r) => !!(r && Array.isArray(r.comboTiers) && r.comboEnabled && r.volumeEnabled && nonNeg(r.maxHoursPerUnit) > 0),
    lineCapacity, lineUsage, deliverableOf, validateQuote, computeTotals, computeDistribution, describeUsage,
    costConfigured, computeProfitability, effectiveStatus, expiryDate, validateBackup, normalizeState, backupPayload
  };
})();
const Proposal = (() => {
  'use strict';
  const E = Engine;
  const h = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = (iso) => { if (!iso) return ''; const [y, m, d] = iso.slice(0, 10).split('-'); const M = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']; return `${+d} de ${M[+m - 1]} de ${y}`; };

  const CSS = `
  .pp{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,Arial,sans-serif;color:#202027;font-size:10.5pt;line-height:1.45;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .pp *{box-sizing:border-box}
  .pp-page{width:210mm;background:#fff;padding:16mm 15mm}
  .pp-cover{min-height:265mm;border-radius:6mm;background:radial-gradient(120mm 90mm at 75% 30%,rgba(139,61,255,.55),transparent 70%),linear-gradient(160deg,#07071A 0%,#140840 55%,#31065C 100%);color:#fff;padding:18mm 16mm;display:flex;flex-direction:column;position:relative;overflow:hidden}
  .pp-cover:after{content:"";position:absolute;right:-30mm;top:40mm;width:150mm;height:150mm;border-radius:50%;border:1.2mm solid rgba(157,92,255,.75);box-shadow:0 0 12mm rgba(139,61,255,.7),inset 0 0 10mm rgba(139,61,255,.45)}
  .pp-cover:before{content:"";position:absolute;right:-10mm;bottom:-10mm;width:80mm;height:80mm;border-radius:50%;border:1px solid rgba(255,255,255,.1)}
  .pp-logo{font-weight:800;font-size:26pt;letter-spacing:-.03em}
  .pp-logo img{max-height:16mm;max-width:60mm;object-fit:contain;display:block}
  .pp-logo-box{display:inline-block;background:#fff;border-radius:3mm;padding:3mm 4mm}
  .pp-kicker{font-size:8.5pt;letter-spacing:.22em;text-transform:uppercase;font-weight:700;opacity:.8}
  .pp-cover h1{font-size:30pt;line-height:1.08;margin:0;letter-spacing:-.02em;font-weight:750}
  .pp-cover .client{font-size:15pt;font-weight:600;margin-top:5mm}
  .pp-cover .meta{display:grid;grid-template-columns:repeat(3,auto);gap:2mm 10mm;font-size:9pt;margin-top:auto;position:relative;z-index:1;justify-content:start}
  .pp-cover .meta b{display:block;font-size:7.5pt;letter-spacing:.14em;text-transform:uppercase;opacity:.7;font-weight:700}
  .pp-motto{font-size:9pt;letter-spacing:.24em;text-transform:uppercase;font-weight:700;margin-top:10mm;opacity:.9;position:relative;z-index:1}
  .pp-sec{margin-bottom:9mm}
  .pp-sec>h2{font-size:15pt;margin:0 0 1mm;color:#31065C;letter-spacing:-.01em}
  .pp-sec>.lead{color:#747480;margin:0 0 5mm;font-size:9.5pt}
  .pp-num{display:inline-block;color:#6815D5;font-weight:750;margin-right:2mm}
  .pp-brands{display:flex;flex-wrap:wrap;gap:2mm}
  .pp-brand{border:1px solid #e3dcef;border-radius:99px;padding:1.4mm 4mm;font-weight:600;font-size:9.5pt;background:#faf8fd}
  .pp-pillars{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm;margin-top:5mm}
  .pp-pillar{border:1px solid #e7e4ee;border-radius:3mm;padding:4mm;break-inside:avoid}
  .pp-pillar b{display:block;color:#6815D5;letter-spacing:.14em;font-size:8.5pt;margin-bottom:1mm}
  .pp-tbl{width:100%;border-collapse:collapse;font-size:9.3pt}
  .pp-tbl thead{display:table-header-group}
  .pp-tbl th{text-align:left;font-size:7.6pt;letter-spacing:.1em;text-transform:uppercase;color:#747480;border-bottom:1.5px solid #31065C;padding:2mm 2.5mm}
  .pp-tbl td{padding:2.3mm 2.5mm;border-bottom:1px solid #ece9f2;vertical-align:top}
  .pp-tbl tr{break-inside:avoid;page-break-inside:avoid}
  .pp-tbl .r{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
  .pp-tbl tfoot td{font-weight:750;border-top:1.5px solid #31065C;border-bottom:0}
  .pp-tbl tr.tot td{font-weight:750;background:#f4effc;color:#31065C}
  .pp-tbl tr.sub td{font-weight:650}
  .pp-cap{border:1px solid #e7e4ee;border-left:1.4mm solid var(--c,#6815D5);border-radius:2.5mm;padding:4.5mm 5mm;margin-bottom:4mm;break-inside:avoid;page-break-inside:avoid}
  .pp-cap h3{margin:0;font-size:12pt}
  .pp-cap .tag{color:#747480;font-size:9pt}
  .pp-cols{display:grid;grid-template-columns:1fr 1fr;gap:5mm;margin-top:3mm}
  .pp-cap ul{margin:1mm 0 0;padding-left:4.5mm} .pp-cap li{margin:.6mm 0;font-size:9.2pt}
  .pp-h4{font-size:7.6pt;letter-spacing:.12em;text-transform:uppercase;color:#6815D5;font-weight:750;margin:2mm 0 1mm}
  .pp-pill{display:inline-block;border-radius:99px;background:#f1e9fd;color:#6815D5;font-weight:700;font-size:8pt;padding:.6mm 2.6mm;margin:0 1mm 1mm 0}
  .pp-pill.b{background:#eaf1ff;color:#3578FF}
  .pp-brandcard{border:1px solid #e7e4ee;border-radius:2.5mm;padding:4mm 5mm;margin-bottom:4mm;break-inside:avoid;page-break-inside:avoid}
  .pp-brandcard h3{margin:0 0 2mm;font-size:11.5pt}
  .pp-note{font-size:8.5pt;color:#747480;margin-top:2mm}
  .pp-hero{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm;margin-bottom:5mm}
  .pp-hero div{border-radius:3mm;padding:4mm;background:#f6f4fa;break-inside:avoid}
  .pp-hero div.main{background:#31065C;color:#fff}
  .pp-hero b{display:block;font-size:7.5pt;letter-spacing:.12em;text-transform:uppercase;opacity:.75;margin-bottom:1mm}
  .pp-hero span{font-size:15pt;font-weight:750;font-variant-numeric:tabular-nums}
  .pp-conds{margin:0;padding-left:5mm} .pp-conds li{margin:1.4mm 0;font-size:9.3pt}
  .pp-sign{display:grid;grid-template-columns:1fr 1fr;gap:12mm;margin-top:16mm;break-inside:avoid}
  .pp-sign div{border-top:1px solid #202027;padding-top:2mm;font-size:9pt}
  .pp-foot{margin-top:10mm;padding-top:3mm;border-top:1px solid #e7e4ee;display:flex;justify-content:space-between;font-size:8pt;color:#747480}
  .pp-break{break-before:page;page-break-before:always}
  @media print{
    @page{size:A4 portrait;margin:14mm 13mm 15mm}
    .pp-page{width:auto;padding:0;box-shadow:none!important;margin:0!important}
    .pp-cover{min-height:266mm;page-break-after:always;break-after:page}
  }`;

  function logo(settings, light) {
    if (settings.logo) return light ? `<span class="pp-logo-box"><img src="${settings.logo}" alt="${h(settings.companyName)}"></span>` : `<img src="${settings.logo}" alt="${h(settings.companyName)}">`;
    const A = typeof ORK_ASSETS !== 'undefined' ? ORK_ASSETS : {};
    if (light && A.logo) return `<img src="${A.logo}" alt="OR-K Business Innovation & Technology" style="max-height:20mm;max-width:80mm">`;
    return `<span>${h(settings.companyName || 'OR-K')}</span>`;
  }

  function capacityText(q, line) {
    const cap = E.capOf(q, line); const c = E.lineCapacity(q, line);
    return cap.resources.map((r) => `${E.fmtNum(c[r.key])} ${r.label.toLowerCase()}`).join(' · ');
  }

  function render(quote, settings) {
    const q = quote; const d = E.computeDistribution(q); const t = d.totals;
    const brands = q.brandIds.map((id) => q.client.brands.find((b) => b.id === id)).filter(Boolean);
    const bname = (id) => (q.client.brands.find((b) => b.id === id) || {}).name || '—';
    const lines = q.lines.map((l) => ({ l, cap: E.capOf(q, l), t: t.lines.find((x) => x.uid === l.uid) }));
    const status = E.effectiveStatus(q);
    const exp = E.expiryDate(q);
    let s = `<div class="pp">`;

    // 1. Portada
    s += `<div class="pp-page"><div class="pp-cover">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;position:relative;z-index:1"><div class="pp-logo">${logo(settings, true)}</div><div class="pp-kicker">OR-K FLIPPER</div></div>
      <div style="margin-top:46mm;position:relative;z-index:1">
        <div class="pp-kicker" style="margin-bottom:5mm">Propuesta de capacidades empresariales</div>
        <h1>${h(q.name)}</h1>
        <div class="client">${h(q.client.name)}${q.client.legalName ? ` <span style="opacity:.7;font-weight:500">· ${h(q.client.legalName)}</span>` : ''}</div>
        ${q.scenarioName ? `<div style="margin-top:3mm;opacity:.8;font-size:10pt">${h(q.scenarioName)}</div>` : ''}
      </div>
      <div class="meta"><div><b>Cotización</b>${h(q.number || 'Borrador sin número')}</div><div><b>Fecha</b>${fmtDate(q.date)}</div><div><b>Vigente hasta</b>${fmtDate(exp)}</div></div>
      <div class="pp-motto">${h(settings.motto || 'Understand. Transform. Scale.')}</div>
    </div></div>`;

    s += `<div class="pp-page">`;
    // 2–4. Cliente, marcas, modelo
    s += `<div class="pp-sec"><h2><span class="pp-num">01</span>Cliente y marcas participantes</h2><p class="lead">${h(q.client.name)}${q.client.contact ? ` · Atención: ${h(q.client.contact)}` : ''}</p>
      <div class="pp-brands">${brands.map((b) => `<span class="pp-brand">${h(b.name)}</span>`).join('')}</div></div>`;
    s += `<div class="pp-sec"><h2><span class="pp-num">02</span>El modelo OR-K Flipper</h2>
      <p>OR-K Flipper —capacidades móviles y flexibles— permite contratar <b>capacidades empresariales</b> —no paquetes cerrados— con recursos y entregables verificables. Cada capacidad puede asignarse de forma exclusiva a una marca o compartirse entre varias: el valor depende de las capacidades y unidades contratadas, no del número de marcas.</p>
      <div class="pp-pillars"><div class="pp-pillar"><b>UNDERSTAND</b>Entendemos el negocio y sus prioridades antes de asignar recursos.</div><div class="pp-pillar"><b>TRANSFORM</b>Ejecutamos con entregables definidos, medibles y distribuidos por marca.</div><div class="pp-pillar"><b>SCALE</b>Las capacidades crecen por unidades o ampliaciones cuando el negocio lo requiere.</div></div></div>`;

    // 5. Capacidades seleccionadas
    s += `<div class="pp-sec"><h2><span class="pp-num">03</span>Capacidades seleccionadas</h2><p class="lead">Unidades mensuales contratadas y su modalidad de uso.</p>
      <table class="pp-tbl"><thead><tr><th>Capacidad</th><th>Modalidad</th><th>Marcas beneficiarias</th><th class="r">Unid.</th><th>Capacidad incluida</th></tr></thead><tbody>
      ${lines.map(({ l, cap }) => `<tr><td><b>${h(cap.name)}</b><br><span style="color:#747480;font-size:8.5pt">${h(cap.tagline)}</span></td><td>${l.mode === 'exclusive' ? 'Exclusiva' : 'Compartida'}</td><td>${l.brandIds.map(bname).map(h).join(', ')}</td><td class="r">${l.qty}</td><td style="font-size:8.6pt">${h(capacityText(q, l))}</td></tr>`).join('') || `<tr><td colspan="5">Sin capacidades seleccionadas.</td></tr>`}
      </tbody></table></div>`;

    // 6. Alcance y entregables
    s += `<div class="pp-sec pp-break"><h2><span class="pp-num">04</span>Alcance y entregables</h2><p class="lead">Lo que incluye cada capacidad y cómo se asignan sus entregables.</p>`;
    lines.forEach(({ l, cap }) => {
      const assigned = l.brandIds.map((b) => ({ b, items: E.describeUsage(q, l, b) })).filter((x) => x.items.length);
      const info = cap.resources.filter((r) => !r.allocatable);
      s += `<div class="pp-cap" style="--c:${h(cap.color)}"><div style="display:flex;justify-content:space-between;gap:4mm"><div><h3>${h(cap.name)}</h3><div class="tag">${h(cap.tagline)}</div></div><div style="text-align:right"><span class="pp-pill">${l.qty} ${l.qty === 1 ? 'unidad' : 'unidades'}</span><span class="pp-pill b">${l.mode === 'exclusive' ? 'Exclusiva' : 'Compartida'}</span></div></div>
        ${E.lineAdjustment(q, l).customized ? `<div class="pp-note" style="margin-top:2mm"><b>Contenido personalizado:</b> ${E.lineAdjustment(q, l).detail.map((x) => `${x.delta > 0 ? '+' : ''}${x.delta} ${h(x.label.toLowerCase())}`).join(' · ')}. La capacidad mensual contratada refleja estos ajustes.</div>` : ''}
        <div class="pp-cols"><div><div class="pp-h4">${E.lineAdjustment(q, l).customized ? 'Servicios del paquete' : 'Incluye'}</div><ul>${cap.included.map((x) => `<li>${h(x)}</li>`).join('')}</ul>
        ${Object.keys(l.extras || {}).some((k) => l.extras[k] > 0) ? `<div class="pp-h4">Ampliaciones</div><ul>${(cap.extras || []).filter((x) => l.extras[x.id] > 0).map((x) => `<li>${l.extras[x.id]} × ${h(x.name)}</li>`).join('')}</ul>` : ''}</div>
        <div><div class="pp-h4">Capacidad mensual contratada</div><div style="font-size:9.2pt">${h(capacityText(q, l))}</div>
        <div class="pp-h4">Entregables asignados</div>${assigned.length ? assigned.map((x) => `<div style="font-size:9.2pt;margin-bottom:1.4mm"><b>${h(bname(x.b))}:</b> ${x.items.map(h).join('; ')}</div>`).join('') : '<div style="font-size:9.2pt;color:#747480">Por definir dentro de la capacidad contratada.</div>'}
        ${info.length ? `<div class="pp-note">Servicios de soporte incluidos: ${info.map((r) => `${E.fmtNum(E.lineCapacity(q, l)[r.key])} ${h(r.label.toLowerCase())}`).join(', ')}.</div>` : ''}
        ${cap.usesAdBudget ? (() => { const cs = E.creativeSource(q, l); return `<div class="pp-h4">Creatividades</div><div style="font-size:9pt">${cs.ork.length ? `Producidas por OR-K: ${cs.ork.map(bname).map(h).join(', ')}.` : ''}${cs.ork.length && cs.client.length ? '<br>' : ''}${cs.client.length ? `Suministradas por el cliente: ${cs.client.map(bname).map(h).join(', ')}.` : ''}</div>`; })() : ''}
        ${l.kpis && l.kpis.length ? `<div class="pp-h4">Indicadores de seguimiento</div><div>${l.kpis.map((k) => `<span class="pp-pill b">${h(k)}</span>`).join('')}</div><div class="pp-note">Campos de seguimiento y objetivos; no constituyen resultados garantizados.</div>` : ''}
        </div></div>
        ${cap.exclusions?.length ? `<div class="pp-note"><b>No incluye:</b> ${cap.exclusions.map(h).join('; ')}.</div>` : ''}</div>`;
    });
    s += `</div>`;

    // 7. Distribución por marca
    s += `<div class="pp-sec pp-break"><h2><span class="pp-num">05</span>Asignación por marca</h2><p class="lead">Recursos que recibe cada marca. Las capacidades compartidas se facturan una sola vez; la participación por marca es informativa${q.shareMode === 'manual' ? ' (definida manualmente)' : ' (calculada por consumo asignado)'}.</p>`;
    d.brands.forEach((b) => {
      const ad = b.ad; const adT = ad.meta + ad.google + ad.other;
      s += `<div class="pp-brandcard"><div style="display:flex;justify-content:space-between;gap:4mm"><h3>${h(b.name)}</h3><div style="font-size:9pt;text-align:right">${b.exclusiveValue ? `Exclusivo: <b>${E.fmtCOP(b.exclusiveValue)}</b>` : ''}${b.exclusiveValue && b.sharedValue ? ' · ' : ''}${b.sharedValue ? `Participación informativa: <b>${E.fmtCOP(b.sharedValue)}</b>` : ''}</div></div>
      ${b.lines.length ? `<table class="pp-tbl"><thead><tr><th style="width:32%">Capacidad</th><th>Entregables y recursos</th></tr></thead><tbody>${b.lines.map((x) => `<tr><td><b>${h(x.capName)}</b><br><span style="color:#747480;font-size:8.3pt">${x.mode === 'exclusive' ? 'Exclusiva' : 'Compartida'}</span></td><td>${x.detail.length ? x.detail.map(h).join('<br>') : '<span style="color:#747480">Beneficiaria; asignación por definir</span>'}</td></tr>`).join('')}</tbody></table>` : '<div class="pp-note">Sin capacidades asignadas.</div>'}
      ${adT ? `<div class="pp-note">Presupuesto publicitario (no incluido en honorarios): ${ad.meta ? `Meta Ads ${E.fmtCOP(ad.meta)}` : ''}${ad.google ? `${ad.meta ? ' · ' : ''}Google Ads ${E.fmtCOP(ad.google)}` : ''}${ad.other ? ` · Otros medios ${E.fmtCOP(ad.other)}` : ''}</div>` : ''}</div>`;
    });
    s += `</div>`;

    // 8. Inversión
    s += `<div class="pp-sec" style="break-inside:avoid-page"><h2><span class="pp-num">06</span>Resumen de inversión</h2><p class="lead">Valores mensuales recurrentes en pesos colombianos.</p>
      ${t.combo.amount ? `<div style="border:1px solid #bfe6d2;background:#e5f6ee;color:#0b6a42;border-radius:3mm;padding:3mm 4mm;margin-bottom:4mm;font-size:9.5pt"><b>Descuento por combinación de capacidades:</b> ahorro de ${E.fmtCOP(t.combo.amount)} al mes.</div>` : ''}
      ${t.volume.amount ? `<div style="border:1px solid #bfe6d2;background:#e5f6ee;color:#0b6a42;border-radius:3mm;padding:3mm 4mm;margin-bottom:4mm;font-size:9.5pt"><b>Descuento por volumen:</b> ahorro de ${E.fmtCOP(t.volume.amount)} al mes por unidades adicionales.</div>` : ''}
      <div class="pp-hero"><div><b>Honorarios OR-K antes de IVA</b><span>${E.fmtCOP(t.net)}</span></div><div><b>Total servicios con IVA</b><span>${E.fmtCOP(t.totalServices)}</span></div><div class="main"><b>Inversión mensual total</b><span>${E.fmtCOP(t.totalInvestment)}</span></div></div>
      <table class="pp-tbl"><thead><tr><th>Concepto</th><th class="r">Unid.</th><th class="r">Valor unitario</th><th class="r">Valor mensual</th></tr></thead><tbody>
      ${t.lines.map((l) => `<tr><td>${h(l.name)}${l.adjustAmt ? `<br><span style="color:#747480;font-size:8.5pt">Personalización: ${l.adjustDetail.map((x) => `${x.delta > 0 ? '+' : ''}${x.delta} ${h(x.label.toLowerCase())}`).join(', ')}${l.floorApplied ? ' (precio mínimo de la capacidad)' : ''}</span>` : ''}${l.extrasDetail.length ? `<br><span style="color:#747480;font-size:8.5pt">Ampliaciones: ${l.extrasDetail.map((x) => `${x.qty} × ${h(x.name)}`).join(', ')}</span>` : ''}</td><td class="r">${l.qty}</td><td class="r">${E.fmtCOP(l.unitPrice)}</td><td class="r">${E.fmtCOP(l.base)}</td></tr>`).join('')}
      <tr class="sub"><td colspan="3">Subtotal de servicios (paquetes)</td><td class="r">${E.fmtCOP(t.services)}</td></tr>
      ${t.adjustments ? `<tr><td colspan="3">Personalización de capacidades</td><td class="r">${t.adjustments < 0 ? '−' + E.fmtCOP(-t.adjustments) : E.fmtCOP(t.adjustments)}</td></tr>` : ''}
      ${t.extras ? `<tr><td colspan="3">Ampliaciones</td><td class="r">${E.fmtCOP(t.extras)}</td></tr>` : ''}
      ${q.supplements.filter((x) => x.approved && x.periodicity !== 'Único').map((x) => `<tr><td colspan="3">Suplemento: ${h(x.name)}</td><td class="r">${E.fmtCOP(x.value)}</td></tr>`).join('')}
      ${t.discountRows.map((x) => x.combo || x.volume ? `<tr><td colspan="3"><b style="color:#0b6a42">${h(x.label)}</b> · ${h(x.target)}</td><td class="r" style="color:#0b6a42"><b>−${E.fmtCOP(x.amount)}</b></td></tr>` : `<tr><td colspan="3">Descuento${x.type === 'pct' ? ` (${String(x.value).replace('.', ',')}%)` : ''}: ${h(x.label)}${x.target !== 'Subtotal comercial' ? ` · ${h(x.target)}` : ''}</td><td class="r">−${E.fmtCOP(x.amount)}</td></tr>`).join('')}
      <tr class="sub"><td colspan="3">Honorarios netos antes de IVA</td><td class="r">${E.fmtCOP(t.net)}</td></tr>
      <tr><td colspan="3">IVA (${(t.ivaBp / 100).toString().replace('.', ',')}%)</td><td class="r">${E.fmtCOP(t.iva)}</td></tr>
      <tr class="tot"><td colspan="3">Total mensual de servicios OR-K</td><td class="r">${E.fmtCOP(t.totalServices)}</td></tr>
      ${t.ad.total ? `<tr><td colspan="3">Presupuesto publicitario Meta Ads</td><td class="r">${E.fmtCOP(t.ad.meta)}</td></tr><tr><td colspan="3">Presupuesto publicitario Google Ads</td><td class="r">${E.fmtCOP(t.ad.google)}</td></tr>${t.ad.other ? `<tr><td colspan="3">Presupuesto otros medios</td><td class="r">${E.fmtCOP(t.ad.other)}</td></tr>` : ''}` : ''}
      <tr class="tot"><td colspan="3">Inversión mensual total estimada</td><td class="r">${E.fmtCOP(t.totalInvestment)}</td></tr>
      </tbody></table>
      ${t.ad.total ? '<div class="pp-note">La pauta publicitaria no hace parte de los honorarios de OR-K, puede ser facturada directamente por las plataformas y su tratamiento tributario es independiente.</div>' : ''}
      ${t.oneTime.subtotal ? `<div class="pp-h4" style="margin-top:5mm">Cargos únicos (no recurrentes)</div><table class="pp-tbl"><tbody>${q.supplements.filter((x) => x.approved && x.periodicity === 'Único').map((x) => `<tr><td>${h(x.name)}</td><td class="r">${E.fmtCOP(x.value)}</td></tr>`).join('')}<tr><td>IVA</td><td class="r">${E.fmtCOP(t.oneTime.iva)}</td></tr><tr class="tot"><td>Total cargos únicos</td><td class="r">${E.fmtCOP(t.oneTime.total)}</td></tr></tbody></table>` : ''}
    </div>`;

    // 9. Condiciones
    s += `<div class="pp-sec"><h2><span class="pp-num">07</span>Condiciones comerciales</h2><ol class="pp-conds">${(q.conditions || []).map((c) => `<li>${h(c)}</li>`).join('')}${lines.map(({ cap }) => cap.conditions ? `<li><b>${h(cap.name)}:</b> ${h(cap.conditions)}</li>` : '').join('')}</ol>
      ${q.clientNotes ? `<p style="margin-top:3mm">${h(q.clientNotes).replace(/\n/g, '<br>')}</p>` : ''}</div>`;

    // 10. Vigencia y aprobación
    s += `<div class="pp-sec" style="break-inside:avoid"><h2><span class="pp-num">08</span>Vigencia y aprobación</h2>
      <p>Esta propuesta tiene una vigencia de <b>${q.validityDays} días</b> a partir del ${fmtDate(q.date)}, es decir, hasta el <b>${fmtDate(exp)}</b>. Estado: ${h(status)}.</p>
      <div class="pp-sign"><div><b>${h(q.client.name)}</b><br>Nombre, cargo y firma<br><br>Fecha:</div><div><b>${h(settings.companyName || 'OR-K')}</b><br>Nombre, cargo y firma<br><br>Fecha:</div></div>
      <div class="pp-foot"><span>${h(settings.companyName || 'OR-K')} · ${h(settings.tagline || '')}</span><span>${h(q.number || '')}</span></div></div>`;
    s += `</div></div>`;
    return s;
  }

  /** Documento HTML independiente para compartir: solo contiene la propuesta. */
  function standalone(quote, settings) {
    return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${h(quote.number || 'Propuesta')} · ${h(quote.client.name)} · OR-K Flipper</title><style>body{margin:0;background:#e9e6ef}.wrap{padding:24px 0}.pp-page{margin:0 auto 24px;box-shadow:0 6px 26px rgba(0,0,0,.12)}@media print{body{background:#fff}.wrap{padding:0}}${CSS}</style></head><body><div class="wrap">${render(quote, settings)}</div></body></html>`;
  }
  return { CSS, render, standalone, fmtDate, h };
})();

/** Motor de cálculo (clientes, cotizaciones, totales, distribución y rentabilidad). */
export const E: any = Engine;
/** Propuesta comercial para cliente (HTML sin costos ni notas privadas). */
export const P: any = Proposal;
