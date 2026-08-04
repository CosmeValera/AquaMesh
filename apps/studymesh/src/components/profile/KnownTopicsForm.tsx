import React from 'react'
import {
  Box,
  Button,
  Chip,
  Divider,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import AddIcon from '@mui/icons-material/Add'

import {
  getBroadKnowledgeOptions,
  parseSpecificKnowledgeInput,
  PROFILE_CONTEXT_RECOMMENDED_MAX_TOPICS,
  ProfileContext,
  saveProfileContext,
  UserKnowledgeRoleId,
  userKnowledgeRoles,
} from '../../profileContext'
import { useInterfaceText } from '../../language/interfaceLanguage'
import type { InterfaceLanguageCode } from '../../language/contentLanguage'

interface KnownTopicsDraft {
  roles: UserKnowledgeRoleId[]
  broadKnowledge: string[]
  specificKnowledge: string[]
}

const listChipSx = (theme: Theme) => ({
  bgcolor: theme.palette.mode === 'dark' ? 'action.selected' : 'grey.100',
  borderColor: 'divider',
  color: 'text.primary',
  fontWeight: 600,
  '&:hover': {
    bgcolor: theme.palette.mode === 'dark' ? 'action.hover' : 'grey.200',
  },
  '& .MuiChip-deleteIcon': {
    color: alpha(theme.palette.text.primary, 0.4),
    '&:hover': {
      color: theme.palette.error.main,
    },
  },
})

const suggestionChipSx = (theme: Theme) => ({
  borderStyle: 'dashed',
  borderColor: alpha(theme.palette.primary.main, 0.4),
  color: theme.palette.mode === 'dark' ? theme.palette.primary.light : theme.palette.primary.dark,
  fontWeight: 600,
  '&:hover': {
    borderColor: theme.palette.primary.main,
    bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.14 : 0.06),
  },
  '& .MuiChip-icon': {
    color: 'inherit',
  },
})

const selectedRoleChipSx = (selected: boolean) =>
  selected
    ? (theme: Theme) => ({
      borderColor: alpha(theme.palette.primary.main, 0.85),
      bgcolor: alpha(theme.palette.primary.main, 0.16),
      color:
          theme.palette.mode === 'dark'
            ? theme.palette.primary.light
            : theme.palette.primary.dark,
      fontWeight: 700,
      '&:hover': {
        bgcolor: alpha(theme.palette.primary.main, 0.24),
      },
    })
    : undefined

const toTopicKey = (topic: string): string => topic.toLowerCase()
const specificKnowledgeInputDraftKey = 'studymesh-profile-context-input-draft'

const roleLabels: Record<
  InterfaceLanguageCode,
  Record<UserKnowledgeRoleId, string>
> = {
  en: {
    student: 'Student',
    software_it: 'Software / IT',
    business_marketing: 'Business / Marketing',
    design_product: 'Design / Product',
    finance: 'Finance',
    science_engineering: 'Science / Engineering',
    healthcare: 'Healthcare',
    law_policy: 'Law / Policy',
    general_curious: 'General curious learner',
  },
  es: {
    student: 'Estudiante',
    software_it: 'Software / TI',
    business_marketing: 'Negocio / Marketing',
    design_product: 'Diseño / Producto',
    finance: 'Finanzas',
    science_engineering: 'Ciencia / Ingeniería',
    healthcare: 'Salud',
    law_policy: 'Derecho / Política pública',
    general_curious: 'Aprendiz curioso general',
  },
  fr: {
    student: 'Étudiant',
    software_it: 'Logiciel / Informatique',
    business_marketing: 'Business / Marketing',
    design_product: 'Design / Produit',
    finance: 'Finance',
    science_engineering: 'Science / Ingénierie',
    healthcare: 'Santé',
    law_policy: 'Droit / Politiques publiques',
    general_curious: 'Apprenant curieux général',
  },
  de: {
    student: 'Schüler / Student',
    software_it: 'Software / IT',
    business_marketing: 'Business / Marketing',
    design_product: 'Design / Produkt',
    finance: 'Finanzen',
    science_engineering: 'Wissenschaft / Technik',
    healthcare: 'Gesundheit',
    law_policy: 'Recht / Politik',
    general_curious: 'Allgemein neugieriger Lernender',
  },
}

const broadKnowledgeTopicLabels: Partial<
  Record<InterfaceLanguageCode, Record<string, string>>
> = {
  es: {
    Exams: 'Exámenes',
    Homework: 'Deberes',
    'Class notes': 'Apuntes de clase',
    Essays: 'Ensayos',
    'Math basics': 'Bases de matemáticas',
    'Science basics': 'Bases de ciencias',
    Languages: 'Idiomas',
    Research: 'Investigación',
    'Group projects': 'Trabajos en grupo',
    Programming: 'Programación',
    'Web development': 'Desarrollo web',
    Backend: 'Backend',
    Databases: 'Bases de datos',
    Cloud: 'Nube',
    DevOps: 'DevOps',
    APIs: 'APIs',
    Cybersecurity: 'Ciberseguridad',
    'AI / ML': 'IA / ML',
    'Data engineering': 'Ingeniería de datos',
    'Mobile apps': 'Apps móviles',
    Testing: 'Testing',
    Sales: 'Ventas',
    Branding: 'Marca',
    'Customer research': 'Investigación de clientes',
    Campaigns: 'Campañas',
    Analytics: 'Analítica',
    Operations: 'Operaciones',
    Strategy: 'Estrategia',
    Pricing: 'Precios',
    Funnels: 'Embudos',
    'UX design': 'Diseño UX',
    'Product strategy': 'Estrategia de producto',
    'User research': 'Investigación de usuarios',
    Wireframes: 'Wireframes',
    Prototyping: 'Prototipado',
    'Design systems': 'Sistemas de diseño',
    Accessibility: 'Accesibilidad',
    Roadmaps: 'Roadmaps',
    Metrics: 'Métricas',
    Investing: 'Inversión',
    Budgeting: 'Presupuestos',
    Accounting: 'Contabilidad',
    Markets: 'Mercados',
    Risk: 'Riesgo',
    Valuation: 'Valoración',
    Loans: 'Préstamos',
    Taxes: 'Impuestos',
    'Financial statements': 'Estados financieros',
    'Lab work': 'Trabajo de laboratorio',
    Physics: 'Física',
    Chemistry: 'Química',
    Biology: 'Biología',
    Mechanics: 'Mecánica',
    Systems: 'Sistemas',
    Statistics: 'Estadística',
    Experiments: 'Experimentos',
    Modeling: 'Modelización',
    'Patient care': 'Atención al paciente',
    Anatomy: 'Anatomía',
    Physiology: 'Fisiología',
    Medication: 'Medicación',
    Diagnostics: 'Diagnóstico',
    'Public health': 'Salud pública',
    'Clinical workflows': 'Flujos clínicos',
    'Medical ethics': 'Ética médica',
    Contracts: 'Contratos',
    Regulation: 'Regulación',
    'Policy analysis': 'Análisis de políticas',
    Rights: 'Derechos',
    Courts: 'Tribunales',
    Compliance: 'Cumplimiento normativo',
    'Public administration': 'Administración pública',
    'Legal writing': 'Redacción jurídica',
    'Everyday life': 'Vida diaria',
    Sports: 'Deportes',
    Cooking: 'Cocina',
    Travel: 'Viajes',
    Movies: 'Películas',
    Music: 'Música',
    History: 'Historia',
    'Personal finance': 'Finanzas personales',
    Fitness: 'Fitness',
  },
  fr: {
    Exams: 'Examens',
    Homework: 'Devoirs',
    'Class notes': 'Notes de cours',
    Essays: 'Dissertations',
    'Math basics': 'Bases des maths',
    'Science basics': 'Bases des sciences',
    Languages: 'Langues',
    Research: 'Recherche',
    'Group projects': 'Travaux de groupe',
    Programming: 'Programmation',
    'Web development': 'Développement web',
    Backend: 'Backend',
    Databases: 'Bases de données',
    Cloud: 'Cloud',
    DevOps: 'DevOps',
    APIs: 'APIs',
    Cybersecurity: 'Cybersécurité',
    'AI / ML': 'IA / ML',
    'Data engineering': 'Ingénierie des données',
    'Mobile apps': 'Apps mobiles',
    Testing: 'Tests',
    Sales: 'Ventes',
    Branding: 'Marque',
    'Customer research': 'Recherche client',
    Campaigns: 'Campagnes',
    Analytics: 'Analyse',
    Operations: 'Opérations',
    Strategy: 'Stratégie',
    Pricing: 'Tarification',
    Funnels: 'Funnels',
    'UX design': 'Design UX',
    'Product strategy': 'Stratégie produit',
    'User research': 'Recherche utilisateur',
    Wireframes: 'Wireframes',
    Prototyping: 'Prototypage',
    'Design systems': 'Design systems',
    Accessibility: 'Accessibilité',
    Roadmaps: 'Roadmaps',
    Metrics: 'Métriques',
    Investing: 'Investissement',
    Budgeting: 'Budget',
    Accounting: 'Comptabilité',
    Markets: 'Marchés',
    Risk: 'Risque',
    Valuation: 'Valorisation',
    Loans: 'Prêts',
    Taxes: 'Impôts',
    'Financial statements': 'États financiers',
    'Lab work': 'Travail de labo',
    Physics: 'Physique',
    Chemistry: 'Chimie',
    Biology: 'Biologie',
    Mechanics: 'Mécanique',
    Systems: 'Systèmes',
    Statistics: 'Statistiques',
    Experiments: 'Expériences',
    Modeling: 'Modélisation',
    'Patient care': 'Soins aux patients',
    Anatomy: 'Anatomie',
    Physiology: 'Physiologie',
    Medication: 'Médicaments',
    Diagnostics: 'Diagnostic',
    'Public health': 'Santé publique',
    'Clinical workflows': 'Flux cliniques',
    'Medical ethics': 'Éthique médicale',
    Contracts: 'Contrats',
    Regulation: 'Réglementation',
    'Policy analysis': 'Analyse des politiques',
    Rights: 'Droits',
    Courts: 'Tribunaux',
    Compliance: 'Conformité',
    'Public administration': 'Administration publique',
    'Legal writing': 'Rédaction juridique',
    'Everyday life': 'Vie quotidienne',
    Sports: 'Sport',
    Cooking: 'Cuisine',
    Travel: 'Voyage',
    Movies: 'Films',
    Music: 'Musique',
    History: 'Histoire',
    'Personal finance': 'Finances personnelles',
    Fitness: 'Fitness',
  },
  de: {
    Exams: 'Prüfungen',
    Homework: 'Hausaufgaben',
    'Class notes': 'Unterrichtsnotizen',
    Essays: 'Aufsätze',
    'Math basics': 'Mathe-Grundlagen',
    'Science basics': 'Naturwissenschaftliche Grundlagen',
    Languages: 'Sprachen',
    Research: 'Recherche',
    'Group projects': 'Gruppenprojekte',
    Programming: 'Programmierung',
    'Web development': 'Webentwicklung',
    Backend: 'Backend',
    Databases: 'Datenbanken',
    Cloud: 'Cloud',
    DevOps: 'DevOps',
    APIs: 'APIs',
    Cybersecurity: 'Cybersicherheit',
    'AI / ML': 'KI / ML',
    'Data engineering': 'Data Engineering',
    'Mobile apps': 'Mobile Apps',
    Testing: 'Testing',
    Sales: 'Vertrieb',
    Branding: 'Branding',
    'Customer research': 'Kundenforschung',
    Campaigns: 'Kampagnen',
    Analytics: 'Analytics',
    Operations: 'Operations',
    Strategy: 'Strategie',
    Pricing: 'Preisgestaltung',
    Funnels: 'Funnels',
    'UX design': 'UX-Design',
    'Product strategy': 'Produktstrategie',
    'User research': 'Nutzerforschung',
    Wireframes: 'Wireframes',
    Prototyping: 'Prototyping',
    'Design systems': 'Designsysteme',
    Accessibility: 'Barrierefreiheit',
    Roadmaps: 'Roadmaps',
    Metrics: 'Metriken',
    Investing: 'Investieren',
    Budgeting: 'Budgetplanung',
    Accounting: 'Buchhaltung',
    Markets: 'Märkte',
    Risk: 'Risiko',
    Valuation: 'Bewertung',
    Loans: 'Kredite',
    Taxes: 'Steuern',
    'Financial statements': 'Finanzberichte',
    'Lab work': 'Laborarbeit',
    Physics: 'Physik',
    Chemistry: 'Chemie',
    Biology: 'Biologie',
    Mechanics: 'Mechanik',
    Systems: 'Systeme',
    Statistics: 'Statistik',
    Experiments: 'Experimente',
    Modeling: 'Modellierung',
    'Patient care': 'Patientenversorgung',
    Anatomy: 'Anatomie',
    Physiology: 'Physiologie',
    Medication: 'Medikation',
    Diagnostics: 'Diagnostik',
    'Public health': 'Öffentliche Gesundheit',
    'Clinical workflows': 'Klinische Abläufe',
    'Medical ethics': 'Medizinethik',
    Contracts: 'Verträge',
    Regulation: 'Regulierung',
    'Policy analysis': 'Politikanalyse',
    Rights: 'Rechte',
    Courts: 'Gerichte',
    Compliance: 'Compliance',
    'Public administration': 'Öffentliche Verwaltung',
    'Legal writing': 'Juristisches Schreiben',
    'Everyday life': 'Alltag',
    Sports: 'Sport',
    Cooking: 'Kochen',
    Travel: 'Reisen',
    Movies: 'Filme',
    Music: 'Musik',
    History: 'Geschichte',
    'Personal finance': 'Persönliche Finanzen',
    Fitness: 'Fitness',
  },
}

const getRoleLabel = (
  role: UserKnowledgeRoleId,
  language: InterfaceLanguageCode,
): string => roleLabels[language][role] || roleLabels.en[role]

const getBroadKnowledgeTopicLabel = (
  topic: string,
  language: InterfaceLanguageCode,
): string => broadKnowledgeTopicLabels[language]?.[topic] || topic

const readSpecificKnowledgeInputDraft = (): string => {
  if (typeof window === 'undefined') {
    return ''
  }

  try {
    return window.sessionStorage.getItem(specificKnowledgeInputDraftKey) || ''
  } catch {
    return ''
  }
}

const writeSpecificKnowledgeInputDraft = (value: string) => {
  if (typeof window === 'undefined') {
    return
  }

  try {
    if (value.trim()) {
      window.sessionStorage.setItem(specificKnowledgeInputDraftKey, value)
      return
    }

    window.sessionStorage.removeItem(specificKnowledgeInputDraftKey)
  } catch {
    // Draft persistence should never block context editing.
  }
}

const mergeUniqueTopics = (topics: string[]): string[] => {
  const seen = new Set<string>()
  const next: string[] = []

  topics.forEach((topic) => {
    const key = toTopicKey(topic)
    if (!topic || seen.has(key)) {
      return
    }

    seen.add(key)
    next.push(topic)
  })

  return next
}

const getSelectedKnowledge = (draft: {
  broadKnowledge: string[]
  specificKnowledge: string[]
}): string[] =>
  mergeUniqueTopics([...draft.broadKnowledge, ...draft.specificKnowledge])

const getSelectedKnowledgeCount = (draft: {
  broadKnowledge: string[]
  specificKnowledge: string[]
}): number => getSelectedKnowledge(draft).length

const getNewestSelectedKnowledge = (topics: string[]): string[] => [
  ...topics,
].reverse()

const KnowledgeRolePicker: React.FC<{
  activeRole: UserKnowledgeRoleId | null
  language: InterfaceLanguageCode
  t: ReturnType<typeof useInterfaceText>['t']
  onSelectRole: (role: UserKnowledgeRoleId) => void
}> = ({ activeRole, language, t, onSelectRole }) => (
  <Box>
    <Typography variant="subtitle2" fontWeight={750} sx={{ mb: 1 }}>
      {t('knowledgeContext.rolePickerTitle')}
    </Typography>
    <Stack direction="row" gap={1} flexWrap="wrap">
      {userKnowledgeRoles.map((item) => {
        const selected = activeRole === item.id
        return (
          <Chip
            key={item.id}
            label={getRoleLabel(item.id, language)}
            clickable
            color={selected ? 'primary' : 'default'}
            variant={selected ? 'filled' : 'outlined'}
            sx={selectedRoleChipSx(selected)}
            onClick={() => onSelectRole(item.id)}
          />
        )
      })}
    </Stack>
  </Box>
)

const KnowledgeSuggestions: React.FC<{
  activeRole: UserKnowledgeRoleId | null
  selectedKnowledge: string[]
  language: InterfaceLanguageCode
  onAddTopic: (topic: string) => void
}> = ({ activeRole, selectedKnowledge, language, onAddTopic }) => {
  const selectedKeys = React.useMemo(
    () => new Set(selectedKnowledge.map(toTopicKey)),
    [selectedKnowledge],
  )
  const suggestions = React.useMemo(
    () =>
      mergeUniqueTopics(activeRole ? getBroadKnowledgeOptions(activeRole) : []).filter(
        (topic) => !selectedKeys.has(toTopicKey(topic)),
      ),
    [activeRole, selectedKeys],
  )

  if (!suggestions.length) {
    return null
  }

  return (
    <Stack direction="row" gap={1} flexWrap="wrap">
      {suggestions.map((topic) => (
        <Chip
          key={topic}
          icon={<AddIcon fontSize="small" />}
          label={getBroadKnowledgeTopicLabel(topic, language)}
          clickable
          variant="outlined"
          sx={suggestionChipSx}
          onClick={() => onAddTopic(topic)}
        />
      ))}
    </Stack>
  )
}

export const KnownTopicsForm: React.FC<{
  initialContext?: ProfileContext | null
  onSelectedCountChange: (count: number) => void
}> = ({ initialContext, onSelectedCountChange }) => {
  const { language, t } = useInterfaceText()
  const [roles, setRoles] = React.useState<UserKnowledgeRoleId[]>([])
  const [broadKnowledge, setBroadKnowledge] = React.useState<string[]>([])
  const [specificKnowledge, setSpecificKnowledge] = React.useState<string[]>([])
  const [specificKnowledgeInput, setSpecificKnowledgeInput] = React.useState('')

  React.useEffect(() => {
    const nextBroadKnowledge = initialContext?.broadKnowledge || []
    const nextSpecificKnowledge = initialContext?.specificKnowledge || []

    setRoles(initialContext?.roles || [])
    setBroadKnowledge(nextBroadKnowledge)
    setSpecificKnowledge(nextSpecificKnowledge)
    setSpecificKnowledgeInput(readSpecificKnowledgeInputDraft())
    onSelectedCountChange(
      getSelectedKnowledgeCount({
        broadKnowledge: nextBroadKnowledge,
        specificKnowledge: nextSpecificKnowledge,
      }),
    )
  }, [initialContext, onSelectedCountChange])

  const selectedKnowledge = getSelectedKnowledge({
    broadKnowledge,
    specificKnowledge,
  })
  const newestSelectedKnowledge = getNewestSelectedKnowledge(selectedKnowledge)
  const selectedCount = selectedKnowledge.length
  const remainingForRecommended = Math.max(
    PROFILE_CONTEXT_RECOMMENDED_MAX_TOPICS - selectedCount,
    0,
  )
  const progressValue =
    (Math.min(selectedCount, PROFILE_CONTEXT_RECOMMENDED_MAX_TOPICS) /
      PROFILE_CONTEXT_RECOMMENDED_MAX_TOPICS) *
    100

  const persist = React.useCallback((draft: KnownTopicsDraft) => {
    saveProfileContext({
      roles: draft.roles,
      broadKnowledge: draft.broadKnowledge,
      specificKnowledge: draft.specificKnowledge,
    })
  }, [])

  const updateDraft = React.useCallback(
    (createNext: (current: KnownTopicsDraft) => KnownTopicsDraft) => {
      const current = { roles, broadKnowledge, specificKnowledge }
      const next = createNext(current)

      setRoles(next.roles)
      setBroadKnowledge(next.broadKnowledge)
      setSpecificKnowledge(next.specificKnowledge)
      onSelectedCountChange(getSelectedKnowledgeCount(next))
      persist(next)
    },
    [broadKnowledge, onSelectedCountChange, persist, roles, specificKnowledge],
  )

  const addBroadKnowledge = (topic: string) => {
    updateDraft((current) => ({
      ...current,
      broadKnowledge: current.broadKnowledge.includes(topic)
        ? current.broadKnowledge
        : [...current.broadKnowledge, topic],
    }))
  }

  const selectRole = (role: UserKnowledgeRoleId) => {
    updateDraft((current) => ({
      ...current,
      roles: current.roles.length === 1 && current.roles[0] === role ? [] : [role],
    }))
  }

  const removeKnowledge = (topic: string) => {
    updateDraft((current) => ({
      ...current,
      broadKnowledge: current.broadKnowledge.filter((item) => item !== topic),
      specificKnowledge: current.specificKnowledge.filter(
        (item) => item !== topic,
      ),
    }))
  }

  const addSpecificKnowledge = () => {
    const topics = parseSpecificKnowledgeInput(specificKnowledgeInput)
    if (!topics.length) {
      return
    }

    updateDraft((current) => ({
      ...current,
      specificKnowledge: mergeUniqueTopics([
        ...current.specificKnowledge,
        ...topics,
      ]),
    }))
    setSpecificKnowledgeInput('')
    writeSpecificKnowledgeInputDraft('')
  }

  const updateSpecificKnowledgeInput = (value: string) => {
    setSpecificKnowledgeInput(value)
    writeSpecificKnowledgeInputDraft(value)
  }

  return (
    <Stack spacing={2.5}>
      <Stack spacing={0.75}>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
          <TextField
            placeholder={t('knowledgeContext.inputPlaceholder')}
            value={specificKnowledgeInput}
            onChange={(event) =>
              updateSpecificKnowledgeInput(event.target.value)
            }
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                addSpecificKnowledge()
              }
            }}
            inputProps={{ 'aria-label': t('knowledgeContext.inputLabel') }}
            fullWidth
            size="small"
          />
          <Button
            variant="contained"
            disableElevation
            onClick={addSpecificKnowledge}
            sx={{ minWidth: { sm: 88 }, alignSelf: { sm: 'flex-start' } }}
          >
            {t('knowledgeContext.add')}
          </Button>
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {t('knowledgeContext.inputHelper')}
        </Typography>
      </Stack>

      <Box>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ mb: 1 }}
        >
          <Typography variant="subtitle2" fontWeight={750}>
            {t('knownTopics.yourList').replace('{count}', String(selectedCount))}
          </Typography>
          <Stack direction="row" alignItems="center" gap={0.6}>
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                bgcolor: 'success.main',
              }}
            />
            <Typography variant="caption" color="success.main" fontWeight={600}>
              {t('knownTopics.autoSaved')}
            </Typography>
          </Stack>
        </Stack>

        {selectedCount ? (
          <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mb: 1.5 }}>
            {newestSelectedKnowledge.map((topic) => (
              <Chip
                key={topic}
                label={
                  broadKnowledge.includes(topic)
                    ? getBroadKnowledgeTopicLabel(topic, language)
                    : topic
                }
                variant="outlined"
                sx={listChipSx}
                onDelete={() => removeKnowledge(topic)}
              />
            ))}
          </Stack>
        ) : (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mb: 1.5, fontStyle: 'italic' }}
          >
            {t('knownTopics.emptyListHint')}
          </Typography>
        )}

        <LinearProgress
          variant="determinate"
          value={progressValue}
          color="success"
          sx={(theme) => ({
            height: 6,
            borderRadius: 999,
            bgcolor: alpha(theme.palette.success.main, 0.15),
          })}
        />
        <Typography
          variant="caption"
          color={remainingForRecommended === 0 ? 'success.main' : 'text.secondary'}
          fontWeight={remainingForRecommended === 0 ? 700 : 400}
          sx={{ mt: 0.5, display: 'block' }}
        >
          {remainingForRecommended === 0
            ? t('knownTopics.progressEnough')
            : t('knownTopics.progressAddMore').replace(
              '{count}',
              String(remainingForRecommended),
            )}
        </Typography>
      </Box>

      <Divider />

      <KnowledgeRolePicker
        activeRole={roles[0] ?? null}
        language={language}
        t={t}
        onSelectRole={selectRole}
      />

      <KnowledgeSuggestions
        activeRole={roles[0] ?? null}
        selectedKnowledge={selectedKnowledge}
        language={language}
        onAddTopic={addBroadKnowledge}
      />
    </Stack>
  )
}

export default KnownTopicsForm
