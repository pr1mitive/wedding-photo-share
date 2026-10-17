"use client";

import { DATA_BACKEND, isSupabaseConfigured } from "../config";
import type { Repo } from "./contract";
import { DemoRepo } from "./demo";
import { SupabaseRepo } from "./supabase";

let instance: Repo | null = null;

/**
 * データ層の取得。
 * DATA_BACKEND=supabase かつ環境変数が揃っている場合のみ本番実装を使い、
 * それ以外はブラウザ内ストレージのデモ実装にフォールバックする。
 */
export function getRepo(): Repo {
  if (instance) return instance;
  if (DATA_BACKEND === "supabase" && isSupabaseConfigured) {
    instance = new SupabaseRepo();
  } else {
    instance = new DemoRepo();
  }
  return instance;
}

export type { Repo, CreatePostInput, StatsSummary, AuditInput, UploadFile } from "./contract";
