const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const readline = require('readline'); // Para conversar com você

// CONFIGURAÇÕES
const CPF = '000.000.000-00'; //<-- COLOQUE SEU CPF AQUI 
const STATE_DIR = path.resolve(__dirname, 'caixa_state');
const FREQUENCIA_FILE = path.resolve(__dirname, 'frequencia.json');
const MEUS_NUMEROS = Array.from({length: 60}, (_, i) => i + 1);

// Função para fazer a pergunta no terminal
function perguntar(texto) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(texto, resposta => {
        rl.close();
        resolve(resposta);
    }));
}

function gerarListaDeJogosEstrategicos(dezenas, qtd) {
    const listaFinal = [];
    const jogosSet = new Set();
    let urnaVirtual = [];

    if (fs.existsSync(FREQUENCIA_FILE)) {
        const pesos = JSON.parse(fs.readFileSync(FREQUENCIA_FILE, 'utf-8'));
        for (const [num, freq] of Object.entries(pesos)) {
            for (let i = 0; i < freq; i++) urnaVirtual.push(parseInt(num));
        }
    } else {
        urnaVirtual = [...MEUS_NUMEROS];
    }

    while (listaFinal.length < qtd) {
        let sorteio = [];
        while (sorteio.length < dezenas) {
            const index = Math.floor(Math.random() * urnaVirtual.length);
            const numSorteado = urnaVirtual[index];
            if (!sorteio.includes(numSorteado)) sorteio.push(numSorteado);
        }
        sorteio.sort((a, b) => a - b);
        const assinatura = sorteio.join('-');
        if (!jogosSet.has(assinatura)) {
            jogosSet.add(assinatura);
            listaFinal.push(sorteio);
        }
    }
    return listaFinal;
}

async function iniciarBot() {
    const context = await chromium.launchPersistentContext(STATE_DIR, {
        headless: false,
        locale: 'pt-BR',
        viewport: { width: 1280, height: 900 }
    });
    
    const page = await context.newPage();

    try {
        console.log("🌐 Acessando Loterias Online...");
        await page.goto('https://www.loteriasonline.caixa.gov.br/', { waitUntil: 'commit' });

        await page.getByRole('button', { name: /aceitar/i }).click({ timeout: 3000 }).catch(() => {});
        await page.locator('#botaosim').click().catch(() => {});
        
        const btnLogin = page.locator('#btnLogin');
        if (await btnLogin.isVisible()) {
            await btnLogin.click();
            await page.waitForSelector('#username');
            await page.fill('#username', CPF);
            await page.click('#button-submit');
            await page.getByRole('button', { name: 'Receber código' }).click();
            console.log("📩 Aguardando login manual...");
        }


        const linkMegaVirada = page.getByRole('link', { name: 'Mega da Virada' });
        await linkMegaVirada.waitFor({ state: 'visible', timeout: 0 });
        await linkMegaVirada.click();

        await page.waitForSelector('#n01', { timeout: 60000 });

        // --- NOVA ESTRATÉGIA: R$ 1.750,00 ---
        const listaDeJogos = [
            ...gerarListaDeJogosEstrategicos(7, 1), // 1 jogo de 7 dezenas
            ...gerarListaDeJogosEstrategicos(6, 1)  // 1 Jogo de 6 dezenas
        ];

        console.log(`📋 Iniciando processamento de ${listaDeJogos.length} jogos...`);

        for (let i = 0; i < listaDeJogos.length; i++) {
            // VERIFICAÇÃO DE PAUSA (A cada 15 jogos)
            if (i > 0 && i % 15 === 0) {
                console.log("\n⚠️ PAUSA ESTRATÉGICA: 15 jogos foram adicionados.");
                let confirmacao = "";
                while(confirmacao.toLowerCase() !== "ok") {
                    confirmacao = await perguntar("👉 Digite 'ok' para continuar os próximos 15 jogos: ");
                }
                console.log("🚀 Continuando...\n");
            }

            const jogo = listaDeJogos[i];
            console.log(`🎰 Jogo ${i + 1}/${listaDeJogos.length} (${jogo.length} dezenas): [${jogo.join(', ')}]`);

            // Garantir que o volante está limpo (opcional, mas seguro)
            const btnLimpar = page.locator('#limpar-volante');
            if (await btnLimpar.isVisible()) await btnLimpar.click();

            if (jogo.length > 6) {
                await page.locator('#aumentarnumero').click();
                await page.waitForTimeout(1000); 
            }

            for (const num of jogo) {
                const numFormatado = num.toString().padStart(2, '0');
                const seletorId = `#n${numFormatado}`;

               // Clica no ID do número (ex: #n05)
                await page.locator(seletorId).click();
            }

            await page.waitForTimeout(2000)
            // Adicionar ao carrinho
           // await page.locator('#colocar-no-carrinho').click();
            await page.getByRole('button', { name: ' Colocar no Carrinho' }).click();
            console.log("✅ Jogo adicionado ao carrinho.");

            await page.waitForTimeout(1000); 
        }

        console.log("🏆 Missão Finalizada! Confira o carrinho de R$ 1.650,00.");

    } catch (err) {
        console.error("❌ Erro:", err.message);
    } 
}

iniciarBot();