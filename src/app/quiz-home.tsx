"use client";

import { useCallback, useState } from "react";
import { withBase } from "@/lib/base-path";
import type { DeckMeta, Quiz } from "@/lib/types";

type Phase = "browse" | "loading" | "error" | "quiz" | "result";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

const PALETTE = [
  "from-blue-500 to-indigo-500",
  "from-emerald-500 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-violet-500 to-purple-500",
  "from-rose-500 to-pink-500",
  "from-cyan-500 to-sky-500",
];

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
      {children}
    </span>
  );
}

function ScoreRing({ percent }: { percent: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative mx-auto h-36 w-36">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#e2e8f0" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="url(#scoreGrad)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - percent / 100)}
        />
        <defs>
          <linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-3xl font-extrabold tracking-tight text-slate-800">{percent}%</span>
      </div>
    </div>
  );
}

export default function QuizHome({ decks }: { decks: DeckMeta[] }) {
  const [phase, setPhase] = useState<Phase>("browse");
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [order, setOrder] = useState<number[]>([]);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [shuffled, setShuffled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openDeck(deck: DeckMeta, doShuffle: boolean) {
    setPhase("loading");
    setError(null);
    try {
      const res = await fetch(withBase(`/quizzes/${deck.id}.json`));
      if (!res.ok) throw new Error(`Không tải được bộ đề (HTTP ${res.status})`);
      const data = (await res.json()) as Quiz;
      const order0 = data.questions.map((_, i) => i);
      setQuiz(data);
      setOrder(doShuffle ? shuffle(order0) : order0);
      setShuffled(doShuffle);
      setAnswers(Array.from({ length: data.questions.length }, () => null));
      setPhase("quiz");
      window.scrollTo(0, 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi.");
      setPhase("error");
    }
  }

  const toggleShuffle = useCallback(() => {
    if (!quiz) return;
    setShuffled((prev) => {
      const next = !prev;
      setOrder(next ? shuffle(quiz.questions.map((_, i) => i)) : quiz.questions.map((_, i) => i));
      return next;
    });
  }, [quiz]);

  function backToBrowse() {
    setPhase("browse");
    setQuiz(null);
    setShuffled(false);
    window.scrollTo(0, 0);
  }

  if (phase === "browse") {
    const total = decks.reduce((s, d) => s + d.count, 0);
    return (
      <div className="w-full max-w-3xl space-y-8">
        <section className="space-y-3 pt-4 text-center">
          <h1 className="bg-gradient-to-r from-blue-700 via-indigo-600 to-violet-600 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent">
            Ngân hàng câu hỏi trắc nghiệm
          </h1>
          <p className="text-slate-500">
            Ôn tập với các bộ đề sinh từ tài liệu học tập, kèm giải thích chi tiết cho từng câu.
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            <Chip>{decks.length} bộ đề</Chip>
            <Chip>{total.toLocaleString("vi-VN")} câu hỏi</Chip>
            <Chip>Giải thích chi tiết</Chip>
          </div>
        </section>

        <section className="grid gap-3">
          {decks.map((deck, i) => (
            <button
              key={deck.id}
              onClick={() => openDeck(deck, false)}
              className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
            >
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${PALETTE[i % PALETTE.length]} text-base font-bold text-white shadow-sm`}
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-slate-800 group-hover:text-blue-700">
                  {deck.title}
                </span>
                <span className="mt-0.5 block text-sm text-slate-500">{deck.count} câu hỏi</span>
              </span>
              <span className="shrink-0 text-slate-300 transition-all group-hover:translate-x-1 group-hover:text-blue-500">
                →
              </span>
            </button>
          ))}
        </section>
      </div>
    );
  }

  if (phase === "loading") {
    return (
      <div className="flex flex-col items-center gap-3 pt-16">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-slate-200 border-t-blue-600" />
        <p className="text-sm text-slate-500">Đang tải bộ đề...</p>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="space-y-4 pt-16 text-center">
        <p className="text-slate-500">{error}</p>
        <button
          onClick={backToBrowse}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-slate-50"
        >
          ← Về danh sách đề
        </button>
      </div>
    );
  }

  if (phase === "quiz" && quiz) {
    const answered = answers.filter((a) => a !== null).length;
    const allDone = answered === quiz.questions.length;
    return (
      <div className="w-full max-w-3xl space-y-5 pb-20">
        <div className="sticky top-[60px] z-10 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <h1 className="truncate font-semibold text-slate-800">{quiz.title}</h1>
            <span className="shrink-0 text-sm text-slate-500">
              {answered}/{quiz.questions.length}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-300"
              style={{ width: `${(answered / quiz.questions.length) * 100}%` }}
            />
          </div>
          <button
            onClick={toggleShuffle}
            className={`mt-3 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              shuffled
                ? "border-blue-600 bg-blue-50 text-blue-700"
                : "border-slate-300 bg-white text-slate-500 hover:border-slate-400"
            }`}
          >
            🔀 {shuffled ? "Đang xáo trộn — bấm để về thứ tự gốc" : "Xáo trộn câu hỏi"}
          </button>
        </div>

        {order.map((qi, position) => {
          const q = quiz.questions[qi];
          return (
            <div key={q.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="font-medium leading-relaxed text-slate-800">
                <span className="mr-2 rounded-md bg-blue-50 px-2 py-0.5 text-sm font-bold text-blue-700">
                  {position + 1}
                </span>
                {q.question}
              </p>
              <div className="mt-4 grid gap-2">
                {q.options.map((opt, oi) => {
                  const selected = answers[qi] === oi;
                  return (
                    <button
                      key={oi}
                      onClick={() =>
                        setAnswers((prev) => prev.map((a, i) => (i === qi ? oi : a)))
                      }
                      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                        selected
                          ? "border-blue-600 bg-blue-50 font-medium text-blue-900 ring-1 ring-blue-600"
                          : "border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-slate-50"
                      }`}
                    >
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                          selected
                            ? "bg-blue-600 text-white"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {LETTERS[oi]}
                      </span>
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 p-3 backdrop-blur">
          <div className="mx-auto flex max-w-3xl gap-3 px-4">
            <button
              onClick={backToBrowse}
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium shadow-sm hover:bg-slate-50"
            >
              ← Danh sách đề
            </button>
            <button
              onClick={() => {
                setPhase("result");
                window.scrollTo(0, 0);
              }}
              disabled={!allDone}
              className="flex-1 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {allDone ? "Nộp bài" : `Còn ${quiz.questions.length - answered} câu chưa trả lời`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "result" && quiz) {
    const score = quiz.questions.reduce(
      (sum, q, qi) => sum + (answers[qi] === q.answerIndex ? 1 : 0),
      0
    );
    const percent = Math.round((score / quiz.questions.length) * 100);

    return (
      <div className="w-full max-w-3xl space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="font-semibold text-slate-800">{quiz.title}</h1>
          <div className="mt-5">
            <ScoreRing percent={percent} />
          </div>
          <p className="mt-4 text-lg font-semibold text-slate-700">
            {score}/{quiz.questions.length} câu đúng
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {percent >= 80
              ? "Xuất sắc! Bạn nắm rất vững kiến thức."
              : percent >= 50
                ? "Khá tốt — xem lại các câu sai bên dưới."
                : "Cần ôn tập thêm. Hãy đọc kỹ phần giải thích."}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Chip>✅ {score} đúng</Chip>
            <Chip>❌ {quiz.questions.length - score} sai</Chip>
          </div>
        </div>

        {quiz.questions.map((q, qi) => {
          const userAnswer = answers[qi];
          const correct = userAnswer === q.answerIndex;
          return (
            <div
              key={q.id}
              className={`rounded-2xl border border-l-4 bg-white p-5 shadow-sm ${
                correct ? "border-slate-200 border-l-emerald-500" : "border-slate-200 border-l-rose-500"
              }`}
            >
              <p className="font-medium leading-relaxed text-slate-800">
                <span className="mr-1.5">{correct ? "✅" : "❌"}</span>
                Câu {qi + 1}. {q.question}
              </p>
              <div className="mt-3 grid gap-1.5 text-sm">
                {q.options.map((opt, oi) => {
                  const isCorrect = oi === q.answerIndex;
                  const isUserPick = oi === userAnswer;
                  return (
                    <div
                      key={oi}
                      className={`flex items-start gap-2 rounded-lg px-3 py-2 ${
                        isCorrect
                          ? "bg-emerald-50 font-medium text-emerald-900"
                          : isUserPick
                            ? "bg-rose-50 text-rose-900 line-through"
                            : "text-slate-600"
                      }`}
                    >
                      <span className="font-semibold">{LETTERS[oi]}.</span>
                      <span>{opt}</span>
                      {isUserPick && !isCorrect && (
                        <span className="ml-auto shrink-0 text-xs text-rose-500">bạn chọn</span>
                      )}
                    </div>
                  );
                })}
              </div>
              {q.explanation && (
                <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-600">
                  <span className="font-medium text-slate-700">Giải thích: </span>
                  {q.explanation}
                </p>
              )}
              {q.source && <p className="mt-1.5 px-1 text-xs text-slate-400">Nguồn: {q.source}</p>}
            </div>
          );
        })}

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            onClick={() => {
              setAnswers(Array.from({ length: quiz.questions.length }, () => null));
              setPhase("quiz");
              window.scrollTo(0, 0);
            }}
            className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium shadow-sm hover:bg-slate-50"
          >
            Làm lại
          </button>
          <button
            onClick={() =>
              openDeck(
                { id: quiz.id, title: quiz.title, count: quiz.questions.length },
                true
              )
            }
            className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium shadow-sm hover:bg-slate-50"
          >
            🔀 Làm lại (xáo trộn)
          </button>
          <button
            onClick={backToBrowse}
            className="flex-1 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 font-semibold text-white shadow-sm hover:opacity-90"
          >
            Chọn đề khác
          </button>
        </div>
      </div>
    );
  }

  return null;
}
