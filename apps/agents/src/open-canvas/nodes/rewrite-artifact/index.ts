import { v4 as uuidv4 } from "uuid";
import { format } from "date-fns";
import {
  OpenCanvasGraphAnnotation,
  OpenCanvasGraphReturnType,
} from "../../state";
import { ArtifactV3 } from "@opencanvas/shared/types";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { optionallyUpdateArtifactMeta } from "./update-meta";
import {
  buildPrompt,
  createNewArtifactContent,
  saveArtifactsToFile,
  saveBestArtifactToFile,
  validateState,
} from "./utils";
import {
  createContextDocumentMessages,
  getFormattedReflections,
  getModelConfig,
  getModelFromConfig,
  getRequirementsContext,
  isUsingO1MiniModel,
  optionallyGetSystemPromptFromConfig,
} from "@/utils";
import { isArtifactMarkdownContent } from "@opencanvas/shared/utils/artifacts";
import { AIMessage } from "@langchain/core/messages";
import {
  extractThinkingAndResponseTokens,
  isThinkingModel,
} from "@opencanvas/shared/utils/thinking";
import { ArticleEvaluation, evaluateArtifact } from "./evaluation";
import { VALIDATION_HTML_PROMPT } from "@/open-canvas/prompts";
import { OC_WEB_SEARCH_RESULTS_MESSAGE_KEY } from "@opencanvas/shared/constants";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { SimpleLLMLogger, extractSystemPrompt, extractUserPrompt, extractOutputContent, extractRequestInfo } from "@/open-canvas/utils/llm-logger";

const SMALL_MODEL_NAME = "gemini-2.5-flash";
const MAX_PAGE_COUNT = 3;
const MAX_ITERATIONS = 5;
const MIN_ACCEPTABLE_SCORE = 90;

/**
 * Initialize artifact if missing
 */
const initializeArtifactIfMissing = (state: typeof OpenCanvasGraphAnnotation.State): ArtifactV3 => {
  if (!state.artifact) {
    return {
      currentIndex: 0,
      contents: [
        {
          index: 0,
          type: "text",
          fullMarkdown: "",
          title: "",
        },
      ],
    } as ArtifactV3;
  }
  return state.artifact;
};

/**
 * Get content from artifact
 */
const getArtifactContent = (currentArtifactContent: any): string => {
  return isArtifactMarkdownContent(currentArtifactContent)
    ? currentArtifactContent.fullMarkdown
    : currentArtifactContent.code;
};

/**
 * Get web search results from state
 */
const getWebSearchResults = (state: typeof OpenCanvasGraphAnnotation.State): string => {
  const webSearchResults = state._messages.find(
    (m) => m.additional_kwargs?.[OC_WEB_SEARCH_RESULTS_MESSAGE_KEY]
  );
  return (webSearchResults?.content as string) || "No web search results found.";
};

/**
 * Format evaluation results
 */
const formatEvaluationResults = (
  evaluationResults: ArticleEvaluation | null
): string => {
  if (!evaluationResults) return "No previous evaluation results";

  const article = evaluationResults.details.articleComparison.find(
    (ac) => ac.articleId === evaluationResults.bestArticle.id
  );

  if (!article) return "No previous evaluation results";

  return `
Content Preferences Score: ${article.contentPreferences.score}
Style Preferences Score: ${article.stylePreferences.score}
Strengths:
${article.overall.strengths.map((s) => `- ${s}`).join("\n")}
Weaknesses:
${article.overall.weaknesses.map((w) => `- ${w}`).join("\n")}
`;
};

/**
 * Generate article contents with AI model
 */
const generateArticleContents = async (
  model: any,
  systemPrompt: string,
  contextDocumentMessages: any[],
  recentHumanMessage: any,
  isO1MiniModel: boolean,
  iteration: number,
  state: typeof OpenCanvasGraphAnnotation.State,
  config: LangGraphRunnableConfig,
  requestInfo: { threadId?: string; requestId: string; timestamp: string }
): Promise<Array<{ id: string; content: string }>> => {
  const results = await Promise.all(
    Array(MAX_PAGE_COUNT)
      .fill(null)
      .map(async (_, index) => {
        let responseContent = "";
        let error;

        const messages = [
          { role: isO1MiniModel ? "user" : "system", content: systemPrompt },
          ...contextDocumentMessages,
          recentHumanMessage,
        ];

        try {
          const stream = await model.stream(messages);

          for await (const chunk of stream) {
            if (chunk.content) {
              responseContent += chunk.content;
            }
          }
        } catch (e) {
          error = e instanceof Error ? e.message : String(e);
          throw e;
        } finally {
          await SimpleLLMLogger.logLLMStep(
            `generateArticleContents_iteration_${iteration}_article_${index + 1}`,
            extractSystemPrompt(messages),
            extractUserPrompt(messages),
            extractOutputContent(responseContent),
            requestInfo
          );
        }

        return {
          id: `article_${index + 1}`,
          content: responseContent,
        };
      })
  );

  return results;
};

/**
 * Save artifacts to file with evaluation results
 */
const saveAllArtifacts = async (
  timestamp: string,
  uuid: string,
  contents: Array<{ id: string; content: string }>,
  evaluationResult: ArticleEvaluation | null,
  recentHumanMessage: any,
  fullSystemPrompt: string,
  artifactContent: string,
  iteration: number,
  webDSL: any
): Promise<void> => {
  try {
    await saveArtifactsToFile(`rewrite_artifact_set_${timestamp}_${uuid}`, {
      artifacts: contents.map((c, index) => {
        const articleComparison = evaluationResult?.details.articleComparison.find(
          (ac) => ac.articleId === c.id
        );
        return {
          content: c.content.replace(/```html\n|```/g, ""),
          filename: `artifact_${index}_score_${articleComparison?.overall.totalScore || 0}.html`,
          rating: articleComparison,
          userPrompt: recentHumanMessage.content,
        };
      }),
      userPrompt: recentHumanMessage.content,
      systemPrompt: fullSystemPrompt,
      originalArtifact: {
        content: artifactContent,
        filename: `original_artifact.txt`,
        userPrompt: recentHumanMessage.content,
      },
      iteration: iteration,
      evaluationResults: evaluationResult,
      webDSL: webDSL,
    });
  } catch (error) {
    console.error("Error saving artifacts to file:", error);
  }
};

/**
 * Save best artifact to file
 */
const saveBestArtifact = async (
  timestamp: string,
  uuid: string,
  evaluationResults: ArticleEvaluation | null,
  iterations: number,
  recentHumanMessage: any
): Promise<void> => {
  try {
    if (!evaluationResults) return;

    const articleComparison = evaluationResults.details.articleComparison.find(
      (ac) => ac.articleId === evaluationResults.bestArticle.id
    );

    await saveBestArtifactToFile(`rewrite_artifact_set_${timestamp}_${uuid}`, {
      content: evaluationResults.bestArticle.content.replace(/```html\n|```/g, "") || "",
      filename: `iterations_${iterations}_${evaluationResults.bestArticle.id}_score_${articleComparison?.overall.totalScore || 0
        }.html`,
      rating: articleComparison,
      userPrompt: recentHumanMessage.content,
    });
  } catch (error) {
    console.error("Error saving best artifact to file:", error);
  }
};

/**
 * Validate and fix HTML
 */
const validateAndFixHtml = async (
  html: string,
  smallModel: any,
  state: typeof OpenCanvasGraphAnnotation.State,
  config: LangGraphRunnableConfig,
  requestInfo: { threadId?: string; requestId: string; timestamp: string }
): Promise<string> => {
  let validationResponse;
  let error;

  const messages = [
    { role: "system", content: VALIDATION_HTML_PROMPT },
    { role: "user", content: html },
  ];

  try {
    validationResponse = await smallModel.invoke(messages);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    throw e;
  } finally {
    await SimpleLLMLogger.logLLMStep(
      "validateAndFixHtml",
      extractSystemPrompt(messages),
      extractUserPrompt(messages),
      extractOutputContent(validationResponse),
      requestInfo
    );
  }

  return validationResponse.content as string;
};

/**
 * Run the article generation iterations
 */
const runGenerationIterations = async (
  state: typeof OpenCanvasGraphAnnotation.State,
  config: LangGraphRunnableConfig,
  model: any,
  smallModel: any,
  recentHumanMessage: any,
  contextDocumentMessages: any[],
  isO1MiniModel: boolean,
  artifactContent: string,
  memoriesAsString: string,
  isNewType: boolean,
  artifactMetaToolCall: any,
  webSearchResultsContent: string,
  requirementsContext: string,
  webDSL: any,
  requestInfo: { threadId?: string; requestId: string; timestamp: string }
): Promise<{
  validatedHtml: string;
  evaluationResults: ArticleEvaluation | null;
}> => {
  let evaluationResults: ArticleEvaluation | null = null;
  let iterations = 0;
  const timestamp = format(new Date(), "yyyy-MM-dd-HH-mm-ss");
  const uuid = uuidv4();

  while (iterations < MAX_ITERATIONS) {
    const formattedEvaluationResults = formatEvaluationResults(evaluationResults);

    const formattedPrompt = buildPrompt({
      artifactContent: evaluationResults ? evaluationResults.bestArticle.content : artifactContent,
      memoriesAsString,
      isNewType,
      artifactMetaToolCall,
      webSearchResults: webSearchResultsContent,
      requirementsAnalysis: requirementsContext,
      evaluationResults: formattedEvaluationResults,
      webDSL: iterations < 1 ? webDSL : null,
    });

    const userSystemPrompt = optionallyGetSystemPromptFromConfig(config);
    const fullSystemPrompt = userSystemPrompt
      ? `${userSystemPrompt}\n${formattedPrompt}`
      : formattedPrompt;

    const contents = await generateArticleContents(
      model,
      fullSystemPrompt,
      contextDocumentMessages,
      recentHumanMessage,
      isO1MiniModel,
      iterations + 1,
      state,
      config,
      requestInfo
    );

    const result = await evaluateArtifact(contents, iterations + 1, state, config);

    await saveAllArtifacts(
      timestamp,
      uuid,
      contents,
      result,
      recentHumanMessage,
      fullSystemPrompt,
      artifactContent,
      iterations + 1,
      webDSL
    );

    if ((result?.bestArticle.score || 0) >= (evaluationResults?.bestArticle.score || 0)) {
      evaluationResults = result;
    }

    if ((evaluationResults?.bestArticle.score || 0) >= MIN_ACCEPTABLE_SCORE) {
      break;
    }

    console.log(`[Iteration ${iterations + 1}] current best version: ${evaluationResults?.bestArticle.score}`);
    iterations++;
  }

  await saveBestArtifact(timestamp, uuid, evaluationResults, iterations, recentHumanMessage);

  const validatedHtml = await validateAndFixHtml(
    evaluationResults?.bestArticle.content || "",
    smallModel,
    state,
    config,
    requestInfo
  );

  return { validatedHtml, evaluationResults };
};

/**
 * Main function to rewrite artifact
 */
export const rewriteArtifact = async (
  state: typeof OpenCanvasGraphAnnotation.State,
  config: LangGraphRunnableConfig
): Promise<OpenCanvasGraphReturnType> => {
  // Extract request info for logging consistency
  const requestInfo = extractRequestInfo(config);

  const { modelName } = getModelConfig(config);
  const model = await getModelFromConfig(config);
  const smallModel = new ChatGoogleGenerativeAI({
    model: SMALL_MODEL_NAME,
    temperature: 0.2,
  }).withConfig({
    runName: "rewrite_artifact_model_call",
  });

  const memoriesAsString = await getFormattedReflections(config);

  // Initialize artifact if missing
  state.artifact = initializeArtifactIfMissing(state);

  const { currentArtifactContent, recentHumanMessage } = validateState(state);

  // Get artifact metadata
  const artifactMetaToolCall = await optionallyUpdateArtifactMeta(state, config);
  const artifactType = artifactMetaToolCall.type;
  const isNewType = artifactType !== currentArtifactContent.type;

  // Get current artifact content
  const artifactContent = getArtifactContent(currentArtifactContent);

  // Get context data
  const requirementsContext = getRequirementsContext(state.analyzedRequirements);
  const webSearchResultsContent = getWebSearchResults(state);
  const contextDocumentMessages = await createContextDocumentMessages(config);
  const isO1MiniModel = isUsingO1MiniModel(config);
  const webDSL = state.webDSL;

  // Run the generation iterations
  const { validatedHtml, evaluationResults } = await runGenerationIterations(
    state,
    config,
    model,
    smallModel,
    recentHumanMessage,
    contextDocumentMessages,
    isO1MiniModel,
    artifactContent,
    memoriesAsString,
    isNewType,
    artifactMetaToolCall,
    webSearchResultsContent,
    requirementsContext,
    webDSL,
    requestInfo
  );

  // Handle thinking message if applicable
  let thinkingMessage: AIMessage | undefined;
  let artifactContentText = validatedHtml;

  if (isThinkingModel(modelName)) {
    const { thinking, response } = extractThinkingAndResponseTokens(artifactContentText);
    thinkingMessage = new AIMessage({
      id: `thinking-${uuidv4()}`,
      content: thinking,
    });
    artifactContentText = response;
  }

  // Create new artifact content
  const newArtifactContent = createNewArtifactContent({
    artifactType,
    state,
    currentArtifactContent,
    artifactMetaToolCall,
    newContent: artifactContentText,
  });

  // Return updated state
  return {
    artifact: {
      ...state.artifact,
      currentIndex: state.artifact.contents.length + 1,
      contents: [...state.artifact.contents, newArtifactContent],
    },
    messages: [...(thinkingMessage ? [thinkingMessage] : [])],
    _messages: [...(thinkingMessage ? [thinkingMessage] : [])],
  };
};
