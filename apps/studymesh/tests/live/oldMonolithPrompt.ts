/* eslint-disable */
// Verbatim copy of the pre-change monolith prompt, kept only so the live A/B
// harness can run both rubrics against the same model and cases.
import { createAiOutputLanguageInstruction } from "../../src/language/contentLanguagePrompt";
import type { StudyMeshLanguageCode } from "../../src/language/contentLanguagePrompt";

export const buildOldMonolithGuidePrompt = ({
  topic,
  titleFallback,
  folderNameFallback,
  userKnownTopics,
  outputLanguage,
}: {
  topic: string;
  titleFallback: string;
  folderNameFallback: string;
  userKnownTopics: string[];
  outputLanguage?: StudyMeshLanguageCode;
}): string => `Write a complete, final RabbitHole Study Guide. This is shipped learner-facing content, not a draft or outline.

Return strict JSON only:
{
  "title": "...",
  "folderName": "...",
  "emoji": "one emoji",
  "quickStart": { "keyIdea": "one sentence, max 35 words", "quickSummary": "two short paragraphs" },${
    userKnownTopics.length
      ? `
  "contextPlan": {
    "useForDefault": true,
    "selectedTopics": ["..."],
    "reason": "...",
    "personalizedQuickStart": { "keyIdea": "...", "quickSummary": "..." },
    "bridgeBlock": { "title": "...", "body": "..." }
  },`
      : ""
  }
  "pages": [
    { "title": "01 - ...", "summary": "one preview sentence", "rawNotes": "Markdown lesson notes" }
  ]
}

Rules:
- ${createAiOutputLanguageInstruction(outputLanguage)}
- Exactly 3 pages, each 280-360 words of rawNotes in readable Markdown with short topic-specific sections.
- Precise, conservative facts only, with a beginner-friendly progression across the pages.
- Finish every paragraph and the final line of each page as a complete sentence. Never end rawNotes mid-thought.
- For programming, framework, DevOps, IaC, config, or command-line topics, include at least one real minimal fenced code/config/command snippet with a language tag.
- Never write placeholder snippets or placeholder comments like "arguments would go here", "component logic goes here", or "configuration would go here".
- For non-code topics, use concrete examples, timelines, scenarios, or comparisons instead of code.
- quickStart explains the concept itself directly and neutrally, not the guide structure. Do not write "This guide teaches...", "You will learn...", or similar framing.
- keyIdea: exactly one complete sentence, 20-35 words, ending in a period. Never write a second sentence and never run past 35 words, because keyIdea is hard-capped at 35 words downstream.
- quickSummary: 60-85 words, 2 short paragraphs, every paragraph ends with a complete sentence.
- Choose a concise, topic-specific folderName and exactly one topic-matching emoji.
- Do not include quiz questions inside rawNotes.${
  userKnownTopics.length
    ? `
- The learner already knows these candidate topics: ${userKnownTopics.join(
        ", ",
      )}.
- contextPlan.selectedTopics: always rank the candidates and choose the 1 that best reduces confusion for this topic (2 only if both are clearly relevant and same-domain). Never invent topics. Do not return [] merely because every candidate is a weak or cross-domain match; return [] only if every candidate would actively mislead, be unsafe, or be dehumanizing.
- contextPlan.useForDefault: true only when the selected candidate genuinely reduces cognitive effort through a precise, same-domain comparison; otherwise false. A weak but honest bridge still gets a selected topic with useForDefault false.
- contextPlan.personalizedQuickStart: always write this variant. It is an opt-in view the learner opens themselves, so write it even when useForDefault is false; it never replaces the neutral Quick Start unless useForDefault is true. Build it through the selected topic. If the bridge is strong, the selected topic must lead. If it is weak or cross-domain, explain the topic neutrally first, use the selected topic as one short honest contrast, and say plainly where the comparison breaks. quickSummary 60-85 words, complete sentences.
- If selectedTopics is [], still write personalizedQuickStart as a neutral beginner-friendly Quick Start with one caveat or common misconception, and invent no bridge.
- contextPlan.bridgeBlock: one short study note connecting a concept from page 2 to the selected topic, with one caveat. body under 85 words, ending with a complete sentence.
- contextPlan.reason: if useForDefault is false (a weak bridge), 6-12 words stating specifically why this topic is not the best fit for the learner's prompt (e.g. "different domain — only shares vocabulary, not underlying mechanics"). If useForDefault is true, one short sentence on why the selected topic was chosen.
- For topics involving identity, history, politics, culture, or people, keep the bridge factual and avoid reductive claims. For human or management topics, do not compare people to infrastructure, tools, or machines.`
    : ""
}

Title fallback: ${titleFallback}
Folder fallback: ${folderNameFallback}
Learner request/topic:
${topic}`;

// HEAD's contextPlan schema shape, for the old arm of the A/B.
export const OLD_CONTEXT_PLAN_SCHEMA = {
  type: "OBJECT",
  properties: {
    useForDefault: { type: "BOOLEAN" },
    selectedTopics: { type: "ARRAY", items: { type: "STRING" } },
    reason: { type: "STRING" },
    personalizedQuickStart: {
      type: "OBJECT",
      properties: {
        keyIdea: { type: "STRING" },
        quickSummary: { type: "STRING" },
      },
      required: ["keyIdea", "quickSummary"],
    },
    bridgeBlock: {
      type: "OBJECT",
      properties: { title: { type: "STRING" }, body: { type: "STRING" } },
      required: ["title", "body"],
    },
  },
  required: [
    "useForDefault",
    "selectedTopics",
    "reason",
    "personalizedQuickStart",
    "bridgeBlock",
  ],
};
