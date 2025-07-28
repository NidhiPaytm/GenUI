import { PROGRAMMING_LANGUAGES } from "@opencanvas/shared/constants";
import { z } from "zod";

export const OPTIONALLY_UPDATE_ARTIFACT_META_SCHEMA = z
  .object({
    type: z.enum(["text"]).describe("The type of the artifact content."),
    title: z
      .string()
      .optional()
      .describe(
        "The new title to give the artifact. ONLY update this if the user is making a request which changes the subject/topic of the artifact."
      ),
    language: z
      .enum(
        PROGRAMMING_LANGUAGES.map((lang) => lang.language) as [
          string,
          ...string[],
        ]
      )
      .describe(
        "The language of the code artifact. This should be populated with the programming language if the user is requesting code to be written, or 'other', in all other cases."
      ),
  })
  .describe("Update the artifact meta information, if necessary.");

export const DYNAMIC_EVALUATION_METRICS_SCHEMA = z.object({
  metrics: z.array(z.object({
    name: z.string().describe("Name of the evaluation metric"),
    description: z.string().describe("Description of what this metric evaluates"),
    weight: z.number().min(0).max(1).describe("Weight of this metric in the overall score"),
    criteria: z.array(z.string()).describe("Specific criteria to evaluate for this metric")
  }))
}).describe("Dynamic evaluation metrics based on requirements analysis");

export const UI_EVALUATION_SCHEMA = z.object({
  articleComparison: z.array(z.object({
    articleId: z.string().describe("Unique identifier for the article"),
    scores: z.array(z.object({
      score: z.number().min(0).max(100).describe("Score for this metric"),
      comment: z.string().describe("One-sentence evaluation comment for this metric")
    })),
    contentPreferences: z.object({
      score: z.number().min(0).max(100).describe("Score for how well the article matches user's content preferences"),
      comment: z.string().describe("One-sentence evaluation of content preferences match")
    }),
    stylePreferences: z.object({
      score: z.number().min(0).max(100).describe("Score for how well the article matches user's style preferences"),
      comment: z.string().describe("One-sentence evaluation of style preferences match")
    }),
    overall: z.object({
      totalScore: z.number().min(0).max(100).describe("Final score for this article"),
      strengths: z.array(z.string()).describe("Key strengths in one sentence each"),
      weaknesses: z.array(z.string()).describe("Key weaknesses in one sentence each")
    })
  })),
  bestArticle: z.object({
    articleId: z.string().describe("Identifier of the best article"),
    totalScore: z.number().min(0).max(100).describe("Total score of the best article"),
    justification: z.string().describe("One-sentence justification for why this is the best article")
  })
}).describe("Article comparison schema for evaluating HTML pages");

