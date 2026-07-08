import React from 'react'
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'

import {
  getBroadKnowledgeGroups,
  parseSpecificKnowledgeInput,
  ProfileContext,
  saveProfileContext,
  UserKnowledgeRoleId,
  userKnowledgeRoles,
} from '../../profileContext'
import { useInterfaceText } from '../../language/interfaceLanguage'
import type { InterfaceLanguageCode } from '../../language/contentLanguage'

type KnowledgeContextSurface = 'onboarding' | 'settings'

interface KnowledgeContextDialogProps {
  open: boolean
  initialContext?: ProfileContext | null
  surface?: KnowledgeContextSurface
  onClose: () => void
}

interface KnowledgeContextDraft {
  roles: UserKnowledgeRoleId[]
  broadKnowledge: string[]
  specificKnowledge: string[]
}

const getRecommendationText = (
  surface: KnowledgeContextSurface,
  t: ReturnType<typeof useInterfaceText>['t'],
): string =>
  surface === 'onboarding'
    ? t('knowledgeContext.recommendedOnboarding')
    : t('knowledgeContext.recommendedSettings')

const selectedChipSx = (selected: boolean) =>
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
        '& .MuiChip-deleteIcon': {
          color: alpha(theme.palette.primary.main, 0.75),
          '&:hover': {
            color: theme.palette.primary.main,
          },
        },
      })
    : undefined

const toTopicKey = (topic: string): string => topic.toLowerCase()
const specificKnowledgeInputDraftKeyPrefix =
  'studymesh-profile-context-input-draft'

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

const getSpecificKnowledgeInputDraftKey = (
  surface: KnowledgeContextSurface,
): string => `${specificKnowledgeInputDraftKeyPrefix}-${surface}`

const readSpecificKnowledgeInputDraft = (
  surface: KnowledgeContextSurface,
): string => {
  if (typeof window === 'undefined') {
    return ''
  }

  try {
    return (
      window.sessionStorage.getItem(
        getSpecificKnowledgeInputDraftKey(surface),
      ) || ''
    )
  } catch {
    return ''
  }
}

const writeSpecificKnowledgeInputDraft = (
  surface: KnowledgeContextSurface,
  value: string,
) => {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const key = getSpecificKnowledgeInputDraftKey(surface)
    if (value.trim()) {
      window.sessionStorage.setItem(key, value)
      return
    }

    window.sessionStorage.removeItem(key)
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
  roles: UserKnowledgeRoleId[]
  language: InterfaceLanguageCode
  t: ReturnType<typeof useInterfaceText>['t']
  onToggleRole: (role: UserKnowledgeRoleId) => void
}> = ({ roles, language, t, onToggleRole }) => (
  <Box>
    <Typography variant="subtitle2" fontWeight={750} sx={{ mb: 1 }}>
      {t('knowledgeContext.rolePickerTitle')}
    </Typography>
    <Stack direction="row" gap={1} flexWrap="wrap">
      {userKnowledgeRoles.map((item) => {
        const selected = roles.includes(item.id)
        return (
          <Chip
            key={item.id}
            label={getRoleLabel(item.id, language)}
            clickable
            color={selected ? 'primary' : 'default'}
            variant={selected ? 'filled' : 'outlined'}
            sx={selectedChipSx(selected)}
            onClick={() => onToggleRole(item.id)}
          />
        )
      })}
    </Stack>
  </Box>
)

const KnowledgeAreaGroups: React.FC<{
  roles: UserKnowledgeRoleId[]
  broadKnowledge: string[]
  language: InterfaceLanguageCode
  t: ReturnType<typeof useInterfaceText>['t']
  onToggleBroadKnowledge: (topic: string) => void
}> = ({ roles, broadKnowledge, language, t, onToggleBroadKnowledge }) => {
  const groups = getBroadKnowledgeGroups(roles)

  if (!groups.length) {
    return null
  }

  return (
    <Box>
      <Typography variant="subtitle2" fontWeight={750} sx={{ mb: 1 }}>
        {t('knowledgeContext.suggestedAreas')}
      </Typography>
      <Stack spacing={1.75}>
        {groups.map((group) => (
          <Box key={group.role}>
            <Typography
              variant="caption"
              color="text.secondary"
              fontWeight={800}
              sx={{
                display: 'block',
                mb: 0.75,
                textTransform: 'uppercase',
                letterSpacing: 0,
              }}
            >
              {getRoleLabel(group.role, language)}
            </Typography>
            <Stack direction="row" gap={1} flexWrap="wrap">
              {group.topics.map((topic) => {
                const selected = broadKnowledge.includes(topic)
                return (
                  <Chip
                    key={`${group.role}-${topic}`}
                    label={getBroadKnowledgeTopicLabel(topic, language)}
                    clickable
                    color={selected ? 'primary' : 'default'}
                    variant={selected ? 'filled' : 'outlined'}
                    sx={selectedChipSx(selected)}
                    onClick={() => onToggleBroadKnowledge(topic)}
                  />
                )
              })}
            </Stack>
          </Box>
        ))}
      </Stack>
    </Box>
  )
}

const KnowledgeContextForm: React.FC<{
  surface: KnowledgeContextSurface
  initialContext?: ProfileContext | null
  onSelectedCountChange: (count: number) => void
}> = ({ surface, initialContext, onSelectedCountChange }) => {
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
    setSpecificKnowledgeInput(readSpecificKnowledgeInputDraft(surface))
    onSelectedCountChange(
      getSelectedKnowledgeCount({
        broadKnowledge: nextBroadKnowledge,
        specificKnowledge: nextSpecificKnowledge,
      }),
    )
  }, [initialContext, onSelectedCountChange, surface])

  const selectedKnowledge = getSelectedKnowledge({
    broadKnowledge,
    specificKnowledge,
  })
  const newestSelectedKnowledge = getNewestSelectedKnowledge(selectedKnowledge)
  const selectedCount = selectedKnowledge.length
  const recommendationText = getRecommendationText(surface, t)
  const specificKnowledgeInputExample = t('knowledgeContext.inputExamples')

  const persist = React.useCallback(
    (draft: KnowledgeContextDraft) => {
      saveProfileContext({
        roles: draft.roles,
        broadKnowledge: draft.broadKnowledge,
        specificKnowledge: draft.specificKnowledge,
      })
    },
    [],
  )

  const updateDraft = React.useCallback(
    (createNext: (current: KnowledgeContextDraft) => KnowledgeContextDraft) => {
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

  const toggleBroadKnowledge = (topic: string) => {
    updateDraft((current) => ({
      ...current,
      broadKnowledge: current.broadKnowledge.includes(topic)
        ? current.broadKnowledge.filter((item) => item !== topic)
        : [...current.broadKnowledge, topic],
    }))
  }

  const toggleRole = (role: UserKnowledgeRoleId) => {
    updateDraft((current) => {
      const nextRoles = current.roles.includes(role)
        ? current.roles.filter((item) => item !== role)
        : [...current.roles, role]

      return {
        ...current,
        roles: nextRoles,
      }
    })
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
    writeSpecificKnowledgeInputDraft(surface, '')
  }

  const updateSpecificKnowledgeInput = (value: string) => {
    setSpecificKnowledgeInput(value)
    writeSpecificKnowledgeInputDraft(surface, value)
  }

  return (
    <Stack spacing={2.25}>
      <Paper
        elevation={0}
        sx={(theme) => ({
          p: 2,
          border: 1,
          borderColor: alpha(theme.palette.primary.main, 0.2),
          background:
            theme.palette.mode === 'dark'
              ? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.28)} 0%, ${alpha(theme.palette.secondary.main, 0.18)} 48%, ${alpha(theme.palette.background.paper, 0.86)} 100%)`
              : `linear-gradient(135deg, ${alpha(theme.palette.primary.light, 0.32)} 0%, ${alpha(theme.palette.secondary.light, 0.22)} 52%, ${alpha(theme.palette.background.paper, 0.94)} 100%)`,
        })}
      >
        <Typography fontWeight={800} sx={{ mb: 0.75 }}>
          {t('knowledgeContext.introTitle')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('knowledgeContext.introBody')}
        </Typography>
      </Paper>

      <Stack spacing={1}>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
          <TextField
            label={t('knowledgeContext.inputLabel')}
            helperText={t('knowledgeContext.inputHelper')}
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
              placeholder={specificKnowledgeInputExample}
            fullWidth
            size="small"
          />
          <Button
            variant="outlined"
            onClick={addSpecificKnowledge}
            sx={{ minWidth: { sm: 88 }, alignSelf: { sm: 'flex-start' } }}
          >
            {t('knowledgeContext.add')}
          </Button>
        </Stack>
      </Stack>

      {selectedCount ? (
        <Box>
          <Typography variant="subtitle2" fontWeight={750} sx={{ mb: 1 }}>
            {t('knowledgeContext.yourContext')}
          </Typography>
          <Stack direction="row" gap={1} flexWrap="wrap">
            {newestSelectedKnowledge.map((topic) => (
              <Chip
                key={topic}
                label={
                  broadKnowledge.includes(topic)
                    ? getBroadKnowledgeTopicLabel(topic, language)
                    : topic
                }
                color="primary"
                variant="filled"
                sx={selectedChipSx(true)}
                onDelete={() => removeKnowledge(topic)}
              />
            ))}
          </Stack>
        </Box>
      ) : null}

      <KnowledgeRolePicker
        roles={roles}
        language={language}
        t={t}
        onToggleRole={toggleRole}
      />

      <KnowledgeAreaGroups
        roles={roles}
        broadKnowledge={broadKnowledge}
        language={language}
        t={t}
        onToggleBroadKnowledge={toggleBroadKnowledge}
      />

      <Typography variant="caption" color="text.secondary">
        {t('knowledgeContext.selectedCount')
          .replace('{count}', String(selectedCount))}
        {' '}
        {recommendationText}
      </Typography>
    </Stack>
  )
}

const KnowledgeContextDialog: React.FC<KnowledgeContextDialogProps> = ({
  open,
  initialContext,
  surface = 'settings',
  onClose,
}) => {
  const { t } = useInterfaceText()
  const [selectedCount, setSelectedCount] = React.useState(0)

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('knowledgeContext.title')}</DialogTitle>
      <DialogContent dividers>
        <KnowledgeContextForm
          surface={surface}
          initialContext={initialContext}
          onSelectedCountChange={setSelectedCount}
        />
      </DialogContent>
      <DialogActions>
        {surface === 'onboarding' ? (
          <Button onClick={onClose}>{t('knowledgeContext.skip')}</Button>
        ) : (
          <Button onClick={onClose}>{t('knowledgeContext.close')}</Button>
        )}
        <Button
          variant="contained"
          onClick={onClose}
          disabled={selectedCount === 0}
        >
          {t('knowledgeContext.accept')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export const KnowledgeContextOnboardingDialog: React.FC<
  Omit<KnowledgeContextDialogProps, 'surface'>
> = (props) => <KnowledgeContextDialog {...props} surface="onboarding" />

export const KnowledgeContextSettingsDialog: React.FC<
  Omit<KnowledgeContextDialogProps, 'surface'>
> = (props) => <KnowledgeContextDialog {...props} surface="settings" />

export default KnowledgeContextDialog
