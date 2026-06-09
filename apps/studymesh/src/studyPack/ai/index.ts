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
export type { StrongAiCallOptions, StrongAiProviderId } from './strongProviders'
export type {
  AiStudyPathDashboardDraft,
  AiStudyPathDraft,
  ExtractRawNotesWithAiOptions,
  GenerateStudyPackWithAiOptions,
  GenerateStudyPathWithAiOptions,
  StrongAiModelTransport,
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
export {
  callHostedAiModel,
  createHostedAiTransport,
  getHostedAiStatus,
  markHostedAiIntroSeen,
} from './hostedClient'
export {
  confirmHostedAiCreditCheckout,
  createHostedAiCreditCheckout,
  notifyHostedAiCreditsChanged,
  redirectToHostedAiCreditCheckout,
} from './hostedBilling'
export type { HostedAiModelOptions, HostedAiTransport } from './hostedClient'
export {
  getHostedAiCreditCost,
  DEFAULT_HOSTED_AI_CREDIT_PACK_ID,
  HOSTED_AI_CREDIT_PACKS,
  HOSTED_AI_CREDIT_COSTS,
  HOSTED_AI_DAILY_FREE_CREDITS,
  HOSTED_AI_INITIAL_FREE_CREDITS,
  HOSTED_AI_REFILL_CURRENCY,
  HOSTED_AI_USAGE_CHANGED_EVENT,
  STUDY_CREDITS_LABEL,
  STUDY_CREDITS_SYMBOL,
} from './hostedCredits'
export type {
  HostedAiGatewayPart,
  HostedAiGatewayRequest,
  HostedAiGatewayResponse,
  HostedAiCreditPack,
  HostedAiCreditPackId,
  HostedAiStatus,
  HostedAiSurface,
} from './hostedCredits'
