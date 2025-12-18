# Robô Loterias Caixa 🍀

Automação em Node.js usando Playwright para preencher jogos da Mega Sena.

## 🚀 Como instalar

1. Tenha o [Node.js](https://nodejs.org/) instalado.
2. Crie uma pasta para o projeto.
3. Coloque os arquivos `package.json` e `bot-loterias.js` dentro dela.
4. Abra o terminal (cmd ou powershell) dentro dessa pasta.
5. Digite o comando abaixo para instalar as dependências:
   ```bash
   npm install
   npx playwright install chromium

## 🎰 Como usar

1. No arquivo bot-loterias.js, altere o CPF para o seu.

2. No terminal, execute:

Bash
node bot-loterias.js

3. O navegador vai abrir. Quando chegar na parte do código/senha, faça manualmente.

4. Após o login, o robô assumirá o controle e preencherá os 10 jogos.


---

### 🚀 Passo a passo para rodar agora:

1. **Crie a pasta:** Clique com o botão direito na sua área de trabalho > Novo > Pasta (nomeie como `robo-loterias`).
2. **Crie os arquivos:** Abra o Bloco de Notas, cole cada código acima e salve com os nomes indicados dentro dessa pasta.
3. **Abra o Terminal:** Dentro da pasta, clique na barra de endereço lá em cima, digite `cmd` e dê Enter.
4. **Instale:** No terminal preto que abriu, digite:
   `npm install`
   *(espere terminar)*
   `npx playwright install chromium`
5. **Rode:**
   `node bot-loterias.js`

---

**Dica do Papito:** O site da Caixa às vezes muda os IDs dos botões. Se o robô travar logo no início, pode ser que o seletor `li >> text="01"` tenha mudado. Se isso rolar, me avisa que a gente ajusta o "alvo"!

