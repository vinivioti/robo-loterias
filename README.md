# Robô Loterias Caixa 🍀

Automação em Node.js usando Playwright para preencher jogos da Mega Sena.

## 🚀 Como instalar

1. Tenha o [Node.js](https://nodejs.org/) instalado.
2. Abra o terminal (cmd ou powershell) dentro dessa pasta.
3. Digite o comando abaixo para instalar as dependências:
   ```bash
   npm install
   npx playwright install chromium

## 🎰 Como usar

1. No arquivo bot-loterias-estatistico.js, altere o CPF para o seu.
2. No arquivo bot-loterias-estatistico.js, Altere a quantidade dos jogos de 7 e 6 dezenas desejados em:
        // --- Quantidade de Jogos de 7 e 6 dezenas---
        const listaDeJogos = [
            ...gerarListaDeJogosEstrategicos(7, 1), // 1 jogo de 7 dezenas
            ...gerarListaDeJogosEstrategicos(6, 1)  // 1 Jogo de 6 dezenas
        ];
3. No terminal, execute:
   ```bash
   node bot-loterias-estatistico.js

4. O navegador vai abrir. Quando chegar na parte do código/senha, faça manualmente.

5. Após o login, o robô assumirá o controle e preencherá os jogos conforme desejado e colocará no carrinho. Devido ao limite de R$945,00 por compra, orobô fará pausas de 15 em 15 jogos e aguardará você dar o comando 'ok' para continuar.

6. Finalize a compra manualmente e boa sorte!!

