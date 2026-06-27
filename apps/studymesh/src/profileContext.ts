export const PROFILE_CONTEXT_CHANGED_EVENT = 'studymesh-profile-context-changed'
export const PROFILE_CONTEXT_STORAGE_KEY = 'studymesh-profile-context-v1'

export type UserKnowledgeRoleId =
  | 'student'
  | 'software_it'
  | 'business_marketing'
  | 'design_product'
  | 'finance'
  | 'science_engineering'
  | 'healthcare'
  | 'law_policy'
  | 'general_curious'

export interface ProfileContext {
  version: 1
  roles: UserKnowledgeRoleId[]
  broadKnowledge: string[]
  specificKnowledge: string[]
  confidence: 'self_reported'
  updatedAt: string
}

export const PROFILE_CONTEXT_RECOMMENDED_MIN_TOPICS = 3
export const PROFILE_CONTEXT_RECOMMENDED_MAX_TOPICS = 5
export const USER_KNOWN_TOPICS_MAX_FOR_AI = 8
export const USER_KNOWN_TOPIC_MAX_CHARS = 40

export const userKnowledgeRoles: Array<{
  id: UserKnowledgeRoleId
  label: string
}> = [
  { id: 'student', label: 'Student' },
  { id: 'software_it', label: 'Software / IT' },
  { id: 'business_marketing', label: 'Business / Marketing' },
  { id: 'design_product', label: 'Design / Product' },
  { id: 'finance', label: 'Finance' },
  { id: 'science_engineering', label: 'Science / Engineering' },
  { id: 'healthcare', label: 'Healthcare' },
  { id: 'law_policy', label: 'Law / Policy' },
  { id: 'general_curious', label: 'General curious learner' },
]

const broadKnowledgeByRole: Record<UserKnowledgeRoleId, string[]> = {
  student: [
    'Exams',
    'Homework',
    'Class notes',
    'Essays',
    'Math basics',
    'Science basics',
    'Languages',
    'Research',
    'Group projects',
  ],
  software_it: [
    'Programming',
    'Web development',
    'Backend',
    'Databases',
    'Cloud',
    'DevOps',
    'APIs',
    'Cybersecurity',
    'AI / ML',
    'Data engineering',
    'Mobile apps',
    'Testing',
  ],
  business_marketing: [
    'Sales',
    'Branding',
    'Customer research',
    'Campaigns',
    'Analytics',
    'Operations',
    'Strategy',
    'Pricing',
    'Funnels',
  ],
  design_product: [
    'UX design',
    'Product strategy',
    'User research',
    'Wireframes',
    'Prototyping',
    'Design systems',
    'Accessibility',
    'Roadmaps',
    'Metrics',
  ],
  finance: [
    'Investing',
    'Budgeting',
    'Accounting',
    'Markets',
    'Risk',
    'Valuation',
    'Loans',
    'Taxes',
    'Financial statements',
  ],
  science_engineering: [
    'Lab work',
    'Physics',
    'Chemistry',
    'Biology',
    'Mechanics',
    'Systems',
    'Statistics',
    'Experiments',
    'Modeling',
  ],
  healthcare: [
    'Patient care',
    'Anatomy',
    'Physiology',
    'Medication',
    'Diagnostics',
    'Public health',
    'Clinical workflows',
    'Medical ethics',
  ],
  law_policy: [
    'Contracts',
    'Regulation',
    'Policy analysis',
    'Rights',
    'Courts',
    'Compliance',
    'Public administration',
    'Legal writing',
  ],
  general_curious: [
    'Everyday life',
    'Sports',
    'Cooking',
    'Travel',
    'Movies',
    'Music',
    'History',
    'Personal finance',
    'Fitness',
  ],
}

const normalizeTopic = (value: unknown, maxChars = Infinity): string => {
  if (typeof value !== 'string') {
    return ''
  }

  return value.replace(/\s+/g, ' ').trim().slice(0, maxChars).trim()
}

export const getBroadKnowledgeOptions = (
  role: UserKnowledgeRoleId | null,
): string[] => broadKnowledgeByRole[role || 'general_curious']

export const getBroadKnowledgeGroups = (
  roles: UserKnowledgeRoleId[],
): Array<{ role: UserKnowledgeRoleId; label: string; topics: string[] }> =>
  roles.map((role) => ({
    role,
    label: userKnowledgeRoles.find((item) => item.id === role)?.label || role,
    topics: broadKnowledgeByRole[role],
  }))

export const getUserKnowledgeRoleLabel = (role: UserKnowledgeRoleId): string =>
  userKnowledgeRoles.find((item) => item.id === role)?.label || role

export const parseSpecificKnowledgeInput = (value: string): string[] =>
  value
    .split(/[,;\n]/)
    .map((topic) => normalizeTopic(topic))
    .filter(Boolean)

export const sanitizeUserKnownTopics = (
  topics: unknown,
  {
    maxTopics = Infinity,
    maxChars = USER_KNOWN_TOPIC_MAX_CHARS,
  }: {
    maxTopics?: number
    maxChars?: number
  } = {},
): string[] => {
  const rawTopics = Array.isArray(topics) ? topics : []
  const seen = new Set<string>()
  const normalized: string[] = []

  rawTopics.forEach((topic) => {
    if (normalized.length >= maxTopics) {
      return
    }

    const next = normalizeTopic(topic, maxChars)
    const key = next.toLowerCase()
    if (!next || seen.has(key)) {
      return
    }

    seen.add(key)
    normalized.push(next)
  })

  return normalized
}

export const normalizeProfileContext = (
  value: unknown,
): ProfileContext | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value as Record<string, unknown>
  const rawRoles = Array.isArray(record.roles)
    ? record.roles
    : record.role
      ? [record.role]
      : []
  const roles = rawRoles.filter((role): role is UserKnowledgeRoleId =>
    userKnowledgeRoles.some((item) => item.id === role),
  )
  const broadKnowledge = sanitizeUserKnownTopics(record.broadKnowledge)
  const specificKnowledge = sanitizeUserKnownTopics(record.specificKnowledge)
  const updatedAt =
    typeof record.updatedAt === 'string' && record.updatedAt.trim()
      ? record.updatedAt.trim()
      : new Date().toISOString()

  return {
    version: 1,
    roles,
    broadKnowledge,
    specificKnowledge,
    confidence: 'self_reported',
    updatedAt,
  }
}

const dispatchProfileContextChanged = (
  profileContext: ProfileContext | null,
) => {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(
    new CustomEvent(PROFILE_CONTEXT_CHANGED_EVENT, {
      detail: { profileContext },
    }),
  )
}

export const readProfileContext = (): ProfileContext | null => {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const stored = window.localStorage.getItem(PROFILE_CONTEXT_STORAGE_KEY)
    return stored ? normalizeProfileContext(JSON.parse(stored)) : null
  } catch {
    return null
  }
}

export const saveProfileContext = (
  value: Omit<ProfileContext, 'version' | 'confidence' | 'updatedAt'> & {
    updatedAt?: string
  },
): ProfileContext => {
  const next = normalizeProfileContext({
    ...value,
    version: 1,
    confidence: 'self_reported',
    updatedAt: value.updatedAt || new Date().toISOString(),
  }) as ProfileContext

  window.localStorage.setItem(PROFILE_CONTEXT_STORAGE_KEY, JSON.stringify(next))
  dispatchProfileContextChanged(next)
  return next
}

export const writeProfileContextFromCloud = (value: unknown): void => {
  const next = normalizeProfileContext(value)
  if (!next) {
    return
  }

  window.localStorage.setItem(PROFILE_CONTEXT_STORAGE_KEY, JSON.stringify(next))
  dispatchProfileContextChanged(next)
}

export const getUserKnownTopics = (
  profileContext = readProfileContext(),
): string[] =>
  sanitizeUserKnownTopics(
    [
      ...(profileContext?.specificKnowledge || []),
      ...(profileContext?.broadKnowledge || []),
    ],
    {
      maxTopics: USER_KNOWN_TOPICS_MAX_FOR_AI,
    },
  )

export const getAllUserKnownTopics = (
  profileContext = readProfileContext(),
): string[] =>
  sanitizeUserKnownTopics([
    ...(profileContext?.specificKnowledge || []),
    ...(profileContext?.broadKnowledge || []),
  ])
