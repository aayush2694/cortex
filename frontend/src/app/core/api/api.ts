import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, Signal, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import {
  Algorithm,
  ChatSession,
  ChatSessionDetail,
  InterviewQuestion,
  JobApplication,
  QuestionBank,
  SkillMatch,
  Activity,
  Flashcard,
  Grade,
  NoteSummary,
  PrepPlan,
  Today,
  TopicNote,
  CodingProblem,
  CodingProblemSummary,
  Solution,
  Submission,
  SolvedProblem,
  KnowledgeMap,
  ProgressItem,
  Recommendation,
  Status,
  TopicDetail,
  Trace,
} from './models';

export const API = '/api/v1';

/** The browser's time zone, so "today" and the heatmap follow your calendar. */
export const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const tz = encodeURIComponent(TIME_ZONE);

/**
 * Reads use httpResource (signal-based, reloads when inputs change).
 * Writes use HttpClient and return promises.
 */
@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);

  // ---------------------------------------------------------------- reads (resources)

  knowledgeMap() {
    return httpResource<KnowledgeMap>(() => `${API}/topics`);
  }

  topic(id: Signal<string | undefined>) {
    return httpResource<TopicDetail>(() => (id() ? `${API}/topics/${id()}` : undefined));
  }

  progress() {
    return httpResource<{ items: ProgressItem[] }>(() => `${API}/progress`);
  }

  nextTopics(limit = 3) {
    return httpResource<{ items: Recommendation[] }>(() => `${API}/progress/next?limit=${limit}`);
  }

  solvedProblems() {
    return httpResource<{ items: SolvedProblem[] }>(() => `${API}/progress/problems`);
  }

  algorithms() {
    return httpResource<{ items: Algorithm[] }>(() => `${API}/visualizer/algorithms`);
  }

  practiceProblems() {
    return httpResource<{ items: CodingProblemSummary[] }>(() => `${API}/practice/problems`);
  }

  practiceProblem(id: Signal<string | undefined>) {
    return httpResource<CodingProblem>(() =>
      id() ? `${API}/practice/problems/${id()}` : undefined,
    );
  }

  submissions(id: Signal<string | undefined>) {
    return httpResource<{ items: Submission[] }>(() =>
      id() ? `${API}/practice/problems/${id()}/submissions` : undefined,
    );
  }

  today() {
    return httpResource<Today>(() => `${API}/study/today?tz=${tz}`);
  }

  activity(days = 182) {
    return httpResource<Activity>(() => `${API}/study/activity?tz=${tz}&days=${days}`);
  }

  dueCards() {
    return httpResource<{ items: Flashcard[] }>(() => `${API}/study/cards/due?limit=100`);
  }

  allCards() {
    return httpResource<{ items: Flashcard[] }>(() => `${API}/study/cards`);
  }

  notes() {
    return httpResource<{ items: NoteSummary[] }>(() => `${API}/study/notes`);
  }

  note(topicId: Signal<string | undefined>) {
    return httpResource<TopicNote>(() =>
      topicId() ? `${API}/study/notes/${topicId()}` : undefined,
    );
  }

  plan() {
    return httpResource<PrepPlan>(() => `${API}/study/plan`);
  }

  applications() {
    return httpResource<{ items: JobApplication[] }>(() => `${API}/jobs/applications`);
  }

  jobProfile() {
    return httpResource<{ current_ctc: number | null }>(() => `${API}/jobs/profile`);
  }

  questionBank() {
    return httpResource<QuestionBank>(() => `${API}/jobs/questions`);
  }

  chatSessions() {
    return httpResource<{ items: ChatSession[] }>(() => `${API}/tutor/sessions`);
  }

  // ---------------------------------------------------------------- writes / one-off calls

  setStatus(topicId: string, status: Status) {
    return firstValueFrom(this.http.put<ProgressItem>(`${API}/progress/${topicId}`, { status }));
  }

  recordVisualizerDone(topicId: string) {
    return firstValueFrom(
      this.http.post<ProgressItem>(`${API}/progress/${topicId}/events`, {
        kind: 'visualizer_completed',
      }),
    );
  }

  setSolved(topicId: string, slug: string, solved: boolean) {
    return firstValueFrom(
      this.http.put<ProgressItem>(`${API}/progress/${topicId}/problems/${slug}`, { solved }),
    );
  }

  trace(key: string, input: Record<string, unknown>) {
    return firstValueFrom(this.http.post<Trace>(`${API}/visualizer/${key}/trace`, { input }));
  }

  practiceSolution(id: string) {
    return firstValueFrom(this.http.get<Solution>(`${API}/practice/problems/${id}/solution`));
  }

  /** The Python harness that judges code; the browser runs it in Pyodide. */
  practiceRuntime() {
    return firstValueFrom(this.http.get(`${API}/practice/runtime`, { responseType: 'text' }));
  }

  submit(id: string, body: { code: string; passed: number; total: number; runtime_ms: number }) {
    return firstValueFrom(
      this.http.post<Submission>(`${API}/practice/problems/${id}/submissions`, body),
    );
  }

  /** Everything you've saved, as a JSON file download. */
  exportUrl(): string {
    return `${API}/me/export`;
  }

  saveNote(topicId: string, body: string) {
    return firstValueFrom(this.http.put<TopicNote>(`${API}/study/notes/${topicId}`, { body }));
  }

  addTopicCards(topicId: string) {
    return firstValueFrom(
      this.http.post<{ added: number; items: Flashcard[] }>(
        `${API}/study/topics/${topicId}/cards`,
        {},
      ),
    );
  }

  addCard(body: { topic_id: string | null; front: string; back: string }) {
    return firstValueFrom(this.http.post<Flashcard>(`${API}/study/cards`, body));
  }

  reviewCard(id: number, grade: Grade) {
    return firstValueFrom(this.http.post<Flashcard>(`${API}/study/cards/${id}/review`, { grade }));
  }

  editCard(id: number, body: { front: string; back: string }) {
    return firstValueFrom(this.http.patch<Flashcard>(`${API}/study/cards/${id}`, body));
  }

  deleteCard(id: number) {
    return firstValueFrom(this.http.delete<void>(`${API}/study/cards/${id}`));
  }

  savePlan(plan: PrepPlan) {
    return firstValueFrom(this.http.put<PrepPlan>(`${API}/study/plan`, plan));
  }

  createApplication(body: Partial<JobApplication> & { company: string; role: string }) {
    return firstValueFrom(this.http.post<JobApplication>(`${API}/jobs/applications`, body));
  }

  updateApplication(id: number, patch: Partial<JobApplication>) {
    return firstValueFrom(this.http.patch<JobApplication>(`${API}/jobs/applications/${id}`, patch));
  }

  deleteApplication(id: number) {
    return firstValueFrom(this.http.delete<void>(`${API}/jobs/applications/${id}`));
  }

  saveJobProfile(currentCtc: number | null) {
    return firstValueFrom(
      this.http.put<{ current_ctc: number | null }>(`${API}/jobs/profile`, {
        current_ctc: currentCtc,
      }),
    );
  }

  matchResume(resume: string, job: string) {
    return firstValueFrom(this.http.post<SkillMatch>(`${API}/jobs/match`, { resume, job }));
  }

  saveQuestion(id: string, body: { practised?: boolean; my_answer?: string }) {
    return firstValueFrom(this.http.put<InterviewQuestion>(`${API}/jobs/questions/${id}`, body));
  }

  createChat(topicId: string | null) {
    return firstValueFrom(
      this.http.post<ChatSession>(`${API}/tutor/sessions`, { topic_id: topicId }),
    );
  }

  deleteChat(id: string) {
    return firstValueFrom(this.http.delete<void>(`${API}/tutor/sessions/${id}`));
  }

  chat(id: string) {
    return firstValueFrom(this.http.get<ChatSessionDetail>(`${API}/tutor/sessions/${id}`));
  }
}

/** Pull a readable message out of an API error response. */
export function errorMessage(err: unknown, fallback = 'Something went wrong'): string {
  const body = (err as { error?: { error?: { message?: string } } })?.error;
  return body?.error?.message ?? fallback;
}
