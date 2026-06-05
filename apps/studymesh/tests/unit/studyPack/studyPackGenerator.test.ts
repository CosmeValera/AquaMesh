import { describe, expect, it } from 'vitest'
import {
  augmentStudyPackPracticeObjects,
  createStudyPackDashboardLayout,
  createStudyPackOrchestratorWidgets,
  createStudyPackWidgets,
  createStudyPackWidgetsFromGroups,
  extractLearningConcepts,
  getDefaultStudyPathLayoutMetadata,
  isBadConceptCandidate,
  normalizeStudyPathLayoutMetadata,
  parseStudyPack,
} from '../../../src/studyPack'

describe('study pack generator', () => {
  it('normalizes Study Guide layout archetype metadata with safe fallbacks', () => {
    expect(getDefaultStudyPathLayoutMetadata('normal')).toMatchObject({
      layoutArchetype: 'learnPracticeTabs',
      dashboardPurpose: 'lesson',
      practiceType: 'mixed',
    })
    expect(getDefaultStudyPathLayoutMetadata('summary')).toMatchObject({
      layoutArchetype: 'overviewReview',
      dashboardPurpose: 'overview',
      practiceType: 'none',
    })
    expect(
      normalizeStudyPathLayoutMetadata(
        {
          layoutArchetype: 'splitReferenceExercise',
          dashboardPurpose: 'lesson',
          practiceType: 'quiz',
          layoutReason: 'Reference beside exercise.',
        },
        getDefaultStudyPathLayoutMetadata('normal'),
      ),
    ).toMatchObject({
      layoutArchetype: 'splitReferenceExercise',
      dashboardPurpose: 'lesson',
      practiceType: 'quiz',
    })
    expect(
      normalizeStudyPathLayoutMetadata(
        {
          layoutArchetype: 'bad-layout',
          dashboardPurpose: 'bad-purpose',
          practiceType: 'bad-practice',
        },
        getDefaultStudyPathLayoutMetadata('normal'),
      ),
    ).toMatchObject({
      layoutArchetype: 'learnPracticeTabs',
      dashboardPurpose: 'lesson',
      practiceType: 'mixed',
    })
  })

  it('extracts concept-first practice and blocks weak candidates', () => {
    const source = `Goal
Example
The passe compose is a French past tense used for completed actions.
It is formed with avoir or etre plus a past participle.
Use etre with movement verbs and reflexive verbs.
Common mistake: students often choose avoir for a movement verb that needs etre.`

    const concepts = extractLearningConcepts(source, 'French Past Tense')
    const augmented = augmentStudyPackPracticeObjects([], {
      packId: 'french-past',
      title: 'French Past Tense',
      rawNotes: source,
      generationTargets: ['quizzes', 'flashcards', 'summaries'],
      generationAmount: 'few',
    })
    const serialized = JSON.stringify(augmented.objects)

    expect(isBadConceptCandidate('Goal')).toBe(true)
    expect(isBadConceptCandidate('Avoir')).toBe(true)
    expect(concepts.map((concept) => concept.concept)).not.toEqual(
      expect.arrayContaining(['Goal', 'Example', 'Avoir']),
    )
    expect(serialized).not.toContain('Which statement best explains')
    expect(serialized).not.toContain('According to the notes')
    expect(serialized).not.toContain('What does')
    expect(serialized).not.toContain('core idea behind')
    expect(augmented.objects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'quiz',
          question: expect.stringMatching(/form|rule|mistake|choose/i),
        }),
        expect.objectContaining({
          kind: 'qa',
          question: expect.stringMatching(/form|know|mistake|use/i),
        }),
      ]),
    )
  })

  it('fills visible practice targets without counting hidden support objects', () => {
    const source = `The present subjunctive uses the ils stem with -e, -es, -e, -ions, -iez, and -ent endings.
Il faut que triggers the subjunctive because it expresses necessity.
Students often overuse the subjunctive after expressions of certainty.
Use the indicative when the speaker presents the action as factual.
Common mistake: choosing the infinitive after que instead of a conjugated subjunctive form.`
    const augmented = augmentStudyPackPracticeObjects(
      [
        {
          id: 'support-list',
          kind: 'list',
          title: 'Internal recap',
          sourceLine: 1,
          tags: [],
          items: ['This list should not consume a visible practice slot.'],
          ordered: false,
          checklist: false,
        },
        {
          id: 'support-review',
          kind: 'reviewPrompt',
          title: 'Internal review',
          sourceLine: 2,
          tags: [],
          prompt: 'Review this later.',
          reason: 'Support-only content.',
          status: 'needsReview',
        },
      ],
      {
        packId: 'visible-practice',
        title: 'Visible Practice',
        rawNotes: source,
        generationTargets: ['quizzes', 'flashcards', 'summaries'],
        generationAmount: 'few',
        visiblePracticeTarget: 7,
      },
    )
    const visibleObjects = augmented.objects.filter(
      (object) =>
        object.kind === 'quiz' ||
        object.kind === 'qa' ||
        object.kind === 'reveal',
    )

    expect(visibleObjects).toHaveLength(7)
    expect(augmented.visiblePracticeCount).toBe(7)
    expect(
      Math.abs(
        visibleObjects.filter((object) => object.kind === 'quiz').length -
          visibleObjects.filter((object) => object.kind === 'qa').length,
      ),
    ).toBeLessThanOrEqual(1)
  })

  it('rejects subjonctif fragments and creates concrete rule practice', () => {
    const source = `# Le subjonctif present

Au niveau B1
Il est souvent introduit par des expressions de volonte.
du subjonctif présent est relativement régulière pour la
Avoir
Être
But
Cause
Conjonctions de But

La formation du subjonctif présent utilise le radical de la troisième personne du pluriel du présent et les terminaisons -e, -es, -e, -ions, -iez, -ent.
Il faut que introduit le subjonctif pour exprimer une nécessité.
On emploie l'indicatif pour un fait certain, mais le subjonctif pour un doute ou une volonté.
Erreur fréquente: utiliser l'indicatif après il faut que au lieu du subjonctif.`
    const concepts = extractLearningConcepts(source, 'Le subjonctif present')
    const augmented = augmentStudyPackPracticeObjects([], {
      packId: 'subjonctif',
      title: 'Le subjonctif present',
      rawNotes: source,
      generationTargets: ['quizzes', 'flashcards', 'summaries'],
      generationAmount: 'medium',
    })
    const names = concepts.map((concept) => concept.concept)
    const serialized = JSON.stringify(augmented.objects)

    expect(isBadConceptCandidate('Au niveau B1')).toBe(true)
    expect(isBadConceptCandidate('Il est souvent introduit...')).toBe(true)
    expect(
      isBadConceptCandidate(
        'du subjonctif présent est relativement régulière pour la',
      ),
    ).toBe(true)
    expect(isBadConceptCandidate('Avoir')).toBe(true)
    expect(isBadConceptCandidate('Être')).toBe(true)
    expect(isBadConceptCandidate('But')).toBe(true)
    expect(isBadConceptCandidate('Cause')).toBe(true)
    expect(isBadConceptCandidate('Conjonctions de But')).toBe(true)
    expect(names).toEqual(
      expect.arrayContaining([
        'subjonctif formation rule',
        'Subjonctif trigger: Il faut que',
        'subjonctif vs indicative',
        'subjonctif common mistake',
      ]),
    )
    expect(serialized).not.toContain('Au niveau B1')
    expect(serialized).not.toContain(
      'du subjonctif présent est relativement régulière pour la',
    )
    expect(serialized).not.toContain('What does')
    expect(serialized).not.toContain('core idea behind')
    expect(augmented.objects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'quiz',
          question: expect.stringMatching(/form|requires|choose|mistake/i),
        }),
        expect.objectContaining({
          kind: 'qa',
          question: expect.stringMatching(/form|use|decide|mistake/i),
        }),
        expect.objectContaining({
          kind: 'list',
          items: expect.arrayContaining([
            'Formation rules',
            'Triggers and uses',
            'Contrasts',
            'Common mistakes',
          ]),
        }),
      ]),
    )
    expect(
      augmented.objects.filter((object) => object.kind === 'quiz'),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'quiz',
          quizMode: expect.stringMatching(/multipleChoice|shortAnswer/),
        }),
      ]),
    )
  })

  it('creates widgets with study-native blocks and dashboard CustomWidget tabs', () => {
    const pack = parseStudyPack(
      `# Derivatives

| Rule | Formula |
|---|---|
| Power | nx^(n-1) |

Q: What is derivative?
A: Rate of change

Definition:: Power rule: d/dx x^n = nx^(n-1)
Reveal:: Mitosis order | Prophase, metaphase, anaphase
Quiz:: Which rule handles x^n? | Power rule | Chain rule | Product rule
\`\`\`nginx
location / {
  root /var/www/example.com;
}
\`\`\`
review this because it is probably important`,
    )
    const widgets = createStudyPackWidgets(pack, { maxObjectsPerWidget: 12 })
    const layout = createStudyPackDashboardLayout(widgets)

    expect(widgets).toHaveLength(1)
    expect(widgets[0]).toMatchObject({
      name: 'Derivatives',
      category: 'Study Pack',
      tags: ['study-pack', 'markdown-table'],
      author: 'StudyMesh',
    })
    expect(JSON.stringify(widgets[0].components)).toContain('"TableBlock"')
    expect(JSON.stringify(widgets[0].components)).toContain('"FlashcardBlock"')
    expect(JSON.stringify(widgets[0].components)).toContain('"DefinitionBlock"')
    expect(JSON.stringify(widgets[0].components)).toContain('"QuizBlock"')
    expect(JSON.stringify(widgets[0].components)).toContain('"CodeBlock"')
    expect(JSON.stringify(widgets[0].components)).toContain(
      '"ReviewPromptBlock"',
    )
    expect(layout.children?.[0].children?.[0]).toMatchObject({
      type: 'tab',
      name: 'Derivatives',
      component: 'CustomWidget',
      config: {
        customProps: {
          widgetId: widgets[0].id,
        },
      },
    })
  })

  it('creates one markdown block when the study pack source is markdown', () => {
    const pack = parseStudyPack(
      `# Biology

## Cell theory

- Cells are the basic unit of life
- Cells come from existing cells`,
      { sourceFormat: 'markdown' },
    )
    const widgets = createStudyPackWidgets(pack)

    expect(pack.objects).toHaveLength(1)
    expect(widgets).toHaveLength(1)
    expect(widgets[0].components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'MarkdownBlock',
          props: expect.objectContaining({
            __blockType: 'MarkdownBlock',
            title: 'Biology',
            markdown: expect.stringContaining('## Cell theory'),
          }),
        }),
      ]),
    )
  })

  it('splits generated dashboards into smart panes and tabs overflow widgets after four panes', () => {
    const pack = parseStudyPack(
      'Alpha:: one\nBeta:: two\nGamma:: three\nDelta:: four\nEpsilon:: five',
    )
    const widgets = createStudyPackWidgetsFromGroups(pack, [
      { name: 'Widget 1', objects: [pack.objects[0]] },
      { name: 'Widget 2', objects: [pack.objects[1]] },
      { name: 'Widget 3', objects: [pack.objects[2]] },
      { name: 'Widget 4', objects: [pack.objects[3]] },
      { name: 'Widget 5', objects: [pack.objects[4]] },
    ])
    const smartLayout = createStudyPackDashboardLayout(widgets)
    const tabbedLayout = createStudyPackDashboardLayout(widgets, {
      mode: 'tabs',
    })

    expect(smartLayout.children).toHaveLength(2)
    expect(smartLayout.children?.[0].children?.[0].children).toHaveLength(2)
    expect(smartLayout.children?.[1].children?.[0].children).toHaveLength(1)
    expect(tabbedLayout.children?.[0].children).toHaveLength(5)
  })

  it('creates orchestrator widgets with source notes on the left and useful generated widgets on the right', () => {
    const pack = parseStudyPack(
      `Loose sentence that should stay out of generated widgets.

Quiz:: One? | A | B | C
Quiz:: Two? | A | B | C
Quiz:: Three? | A | B | C
Q: Front
A: Back
- first list item
- second list item`,
      { sourceFormat: 'text' },
    )
    const widgets = createStudyPackOrchestratorWidgets(pack, {
      rawSource: 'Raw **source** notes',
    })
    const layout = createStudyPackDashboardLayout(widgets, {
      mode: 'orchestrator',
    })

    expect(widgets[0]).toMatchObject({
      name: `${pack.title} Source`,
      tags: ['study-pack', 'source', 'text'],
    })
    expect(widgets[0].components.map((component) => component.type)).toEqual([
      'Label',
      'MarkdownBlock',
    ])
    expect(widgets[0].components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'MarkdownBlock',
          props: expect.objectContaining({
            markdown: 'Raw **source** notes',
          }),
        }),
      ]),
    )
    expect(widgets.map((widget) => widget.name)).toEqual([
      `${pack.title} Source`,
      `${pack.title} Summary`,
      `${pack.title} Review`,
    ])
    expect(JSON.stringify(widgets.slice(1))).not.toContain('"Chart"')
    expect(JSON.stringify(widgets.slice(1))).not.toContain('StudyNoteBlock')
    expect(layout.children?.[0].children?.[0]).toMatchObject({
      type: 'tab',
      name: `${pack.title} Source`,
    })
    expect(layout.children?.[0].children?.[1]).toMatchObject({
      type: 'tab',
      name: `${pack.title} Summary`,
    })
    expect(layout.children?.[0].weight).toBe(50)
    expect(layout.children?.[1].weight).toBe(50)
    expect(layout.children?.[1].children).toHaveLength(1)
  })

  it('does not create generated widgets when only study notes are detected', () => {
    const pack = parseStudyPack('Loose sentence only', { sourceFormat: 'text' })
    const widgets = createStudyPackOrchestratorWidgets(pack, {
      rawSource: 'Loose sentence only',
    })

    expect(widgets).toHaveLength(2)
    expect(JSON.stringify(widgets)).not.toContain('StudyNoteBlock')
  })

  it('creates right-side generated widgets from prose definitions and facts', () => {
    const source =
      'Photosynthesis is a biological process used by plants, algae, and some bacteria to convert light energy into chemical energy. It usually takes place in chloroplasts that contain chlorophyll. The process produces oxygen as a byproduct and stores energy in sugars. Photosynthesis supports most food chains because organisms depend on plant biomass.'
    const pack = parseStudyPack(source, { sourceFormat: 'text' })
    const widgets = createStudyPackOrchestratorWidgets(pack, {
      rawSource: source,
    })

    expect(pack.objects.map((object) => object.kind)).toEqual([
      'term',
      'list',
      'note',
    ])
    expect(widgets.map((widget) => widget.name)).toEqual([
      `${pack.title} Source`,
      `${pack.title} Summary`,
      `${pack.title} Misc`,
    ])
    expect(JSON.stringify(widgets.slice(1))).toContain('DefinitionBlock')
    expect(JSON.stringify(widgets.slice(1))).toContain('ListBlock')
    expect(JSON.stringify(widgets.slice(1))).not.toContain('StudyNoteBlock')
  })

  it('can create a CSV source widget as a table without the source chart', () => {
    const pack = parseStudyPack('Rule,Formula\nPower,nx^(n-1)', {
      title: 'Rules',
    })
    const widgets = createStudyPackOrchestratorWidgets(pack, {
      includeSummaryChart: false,
      rawSource: 'Rule,Formula\nPower,nx^(n-1)',
    })

    expect(widgets[0]).toMatchObject({
      name: 'Rules Source',
      tags: ['study-pack', 'source', 'csv'],
    })
    expect(widgets[0].components.map((component) => component.type)).toEqual([
      'Label',
      'TableBlock',
    ])
    expect(widgets[0].components[1]).toMatchObject({
      type: 'TableBlock',
      props: expect.objectContaining({
        headers: ['Rule', 'Formula'],
        rows: [['Power', 'nx^(n-1)']],
      }),
    })
    expect(JSON.stringify(widgets)).not.toContain('"Chart"')
  })

  it('renders Study Guide lessons as one learning widget when practice is not useful', () => {
    const pack = parseStudyPack(
      `Quiz:: Which rule handles x^n? | Power rule | Chain rule | Product rule
Q: When is the power rule used?
A: When differentiating x raised to a constant power.`,
      { title: 'Derivatives', sourceFormat: 'text' },
    )
    const widgets = createStudyPackOrchestratorWidgets(pack, {
      rawSource: 'The power rule differentiates x raised to a constant power.',
      studyPath: {
        pathId: 'derivatives-path',
        title: 'Derivatives Path',
        dashboardKey: 'derivatives-path-1',
        dashboardName: '01 - Content 1',
        dashboardIndex: 1,
        dashboardCount: 7,
        folderName: 'Derivatives Path',
        layoutArchetype: 'learnPracticeTabs',
        dashboardPurpose: 'lesson',
        practiceType: 'none',
      },
    })
    const serialized = JSON.stringify(widgets)

    expect(widgets.map((widget) => widget.name)).toEqual(['Derivatives Lesson'])
    expect(serialized).toContain('StudyPathProgressBlock')
    expect(serialized).toContain('studyPathLayoutArchetype')
    expect(serialized).toContain('derivatives-path-1')
    expect(serialized).not.toContain('Derivatives Summary')
    expect(serialized).not.toContain('QuizCarouselBlock')
    expect(serialized).not.toContain('FlashcardCarouselBlock')
  })

  it('adds one right-side QuizCarouselBlock for Study Guide lessons with useful quiz practice', () => {
    const pack = parseStudyPack(
      `Quiz:: Which rule handles x^n? | Power rule | Chain rule | Product rule
Quiz:: What changes when the exponent is 4? | Multiply by 4 and reduce the exponent | Keep the exponent unchanged | Use the product rule
Quiz:: What mistake should you avoid? | Dropping the coefficient | Changing x to y | Ignoring all exponents
Q: When is the power rule used?
A: When differentiating x raised to a constant power.`,
      { title: 'Derivatives', sourceFormat: 'text' },
    )
    const widgets = createStudyPackOrchestratorWidgets(pack, {
      rawSource: 'The power rule differentiates x raised to a constant power.',
      studyPath: {
        pathId: 'derivatives-path',
        title: 'Derivatives Path',
        dashboardKey: 'derivatives-path-2',
        dashboardName: '02 - Practice power rule',
        dashboardIndex: 2,
        dashboardCount: 7,
        folderName: 'Derivatives Path',
        layoutArchetype: 'learnPracticeTabs',
        dashboardPurpose: 'lesson',
        practiceType: 'mixed',
      },
    })
    const layout = createStudyPackDashboardLayout(widgets)
    const serialized = JSON.stringify(widgets)

    expect(widgets.map((widget) => widget.name)).toEqual([
      'Derivatives Lesson',
      'Derivatives Quiz',
    ])
    expect(serialized).toContain('QuizCarouselBlock')
    expect(serialized).not.toContain('FlashcardCarouselBlock')
    expect(layout.children).toHaveLength(2)
    expect(layout.children?.[0]).toMatchObject({ type: 'tabset', weight: 50 })
    expect(layout.children?.[1]).toMatchObject({ type: 'tabset', weight: 50 })
    expect(layout.children?.[0].children?.[0]).toMatchObject({
      type: 'tab',
      name: 'Derivatives Lesson',
    })
    expect(layout.children?.[1].children?.[0]).toMatchObject({
      type: 'tab',
      name: 'Derivatives Quiz',
    })
  })

  it('keeps split reference Study Guide dashboards as one lesson when quiz practice is too thin', () => {
    const pack = parseStudyPack(
      `Quiz:: Which rule handles x^n? | Power rule | Chain rule | Product rule
Q: When is the power rule used?
A: When differentiating x raised to a constant power.`,
      { title: 'Derivatives', sourceFormat: 'text' },
    )
    const widgets = createStudyPackOrchestratorWidgets(pack, {
      rawSource: 'The power rule differentiates x raised to a constant power.',
      studyPath: {
        pathId: 'derivatives-path',
        title: 'Derivatives Path',
        dashboardKey: 'derivatives-path-1',
        dashboardName: '01 - Applied rule',
        dashboardIndex: 1,
        dashboardCount: 3,
        folderName: 'Derivatives Path',
        layoutArchetype: 'splitReferenceExercise',
        dashboardPurpose: 'lesson',
        practiceType: 'quiz',
      },
    })

    expect(widgets.map((widget) => widget.name)).toEqual(['Derivatives Lesson'])
    expect(JSON.stringify(widgets)).not.toContain('QuizCarouselBlock')
  })

  it('renders summary Study Guide dashboards as recap-only', () => {
    const pack = parseStudyPack(
      `- Connect formation and usage rules
Quiz:: Which form is correct? | A | B | C
Q: What should you test?
A: The mixed rules.`,
      { title: 'French Summary', sourceFormat: 'text' },
    )
    const widgets = createStudyPackOrchestratorWidgets(
      { ...pack, dashboardRole: 'summary' },
      {
        rawSource: 'Synthesize the previous dashboards.',
        studyPath: {
          pathId: 'french-path',
          title: 'French Path',
          dashboardKey: 'french-path-4',
          dashboardName: '04 - Summary',
          dashboardIndex: 4,
          dashboardCount: 5,
          folderName: 'French Path',
          dashboardRole: 'summary',
        },
      },
    )
    const serialized = JSON.stringify(widgets)

    expect(widgets.map((widget) => widget.name)).toEqual([
      'French Summary Lesson',
    ])
    expect(serialized).not.toContain('QuizBlock')
    expect(serialized).not.toContain('FlashcardBlock')
    expect(serialized).not.toContain('French Summary Summary')
  })

  it('keeps legacy exercises Study Guide dashboards lesson-clean', () => {
    const pack = parseStudyPack(
      `- This recap should not render on exercises dashboards
Quiz:: Choose the subjunctive form. | partions | partons | partirez
Q: Complete: Il faut que nous ___.
A: partions`,
      { title: 'French Exercises', sourceFormat: 'text' },
    )
    const widgets = createStudyPackOrchestratorWidgets(
      { ...pack, dashboardRole: 'exercises' },
      {
        rawSource: 'Use this dashboard for mixed practice.',
        studyPath: {
          pathId: 'french-path',
          title: 'French Path',
          dashboardKey: 'french-path-5',
          dashboardName: '05 - Exercises',
          dashboardIndex: 5,
          dashboardCount: 5,
          folderName: 'French Path',
          dashboardRole: 'exercises',
        },
      },
    )
    const serialized = JSON.stringify(widgets)

    expect(widgets.map((widget) => widget.name)).toEqual([
      'French Exercises Lesson',
    ])
    expect(serialized).not.toContain('QuizCarouselBlock')
    expect(serialized).not.toContain('FlashcardCarouselBlock')
    expect(serialized).not.toContain('French Exercises Summary')
    expect(serialized).not.toContain('This recap should not render')
  })

  it('renders focus lesson Study Guide dashboards as one learning surface', () => {
    const pack = parseStudyPack(
      `# Concept
Read one careful explanation.
Quiz:: Which answer fits? | A | B | C
Q: What matters?
A: The concept.`,
      { title: 'Focused Concept', sourceFormat: 'text' },
    )
    const widgets = createStudyPackOrchestratorWidgets(pack, {
      rawSource: 'Read one careful explanation.',
      studyPath: {
        pathId: 'focus-path',
        title: 'Focus Path',
        dashboardKey: 'focus-path-1',
        dashboardName: '01 - Concept',
        dashboardIndex: 1,
        dashboardCount: 3,
        folderName: 'Focus Path',
        layoutArchetype: 'focusLesson',
        dashboardPurpose: 'lesson',
        practiceType: 'none',
      },
    })

    expect(widgets.map((widget) => widget.name)).toEqual([
      'Focused Concept Lesson',
    ])
    expect(JSON.stringify(widgets)).not.toContain('QuizCarouselBlock')
    expect(JSON.stringify(widgets)).not.toContain('FlashcardCarouselBlock')
  })

  it('can skip the source widget and use caller-provided widget groups', () => {
    const pack = parseStudyPack(
      `Quiz:: One? | A | B | C
Q: Front
A: Back`,
      { sourceFormat: 'text' },
    )
    const widgets = createStudyPackOrchestratorWidgets(pack, {
      includeSourceWidget: false,
      widgetGroups: [
        {
          name: 'Practice',
          objects: pack.objects.filter((object) => object.kind === 'quiz'),
        },
      ],
    })

    expect(widgets).toHaveLength(1)
    expect(widgets[0].name).toBe('Practice')
    expect(JSON.stringify(widgets)).not.toContain('Source notes')
    expect(JSON.stringify(widgets)).not.toContain('"Chart"')
  })

  it('can force short-answer quizzes to render as QuizBlock components', () => {
    const pack = parseStudyPack('Quiz:: What is a derivative? | Rate of change')
    const widgets = createStudyPackOrchestratorWidgets(pack, {
      forceQuizBlockComponent: true,
      includeSourceWidget: false,
    })
    const serialized = JSON.stringify(widgets)

    expect(pack.objects).toEqual([
      expect.objectContaining({ kind: 'quiz', quizMode: 'shortAnswer' }),
    ])
    expect(serialized).toContain('QuizBlock')
    expect(serialized).not.toContain('QuizzSingle')
    expect(serialized).not.toContain('quiz-single')
  })

  it('renders focused study sessions as carousel blocks', () => {
    const pack = parseStudyPack(
      `Quiz:: One? | A | B | C
Q: Front
A: Back`,
      { sourceFormat: 'text' },
    )
    const quizWidgets = createStudyPackOrchestratorWidgets(pack, {
      focusedResourceType: 'quiz',
      includeSourceWidget: false,
      widgetGroups: [
        {
          name: 'Practice Quiz',
          objects: pack.objects.filter((object) => object.kind === 'quiz'),
        },
      ],
    })
    const flashcardWidgets = createStudyPackOrchestratorWidgets(pack, {
      focusedResourceType: 'flashcards',
      includeSourceWidget: false,
      widgetGroups: [
        {
          name: 'Practice Flashcards',
          objects: pack.objects.filter((object) => object.kind === 'qa'),
        },
      ],
    })

    expect(JSON.stringify(quizWidgets)).toContain('QuizCarouselBlock')
    expect(JSON.stringify(quizWidgets)).not.toContain('QuizBlock')
    expect(JSON.stringify(quizWidgets)).not.toContain('QuizzSingle')
    expect(JSON.stringify(flashcardWidgets)).toContain('FlashcardCarouselBlock')
    expect(JSON.stringify(flashcardWidgets)).not.toContain('FlashcardBlock')
  })
})
