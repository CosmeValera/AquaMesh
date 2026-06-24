export {
  DEFAULT_QUICK_CREATE_AI_MODEL,
  getEnvCerebrasApiKey,
  QUICK_CREATE_AI_SETTINGS_CHANGED_EVENT,
  QUICK_CREATE_AI_SETTINGS_KEY,
  clearQuickCreateAiToken,
  getEnvGeminiApiKey,
  getEnvStrongAiProviderApiKey,
  getQuickCreateAiCredentialForProvider,
  readQuickCreateAiSettings,
  resolveQuickCreateAiCredentials,
  saveQuickCreateAiSessionKey,
  saveQuickCreateAiSettings,
} from './settings'
export type {
  StrongAiProviderCredential,
  StrongAiProviderCredentials,
  QuickCreateAiSettings,
} from './settings'
export type { QuickCreateAiProvider } from './settings'
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
  GenerateQuickCreateWithAiOptions,
  GenerateStudyPathWithAiOptions,
  StrongAiModelTransport,
} from './strongGeneration'
export {
  generateQuickCreateWithAi as generateQuickCreateWithGemini,
  generateStudyPathWithAi as generateStudyPathWithGemini,
} from './strongGeneration'
export {
  generateQuickCreateWithAi,
  generateStudyGuideQuickStartWithAi,
  generateStudyPathWithAi,
} from './provider'
export {
  assertRoleObjectsAreClean,
  filterStudyObjectsForDashboardRole,
  applyStudyMaterialResourceTypeToDraft,
  normalizeAiQuickCreateDraft,
  studyObjectAllowedForDashboardRole,
} from './normalizer'
export type {
  AiGenerationDebugTrace,
  AiSourceSummary,
  AiQuickCreateDraft,
  StrictAiDashboardContract,
  StudyMaterialDetailLevel,
  StudyMaterialResourceType,
} from './normalizer'
export {
  callLocalLanguageModel,
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
  normalizeLocalAiQuickCreateDraft,
  parseLocalAiJson,
} from './localGeneration'
export type {
  LocalAiGenerationFailureCode,
  LocalAiGenerationFailureDebug,
} from './localGeneration'
export {
  callHostedAiModel,
  createHostedAiTransport,
  createHostedStudyGuideTransportWithQuickStart,
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
  HOSTED_AI_INSUFFICIENT_CREDITS_EVENT,
  HOSTED_AI_REFILL_CURRENCY,
  HOSTED_AI_USAGE_CHANGED_EVENT,
  HOSTED_AI_VISUAL_REFUND_EVENT,
  HOSTED_AI_VISUAL_SPEND_EVENT,
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
