export const regions = [
    { name: 'Reino dos Números', topic: 'Números naturais', symbol: '＋', color: '#f0b418', guardian: 'Guardião do Portal', lesson: 'Resolva primeiro multiplicações e divisões. Depois, adições e subtrações.', quest: 'Acenda os cinco cristais para abrir o portal do reino.' },
    { name: 'Floresta das Frações', topic: 'Frações e equivalências', symbol: '½', color: '#77d9aa', guardian: 'Guardião das Pontes', lesson: 'Frações equivalentes representam a mesma quantidade. Multiplique numerador e denominador pelo mesmo número.', quest: 'Reconstrua as pontes e devolva a energia à floresta.' },
    { name: 'Montanhas da Geometria', topic: 'Formas e medidas', symbol: '△', color: '#9cbcfb', guardian: 'Guardião dos Cristais', lesson: 'Perímetro é a soma dos lados. A área de um retângulo é base × altura.', quest: 'Alinhe os cristais geométricos para alcançar o cume.' },
    { name: 'Templo das Operações', topic: 'Expressões numéricas', symbol: '×', color: '#eab985', guardian: 'Guardião do Templo', lesson: 'A ordem importa: parênteses primeiro, depois multiplicação e divisão, depois adição e subtração.', quest: 'Ative os mecanismos antigos do templo.' },
    { name: 'Cavernas dos Desafios', topic: 'Decimais e grandezas', symbol: '÷', color: '#b1a8f4', guardian: 'Guardião das Medidas', lesson: 'Um metro tem 100 centímetros. Ao somar decimais, alinhe as vírgulas.', quest: 'Ilumine a caverna usando medidas e raciocínio.' },
    { name: 'Fortaleza dos Enigmas', topic: 'Revisão e raciocínio', symbol: '∞', color: '#efce6d', guardian: 'Guardião do Conhecimento', lesson: 'Leia o problema, escolha a operação e confira se o resultado faz sentido.', quest: 'Reúna tudo o que aprendeu e liberte a energia do conhecimento.' }
];
export const gears = [{ name: 'Pulseira numérica', symbol: '＋', xp: 0, level: 'Aprendiz' }, { name: 'Mochila do explorador', symbol: '÷', xp: 400, level: 'Explorador' }, { name: 'Compasso do estrategista', symbol: '△', xp: 1200, level: 'Estrategista' }, { name: 'Insígnia do conhecimento', symbol: '∞', xp: 2400, level: 'Capitão' }];
function rand(n) { const v = new Uint32Array(1); crypto.getRandomValues(v); return v[0] % n; }
export function makeQuestion(region, stage) {
    const a = rand(8) + 3, b = rand(6) + 2;
    let text = '', answer = '', explanation = '', wrong = [];
    const number = (t, n, e) => { text = t; answer = String(n); explanation = e; wrong = [String(n + 1), String(n + 3), String(Math.max(0, n - 2))]; };
    if (region === 0) {
        if (stage < 2)
            number(`${a * 10} + ${b * 3} = ?`, a * 10 + b * 3, `Some as dezenas e as unidades: ${a * 10} + ${b * 3} = ${a * 10 + b * 3}.`);
        else if (stage < 4)
            number(`Há ${a} caixas com ${b} cristais em cada uma. Quantos cristais há?`, a * b, `${a} grupos de ${b}: ${a} × ${b} = ${a * b}.`);
        else
            number(`O portal precisa de ${a * b} cristais. Já tem ${a}. Quantos faltam?`, a * b - a, `Subtraia o que já existe: ${a * b} − ${a} = ${a * b - a}.`);
    }
    if (region === 1) {
        if (stage % 2 === 0) {
            text = `Qual fração equivale a 1/${b}?`;
            answer = `${a}/${a * b}`;
            wrong = [`${a}/${a * b + 1}`, `1/${b + 1}`, `${a + 1}/${a * b}`];
            explanation = `Multiplique as duas partes por ${a}: 1/${b} = ${a}/${a * b}.`;
        }
        else
            number(`Quanto é 1/${b} de ${a * b}?`, a, `Divida o total em ${b} partes iguais: ${a * b} ÷ ${b} = ${a}.`);
    }
    if (region === 2) {
        if (stage === 0) {
            text = 'Quantos lados tem um hexágono?';
            answer = '6';
            wrong = ['5', '7', '8'];
            explanation = 'O hexágono é um polígono de seis lados.';
        }
        else if (stage === 3) {
            text = 'Quanto mede um ângulo reto?';
            answer = '90°';
            wrong = ['45°', '180°', '360°'];
            explanation = 'Um ângulo reto mede 90°, como o canto de um quadrado.';
        }
        else if (stage % 2)
            number(`Um retângulo mede ${a} m por ${b} m. Qual é o perímetro, em metros?`, 2 * (a + b), `Some os quatro lados: ${a} + ${b} + ${a} + ${b} = ${2 * (a + b)} m.`);
        else
            number(`Um retângulo mede ${a} m por ${b} m. Qual é a área, em m²?`, a * b, `Área = base × altura = ${a} × ${b} = ${a * b} m².`);
    }
    if (region === 3) {
        if (stage % 2)
            number(`(${a} + ${b}) × 2 = ?`, (a + b) * 2, `Parênteses primeiro: ${a + b} × 2 = ${(a + b) * 2}.`);
        else
            number(`${a} + ${b} × 2 = ?`, a + b * 2, `Multiplique antes de somar: ${a} + ${b * 2} = ${a + b * 2}.`);
    }
    if (region === 4) {
        if (stage % 2)
            number(`${a} metros equivalem a quantos centímetros?`, a * 100, `Cada metro tem 100 cm: ${a} × 100 = ${a * 100} cm.`);
        else {
            text = `${a},50 + ${b},25 = ?`;
            answer = `${a + b},75`;
            wrong = [`${a + b},25`, `${a + b + 1},75`, `${a + b},50`];
            explanation = `Some as partes inteiras e os centésimos: ${a + b} + 0,75 = ${answer}.`;
        }
    }
    if (region === 5) {
        if (stage < 2)
            number(`Divida ${a * b} cristais igualmente entre ${b} portais. Quantos vão em cada um?`, a, `${a * b} ÷ ${b} = ${a}.`);
        else if (stage < 4)
            number(`Uma sequência começa em ${a} e aumenta de ${b} em ${b}: ${a}, ${a + b}, ${a + 2 * b}, ... Qual é o próximo número?`, a + 3 * b, `Adicione ${b} ao último número: ${a + 2 * b} + ${b} = ${a + 3 * b}.`);
        else
            number(`Uma sala tem ${a} fileiras com ${b} lugares. ${b} lugares estão vazios. Quantas pessoas estão sentadas?`, a * b - b, `Primeiro calcule os lugares: ${a} × ${b} = ${a * b}. Depois subtraia os vazios: ${a * b} − ${b} = ${a * b - b}.`);
    }
    const options = [answer, ...wrong];
    for (let i = options.length - 1; i > 0; i--) {
        let j = rand(i + 1);
        [options[i], options[j]] = [options[j], options[i]];
    }
    return { text, options, correct: options.indexOf(answer), explanation };
}
export function publicQuestion(q) { return { text: q.text, options: q.options }; }
export function scoreRun(correct) { return correct * 100; }
