export const EXPECTED_LETTER_ORDER = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V"];

function uniqueUpper(values) {
  const out = [];
  const seen = new Set();
  values.forEach((value) => {
    const clean = String(value || "").trim().toUpperCase();
    if (!clean || seen.has(clean)) {
      return;
    }
    seen.add(clean);
    out.push(clean);
  });
  return out;
}

function filterKnownLetters(values) {
  return values.filter((letter) => EXPECTED_LETTER_ORDER.includes(letter));
}

export function resolveLetterOrder(rawBank) {
  const logs = [];

  if (Array.isArray(rawBank?.letras_incluidas) && rawBank.letras_incluidas.length > 0) {
    const normalized = filterKnownLetters(uniqueUpper(rawBank.letras_incluidas));
    if (normalized.length > 0) {
      logs.push("Usando letras_incluidas del banco.");
      return { letterOrder: normalized, logs, usedFallback: false };
    }
    logs.push("letras_incluidas existe pero no contiene letras validas. Se aplica compatibilidad.");
  } else {
    logs.push("El banco no trae letras_incluidas. Se aplica derivacion por compatibilidad.");
  }

  const fromQuestions = filterKnownLetters(uniqueUpper((rawBank?.preguntas || []).map((q) => q?.letra)));
  const fullOrder = EXPECTED_LETTER_ORDER.slice();

  const missingFromQuestions = EXPECTED_LETTER_ORDER.filter((l) => !fromQuestions.includes(l));
  if (missingFromQuestions.length > 0) {
    logs.push(`Faltan letras en preguntas para compatibilidad: ${missingFromQuestions.join(", ")}`);
  }

  return {
    letterOrder: fullOrder,
    logs,
    usedFallback: true
  };
}

export function validateAndNormalizeBank(rawBank) {
  if (!rawBank || typeof rawBank !== "object" || !Array.isArray(rawBank.preguntas)) {
    throw new Error("El JSON debe incluir preguntas[]");
  }

  const { letterOrder, logs, usedFallback } = resolveLetterOrder(rawBank);
  const validSet = new Set(letterOrder);
  const expectedSet = new Set(EXPECTED_LETTER_ORDER);

  const normalized = [];
  const seenLetters = new Set();
  const duplicateKeys = new Set();
  const seenKey = new Set();

  rawBank.preguntas.forEach((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`preguntas[${index}] no es objeto`);
    }

    const letra = String(item.letra || "").trim().toUpperCase();
    const tipo = String(item.tipo || "").trim();
    const pregunta = String(item.pregunta || "").trim();
    const respuesta = String(item.respuesta || "").trim();

    if (!expectedSet.has(letra)) {
      throw new Error(`preguntas[${index}].letra invalida: ${letra || "(vacia)"}`);
    }
    if (!tipo || !pregunta || !respuesta) {
      throw new Error(`preguntas[${index}] requiere letra, tipo, pregunta y respuesta`);
    }

    if (!validSet.has(letra)) {
      logs.push(`La letra ${letra} existe en preguntas pero no en letras_incluidas. Se ignora en este banco.`);
      return;
    }

    const dupKey = `${letra}|${pregunta.toLowerCase()}|${respuesta.toLowerCase()}`;
    if (seenKey.has(dupKey)) {
      duplicateKeys.add(dupKey);
    }
    seenKey.add(dupKey);
    seenLetters.add(letra);

    normalized.push({
      ...item,
      idx: index + 1,
      letra,
      tipo,
      pregunta,
      respuesta,
      ciclo: String(item.ciclo || ""),
      modulo: String(item.modulo || ""),
      dificultad: String(item.dificultad || "")
    });
  });

  const missingLetters = letterOrder.filter((letter) => !seenLetters.has(letter));

  return {
    bank: {
      ...rawBank,
      letras_incluidas: letterOrder,
      preguntas: normalized,
      questions: normalized
    },
    summary: {
      total: normalized.length,
      duplicateCount: duplicateKeys.size,
      missingLetters,
      letterOrder,
      usedFallback,
      logs
    }
  };
}

export function buildGameSetByLetter(letterOrder, filteredQuestions, shuffleEnabled) {
  const poolByLetter = Object.fromEntries(letterOrder.map((letra) => [letra, []]));
  filteredQuestions.forEach((q) => {
    if (poolByLetter[q.letra]) {
      poolByLetter[q.letra].push(q);
    }
  });

  const selectedByLetter = {};
  const letters = letterOrder.map((letra) => {
    const pool = poolByLetter[letra] || [];
    if (pool.length === 0) {
      return { letra, status: "disabled", questionData: null };
    }

    const picked = shuffleEnabled ? pool[Math.floor(Math.random() * pool.length)] : pool[0];
    selectedByLetter[letra] = picked;
    return { letra, status: "pending", questionData: picked };
  });

  return { letters, selectedByLetter, poolByLetter };
}
