export {
  DEFAULT_STUDY_PACK_AI_MODEL,
  getEnvCerebrasApiKey,
  STUDY_PACK_AI_SETTINGS_CHANGED_EVENT,
  STUDY_PACK_AI_SETTINGS_KEY,
  clearStudyPackAiToken,
  getEnvGeminiApiKey,
  getEnvStrongAiProviderApiKey,
  getStudyPackAiCredentialForProvider,
  readStudyPackAiSettings,
  resolveStudyPackAiCredentials,
  saveStudyPackAiSettings,
} from './settings'
export type {
  StrongAiProviderCredential,
  StrongAiProviderCredentials,
  StudyPackAiSettings,
} from './settings'
export type { StudyPackAiProvider } from './settings'
export {
  callStrongAiModel,
  DEFAULT_STRONG_AI_PROVIDER,
  getStrongAiProviderConfig,
  isStrongAiProvider,
  STRONG_AI_PROVIDERS,
} from './strongProviders'
export type { StrongAiProviderId } from './strongProviders'
export { normalizeStudyPathGenerationAmount } from './strongGeneration'
export type {
  AiStudyPathDashboardDraft,
  AiStudyPathDraft,
  ExtractRawNotesWithAiOptions,
  GenerateStudyPackWithAiOptions,
  GenerateStudyPathWithAiOptions,
  StudyPathGenerationAmount,
} from './strongGeneration'
export { extractRawNotesWithAi } from './strongGeneration'
export {
  generateStudyPackWithAi as generateStudyPackWithGemini,
  generateStudyPathWithAi as generateStudyPathWithGemini,
} from './strongGeneration'
export { generateStudyPackWithAi, generateStudyPathWithAi } from './provider'
export {
  assertRoleObjectsAreClean,
  filterStudyObjectsForDashboardRole,
  applyStudyMaterialResourceTypeToDraft,
  normalizeAiStudyPackDraft,
  studyObjectAllowedForDashboardRole,
} from './normalizer'
export type {
  AiGenerationDebugTrace,
  AiSourceSummary,
  AiStudyPackDraft,
  StrictAiDashboardContract,
  StudyMaterialDetailLevel,
  StudyMaterialResourceType,
} from './normalizer'
export {
  callLocalLanguageModel,
  extractNotesFromImageWithLocalLanguageModel,
  getLocalLanguageModelImageAvailability,
  getLocalLanguageModelAvailability,
  isLocalLanguageModelSupported,
  resetLocalLanguageModelCooldownForTests,
  testLocalLanguageModel,
} from './localLanguageModel'
export type { LocalAiProgressEvent } from './localLanguageModel'
export {
  cancelAllLocalAiSessions,
  cancelLocalAiSession,
  clearCompletedLocalAiSessionHistory,
  destroyAllLocalAiSessions,
  destroyLocalAiSession,
  getLocalAiSessionDebugState,
  resetLocalAiSessionManagerForTests,
  runLocalAiPrompt,
  subscribeToLocalAiSessionDebugState,
} from './localAiSessionManager'
export type {
  LocalAiManagedSession,
  LocalAiPromptType,
} from './localAiSessionManager'
export {
  generateStudyPathWithLocalAi,
  isLocalAiGenerationError,
  normalizeLocalAiStudyPackDraft,
  parseLocalAiJson,
} from './localGeneration'
export type {
  LocalAiGenerationFailureCode,
  LocalAiGenerationFailureDebug,
} from './localGeneration'
