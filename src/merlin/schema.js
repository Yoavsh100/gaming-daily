// The structured report the analyst engine must return. Merlin renders BOTH the
// markdown report and the branded B2Tech PDF from this single object.
//
// The shape mirrors how a buy-side gaming analyst actually writes: a group-level
// executive read, a group financials table, then a DEEP per-segment dive (each
// with its own narrative and a QoQ/YoY/H1 table), highlights/lowlights, and a
// forward view. Breadth and market context are the point — not a one-pager.

const flexTable = {
  type: 'object', required: ['note', 'columns', 'rows'],
  properties: {
    note: { type: 'string', description: 'Header for the first (label) column, e.g. "US $m".' },
    columns: { type: 'array', items: { type: 'string' }, description: 'Value-column headers, e.g. ["Q2-26","QoQ","YoY","H1-26","H1 YoY"].' },
    rows: {
      type: 'array',
      items: {
        type: 'object', required: ['label'],
        properties: {
          label: { type: 'string' },
          cells: { type: 'array', items: { type: 'string' }, description: 'One value per column (same length/order as columns). Empty for group rows.' },
          kind: { type: 'string', enum: ['line', 'group', 'emphasis'] },
          indent: { type: 'boolean' },
          footnote: { type: 'string' }
        }
      }
    }
  }
};

export const REPORT_SCHEMA = {
  type: 'object',
  required: ['releaseDate', 'currency', 'verdict', 'kpis', 'summary', 'groupTable',
    'segments', 'highlights', 'lowlights', 'forecast', 'confidence', 'confidenceNote', 'sources'],
  properties: {
    releaseDate: { type: 'string', description: 'Date results were released, e.g. "5 Aug 2026".' },
    currency: { type: 'string', description: 'Reporting currency + unit, e.g. "USD" (tables in millions).' },
    sharePriceReaction: { type: 'string', description: 'The market reaction, e.g. "Shares -11.8% to $92.56 on the day."' },
    verdict: { type: 'string', description: 'The one-line verdict: 2-3 sentences, the whole quarter distilled.' },
    kpis: {
      type: 'array', minItems: 4, maxItems: 6,
      description: 'The 4-6 headline GROUP metrics for the KPI strip.',
      items: {
        type: 'object', required: ['label', 'value', 'delta', 'dir'],
        properties: {
          label: { type: 'string' }, value: { type: 'string' }, delta: { type: 'string' },
          dir: { type: 'string', enum: ['up', 'down', 'flat'] }
        }
      }
    },
    summary: {
      type: 'array', minItems: 15,
      description: 'Executive summary: 15+ bullets at GROUP/strategic level. Lead each with a **bold** takeaway. Cover the result vs expectations, the guidance bridge (what drove it and which division), group event stats (e.g. World Cup group revenue/handle/actives), the cost-transformation program, capital position, management/strategy news, and the thesis read-through.',
      items: { type: 'string' }
    },
    groupTable: {
      ...flexTable,
      description: 'Group financial summary table (revenue by segment & product, adj. EBITDA & margin, net income, EPS, group KPIs, cash, net debt/leverage).'
    },
    segments: {
      type: 'array', minItems: 1,
      description: 'DEEP per-segment dives — typically US and International. This is where the breadth lives.',
      items: {
        type: 'object', required: ['name', 'narrative', 'table'],
        properties: {
          name: { type: 'string', description: 'e.g. "US (FanDuel)" or "International".' },
          headline: { type: 'string', description: 'One-line segment takeaway.' },
          narrative: {
            type: 'array', minItems: 4,
            description: 'Detailed analyst bullets: revenue & drivers, market shares/#1 positions, actives & ARPU, marketing spend (% of revenue), for sportsbook the handle / net margin / structural margin / promo % of handle, product & content, regional breakdown (for International: UK&I, Southern Europe & Africa, Brazil, APAC, CEE), event engagement, and segment guidance. Use **bold** for the lead of each bullet.',
            items: { type: 'string' }
          },
          table: { ...flexTable, description: 'Detailed segment table with QoQ/YoY/H1 columns.' }
        }
      }
    },
    highlights: {
      type: 'array', minItems: 4,
      items: { type: 'object', required: ['text', 'tag'], properties: { text: { type: 'string' }, tag: { type: 'string', description: '"structural", "one-off", "mixed", "early", "watch".' } } }
    },
    lowlights: {
      type: 'array', minItems: 4,
      items: { type: 'object', required: ['text', 'tag'], properties: { text: { type: 'string' }, tag: { type: 'string', description: '"structural", "one-off", "mixed", "governance", "watch".' } } }
    },
    forecast: {
      type: 'object', required: ['intro', 'bridge', 'view', 'watch'],
      properties: {
        intro: { type: 'string', description: 'Guidance-bridge paragraph: old vs new, which division drove it, and the moving parts.' },
        bridge: {
          type: 'array', minItems: 2, maxItems: 4,
          items: { type: 'object', required: ['title', 'value'], properties: { title: { type: 'string' }, value: { type: 'string' }, change: { type: 'string' } } }
        },
        view: { type: 'string', description: 'Your independent forward view: revenue, margin, leverage direction; **bold** for emphasis.' },
        watch: { type: 'array', minItems: 3, items: { type: 'string' } }
      }
    },
    confidence: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
    confidenceNote: { type: 'string' },
    sources: {
      type: 'array', minItems: 1,
      items: { type: 'object', required: ['label', 'kind'], properties: { label: { type: 'string' }, kind: { type: 'string', enum: ['primary', 'secondary'] }, url: { type: 'string' } } }
    }
  }
};
