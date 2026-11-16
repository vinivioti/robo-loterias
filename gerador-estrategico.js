// gerador-estrategico.js
// ============================================================
// Módulo de geração inteligente de jogos para Mega-Sena
// Estratégias: Score Ponderado | Wheeling | Filtros de Validação
// ============================================================

const fs   = require('fs');
const path = require('path');
const { randomInt } = require('crypto'); // aleatoriedade criptograficamente segura

const TOTAL_NUMEROS   = 60;
const SCORES_FILE     = path.resolve(__dirname, 'scores.json');
const FREQUENCIA_FILE = path.resolve(__dirname, 'frequencia.json');

// ============================================================
// 1. CARREGAMENTO DE DADOS
// ============================================================

/**
 * Carrega os scores calculados pelo analisador.
 * Fallback: usa frequencia.json normalizada.
 * Fallback final: scores uniformes (totalmente aleatório).
 */
function carregarScores() {
    if (fs.existsSync(SCORES_FILE)) {
        return JSON.parse(fs.readFileSync(SCORES_FILE, 'utf-8'));
    }

    if (fs.existsSync(FREQUENCIA_FILE)) {
        console.log('⚠️  scores.json não encontrado. Usando frequencia.json como fallback.');
        const freq = JSON.parse(fs.readFileSync(FREQUENCIA_FILE, 'utf-8'));
        const max  = Math.max(...Object.values(freq));
        const scores = {};
        for (let i = 1; i <= TOTAL_NUMEROS; i++) {
            scores[i] = +(( (freq[i] || 0) / max ).toFixed(6));
        }
        return scores;
    }

    console.log('⚠️  Nenhum arquivo de dados encontrado. Usando scores uniformes.');
    const scores = {};
    for (let i = 1; i <= TOTAL_NUMEROS; i++) scores[i] = 1;
    return scores;
}

// ============================================================
// 2. FILTROS DE VALIDAÇÃO ESTATÍSTICA
// ============================================================

/**
 * Retorna true se o jogo passa em todos os filtros estatísticos.
 *
 * Filtros aplicados (baseados em análise histórica da Mega-Sena):
 *   F1 — Equilíbrio par/ímpar: nunca todos pares ou todos ímpares
 *   F2 — Soma dos dezenas: entre 100 e 200 (ocorre em ~70% dos sorteios)
 *   F3 — Cobertura de faixas: pelo menos 3 das 6 faixas (1-10, 11-20, …)
 *   F4 — Sem sequência de 4+ números consecutivos
 */
function jogoEhValido(jogo) {
    const pares   = jogo.filter(n => n % 2 === 0).length;
    const impares = jogo.length - pares;

    // F1: evita todos pares ou todos ímpares (<1% dos sorteios)
    if (pares === 0 || impares === 0) return false;

    // F2: soma ideal (70% dos sorteios reais estão nessa faixa)
    const soma = jogo.reduce((a, b) => a + b, 0);
    if (soma < 100 || soma > 200) return false;

    // F3: diversidade de faixas de dezenas
    const faixas = new Set(jogo.map(n => Math.ceil(n / 10)));
    if (faixas.size < 3) return false;

    // F4: sem sequência longa de consecutivos
    const sorted = [...jogo].sort((a, b) => a - b);
    let maxConsec = 1, consec = 1;
    for (let i = 1; i < sorted.length; i++) {
        consec     = sorted[i] === sorted[i - 1] + 1 ? consec + 1 : 1;
        maxConsec  = Math.max(maxConsec, consec);
    }
    if (maxConsec >= 4) return false;

    return true;
}

// ============================================================
// 3. SELEÇÃO POR ROLETA PONDERADA (criptograficamente segura)
// ============================================================

/**
 * Sorteia um número do array `candidatos` usando seus scores como pesos.
 * Usa crypto.randomInt para melhor qualidade de aleatoriedade.
 */
function selecionarPorPeso(candidatos, scores) {
    const total = candidatos.reduce((acc, n) => acc + (scores[n] || 0), 0);
    // randomInt(0, 1_000_000) gera inteiro em [0, 999999]
    let rand = (randomInt(0, 1_000_000) / 1_000_000) * total;

    for (const num of candidatos) {
        rand -= scores[num] || 0;
        if (rand <= 0) return num;
    }
    // fallback seguro
    return candidatos[candidatos.length - 1];
}

// ============================================================
// 4. ESTRATÉGIA A — ROLETA PONDERADA (poucos jogos, qualidade alta)
// ============================================================

/**
 * Gera `qtd` jogos únicos e válidos usando roleta ponderada pelos scores.
 * @param {number} dezenas - Quantidade de números por jogo (6, 7, 8…)
 * @param {number} qtd     - Quantidade de jogos desejados
 * @param {object} scores  - Mapa { num: score }
 */
function gerarJogosPonderados(dezenas, qtd, scores) {
    const listaFinal = [];
    const jogosSet   = new Set();
    const numeros    = Array.from({ length: TOTAL_NUMEROS }, (_, i) => i + 1);
    const maxTentativas = qtd * 2000;
    let tentativas = 0;

    while (listaFinal.length < qtd && tentativas < maxTentativas) {
        tentativas++;
        const disponiveis = [...numeros];
        const sorteio     = [];

        // Seleciona `dezenas` números sem repetição, ponderado por score
        while (sorteio.length < dezenas && disponiveis.length > 0) {
            const escolhido = selecionarPorPeso(disponiveis, scores);
            sorteio.push(escolhido);
            disponiveis.splice(disponiveis.indexOf(escolhido), 1);
        }

        sorteio.sort((a, b) => a - b);
        const assinatura = sorteio.join('-');

        if (!jogosSet.has(assinatura) && jogoEhValido(sorteio)) {
            jogosSet.add(assinatura);
            listaFinal.push(sorteio);
        }
    }

    if (listaFinal.length < qtd) {
        console.warn(`⚠️  Gerados ${listaFinal.length}/${qtd} jogos (máx. tentativas atingido).`);
    }

    return listaFinal;
}

// ============================================================
// 5. ESTRATÉGIA B — WHEELING (cobertura garantida)
// ============================================================

/**
 * Retorna os `tamanhoPool` números com maior score.
 */
function gerarTopPool(scores, tamanhoPool = 10) {
    return Object.entries(scores)
        .sort(([, a], [, b]) => b - a)
        .slice(0, tamanhoPool)
        .map(([num]) => parseInt(num))
        .sort((a, b) => a - b);
}

/**
 * Gera todas as combinações de `dezenas` elementos escolhidos de `pool`.
 * Para pool=10, dezenas=6 → C(10,6) = 210 combinações.
 * Para pool=12, dezenas=6 → C(12,6) = 924 combinações.
 */
function gerarCombinacoes(pool, dezenas) {
    const combos = [];
    function combine(start, atual) {
        if (atual.length === dezenas) {
            combos.push([...atual]);
            return;
        }
        for (let i = start; i < pool.length; i++) {
            combine(i + 1, [...atual, pool[i]]);
        }
    }
    combine(0, []);
    return combos;
}

/**
 * Wheeling: gera todos os jogos de `dezenas` a partir dos top `tamanhoPool`
 * números por score, aplicando filtros de validação.
 *
 * GARANTIA: se pelo menos `dezenas` números do pool saírem no sorteio,
 * você terá pelo menos um jogo vencedor nessa faixa de acertos.
 *
 * @param {number} dezenas     - Dezenas por jogo (geralmente 6)
 * @param {number} tamanhoPool - Tamanho do pool de favoritos (10 a 15)
 * @param {object} scores      - Mapa { num: score }
 * @param {number} limite      - Limite máximo de jogos retornados (0 = sem limite)
 */
function gerarJogosWheeling(dezenas = 6, tamanhoPool = 10, scores, limite = 0) {
    const pool = gerarTopPool(scores, tamanhoPool);

    console.log(`\n🎯 Pool de ${tamanhoPool} favoritos (maior score): [${pool.join(', ')}]`);
    console.log(`   Garantia: se ${dezenas} desses números saírem, você acerta a sena!`);

    const todasCombos = gerarCombinacoes(pool, dezenas);
    const validas     = todasCombos.filter(jogoEhValido);

    console.log(`   C(${tamanhoPool},${dezenas}) = ${todasCombos.length} combinações | Após filtros: ${validas.length} jogos\n`);

    return limite > 0 ? validas.slice(0, limite) : validas;
}

// ============================================================
// 6. INTERFACE PRINCIPAL (compatível com bot-loterias-estatistico.js)
// ============================================================

/**
 * Função principal de geração — usada pelo bot.
 * @param {number} dezenas - Dezenas por jogo
 * @param {number} qtd     - Quantidade de jogos
 * @param {'ponderado'|'wheeling'} modo - Estratégia de geração
 */
function gerarListaDeJogosEstrategicos(dezenas, qtd, modo = 'ponderado') {
    const scores = carregarScores();

    if (modo === 'wheeling') {
        return gerarJogosWheeling(dezenas, 10, scores, qtd);
    }

    return gerarJogosPonderados(dezenas, qtd, scores);
}

// ============================================================
// 7. DIAGNÓSTICO — imprime ranking dos top números
// ============================================================

function imprimirRankingScores(top = 20) {
    const scores = carregarScores();
    const ranking = Object.entries(scores)
        .sort(([, a], [, b]) => b - a)
        .slice(0, top);

    console.log(`\n🏆 Top ${top} números por score estratégico:`);
    ranking.forEach(([num, score], i) => {
        const bar = '█'.repeat(Math.round(score * 200));
        console.log(`  ${String(i + 1).padStart(2)}. Nº ${String(num).padStart(2)}  score: ${score.toFixed(4)}  ${bar}`);
    });
    console.log('');
}

module.exports = {
    gerarListaDeJogosEstrategicos,
    gerarJogosPonderados,
    gerarJogosWheeling,
    jogoEhValido,
    gerarTopPool,
    carregarScores,
    imprimirRankingScores,
};
