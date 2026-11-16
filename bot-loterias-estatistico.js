// bot-loterias-estatistico.js — VERSÃO MELHORADA
// ============================================================
// Bot de automação para preenchimento de jogos na Mega-Sena
// Usa o gerador-estrategico.js para criar jogos inteligentes
// ============================================================

const { chromium } = require('playwright');
const path         = require('path');
const readline     = require('readline');
const {
    gerarListaDeJogosEstrategicos,
    imprimirRankingScores,
} = require('./gerador-estrategico');

// ============================================================
// ⚙️  CONFIGURAÇÕES
// ============================================================

// CPF: lido da variável de ambiente CPF ou de .env
// Para usar: CPF=123.456.789-00 node bot-loterias-estatistico.js
// Ou crie um arquivo .env com: CPF=123.456.789-00  (ver .env.example)
const CPF       = process.env.CPF || '000.000.000-00'; // <-- ou edite aqui
const STATE_DIR = path.resolve(__dirname, 'caixa_state');

// ── Configuração dos jogos ─────────────────────────────────
//
// modo: 'ponderado' → gera jogos por roleta ponderada (ideal para poucos jogos)
//       'wheeling'  → gera TODAS combinações dos top-10 números (máxima cobertura)
//
// ESTRATÉGIA RECOMENDADA (custo moderado):
//   1 jogo de 7 dezenas (ponderado)  — ~R$ 105
//   1 jogo de 6 dezenas (ponderado)  — ~R$ 5
//
// ESTRATÉGIA DE COBERTURA TOTAL (wheeling):
//   C(10,6) = 210 jogos a R$5 ≈ R$1.050
//   GARANTIA: se 6 dos seus top-10 saírem, você ACERTA A SENA.
//
const CONFIG_JOGOS = [
    { dezenas: 7, qtd: 1, modo: 'ponderado' },  // 1 jogo de 7 dezenas
    { dezenas: 6, qtd: 1, modo: 'ponderado' },  // 1 jogo de 6 dezenas
    // { dezenas: 6, qtd: 10, modo: 'wheeling' }, // descomente para wheeling
];

// Pausa a cada N jogos (limite de R$945 do site)
const PAUSA_A_CADA = 15;

// ============================================================
// UTILIDADES
// ============================================================

function perguntar(texto) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(texto, resposta => {
        rl.close();
        resolve(resposta);
    }));
}

function exibirResumoJogos(listaDeJogos) {
    const totalSoma  = listaDeJogos.reduce((acc, j) => acc + j.reduce((a, b) => a + b, 0), 0);
    const somaMedia  = (totalSoma / listaDeJogos.length).toFixed(1);
    console.log(`\n📋 RESUMO DOS JOGOS GERADOS:`);
    console.log(`   Total de jogos  : ${listaDeJogos.length}`);
    console.log(`   Soma média      : ${somaMedia} (ideal: 100–200)`);
    listaDeJogos.forEach((j, i) => {
        const soma   = j.reduce((a, b) => a + b, 0);
        const pares  = j.filter(n => n % 2 === 0).length;
        console.log(`   Jogo ${String(i + 1).padStart(2)}: [${j.join(', ')}]  soma=${soma}  par/ímpar=${pares}/${j.length - pares}`);
    });
    console.log('');
}

// ============================================================
// BOT PRINCIPAL
// ============================================================

async function iniciarBot() {
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║   🤖 BOT MEGA-SENA — Versão Estratégica       ║');
    console.log('╚══════════════════════════════════════════════╝\n');

    // ── Exibe ranking antes de jogar ───────────────────────
    imprimirRankingScores(10);

    // ── Gera todos os jogos configurados ───────────────────
    console.log('🎲 Gerando jogos estratégicos...');
    const listaDeJogos = [];

    for (const config of CONFIG_JOGOS) {
        const jogos = gerarListaDeJogosEstrategicos(config.dezenas, config.qtd, config.modo);
        listaDeJogos.push(...jogos);
        console.log(`   ✅ ${jogos.length}x jogo(s) de ${config.dezenas} dezenas [${config.modo}] gerados.`);
    }

    if (listaDeJogos.length === 0) {
        console.error('❌ Nenhum jogo foi gerado. Verifique os arquivos de dados.');
        return;
    }

    exibirResumoJogos(listaDeJogos);

    // ── Abre o navegador ───────────────────────────────────
    console.log('🌐 Iniciando navegador...');
    const context = await chromium.launchPersistentContext(STATE_DIR, {
        headless: false,
        locale:   'pt-BR',
        viewport: { width: 1280, height: 900 },
    });

    const page = await context.newPage();

    try {
        console.log('🌐 Acessando Loterias Online...');
        await page.goto('https://www.loteriasonline.caixa.gov.br/', { waitUntil: 'commit' });

        // Aceita cookies / alertas
        await page.getByRole('button', { name: /aceitar/i }).click({ timeout: 3000 }).catch(() => {});
        await page.locator('#botaosim').click().catch(() => {});

        // ── Login (se necessário) ──────────────────────────
        const btnLogin = page.locator('#btnLogin');
        if (await btnLogin.isVisible()) {
            await btnLogin.click();
            await page.waitForSelector('#username');
            await page.fill('#username', CPF);
            await page.click('#button-submit');
            await page.getByRole('button', { name: 'Receber código' }).click();
            console.log('📩 Aguardando login manual (verifique o e-mail/SMS)...');
        }

        // ── Navega até Mega da Virada ──────────────────────
        const linkMegaVirada = page.getByRole('link', { name: 'Mega da Virada' });
        await linkMegaVirada.waitFor({ state: 'visible', timeout: 0 });
        await linkMegaVirada.click();

        await page.waitForSelector('#n01', { timeout: 60000 });
        console.log(`\n📋 Iniciando preenchimento de ${listaDeJogos.length} jogo(s)...\n`);

        // ── Preenche os jogos no volante ───────────────────
        for (let i = 0; i < listaDeJogos.length; i++) {

            // Pausa estratégica a cada PAUSA_A_CADA jogos (limite do site)
            if (i > 0 && i % PAUSA_A_CADA === 0) {
                console.log(`\n⚠️  PAUSA: ${PAUSA_A_CADA} jogos adicionados. Verifique o valor do carrinho antes de continuar.`);
                let confirmacao = '';
                while (confirmacao.toLowerCase() !== 'ok') {
                    confirmacao = await perguntar("👉 Digite 'ok' para continuar: ");
                }
                console.log('🚀 Continuando...\n');
            }

            const jogo = listaDeJogos[i];
            const soma  = jogo.reduce((a, b) => a + b, 0);
            const pares = jogo.filter(n => n % 2 === 0).length;
            console.log(`🎰 Jogo ${i + 1}/${listaDeJogos.length} (${jogo.length} dezenas) | soma=${soma} | p/i=${pares}/${jogo.length - pares} | [${jogo.join(', ')}]`);

            // Limpa o volante
            const btnLimpar = page.locator('#limpar-volante');
            if (await btnLimpar.isVisible()) await btnLimpar.click();

            // Se o jogo tiver mais de 6 dezenas, aumenta o contador
            if (jogo.length > 6) {
                const extra = jogo.length - 6;
                for (let e = 0; e < extra; e++) {
                    await page.locator('#aumentarnumero').click();
                    await page.waitForTimeout(500);
                }
            }

            // Clica em cada número do jogo
            for (const num of jogo) {
                const numFormatado = num.toString().padStart(2, '0');
                await page.locator(`#n${numFormatado}`).click();
            }

            await page.waitForTimeout(1500);

            // Adiciona ao carrinho
            await page.getByRole('button', { name: ' Colocar no Carrinho' }).click();
            console.log(`   ✅ Jogo ${i + 1} adicionado ao carrinho.`);

            await page.waitForTimeout(1000);
        }

        console.log('\n🏆 Todos os jogos foram adicionados! Confira o carrinho e finalize a compra.');

    } catch (err) {
        console.error('❌ Erro durante a execução:', err.message);
    }
    // Nota: contexto mantido aberto intencionalmente para o usuário finalizar a compra
}

iniciarBot();
