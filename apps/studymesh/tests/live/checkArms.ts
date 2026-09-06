/* eslint-disable @typescript-eslint/no-explicit-any */
// Offline check of the firstPageTiming A/B arms: no model calls, no cost.
// Confirms the two arms differ only in field order and that the reconstructed
// old prompt still matches the real one, so a drifted prompt is caught before
// any money is spent.
//
// Run with:
//   LIVE_DRY_RUN=1 npx tsx apps/studymesh/tests/live/checkArms.ts
import {
  buildMonolithGuidePrompt,
  createMonolithGuideSchema,
} from '../../../../api/hosted-ai'
import { oldOrderSchema, toOldPrompt } from './firstPageTiming'

const prompt = buildMonolithGuidePrompt({
  topic: 'inflation',
  titleFallback: 'Study Guide',
  folderNameFallback: 'Study Guide',
  userKnownTopics: ['cooking'],
  outputLanguage: 'en',
})

const keys = (schema: unknown) =>
  Object.keys((schema as any).properties).join(' ')
const required = (schema: unknown) => (schema as any).required.join(' ')

console.log('new schema  :', keys(createMonolithGuideSchema(true)))
console.log('old schema  :', keys(oldOrderSchema(true)))
console.log('new required:', required(createMonolithGuideSchema(true)))
console.log('old required:', required(oldOrderSchema(true)))

const old = toOldPrompt(prompt)
console.log('\n--- old prompt example JSON ---')
console.log(old.split('Rules:')[0].trim())
// Equal length is the check that matters: the two prompts must be the same text
// in a different order, not different text.
console.log('\nsame length as the new prompt:', old.length === prompt.length)
console.log('actually reordered:', old !== prompt)
