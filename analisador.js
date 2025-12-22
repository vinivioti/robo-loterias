// analisador.js
const axios = require('axios'); // Instale com: npm install axios
const fs = require('fs');

async function mapearFrequencia() {
    console.log("📊 Analisando histórico de resultados...");
    try {
        // Usando uma API de resultados (exemplo didático)
        // No mundo real, você pode baixar o .csv da Caixa e ler localmente
        const response = await axios.get('https://loteriascaixa-api.herokuapp.com/api/megasena');
        const sorteios = response.data;

        const frequencia = {};
        // Inicializa de 1 a 60
        for (let i = 1; i <= 60; i++) frequencia[i] = 0;

        // Conta a ocorrência de cada número
        sorteios.forEach(concurso => {
            concurso.dezenas.forEach(num => {
                const n = parseInt(num);
                frequencia[n] += 1;
            });
        });

        fs.writeFileSync('frequencia.json', JSON.stringify(frequencia, null, 2));
        console.log("✅ Mapa de frequência gerado com sucesso em 'frequencia.json'!");
    } catch (error) {
        console.error("❌ Erro ao analisar dados:", error.message);
    }
}

mapearFrequencia();