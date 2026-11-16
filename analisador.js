// analisador.js — VERSÃO MELHORADA
// ============================================================
// Busca o histórico da Mega-Sena via API oficial da Caixa,
// calcula frequências, calor recente e ausência,
// e gera scores ponderados em scores.json.
// ============================================================

const axios = require('axios');
const fs    = require('fs');
const path  = require('path');

// ---- Configurações ----------------------------------------
const TOTAL_NUMEROS        = 60;
const CONCURSOS_RECENTES   = 50;    // usados para calcular "calor" e "ausência"
const DELAY_ENTRE_REQUESTS = 300;   // ms entre requests para não sobrecarregar a API

// ---- Arquivos de saída ------------------------------------
const FREQUENCIA_FILE = path.resolve(__dirname, 'frequencia.json');
const HISTORICO_FILE  = path.resolve(__dirname, 'historico_recente.json');
const SCORES_FILE     = path.resolve(__dirname, 'scores.json');

// ---- APIs (oficial Caixa) ---------------------------------
const API_BASE = 'https://servicebus2.caixa.gov.br/portaldeloterias/api/megasena';

// ============================================================
// UTILIDADES
// ============================================================

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Busca dados de um concurso específico (ou o último, se omitido).
 */
async function buscarConcurso(numero = '') {
    const url = numero ? `${API_BASE}/${numero}` : API_BASE;
    const { data } = await axios.get(url, {
        timeout: 15000,
        headers: {
            'Accept':          'application/json, text/plain, */*',
            'Accept-Language': 'pt-BR,pt;q=0.9',
            'Origin':          'https://loterias.caixa.gov.br',
            'Referer':         'https://loterias.caixa.gov.br/',
        },
    });
    return data;
}

/**
 * Extrai o array de dezenas sorteadas de um objeto de concurso da API.
 * A API pode retornar em diferentes campos conforme a versão.
 */
function extrairDezenas(concurso) {
    const raw =
        concurso.dezenasSorteadasOrdemSorteio ||
        concurso.listaDezenas                 ||
        concurso.dezenas                      ||
        [];
    return raw.map(d => parseInt(d, 10)).filter(n => n >= 1 && n <= 60);
}

// ============================================================
// CÁLCULO DE SCORES PONDERADOS
// ============================================================

/**
 * Calcula o score estratégico de cada número (1–60).
 *
 * Componentes:
 *   40% — Frequência histórica normalizada
 *   35% — Calor recente (últimos 20 sorteios)
 *   25% — Ausência (sorteios desde a última aparição, normalizado)
 *
 * @param {object}   frequencia      { num: contagem_total }
 * @param {Array}    historicoRecente Array de { concurso, data, dezenas[] }
 * @param {number}   totalSorteios   Nº total de sorteios históricos
 */
function calcularScores(frequencia, historicoRecente, totalSorteios) {
    const ultimos20 = historicoRecente.slice(-20);
    const scores = {};

    for (let num = 1; num <= TOTAL_NUMEROS; num++) {
        // — Componente 1: Frequência histórica (0 → 1)
        const freqNorm = (frequencia[num] || 0) / Math.max(totalSorteios, 1);

        // — Componente 2: Calor nos últimos 20 sorteios (0 → 1)
        const vezesCaloр = ultimos20.filter(s => s.dezenas.includes(num)).length;
        const calorNorm  = vezesCaloр / Math.max(ultimos20.length, 1);

        // — Componente 3: Ausência (nº de sorteios desde a última aparição)
        let ausencia = 0;
        for (let i = historicoRecente.length - 1; i >= 0; i--) {
            if (historicoRecente[i].dezenas.includes(num)) break;
            ausencia++;
        }
        const ausenciaNorm = Math.min(ausencia / 50, 1.0);

        scores[num] = +(
            0.40 * freqNorm +
            0.35 * calorNorm +
            0.25 * ausenciaNorm
        ).toFixed(6);
    }

    return scores;
}

// ============================================================
// EXIBIÇÃO DOS RESULTADOS
// ============================================================

function exibirRankingScores(scores, frequencia, top = 20) {
    const ranking = Object.entries(scores)
        .sort(([, a], [, b]) => b - a)
        .slice(0, top);

    console.log(`\n🏆 Top ${top} números por score estratégico:`);
    console.log('   Nº  | Score  | Freq | Calor+Ausência');
    console.log('   ----|--------|------|' + '-'.repeat(30));

    ranking.forEach(([num, score], i) => {
        const bar = '█'.repeat(Math.round(score * 250));
        console.log(
            `   ${String(i + 1).padStart(2)}. Nº${String(num).padStart(2)} | ${score.toFixed(4)} | ${String(frequencia[num] || 0).padStart(4)} | ${bar}`
        );
    });
}

// ============================================================
// FUNÇÃO PRINCIPAL
// ============================================================

async function mapearFrequencia() {
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║   📊 ANALISADOR MEGA-SENA — Versão Melhorada  ║');
    console.log('╚══════════════════════════════════════════════╝\n');

    // ── Passo 1: Carrega frequência histórica existente ────────
    const frequencia = {};
    for (let i = 1; i <= TOTAL_NUMEROS; i++) frequencia[i] = 0;

    if (fs.existsSync(FREQUENCIA_FILE)) {
        const existing = JSON.parse(fs.readFileSync(FREQUENCIA_FILE, 'utf-8'));
        for (let i = 1; i <= TOTAL_NUMEROS; i++) {
            frequencia[i] = existing[i] || 0;
        }
        const totalDez = Object.values(frequencia).reduce((a, b) => a + b, 0);
        console.log(`📂 frequencia.json carregado (${Math.round(totalDez / 6)} sorteios históricos estimados)`);
    } else {
        console.log('⚠️  frequencia.json não encontrado — será criado do zero.');
    }

    // ── Passo 2: Busca dados recentes via API ──────────────────
    let historicoRecente = [];

    try {
        console.log('\n🌐 Conectando à API oficial da Caixa...');
        const ultimoRaw  = await buscarConcurso();
        const ultimoNum  = ultimoRaw.numero;
        const ultimaData = ultimoRaw.dataApuracao;
        console.log(`✅ Último concurso: #${ultimoNum} (${ultimaData})\n`);

        console.log(`📥 Buscando os ${CONCURSOS_RECENTES} concursos mais recentes...`);

        for (let c = ultimoNum; c > Math.max(0, ultimoNum - CONCURSOS_RECENTES); c--) {
            process.stdout.write(`\r   ▶ Concurso #${c}...   `);
            try {
                const raw    = await buscarConcurso(c);
                const dezenas = extrairDezenas(raw);
                if (dezenas.length > 0) {
                    historicoRecente.unshift({
                        concurso: c,
                        data:     raw.dataApuracao || '',
                        dezenas,
                    });
                }
            } catch {
                // Ignora concurso não encontrado individualmente
            }
            await sleep(DELAY_ENTRE_REQUESTS);
        }

        console.log(`\n✅ ${historicoRecente.length} concursos recentes carregados.\n`);

    } catch (error) {
        console.error(`\n⚠️  Falha na API: ${error.message}`);

        // Tenta carregar histórico salvo anteriormente
        if (fs.existsSync(HISTORICO_FILE)) {
            historicoRecente = JSON.parse(fs.readFileSync(HISTORICO_FILE, 'utf-8'));
            console.log(`📂 Usando historico_recente.json salvo anteriormente (${historicoRecente.length} sorteios).`);
        } else {
            console.log('❌ Sem histórico recente disponível. Scores usarão somente frequência histórica.');
        }
    }

    // ── Passo 3: Calcula scores ────────────────────────────────
    const totalDezenas  = Object.values(frequencia).reduce((a, b) => a + b, 0);
    const totalSorteios = Math.round(totalDezenas / 6);

    console.log(`📈 Calculando scores ponderados...`);
    console.log(`   • Sorteios históricos: ~${totalSorteios}`);
    console.log(`   • Concursos recentes para calor/ausência: ${historicoRecente.length}`);

    const scores = calcularScores(frequencia, historicoRecente, totalSorteios);

    // ── Passo 4: Salva arquivos ────────────────────────────────
    fs.writeFileSync(FREQUENCIA_FILE, JSON.stringify(frequencia, null, 2));
    fs.writeFileSync(SCORES_FILE,     JSON.stringify(scores, null, 2));
    if (historicoRecente.length > 0) {
        fs.writeFileSync(HISTORICO_FILE, JSON.stringify(historicoRecente, null, 2));
    }

    console.log('\n✅ Arquivos gerados/atualizados:');
    console.log('   📄 frequencia.json       — contagem histórica de cada número');
    console.log('   📄 scores.json           — score estratégico ponderado');
    console.log('   📄 historico_recente.json — últimos sorteios para calor/ausência');

    exibirRankingScores(scores, frequencia);

    console.log('\n💡 Próximo passo: execute  node bot-loterias-estatistico.js\n');
}

mapearFrequencia();
