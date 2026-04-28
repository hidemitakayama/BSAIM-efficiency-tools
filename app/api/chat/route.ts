type Message = { role: 'user' | 'assistant'; content: string };

const SYSTEM_PROMPT_BASE = `あなたはWeb制作会社のサブスクリプション型サービス専門の収益コンサルタントAIです。
ユーザーが操作している「料金・利益シミュレーター」をもとに、具体的で実践的なアドバイスを提供します。

## あなたの役割
- 料金設定の改善提案（利益率の向上）
- 追加オプション（アドオン）の活用・アップセル戦略
- LTV最大化のための顧客維持施策
- 原価（工数・ツール代）削減のアドバイス
- 競合他社との差別化ポイントの提案

## 回答スタイル
- 日本語で回答する
- 具体的な数値を引用して説明する（例: 「現在の月額粗利 ¥X,XXX を ¥XX,XXX に改善するには...」）
- 簡潔にまとめ、必要に応じて箇条書きを使う
- ポジティブかつ実践的なトーンを保つ`;

export async function POST(req: Request) {
  try {
    if (!process.env.GROQ_API_KEY) {
      return new Response('GROQ_API_KEY が設定されていません', { status: 500 });
    }

    const { messages, simContext }: { messages: Message[]; simContext: string } =
      await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response('messages is required', { status: 400 });
    }

    const systemInstruction = `${SYSTEM_PROMPT_BASE}

## 現在のシミュレーション設定
\`\`\`
${simContext}
\`\`\``;

    const groqMessages = [
      { role: 'system', content: systemInstruction },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: groqMessages,
        stream: true,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Groq API error:', res.status, errText);
      return new Response(errText, { status: res.status });
    }

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            for (const line of chunk.split('\n')) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data:')) continue;
              const data = trimmed.slice(5).trim();
              if (data === '[DONE]') break;
              try {
                const json = JSON.parse(data);
                const text = json.choices?.[0]?.delta?.content;
                if (text) controller.enqueue(encoder.encode(text));
              } catch {
                // ignore malformed lines
              }
            }
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Chat API error:', msg);
    return new Response(msg, { status: 500 });
  }
}
