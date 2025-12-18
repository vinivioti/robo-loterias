const { chromium } = require('playwright');
const path = require('path');

// CONFIGURAÇÕES
const CPF = '000.000.000-00'; // Coloque seu CPF real aqui
const STATE_DIR = path.resolve(__dirname, 'caixa_state');

const MEUS_NUMEROS = [
  1, 5, 8, 10, 15, 20, 22, 25, 30, 33, 
  35, 40, 42, 45, 48, 50, 51, 53, 54, 55, 
  56, 57, 58, 59, 60, 2, 3, 11, 19, 21
];

/**
 * Gera jogos aleatórios de 6 números a partir da sua lista de 30
 */
function gerarJogos(arrayNumeros, qtd = 10) {
    const jogos = [];
    for (let i = 0; i < qtd; i++) {
        const sorteio = [...arrayNumeros]
            .sort(() => 0.5 - Math.random())
            .slice(0, 6)
            .sort((a, b) => a - b);
        jogos.push(sorteio);
    }
    return jogos;
}

async function iniciarBot() {
    // Persistent Context mantém a sessão ativa (cookies e login)
    const context = await chromium.launchPersistentContext(STATE_DIR, {
        headless: false,
        locale: 'pt-BR',
        viewport: { width: 1280, height: 900 }
    });
    
    
    const page = await context.newPage();

    try {
        console.log("🌐 Acessando Loterias Online...");
        await page.goto('https://www.loteriasonline.caixa.gov.br/', { waitUntil: 'commit' });

        try {
            // Tenta clicar no botão "Aceitar" com um limite de 3 segundos
            await page.getByRole('button', { name: 'Aceitar' }).click({ timeout: 3000 });
            console.log("✅ Botão 'Aceitar' encontrado e clicado.");
        } catch (error) {
            // Se o botão não for clicável ou não aparecer em 3s, ele ignora o erro
            console.log("ℹ️ Botão 'Aceitar' não apareceu, seguindo adiante...");
        }

        // 1. Verificação de idade
        await page.locator('//*[@id="botaosim"]').click();

        // 2. Acessar Login
        await page.locator('//*[@id="btnLogin"]').click();

        // 3. Preencher CPF
        console.log("🔑 Digitando CPF...");
        await page.waitForSelector('//*[@id="username"]');
        await page.fill('//*[@id="username"]', CPF);
        await page.click('//*[@id="button-submit"]');
        await page.getByRole('button', { name: 'Receber código' }).click();

         // 4. Pausa para ação humana
        console.log("📩 Pegue o código enviado para o seu e-mail e faça o login manualmente.");
        console.log("⏳ O robô vai esperar você logar e a página da Mega-Sena ser acessada...");

        //Após logar com sucesso:
        console.log("Log efetuado, iniciando o processo de preenchimento...");

        // Espera clicar na Mega Sena e o volante aparecer
        // await page.waitForSelector('//*[@id="Mega-Sena"]', { timeout: 0 });
        // await page.click('//*[@id="Mega-Sena"]');

        // Espera o link da Mega da Virada aparecer e clica
        const linkMegaVirada = page.getByRole('link', { name: 'Mega da Virada' });
        await linkMegaVirada.waitFor({ state: 'visible', timeout: 0 }); // Espera infinita até você logar
        await linkMegaVirada.click();

        // Espera carregar o volante de jogo (procurando pelo ID do número 01)
        console.log("🚀 Aguardando volante carregar...");
        await page.waitForSelector('#n01', { timeout: 60000 });

        const jogosParaFazer = gerarJogos(MEUS_NUMEROS, 10);

        for (let i = 0; i < jogosParaFazer.length; i++) {
            const jogo = jogosParaFazer[i];
            console.log(`🎰 Preenchendo Jogo ${i + 1}/10: [${jogo.join(', ')}]`);

            // Garantir que o volante está limpo (opcional, mas seguro)
            const btnLimpar = page.locator('#limpar-volante');
            if (await btnLimpar.isVisible()) await btnLimpar.click();

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
            
            // Delay pequeno para animação do site
            await page.waitForTimeout(1000); 
        }

        console.log("🛒 FIM! Todos os 10 jogos estão no carrinho. Pode finalizar o pagamento!");

    } catch (err) {
        console.error("❌ Erro na automação:", err.message);
    } 
    // Nota: Não fechei o browser para você poder pagar no final.
}

iniciarBot();