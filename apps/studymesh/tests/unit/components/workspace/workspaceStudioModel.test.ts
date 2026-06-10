import { describe, expect, it } from 'vitest'

import {
  createGenerationDraft,
  quickCreateLabels,
} from '../../../../src/components/workspace/workspaceStudioModel'

describe('workspaceStudioModel Quick Create', () => {
  it('uses Quick Create as the context-based creation flow', () => {
    const draft = createGenerationDraft('quick-create')

    expect(draft.flow).toBe('quick-create')
    expect(draft.inputSummary).toBe('Current dashboard')
    expect(quickCreateLabels).toMatchObject({
      quiz: 'Quiz',
      flashcards: 'Flashcards',
      improvedNotes: 'Expand on this',
    })
  })
})
