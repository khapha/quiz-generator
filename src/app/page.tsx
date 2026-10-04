import { readFileSync } from "node:fs";
import { join } from "node:path";
import QuizHome from "./quiz-home";
import type { DeckMeta } from "@/lib/types";

function getDecks(): DeckMeta[] {
  try {
    const raw = readFileSync(join(process.cwd(), "public", "quizzes", "index.json"), "utf-8");
    return JSON.parse(raw) as DeckMeta[];
  } catch {
    return [];
  }
}

export default function Home() {
  return <QuizHome decks={getDecks()} />;
}
