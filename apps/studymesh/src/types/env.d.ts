declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV?: string
    SUPABASE_URL?: string
    SUPABASE_ANON_KEY?: string
    GEMINI_API_KEY?: string
    CEREBRAS_API_KEY?: string
    VITE_SHOW_LOCAL_AI_DEBUG_PANEL?: string
  }
}
