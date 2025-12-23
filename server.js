// ===============================
// server.js — облачный прокси для DeepSeek
// ===============================
// Задача сервера:
// 1) принять запрос от сайта (index.html)
// 2) безопасно добавить API-ключ DeepSeek
// 3) отправить запрос в DeepSeek
// 4) вернуть ответ обратно сайту
//
// API-ключ хранится ТОЛЬКО в переменной окружения
// ===============================

const express = require("express");
const cors = require("cors");

const app = express();
app.use(express.json({ limit: "2mb" }));

// Разрешаем запросы с любого сайта (для демо / универа)
app.use(
  cors({
    origin: "*",
    methods: ["POST"],
    allowedHeaders: ["Content-Type"],
  })
);

// ========================================
// НАСТРОЙКИ DEEPSEEK
// ========================================

// ❗❗❗ КЛЮЧ СЮДА НЕ ВСТАВЛЯЕТСЯ ❗❗❗
// Он задаётся в Render → Environment Variables
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// Можно менять модель при необходимости
const DEEPSEEK_MODEL = "deepseek-chat";

// URL API DeepSeek (НЕ МЕНЯТЬ)
const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";

// ========================================
// Основной endpoint для сайта
// ========================================
app.post("/api/chat", async (req, res) => {
  try {
    if (!DEEPSEEK_API_KEY) {
      return res.json({
        answer: "❌ DEEPSEEK_API_KEY не задан на сервере",
      });
    }

    const userText = String(req.body.userText || "").trim();
    const docsContext = String(req.body.docsContext || "").trim();
    const docsOnly = Boolean(req.body.docsOnly);

    if (!userText) {
      return res.json({ answer: "Пустой запрос." });
    }

    // ==============================
    // SYSTEM PROMPT
    // ==============================
    const systemPrompt = docsOnly
      ? `
Ты отвечаешь ТОЛЬКО на основе переданного КОНТЕКСТА.
Если ответа нет — ответь строго:
"В документах нет ответа".
Запрещено использовать внешние знания.
      `.trim()
      : `
Ты полезный ассистент.
Если есть контекст — используй его.
      `.trim();

    if (docsOnly && !docsContext) {
      return res.json({ answer: "В документах нет ответа" });
    }

    const messages = [
      { role: "system", content: systemPrompt },
      ...(docsContext
        ? [{ role: "user", content: `КОНТЕКСТ:\n${docsContext}` }]
        : []),
      { role: "user", content: userText },
    ];

    const payload = {
      model: DEEPSEEK_MODEL,
      messages,
      temperature: docsOnly ? 0.1 : 0.7,
    };

    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.json({
        answer: `Ошибка DeepSeek (${response.status}): ${err}`,
      });
    }

    const data = await response.json();
    const answer =
      data?.choices?.[0]?.message?.content ||
      "DeepSeek не вернул ответ.";

    return res.json({ answer });
  } catch (e) {
    return res.json({ answer: `Ошибка сервера: ${String(e)}` });
  }
});

// ========================================
// Запуск сервера
// ========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ DeepSeek server running on port ${PORT}`);
});
